'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import { CATEGORY_LABELS } from '@/components/Profile/categoryLabels'
import { SectionLabel } from '@/components/Profile/SectionLabel'
import {
  type LinksLayout,
  StorefrontLinkItem,
} from '@/components/Profile/StorefrontLinks'
import { toast } from '@/components/Toast/use-toast'
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import GridViewOutlined from '@mui/icons-material/GridViewOutlined'
import ViewAgendaOutlined from '@mui/icons-material/ViewAgendaOutlined'
import ViewCarouselOutlined from '@mui/icons-material/ViewCarouselOutlined'
import ViewListOutlined from '@mui/icons-material/ViewListOutlined'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { SpaceEmptyHero } from '../SpaceEmptyHero'
import { Portal } from './Portal'

type BlockKind = 'products' | 'links' | 'forms'

const DEFAULT_ORDER: BlockKind[] = ['products', 'links']

// ─── Empty-state hero — shared component lives in
//     ../SpaceEmptyHero so the public storefront can render the same
//     thing when there are no products/links yet. ──

const getBlockOrder = (
  settings: schemas['OrganizationStorefrontSettings'] | undefined | null,
): BlockKind[] => {
  const persisted = (settings as { block_order?: BlockKind[] } | null | undefined)
    ?.block_order
  if (persisted && persisted.length > 0) return persisted
  if (settings?.links_position === 'before_products')
    return ['links', 'products']
  return DEFAULT_ORDER
}

// ─── ID prefixes so the single DndContext can route by type ───────
const BLOCK_PREFIX = 'block:'
const PRODUCT_PREFIX = 'product:'
const LINK_PREFIX = 'link:'

// ─── Sortable wrapper for blocks ──────────────────────────────────

const SortableBlock = ({
  id,
  children,
}: {
  id: BlockKind
  children: (handleProps: {
    listeners: ReturnType<typeof useSortable>['listeners']
    attributes: ReturnType<typeof useSortable>['attributes']
  }) => React.ReactNode
}) => {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    listeners,
    attributes,
  } = useSortable({ id: BLOCK_PREFIX + id })
  return (
    <div
      ref={setNodeRef}
      className={`block-host${isDragging ? ' dragging' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children({ listeners, attributes })}
    </div>
  )
}

// ─── Sortable wrapper for individual items (products / links) ─────

const SortableItem = ({
  id,
  prefix,
  children,
}: {
  id: string
  prefix: string
  children: (handleProps: {
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
  } = useSortable({ id: prefix + id })
  return (
    <div
      ref={setNodeRef}
      className={`item-host${isDragging ? ' dragging' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children({ listeners, attributes, isDragging })}
    </div>
  )
}

