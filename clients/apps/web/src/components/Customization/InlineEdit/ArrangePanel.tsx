'use client'

import { CATEGORY_LABELS } from '@/components/Profile/categoryLabels'
import { StorefrontLinkItem } from '@/components/Profile/StorefrontLinks'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined'
import KeyboardArrowUpOutlined from '@mui/icons-material/KeyboardArrowUpOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { schemas } from '@spaire/client'
import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'

/**
 * Arrange panel — single source of truth for ordering everything on
 * the Space. Design rules:
 *
 *  • One DndContext per kind (products / links). No nesting — nested
 *    SortableContexts cause dnd-kit's collision detection to fight
 *    itself on the boundaries.
 *  • Categories are NOT draggable here. They get ↑/↓ buttons because
 *    a one-click swap is unambiguous and a category drag in a flat
 *    list creates more confusion than it solves.
 *  • Cross-category drag is rejected: a product's category is a
 *    property of the product, not of its slot in the list, so moving
 *    a t-shirt under "Courses" can't actually relocate it on the
 *    storefront. We snap back instead.
 *  • Hide (eye-off) vs Delete (trash) are different actions:
 *    products hide reversibly (recoverable from "Hidden products"),
 *    links delete permanently after a confirm.
 */

type Settings = NonNullable<schemas['OrganizationStorefrontSettings']>

const PRODUCT_PREFIX = 'p:'
const LINK_PREFIX = 'l:'
const EMBED_PREFIX = 'e:'

