import asyncio
import logging.config
from functools import wraps
from typing import Any, cast

import structlog
import typer
from sqlalchemy import func, select, text
from sqlalchemy.engine import CursorResult

from polar.config import settings
from polar.event.system import SystemEvent
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.kit.db.postgres import create_async_engine as _create_async_engine
from polar.models import Event
from polar.models.event import EventSource

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def fix_balance_order_timestamps(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Fix balance.order event timestamps to match order.created_at.
    """
    typer.echo("\n=== Fixing balance.order event timestamps ===")

    count_result = await session.execute(
        select(func.count(Event.id)).where(
            Event.source == EventSource.system,
            Event.name == SystemEvent.balance_order,
        )
    )
    total_events = count_result.scalar() or 0
    typer.echo(f"Found {total_events} balance.order events to check")

    mismatched_result = await session.execute(
        text("""
            SELECT COUNT(*)
            FROM events e
            JOIN orders o ON (e.user_metadata->>'order_id')::uuid = o.id
            WHERE e.source = 'system'
              AND e.name = 'balance.order'
              AND e.timestamp != o.created_at
        """)
    )
    mismatched_count = mismatched_result.scalar() or 0
    typer.echo(f"Found {mismatched_count} events with mismatched timestamps")

    if mismatched_count == 0:
        typer.echo("No timestamps to fix")
        return 0

    updated_result = await session.execute(
        text("""
            UPDATE events e
            SET timestamp = o.created_at
            FROM orders o
            WHERE (e.user_metadata->>'order_id')::uuid = o.id
              AND e.source = 'system'
              AND e.name = 'balance.order'
              AND e.timestamp != o.created_at
        """)
    )
    await session.commit()

    updated_count = cast(CursorResult[Any], updated_result).rowcount
    typer.echo(f"Updated {updated_count} event timestamps")
    return updated_count


async def delete_duplicate_balance_order_events(
    session: AsyncSession,
    batch_size: int,
    rate_limit_delay: float,
) -> int:
    """
    Delete duplicate balance.order events, keeping only the oldest one per order.
    """
    typer.echo("\n=== Deleting duplicate balance.order events ===")

    duplicate_count_result = await session.execute(
        text("""
            SELECT COUNT(*) FROM (
                SELECT user_metadata->>'order_id' as order_id, COUNT(*) as cnt
                FROM events
                WHERE source = 'system'
                  AND name = 'balance.order'
                GROUP BY user_metadata->>'order_id'
                HAVING COUNT(*) > 1
            ) dupes
        """)
    )
    orders_with_dupes = duplicate_count_result.scalar() or 0

    if orders_with_dupes == 0:
        typer.echo("No duplicate events to delete")
        return 0

    typer.echo(f"Found {orders_with_dupes} orders with duplicate balance.order events")

    deleted_result = await session.execute(
        text("""
            DELETE FROM events
            WHERE id IN (
                SELECT id FROM (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY user_metadata->>'order_id'
                            ORDER BY created_at ASC
                        ) as rn
                    FROM events
                    WHERE source = 'system'
                      AND name = 'balance.order'
                ) ranked
                WHERE rn > 1
            )
        """)
    )
    await session.commit()

    deleted_count = cast(CursorResult[Any], deleted_result).rowcount
    typer.echo(f"Deleted {deleted_count} duplicate events")
    return deleted_count


async def run_fix(
    batch_size: int = settings.DATABASE_STREAM_YIELD_PER,
    rate_limit_delay: float = 0.5,
    session: AsyncSession | None = None,
) -> dict[str, int]:
    """
    Run all fix operations for balance.order events.
    """
    engine = None
    own_session = False

    if session is None:
        engine = _create_async_engine(
            dsn=str(settings.get_postgres_dsn("asyncpg")),
            application_name=f"{settings.ENV.value}.script",
            debug=False,
            pool_size=settings.DATABASE_POOL_SIZE,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            command_timeout=settings.DATABASE_COMMAND_TIMEOUT_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)
        session = sessionmaker()
        own_session = True

    results: dict[str, int] = {}

    try:
        results["timestamps_fixed"] = await fix_balance_order_timestamps(
            session, batch_size, rate_limit_delay
        )

        results["duplicates_deleted"] = await delete_duplicate_balance_order_events(
            session, batch_size, rate_limit_delay
        )

        typer.echo("\n" + "=" * 50)
        typer.echo("BALANCE ORDER EVENT FIX SUMMARY")
        typer.echo("=" * 50)
        for key, value in results.items():
            typer.echo(f"  {key}: {value}")
        typer.echo("=" * 50 + "\n")

    finally:
        if own_session:
            await session.close()
        if engine is not None:
            await engine.dispose()

    return results


@cli.command()
@typer_async
async def fix(
    batch_size: int = typer.Option(
        settings.DATABASE_STREAM_YIELD_PER,
        help="Number of records to process per batch",
    ),
    rate_limit_delay: float = typer.Option(
        0.5, help="Delay in seconds between batches"
    ),
) -> None:
    """
    Fix balance.order events:
    1. Update timestamps to match order.created_at
    2. Delete duplicate events (keeping oldest per order)
    """
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": True,
            "handlers": {
                "default": {
                    "level": "DEBUG",
                    "class": "logging.StreamHandler",
                },
            },
            "root": {
                "handlers": ["default"],
                "level": "WARNING",
            },
        }
    )
    structlog.configure(
        processors=[drop_all],
        wrapper_class=structlog.BoundLogger,
        cache_logger_on_first_use=True,
    )

    await run_fix(batch_size=batch_size, rate_limit_delay=rate_limit_delay)


if __name__ == "__main__":
    cli()