// Drag handle button shared by item types.
const ItemDragHandle = ({
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
    className="item-drag-handle"
    aria-label={label}
    {...listeners}
    {...attributes}
  >
    ⋮⋮
  </button>
)

// ─── Layout picker (Links heading) ────────────────────────────────

const LAYOUTS: { value: LinksLayout; label: string; Icon: React.ComponentType<{ style?: React.CSSProperties }> }[] = [
  { value: 'classic', label: 'List', Icon: ViewListOutlined },
  { value: 'card', label: 'Cards', Icon: ViewAgendaOutlined },
  { value: 'image_grid', label: 'Grid', Icon: GridViewOutlined },
  { value: 'carousel', label: 'Carousel', Icon: ViewCarouselOutlined },
]

const LayoutPicker = ({
  value,
  onChange,
}: {
  value: LinksLayout
  onChange: (next: LinksLayout) => void
}) => (
  <span className="layout-picker">
    {LAYOUTS.map(({ value: v, label, Icon }) => (
      <button
        key={v}
        type="button"
        aria-pressed={value === v}
        onClick={() => onChange(v)}
        title={label}
      >
        <Icon style={{ fontSize: 14 }} />
      </button>
    ))}
  </span>
)

// ─── Products block (canvas) ──────────────────────────────────────

const ProductsBlock = ({
  organization,
  products,
  productOrder,
  categoryOrder,
  onUnfeature,
}: {
  organization: schemas['Organization']
  products: schemas['ProductStorefront'][]
  productOrder: string[]
  categoryOrder: string[]
  onUnfeature: (productId: string) => void
}) => {
  const settings = organization.storefront_settings
  const featuredMode = settings?.featured_mode ?? 'all'
  const featuredIds = settings?.featured_product_ids ?? []
  const showDetails = settings?.show_product_details ?? true
  const thumbnailSize = settings?.thumbnail_size ?? 'medium'

  // Show ALL products in 'all' mode; only featured IDs in curated mode.
  const visible = useMemo(() => {
    if (featuredMode === 'curated') {
      return products.filter((p) => featuredIds.includes(p.id))
    }
    return products
  }, [products, featuredMode, featuredIds])

  // Apply the creator's manual product_order as a ranking hint.
  // Products not yet ranked (newly added) fall through to the back in
  // their original server order.
  const orderedVisible = useMemo(() => {
    if (productOrder.length === 0) return visible
    const rank = new Map(productOrder.map((id, i) => [id, i]))
    const ranked = visible
      .filter((p) => rank.has(p.id))
      .sort((a, b) => (rank.get(a.id)! - rank.get(b.id)!))
    const unranked = visible.filter((p) => !rank.has(p.id))
    return [...ranked, ...unranked]
  }, [visible, productOrder])

  const sections = useMemo(() => {
    const buckets: Record<string, schemas['ProductStorefront'][]> = {}
    const uncat: schemas['ProductStorefront'][] = []
    for (const p of orderedVisible) {
      const cat = p.category
      if (cat && cat in CATEGORY_LABELS) (buckets[cat] ??= []).push(p)
      else uncat.push(p)
    }
    // Categories present in this storefront (excluding the bucket that
    // will become "Other").
    const presentKeys = Object.keys(buckets).filter(
      (k) => k !== 'other' && buckets[k].length > 0 && k in CATEGORY_LABELS,
    )
    // User's preferred order first, then any unranked categories in the
    // default catalog order.
    const rank = new Map(categoryOrder.map((k, i) => [k, i]))
    const ranked = presentKeys
      .filter((k) => rank.has(k))
      .sort((a, b) => rank.get(a)! - rank.get(b)!)
    const unranked = (
      Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>
    )
      .filter((k) => k !== 'other' && presentKeys.includes(k) && !rank.has(k))
    const orderedKeys = [...ranked, ...unranked]
    const ordered = orderedKeys.map((k) => ({
      key: k,
      label: CATEGORY_LABELS[k],
      items: buckets[k],
    }))
    const otherItems = [...(buckets.other ?? []), ...uncat]
    if (otherItems.length > 0) {
      ordered.push({
        key: 'other',
        label: CATEGORY_LABELS.other,
        items: otherItems,
      })
    }
    return ordered
  }, [orderedVisible, categoryOrder])

  // The fully-empty case is handled at the canvas level (single hero,
  // see below). Returning null here keeps a partial canvas (links but
  // no products) from rendering a redundant empty state.
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-12">
      {sections.map((section) => (
        <section
          key={section.key}
          className="flex scroll-mt-24 flex-col gap-6"
        >
          <SectionLabel count={section.items.length}>
            {section.label}
          </SectionLabel>
          <SortableContext
            items={section.items.map((p) => PRODUCT_PREFIX + p.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
              {section.items.map((product) => (
                <SortableItem
                  key={product.id}
                  id={product.id}
                  prefix={PRODUCT_PREFIX}
                >
                  {({ listeners, attributes }) => (
                    <div className="item-hover">
                      <ProductCard
                        product={product}
                        showDetails={showDetails}
                        thumbnailSize={
                          thumbnailSize as 'small' | 'medium' | 'large'
                        }
                      />
                      <div className="item-actions">
                        <ItemDragHandle
                          listeners={listeners}
                          attributes={attributes}
                          label={`Drag ${product.name} to reorder`}
                        />
                        <button
                          type="button"
                          className="item-action"
                          onClick={(e) => {
                            e.stopPropagation()
                            onUnfeature(product.id)
                          }}
                        >
                          {featuredMode === 'curated' ? 'Remove' : 'Hide'}
                        </button>
                      </div>
                    </div>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </section>
      ))}
    </div>
  )
}

// ─── Links block (canvas) ─────────────────────────────────────────

const LinksBlock = ({
  links,
  layout,
  onLayoutChange,
  onRemove,
}: {
  links: StorefrontLinkItem[]
  layout: LinksLayout
  onLayoutChange: (next: LinksLayout) => void
  onRemove: (id: string) => void
}) => {
  // Canvas-level hero (see below) handles the fully-empty case. Skip
  // the per-block hero here so we don't stack two empty states.
  if (links.length === 0) return null

  // Embeds and URL links render as separate sections — same split the
  // public StorefrontLinks renderer uses. Each list is its own
  // SortableContext so dragging only reorders within that list.
  const urlLinks = links.filter((l) => l.type !== 'embedded')
  const embedLinks = links.filter((l) => l.type === 'embedded')

  const layoutClass: Record<LinksLayout, string> = {
    classic: 'flex flex-col gap-3',
    card: 'flex flex-col gap-4',
    image_grid: 'grid grid-cols-2 gap-3 sm:grid-cols-3',
    carousel: '-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2',
  }

  return (
    <div className="flex flex-col gap-8">
      {embedLinks.length > 0 && (
        <div className="flex flex-col gap-4">
          <SectionLabel>Featured</SectionLabel>
          <SortableContext
            items={embedLinks.map((l) => LINK_PREFIX + l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex w-full flex-col gap-5">
              {embedLinks.map((link) => (
                <SortableItem
                  key={link.id}
                  id={link.id}
                  prefix={LINK_PREFIX}
                >
                  {({ listeners, attributes }) => (
                    <div className="item-hover">
                      <LinkRow link={link} layout="card" embedded />
                      <div className="item-actions">
                        <ItemDragHandle
                          listeners={listeners}
                          attributes={attributes}
                          label="Drag embed to reorder"
                        />
                        <button
                          type="button"
                          className="item-action danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemove(link.id)
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </div>
      )}

      {urlLinks.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <SectionLabel>Links</SectionLabel>
            <LayoutPicker value={layout} onChange={onLayoutChange} />
          </div>
          <SortableContext
            items={urlLinks.map((l) => LINK_PREFIX + l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={layoutClass[layout]}>
              {urlLinks.map((link) => (
                <SortableItem
                  key={link.id}
                  id={link.id}
                  prefix={LINK_PREFIX}
                >
                  {({ listeners, attributes }) => (
                    <div className="item-hover">
                      <LinkRow link={link} layout={layout} />
                      <div className="item-actions">
                        <ItemDragHandle
                          listeners={listeners}
                          attributes={attributes}
                          label="Drag link to reorder"
                        />
                        <button
                          type="button"
                          className="item-action danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemove(link.id)
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </div>
      )}
    </div>
  )
}

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Lightweight link card per layout — click does nothing in edit mode
// (preview-only). Hover reveals the Remove button via .item-hover.
const LinkRow = ({
  link,
  layout,
  embedded = false,
}: {
  link: StorefrontLinkItem
  layout: LinksLayout
  embedded?: boolean
}) => {
  const effectiveLayout = embedded ? 'card' : layout
  const title = link.title || getDomain(link.url)
  const host = getDomain(link.url)
  const cover = link.image_url

  if (effectiveLayout === 'classic') {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm">
        <div
          className="h-12 w-12 shrink-0 rounded-xl bg-gray-100"
          style={
            cover
              ? {
                  backgroundImage: `url(${cover})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900">
            {title}
          </div>
          <div className="truncate text-[11px] text-gray-400">{host}</div>
        </div>
      </div>
    )
  }

  if (effectiveLayout === 'image_grid') {
    return (
      <div
        className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100 shadow-sm"
        style={
          cover
            ? {
                backgroundImage: `url(${cover})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-3">
          <p className="line-clamp-2 text-sm font-semibold text-white">
            {title}
          </p>
        </div>
      </div>
    )
  }

  if (effectiveLayout === 'carousel') {
    return (
      <div className="flex w-[240px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div
          className="aspect-[4/3] w-full bg-gray-100"
          style={
            cover
              ? {
                  backgroundImage: `url(${cover})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        />
        <div className="p-3">
          <div className="line-clamp-2 text-sm font-semibold text-gray-900">
            {title}
          </div>
          <div className="truncate text-[11px] text-gray-400">{host}</div>
        </div>
      </div>
    )
  }

  // card layout
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div
        className="aspect-[16/9] w-full bg-gray-100"
        style={
          cover
            ? {
                backgroundImage: `url(${cover})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      />
      <div className="p-4">
        <div className="text-base font-bold text-gray-900">{title}</div>
        {link.description && (
          <p className="line-clamp-2 text-sm text-gray-500">{link.description}</p>
        )}
        <div className="mt-1 truncate text-[11px] text-gray-400">{host}</div>
      </div>
    </div>
  )
}

// ─── DraggableBlocks export ───────────────────────────────────────

export const DraggableBlocks = ({
  organization: org,
  products,
  onAddToSpace,
}: {
  organization: schemas['Organization']
  products: schemas['ProductStorefront'][]
  onAddToSpace?: () => void
}) => {
  const { watch, setValue } = useFormContext<schemas['OrganizationUpdate']>()
  const settings = (watch('storefront_settings') ??
    org.storefront_settings) as
    | schemas['OrganizationStorefrontSettings']
    | undefined

  const blockOrder = getBlockOrder(settings)
  const linksLayout: LinksLayout = (settings?.links_layout ?? 'classic') as LinksLayout
  const links =
    ((settings as { storefront_links?: StorefrontLinkItem[] } | undefined)
      ?.storefront_links ?? []) as StorefrontLinkItem[]
  // Per-item product ordering. Reuses featured_product_ids as the
  // ranking hint — its declared order is the on-canvas order. Items
  // not in the list (newly created products, or products in 'all'
  // mode that haven't been touched) fall through to server order.
  const productOrder = settings?.featured_product_ids ?? []
  // User-defined ordering for the category sections themselves.
  // Categories not in the list fall through to CATEGORY_LABELS order.
  const categoryOrder =
    ((settings as { category_order?: string[] } | undefined)?.category_order ??
      []) as string[]

  const orgWithSettings = { ...org, storefront_settings: settings ?? {} } as schemas['Organization']

  // ── Mutations ──
  const updateSetting = <
    K extends keyof NonNullable<schemas['OrganizationStorefrontSettings']>,
  >(
    key: K,
    value: NonNullable<schemas['OrganizationStorefrontSettings']>[K],
  ) => {
    setValue(
      'storefront_settings',
      { ...(settings ?? {}), [key]: value },
      { shouldDirty: true },
    )
  }

  const onRemoveLink = (id: string) => {
    const next = links.filter((l) => l.id !== id)
    setValue(
      'storefront_settings',
      { ...(settings ?? {}), storefront_links: next } as schemas['OrganizationStorefrontSettings'],
      { shouldDirty: true },
    )
    toast({ title: 'Link removed', description: 'Publish to update your Space.' })
  }

  const onUnfeatureProduct = (productId: string) => {
    const featuredMode = settings?.featured_mode ?? 'all'
    const featuredIds = settings?.featured_product_ids ?? []

    if (featuredMode === 'curated') {
      setValue(
        'storefront_settings',
        {
          ...(settings ?? {}),
          featured_product_ids: featuredIds.filter((id) => id !== productId),
        },
        { shouldDirty: true },
      )
      toast({ title: 'Removed from your Space' })
    } else {
      const allIds = products.map((p) => p.id)
      const next = allIds.filter((id) => id !== productId)
      setValue(
        'storefront_settings',
        {
          ...(settings ?? {}),
          featured_mode: 'curated',
          featured_product_ids: next,
        },
        { shouldDirty: true },
      )
      toast({
        title: 'Hidden from your Space',
        description: 'Switched to curated mode — toggle off in Settings to show all again.',
      })
    }
  }

  // ── DnD ──
  // Small activation distance so the drag picks up the moment the
  // pointer commits to a direction. (Don't combine with `tolerance` —
  // that field is paired with `delay`, not `distance`, and including
  // it silently invalidates the constraint.)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const [activeBlock, setActiveBlock] = useState<BlockKind | null>(null)

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    if (id.startsWith(BLOCK_PREFIX)) {
      setActiveBlock(id.slice(BLOCK_PREFIX.length) as BlockKind)
    }
  }

  // Live reorder while the pointer is still down: as the active item
  // crosses another item we commit the swap into form state so the
  // canvas reflows in real time. onDragEnd is just bookkeeping.
  const applyReorder = (activeId: string, overId: string) => {
    if (activeId === overId) return

    if (activeId.startsWith(BLOCK_PREFIX) && overId.startsWith(BLOCK_PREFIX)) {
      const a = activeId.slice(BLOCK_PREFIX.length) as BlockKind
      const b = overId.slice(BLOCK_PREFIX.length) as BlockKind
      const from = blockOrder.indexOf(a)
      const to = blockOrder.indexOf(b)
      if (from < 0 || to < 0 || from === to) return
      const next = arrayMove(blockOrder, from, to)
      updateSetting(
        'block_order',
        next as NonNullable<schemas['OrganizationStorefrontSettings']>['block_order'],
      )
      return
    }

    if (activeId.startsWith(PRODUCT_PREFIX) && overId.startsWith(PRODUCT_PREFIX)) {
      const aId = activeId.slice(PRODUCT_PREFIX.length)
      const bId = overId.slice(PRODUCT_PREFIX.length)
      // Reorder only within the currently-visible set. In curated mode
      // featured_product_ids doubles as the visibility list, so we
      // mustn't expand it with hidden products — that would silently
      // un-curate everything. In 'all' mode the visible set is every
      // product, so this collapses to the same arrayMove.
      const featuredMode = settings?.featured_mode ?? 'all'
      const visibleIds =
        featuredMode === 'curated'
          ? productOrder.filter((id) => products.some((p) => p.id === id))
          : products.map((p) => p.id)
      // Apply ranking hint to derive the same on-canvas ordering the
      // user sees: ranked ids first (in productOrder), then unranked.
      const rank = new Map(productOrder.map((id, i) => [id, i]))
      const ordered = [...visibleIds].sort((a, b) => {
        const ra = rank.has(a) ? rank.get(a)! : Number.POSITIVE_INFINITY
        const rb = rank.has(b) ? rank.get(b)! : Number.POSITIVE_INFINITY
        return ra - rb
      })
      const from = ordered.indexOf(aId)
      const to = ordered.indexOf(bId)
      if (from < 0 || to < 0 || from === to) return
      const newVisibleOrder = arrayMove(ordered, from, to)
      // Weave the new order back into productOrder. Visible ids
      // already present in productOrder keep their slots; new visible
      // ids (e.g. 'all' mode + empty ranking hint) get appended.
      const visibleSet = new Set(visibleIds)
      const queue = [...newVisibleOrder]
      const woven: string[] = []
      for (const id of productOrder) {
        if (visibleSet.has(id)) {
          const next = queue.shift()
          if (next) woven.push(next)
        } else {
          woven.push(id)
        }
      }
      for (const id of queue) woven.push(id)
      // Defense: never persist ids that no longer correspond to a
      // real, in-catalog product (e.g. archived between sessions).
      const valid = new Set(products.map((p) => p.id))
      updateSetting(
        'featured_product_ids',
        woven.filter((id) => valid.has(id)),
      )
      return
    }

    if (activeId.startsWith(LINK_PREFIX) && overId.startsWith(LINK_PREFIX)) {
      const aId = activeId.slice(LINK_PREFIX.length)
      const bId = overId.slice(LINK_PREFIX.length)
      const from = links.findIndex((l) => l.id === aId)
      const to = links.findIndex((l) => l.id === bId)
      if (from < 0 || to < 0 || from === to) return
      const next = arrayMove(links, from, to)
      setValue(
        'storefront_settings',
        { ...(settings ?? {}), storefront_links: next } as schemas['OrganizationStorefrontSettings'],
        { shouldDirty: true },
      )
      return
    }

    // Category reorder lives in the Arrange panel (↑/↓ buttons) — no
    // canvas drag for sections, so no branch here.
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    applyReorder(String(active.id), String(over.id))
  }

  const handleDragEnd = (_event: DragEndEvent) => {
    setActiveBlock(null)
  }

  // ── Block renderers ──
  const renderBlockBody = (kind: BlockKind) => {
    if (kind === 'products') {
      return (
        <ProductsBlock
          organization={orgWithSettings}
          products={products}
          productOrder={productOrder}
          categoryOrder={categoryOrder}
          onUnfeature={onUnfeatureProduct}
        />
      )
    }
    if (kind === 'links') {
      return (
        <LinksBlock
          links={links}
          layout={linksLayout}
          onLayoutChange={(v) => updateSetting('links_layout', v)}
          onRemove={onRemoveLink}
        />
      )
    }
    return null
  }

  const renderableOrder = blockOrder.filter((k) => k === 'products' || k === 'links')

  // If the whole canvas is empty, collapse the per-block heroes into a
  // single one — two stacked heroes would just be noise.
  const featuredMode = settings?.featured_mode ?? 'all'
  const featuredIds = settings?.featured_product_ids ?? []
  const visibleProductCount =
    featuredMode === 'curated'
      ? products.filter((p) => featuredIds.includes(p.id)).length
      : products.length
  const isFullyEmpty = visibleProductCount === 0 && links.length === 0

  // Match the empty-state hero height to the left ProfileCard so the
  // two columns visually line up. Falls back to a sensible viewport
  // calc until the measurement lands.
  const [leftCardHeight, setLeftCardHeight] = useState<number | null>(null)
  useEffect(() => {
    if (!isFullyEmpty || typeof window === 'undefined') return
    const leftCard = document.querySelector(
      '.spaire-editor .col-left .canvas-card',
    ) as HTMLElement | null
    if (!leftCard) return
    const update = () =>
      setLeftCardHeight(leftCard.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(leftCard)
    return () => ro.disconnect()
  }, [isFullyEmpty])

  if (isFullyEmpty) {
    return (
      <div
        style={{
          height: leftCardHeight ?? undefined,
          minHeight: leftCardHeight ? undefined : 'calc(100dvh - 220px)',
          width: '100%',
        }}
      >
        <SpaceEmptyHero onAddToSpace={onAddToSpace} fill />
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveBlock(null)}
    >
      <SortableContext
        items={renderableOrder.map((k) => BLOCK_PREFIX + k)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-12">
          {renderableOrder.map((kind) => (
            <SortableBlock key={kind} id={kind}>
              {({ listeners, attributes }) => (
                <>
                  <button
                    type="button"
                    className="block-drag-handle"
                    aria-label={`Drag ${kind === 'products' ? 'products' : 'links'} block to reorder`}
                    {...listeners}
                    {...attributes}
                  >
                    ⋮⋮
                  </button>
                  <div className="canvas-card">{renderBlockBody(kind)}</div>
                </>
              )}
            </SortableBlock>
          ))}
        </div>
      </SortableContext>

      {/* DragOverlay — only renders for block-level drag (item drag is
          smaller and renders in place). */}
      <Portal>
        <DragOverlay>
          {activeBlock ? (
            <div className="spaire-editor">
              <div className="drag-overlay">
                <div className="canvas-card">{renderBlockBody(activeBlock)}</div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </Portal>
    </DndContext>
  )
}
