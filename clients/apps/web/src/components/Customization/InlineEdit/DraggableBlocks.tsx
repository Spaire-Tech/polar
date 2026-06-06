'use client'

import { ProductCard } from '@/components/Products/ProductCard'
import { CATEGORY_LABELS } from '@/components/Profile/categoryLabels'
import { SectionLabel } from '@/components/Profile/SectionLabel'
import {
  EmbedCard,
  type LinksLayout,
  StorefrontLinkItem,
  URL_LAYOUT_WRAPPERS,
  UrlLink,
} from '@/components/Profile/StorefrontLinks'
import {
  buildEmbedUrl,
  isEmbeddablePlatform,
} from '@/components/Profile/linkPlatforms'
import {
  itemKey,
  reorderSpaceItem,
  resolveSpaceItems,
  setItemHidden,
  type ResolvedSpaceItem,
} from '@/components/Profile/spaceItems'
import { toast } from '@/components/Toast/use-toast'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
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
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'
import { schemas } from '@spaire/client'
import { useEffect, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { SpaceEmptyHero } from '../SpaceEmptyHero'

// ─── Editor canvas — flat list of Space items ─────────────────────
//
// Everything on the Space (products, links, embeds) renders in a
// single flat sortable list. The order comes from
// `storefront_settings.space_items` via the resolver, so the canvas
// always shows the same sequence the public storefront will. Drag any
// item over any other to reorder; hide an item to take it off the
// Space without losing its slot or its data.
//
// Visual chunking
// ───────────────
// Consecutive items of the same kind render together — a run of
// products as the 2-column grid the public Space uses, a run of links
// as the creator's chosen layout (classic/card/grid/carousel). Single
// mixed items just sit on their own row.

const LAYOUTS: {
  value: LinksLayout
  label: string
  Icon: React.ComponentType<{ style?: React.CSSProperties }>
}[] = [
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

// Generic sortable wrapper for a single Space item. The drag handle is
// a child element so the hover-attached Remove / Hide controls don't
// fight the listeners.
const SortableItem = ({
  id,
  className,
  children,
}: {
  id: string
  className?: string
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
  } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`item-host${isDragging ? ' dragging' : ''}${
        className ? ` ${className}` : ''
      }`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children({ listeners, attributes, isDragging })}
    </div>
  )
}

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

// Picks the right render for an embedded link (iframe) vs a normal URL
// link. Same dispatch the public Storefront uses, so the editor and
// the live page stay byte-for-byte equivalent at this layer.
const LinkRow = ({
  link,
  layout,
  embedded = false,
}: {
  link: StorefrontLinkItem
  layout: LinksLayout
  embedded?: boolean
}) => {
  if (
    embedded &&
    isEmbeddablePlatform(link.platform) &&
    buildEmbedUrl(link.url, link.platform ?? '')
  ) {
    return <EmbedCard link={link} />
  }
  return <UrlLink link={link} layout={embedded ? 'card' : layout} preview />
}

// Category bucket used when a product has no category, or one we don't
// have a label for. Same fallback the public storefront uses so the
// editor and the live page agree at the section-label layer too.
const FALLBACK_CATEGORY = 'other'

const categoryOf = (
  entry: Extract<ResolvedSpaceItem, { kind: 'product' }>,
): string => {
  const cat = entry.product.category
  if (cat && cat in CATEGORY_LABELS) return cat
  return FALLBACK_CATEGORY
}

type ProductChunk = {
  kind: 'product'
  category: string
  items: Extract<ResolvedSpaceItem, { kind: 'product' }>[]
}
type LinkChunk = {
  kind: 'link'
  items: Extract<ResolvedSpaceItem, { kind: 'link' }>[]
}
type Chunk = ProductChunk | LinkChunk