// ─── Generic sortable row ────────────────────────────────────────
const SortableRow = ({
  id,
  className = '',
  children,
}: {
  id: string
  className?: string
  children: (handle: {
    listeners: ReturnType<typeof useSortable>['listeners']
    attributes: ReturnType<typeof useSortable>['attributes']
    isDragging: boolean
  }) => React.ReactNode
}) => {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    listeners,
    attributes,
  } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`ap-sortable ${className} ${isDragging ? 'ap-is-dragging' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children({ listeners, attributes, isDragging })}
    </div>
  )
}

const Grip = ({
  listeners,
  attributes,
  label,
}: {
  listeners: ReturnType<typeof useSortable>['listeners']
  attributes: ReturnType<typeof useSortable>['attributes']
  label: string
}) => (
  <button
    type="button"
    className="ap-grip"
    aria-label={label}
    {...listeners}
    {...attributes}
  >
    <DragIndicatorOutlined style={{ fontSize: 18 }} />
  </button>
)

// ─── Panel ───────────────────────────────────────────────────────
export const ArrangePanel = ({
  organization,
  products,
  onClose,
}: {
  organization: schemas['Organization']
  products: schemas['ProductStorefront'][]
  onClose: () => void
}) => {
  const { watch, setValue } = useFormContext<schemas['OrganizationUpdate']>()
  const watched = watch()
  const settings = (watched.storefront_settings ??
    organization.storefront_settings ??
    {}) as Settings

  const featuredMode = settings.featured_mode ?? 'curated'
  const featuredIds = settings.featured_product_ids ?? []
  const categoryOrder =
    (settings as { category_order?: string[] }).category_order ?? []
  const links = (settings.storefront_links ?? []) as StorefrontLinkItem[]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const writeSettings = (patch: Partial<Settings>) => {
    setValue(
      'storefront_settings',
      { ...settings, ...patch } as Settings,
      { shouldDirty: true },
    )
  }

  // Defense: never persist ids that don't correspond to a real
  // product. Stops archived products resurfacing via a drag.
  const cleanFeaturedIds = (ids: string[]) => {
    const valid = new Set(products.map((p) => p.id))
    return ids.filter((id) => valid.has(id))
  }

  // Visible product list — same scope + ranking the canvas + public
  // storefront use.
  const visibleProducts = useMemo(() => {
    const scoped =
      featuredMode === 'curated'
        ? products.filter((p) => featuredIds.includes(p.id))
        : products
    if (featuredIds.length === 0) return scoped
    const rank = new Map(featuredIds.map((id, i) => [id, i]))
    const ranked = scoped
      .filter((p) => rank.has(p.id))
      .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
    const unranked = scoped.filter((p) => !rank.has(p.id))
    return [...ranked, ...unranked]
  }, [products, featuredMode, featuredIds])

  // Group into category buckets in the user's declared order. Unlike
  // the canvas we expose the list directly per-section so each
  // section can have its own flat DnD context.
  const sections = useMemo(() => {
    const buckets: Record<string, schemas['ProductStorefront'][]> = {}
    const uncategorized: schemas['ProductStorefront'][] = []
    for (const p of visibleProducts) {
      const cat = p.category
      if (cat && cat in CATEGORY_LABELS) (buckets[cat] ??= []).push(p)
      else uncategorized.push(p)
    }
    const present = Object.keys(buckets).filter(
      (k) => k !== 'other' && buckets[k].length > 0 && k in CATEGORY_LABELS,
    )
    const rank = new Map(categoryOrder.map((k, i) => [k, i]))
    const ranked = present
      .filter((k) => rank.has(k))
      .sort((a, b) => rank.get(a)! - rank.get(b)!)
    const unranked = (
      Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>
    ).filter(
      (k) => k !== 'other' && present.includes(k) && !rank.has(k),
    )
    const orderedKeys = [...ranked, ...unranked]
    const out = orderedKeys.map((k) => ({
      key: k as string,
      label: CATEGORY_LABELS[k],
      items: buckets[k],
    }))
    const otherItems = [...(buckets.other ?? []), ...uncategorized]
    if (otherItems.length > 0) {
      out.push({
        key: 'other',
        label: CATEGORY_LABELS.other,
        items: otherItems,
      })
    }
    return out
  }, [visibleProducts, categoryOrder])

  // ── Mutations ────────────────────────────────────────────────
  // Reorder one product within its own section. Cross-section drops
  // are rejected at the caller. The new section order is woven back
  // into featured_product_ids without touching ids outside the
  // section and without ever introducing new ids.
  const reorderWithinSection = (
    sectionKey: string,
    fromId: string,
    toId: string,
  ) => {
    const section = sections.find((s) => s.key === sectionKey)
    if (!section) return
    const sectionIds = section.items.map((p) => p.id)
    const from = sectionIds.indexOf(fromId)
    const to = sectionIds.indexOf(toId)
    if (from < 0 || to < 0 || from === to) return
    const newSectionOrder = arrayMove(sectionIds, from, to)

    const inSection = new Set(sectionIds)
    const queue = [...newSectionOrder]
    const woven: string[] = []
    for (const id of featuredIds) {
      if (inSection.has(id)) {
        const next = queue.shift()
        if (next) woven.push(next)
      } else {
        woven.push(id)
      }
    }
    for (const id of queue) woven.push(id)
    writeSettings({ featured_product_ids: cleanFeaturedIds(woven) })
  }

  const reorderLinks = (kind: 'standard' | 'embedded', fromId: string, toId: string) => {
    // Reorder within a single kind ('standard' or 'embedded'). The
    // other kind's items keep their absolute slots in storefront_links
    // — same weaving pattern we use for products inside a category.
    const sameKind = links
      .map((l, i) => ({ link: l, i }))
      .filter((x) => x.link.type === kind)
    const ids = sameKind.map((x) => x.link.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0 || from === to) return
    const newOrder = arrayMove(ids, from, to)
    const idToLink = new Map(links.map((l) => [l.id, l]))
    const queue = [...newOrder]
    const next: StorefrontLinkItem[] = links.map((l) => {
      if (l.type !== kind) return l
      const replacementId = queue.shift()
      return replacementId ? (idToLink.get(replacementId) ?? l) : l
    })
    writeSettings({ storefront_links: next })
  }

  const moveCategory = (key: string, direction: -1 | 1) => {
    const present = sections.map((s) => s.key)
    const seed = categoryOrder.length > 0 ? categoryOrder : present
    const tail = present.filter((k) => !seed.includes(k))
    const full = [...seed, ...tail]
    const idx = full.indexOf(key)
    if (idx < 0) return
    const target = idx + direction
    if (target < 0 || target >= full.length) return
    writeSettings({
      category_order: arrayMove(full, idx, target),
    } as Partial<Settings>)
  }

  const hideProduct = (productId: string) => {
    if (featuredMode === 'curated') {
      writeSettings({
        featured_product_ids: cleanFeaturedIds(
          featuredIds.filter((id) => id !== productId),
        ),
      })
    } else {
      // 'all' mode: switch to curated and exclude the product the
      // user just hid. Status banner explains this happened.
      const remainingIds = visibleProducts
        .filter((p) => p.id !== productId)
        .map((p) => p.id)
      writeSettings({
        featured_mode: 'curated',
        featured_product_ids: cleanFeaturedIds(remainingIds),
      })
    }
  }

  const restoreProduct = (productId: string) => {
    writeSettings({
      featured_product_ids: cleanFeaturedIds([...featuredIds, productId]),
    })
  }

  const deleteLink = (linkId: string) => {
    const link = links.find((l) => l.id === linkId)
    const label = link?.title || link?.url || 'this link'
    if (
      !window.confirm(
        `Delete ${label}? This removes it from your Space permanently.`,
      )
    ) {
      return
    }
    writeSettings({ storefront_links: links.filter((l) => l.id !== linkId) })
  }

  const showAllProducts = () => {
    writeSettings({ featured_mode: 'all', featured_product_ids: [] })
  }

  const productCount = sections.reduce((n, s) => n + s.items.length, 0)
  const totalItems = productCount + links.length

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="arrange-panel">
      <div className="ap-header">
        <div>
          <h2>Arrange</h2>
          <p className="ap-sub">
            Drag products inside a category to reorder. Use the
            &uarr;&darr; buttons next to a category header to move the
            whole section (e.g. put Courses above eBooks).
          </p>
        </div>
        <button
          type="button"
          className="ap-close"
          onClick={onClose}
          aria-label="Close Arrange panel"
        >
          ×
        </button>
      </div>

      {/* Status banner — make the implicit mode explicit. */}
      <div className="ap-status" data-mode={featuredMode}>
        {featuredMode === 'all' ? (
          <>
            <span>
              Showing all active products
              {productCount > 0 ? ` (${productCount})` : ''}. Hide a
              product to start curating.
            </span>
          </>
        ) : (
          <>
            <span>
              Curated selection ({featuredIds.length} chosen).
            </span>
            <button
              type="button"
              className="ap-mini-action"
              onClick={showAllProducts}
              title="Show every active product on your Space"
            >
              Show all products
            </button>
          </>
        )}
      </div>

      {totalItems === 0 && (
        <div className="ap-empty">
          Nothing in your Space yet. Use &ldquo;+ Add to Space&rdquo;
          to add products or links.
        </div>
      )}

      {/* ── Products ─────────────────────────────────────────── */}
      {sections.length > 0 && (
        <section className="ap-section">
          <h3>Products</h3>
          <div className="ap-cat-list">
            {sections.map((section, idx) => (
              <ProductSection
                key={section.key}
                section={section}
                isFirst={idx === 0}
                isLast={idx === sections.length - 1}
                sensors={sensors}
                onReorder={(fromId, toId) =>
                  reorderWithinSection(section.key, fromId, toId)
                }
                onMoveUp={() => moveCategory(section.key, -1)}
                onMoveDown={() => moveCategory(section.key, 1)}
                onHide={hideProduct}
              />
            ))}
          </div>

          {/* Hidden / available products (curated mode only). */}
          {featuredMode === 'curated' && (
            <HiddenProductsList
              hidden={products.filter((p) => !featuredIds.includes(p.id))}
              onRestore={restoreProduct}
            />
          )}
        </section>
      )}

      {/* ── Links (URL links) ────────────────────────────────── */}
      <LinksSection
        title="Links"
        items={links.filter((l) => l.type === 'standard')}
        sensors={sensors}
        prefix={LINK_PREFIX}
        onReorder={(fromId, toId) => reorderLinks('standard', fromId, toId)}
        onDelete={deleteLink}
      />

      {/* ── Embeds (YouTube, Spotify, etc.) ──────────────────── */}
      <LinksSection
        title="Embeds"
        items={links.filter((l) => l.type === 'embedded')}
        sensors={sensors}
        prefix={EMBED_PREFIX}
        onReorder={(fromId, toId) => reorderLinks('embedded', fromId, toId)}
        onDelete={deleteLink}
      />
    </div>
  )
}

// ─── A single category's product list, with its own flat DnD ────
const ProductSection = ({
  section,
  isFirst,
  isLast,
  sensors,
  onReorder,
  onMoveUp,
  onMoveDown,
  onHide,
}: {
  section: { key: string; label: string; items: schemas['ProductStorefront'][] }
  isFirst: boolean
  isLast: boolean
  sensors: ReturnType<typeof useSensors>
  onReorder: (fromId: string, toId: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onHide: (productId: string) => void
}) => {
  return (
    <div className="ap-cat">
      <div className="ap-cat-head">
        <div className="ap-cat-move">
          <button
            type="button"
            className="ap-arrow"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`Move ${section.label} up`}
            title="Move section up"
          >
            <KeyboardArrowUpOutlined style={{ fontSize: 16 }} />
          </button>
          <button
            type="button"
            className="ap-arrow"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Move ${section.label} down`}
            title="Move section down"
          >
            <KeyboardArrowDownOutlined style={{ fontSize: 16 }} />
          </button>
        </div>
        <span className="ap-cat-label">{section.label}</span>
        <span className="ap-count">{section.items.length}</span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e: DragEndEvent) => {
          const { active, over } = e
          if (!over || active.id === over.id) return
          const a = String(active.id)
          const b = String(over.id)
          if (!a.startsWith(PRODUCT_PREFIX) || !b.startsWith(PRODUCT_PREFIX))
            return
          onReorder(
            a.slice(PRODUCT_PREFIX.length),
            b.slice(PRODUCT_PREFIX.length),
          )
        }}
      >
        <SortableContext
          items={section.items.map((p) => PRODUCT_PREFIX + p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="ap-row-list">
            {section.items.map((product) => (
              <SortableRow key={product.id} id={PRODUCT_PREFIX + product.id}>
                {({ listeners, attributes }) => (
                  <div className="ap-row">
                    <Grip
                      listeners={listeners}
                      attributes={attributes}
                      label={`Drag ${product.name}`}
                    />
                    {product.medias[0]?.public_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.medias[0].public_url}
                        alt=""
                        className="ap-thumb"
                      />
                    ) : (
                      <span className="ap-thumb ap-thumb-empty" />
                    )}
                    <span className="ap-row-name" title={product.name}>
                      {product.name}
                    </span>
                    <button
                      type="button"
                      className="ap-row-action"
                      onClick={() => onHide(product.id)}
                      title="Hide from Space"
                      aria-label={`Hide ${product.name} from Space`}
                    >
                      <VisibilityOffOutlined style={{ fontSize: 16 }} />
                    </button>
                  </div>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

// ─── Hidden products disclosure ─────────────────────────────────
const HiddenProductsList = ({
  hidden,
  onRestore,
}: {
  hidden: schemas['ProductStorefront'][]
  onRestore: (id: string) => void
}) => {
  if (hidden.length === 0) return null
  return (
    <details className="ap-hidden">
      <summary>Hidden products ({hidden.length})</summary>
      <div className="ap-row-list">
        {hidden.map((product) => (
          <div className="ap-row ap-row-muted" key={product.id}>
            {product.medias[0]?.public_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.medias[0].public_url}
                alt=""
                className="ap-thumb"
              />
            ) : (
              <span className="ap-thumb ap-thumb-empty" />
            )}
            <span className="ap-row-name" title={product.name}>
              {product.name}
            </span>
            <button
              type="button"
              className="ap-row-action"
              onClick={() => onRestore(product.id)}
              title="Restore to Space"
              aria-label={`Restore ${product.name} to Space`}
            >
              <VisibilityOutlined style={{ fontSize: 16 }} />
            </button>
          </div>
        ))}
      </div>
    </details>
  )
}

// ─── Single-kind link section (URL links OR embeds) ─────────────
const LinksSection = ({
  title,
  items,
  sensors,
  prefix,
  onReorder,
  onDelete,
}: {
  title: string
  items: StorefrontLinkItem[]
  sensors: ReturnType<typeof useSensors>
  prefix: string
  onReorder: (fromId: string, toId: string) => void
  onDelete: (linkId: string) => void
}) => {
  if (items.length === 0) return null
  const isEmbed = title === 'Embeds'
  return (
    <section className="ap-section">
      <h3>{title}</h3>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e: DragEndEvent) => {
          const { active, over } = e
          if (!over || active.id === over.id) return
          const a = String(active.id)
          const b = String(over.id)
          if (!a.startsWith(prefix) || !b.startsWith(prefix)) return
          onReorder(a.slice(prefix.length), b.slice(prefix.length))
        }}
      >
        <SortableContext
          items={items.map((l) => prefix + l.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="ap-row-list">
            {items.map((link) => (
              <SortableRow key={link.id} id={prefix + link.id}>
                {({ listeners, attributes }) => (
                  <div className="ap-row">
                    <Grip
                      listeners={listeners}
                      attributes={attributes}
                      label={`Drag ${link.title || (isEmbed ? 'embed' : 'link')}`}
                    />
                    <span className="ap-thumb ap-thumb-empty">
                      {isEmbed ? (
                        <OndemandVideoOutlined style={{ fontSize: 18 }} />
                      ) : (
                        <LinkOutlined style={{ fontSize: 18 }} />
                      )}
                    </span>
                    <span
                      className="ap-row-name"
                      title={link.title || link.url}
                    >
                      {link.title || link.url}
                    </span>
                    <button
                      type="button"
                      className="ap-row-action ap-row-action-danger"
                      onClick={() => onDelete(link.id)}
                      title={`Delete ${isEmbed ? 'embed' : 'link'}`}
                      aria-label={`Delete ${link.title || (isEmbed ? 'embed' : 'link')}`}
                    >
                      <DeleteOutlineOutlined style={{ fontSize: 16 }} />
                    </button>
                  </div>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}
