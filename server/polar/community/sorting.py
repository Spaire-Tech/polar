from enum import StrEnum


class CommunityPostSortProperty(StrEnum):
    """Feed sort options surfaced as the left-rail "Sort" list. Not a
    free-form column sort — these are pre-baked queries the repository
    knows how to apply."""

    # Default: coalesce(pinned_at, published_at) DESC, id DESC.
    recent = "recent"

    # Top this week: most-reacted posts in the last 7 days.
    top_week = "top_week"

    # Only posts tagged 'question' that have zero comments. Resolves to
    # "no replies yet" in the feed header.
    unanswered = "unanswered"


# Seed tag slugs from the migration. Referenced by the milestone task and
# the default filter-chip set; the labels stay creator-renamable but the
# slugs are stable identifiers the code looks up by.
COMMUNITY_TAG_SLUGS_SEEDED = ("question", "win", "prompt", "milestone")