// Same chunking rule the public Storefront uses: start a new chunk on
// every (kind, category) transition. Two ebooks in a row → one chunk.
// Ebook, course, ebook → three chunks, "eBooks" label rendered twice.
// This is what keeps WYSIWYG between the editor canvas and the live
// page when the creator drags items across categories.
const chunkByKindAndCategory = (items: ResolvedSpaceItem[]): Chunk[] => {
  const out: Chunk[] = []
  for (const item of items) {
    if (item.kind === 'product') {
      const cat = categoryOf(item)
      const tail = out[out.length - 1]
      if (tail && tail.kind === 'product' && tail.category === cat) {
        tail.items.push(item)
        continue
      }
      out.push({ kind: 'product', category: cat, items: [item] })
    } else {
      const tail = out[out.length - 1]
      if (tail && tail.kind === 'link') {
        tail.items.push(item)
        continue
      }
      out.push({ kind: 'link', items: [item] })
    }
  }
  return out
}

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

  const links = ((settings?.storefront_links ?? []) as StorefrontLinkItem[])
  const linksLayout: LinksLayout = (settings?.links_layout ??
    'classic') as LinksLayout
  const showDetails = settings?.show_product_details ?? true
  const thumbnailSize = (settings?.thumbnail_size ?? 'medium') as
    | 'small'
    | 'medium'
    | 'large'

  // Hidden items belong in the editor (so the creator can drag/unhide
  // them) but never in the public render — the resolver does the
  // filtering, we just ask for the visible-only list here.
  const items = useMemo(
    () => resolveSpaceItems({ settings, products, links }),
    [settings, products, links],
  )

  // The generated OpenAPI types don't include `space_items` yet — it
  // lands on the frontend the next time `pnpm generate` runs against a
  // backend that has the new field. Until then we accept Partial<…>
  // *plus* arbitrary extra keys (notably `space_items`) so the
  // resolver's patches flow through cleanly.
  const writeSettings = (
    patch: Partial<schemas['OrganizationStorefrontSettings']> &
      Record<string, unknown>,
  ) => {
    setValue(
      'storefront_settings',
      { ...(settings ?? {}), ...patch } as schemas['OrganizationStorefrontSettings'],
      { shouldDirty: true },
    )
  }

  const onHide = (key: string, name: string) => {
    const patch = setItemHidden({
      settings,
      products,
      links,
      key,
      hidden: true,
    })
    writeSettings(patch)
    toast({
      title: `${name} hidden`,
      description: 'Visit Arrange to restore it.',
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const patch = reorderSpaceItem({
      settings,
      products,
      links,
      fromId: String(active.id),
      toId: String(over.id),
    })
    if (patch) writeSettings(patch)
  }

  // Match the empty-state hero height to the left ProfileCard so the
  // columns line up visually. Falls back to a sensible viewport calc
  // until the measurement lands.
  const [leftCardHeight, setLeftCardHeight] = useState<number | null>(null)
  const isEmpty = items.length === 0
  useEffect(() => {
    if (!isEmpty || typeof window === 'undefined') return
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
  }, [isEmpty])

  if (isEmpty) {
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

  const chunks = chunkByKindAndCategory(items)
  const hasAnyLinks = items.some((i) => i.kind === 'link')

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(itemKey)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-12">
          {/* Layout picker for link runs. Shown once at the top so it
              applies globally — the public storefront also reads
              `links_layout` for every link block, so a per-run picker
              would be misleading. */}
          {hasAnyLinks && (
            <div className="canvas-card-toolbar">
              <span className="canvas-card-toolbar-label">Link layout</span>
              <LayoutPicker
                value={linksLayout}
                onChange={(v) => writeSettings({ links_layout: v })}
              />
            </div>
          )}

          {chunks.map((chunk, idx) => {
            if (chunk.kind === 'product') {
              return (
                <section
                  key={`p-${idx}`}
                  className="canvas-card flex scroll-mt-24 flex-col gap-6"
                >
                  <SectionLabel count={chunk.items.length}>
                    {CATEGORY_LABELS[chunk.category] ?? CATEGORY_LABELS.other}
                  </SectionLabel>
                  <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
                  {chunk.items.map((entry) => (
                    <SortableItem key={itemKey(entry)} id={itemKey(entry)}>
                      {({ listeners, attributes }) => (
                        <div className="item-hover">
                          <ProductCard
                            product={entry.product}
                            showDetails={showDetails}
                            thumbnailSize={thumbnailSize}
                          />
                          <div className="item-actions">
                            <ItemDragHandle
                              listeners={listeners}
                              attributes={attributes}
                              label={`Drag ${entry.product.name} to reorder`}
                            />
                            <button
                              type="button"
                              className="item-action"
                              onClick={(e) => {
                                e.stopPropagation()
                                onHide(itemKey(entry), entry.product.name)
                              }}
                              title="Hide from Space"
                              aria-label={`Hide ${entry.product.name} from Space`}
                            >
                              <VisibilityOffOutlined style={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                  </div>
                </section>
              )
            }
            // Link chunk. Wrap the items in the SAME layout container the
            // public Storefront uses (URL_LAYOUT_WRAPPERS) so "Grid" is an
            // actual 2/3-up grid and "Cards"/"Carousel" size exactly like
            // the live Space — instead of every link stretching to the
            // full canvas width (the "fake massive view"). Embeds always
            // render full-width, so they span every column of the grid.
            return (
              <div
                key={`l-${idx}`}
                className={`canvas-card ${URL_LAYOUT_WRAPPERS[linksLayout]}`}
                style={
                  linksLayout === 'carousel'
                    ? { scrollbarWidth: 'thin' }
                    : undefined
                }
              >
                {chunk.items.map((entry) => {
                  const isEmbed =
                    entry.link.type === 'embedded' &&
                    isEmbeddablePlatform(entry.link.platform) &&
                    !!buildEmbedUrl(entry.link.url, entry.link.platform ?? '')
                  return (
                  <SortableItem
                    key={itemKey(entry)}
                    id={itemKey(entry)}
                    className={isEmbed ? 'col-span-full w-full' : undefined}
                  >
                    {({ listeners, attributes }) => (
                      <div className="item-hover">
                        <LinkRow
                          link={entry.link}
                          layout={linksLayout}
                          embedded={entry.link.type === 'embedded'}
                        />
                        <div className="item-actions">
                          <ItemDragHandle
                            listeners={listeners}
                            attributes={attributes}
                            label={`Drag ${entry.link.title || 'link'} to reorder`}
                          />
                          <button
                            type="button"
                            className="item-action"
                            onClick={(e) => {
                              e.stopPropagation()
                              onHide(
                                itemKey(entry),
                                entry.link.title || entry.link.url || 'Link',
                              )
                            }}
                            title="Hide from Space"
                            aria-label={`Hide ${
                              entry.link.title || 'link'
                            } from Space`}
                          >
                            <VisibilityOffOutlined style={{ fontSize: 16 }} />
                          </button>
                        </div>
                      </div>
                    )}
                  </SortableItem>
                  )
                })}
              </div>
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}
