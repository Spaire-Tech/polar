'use client'

import { CATEGORY_LABELS } from '@/components/Profile/categoryLabels'
import { StorefrontLinkItem } from '@/components/Profile/StorefrontLinks'
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import {
  closestCorners,
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
 * Floating Arrange panel — single place to reorder everything that
 * appears on the Space. Replaces the per-item drag handles scattered
 * across the canvas with a flat list grouped by Categories (with
 * products inside) and Links. All edits write to the same form fields
 * the canvas reads from, so the preview updates instantly and Publish
 * persists.
 */

type Settings = NonNullable<schemas['OrganizationStorefrontSettings']>

const PRODUCT_PREFIX = 'p:'
const CATEGORY_PREFIX = 'c:'
const LINK_PREFIX = 'l:'

const ListRow = ({
  id,
  children,
}: {
  id: string
  children: (handle: {
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
  } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {children({ listeners, attributes })}
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

  const featuredMode = settings.featured_mode ?? 'all'
  const featuredIds = settings.featured_product_ids ?? []
  const categoryOrder =
    (settings as { category_order?: string[] }).category_order ?? []
  const links = (settings.storefront_links ?? []) as StorefrontLinkItem[]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const writeSettings = (patch: Partial<Settings>) => {
    setValue(
      'storefront_settings',
      { ...settings, ...patch } as Settings,
      { shouldDirty: true },
    )
  }

  // Defense: never persist ids that don't correspond to a real
  // product. Prevents archived / deleted products from haunting the
  // featured list.
  const cleanFeaturedIds = (ids: string[]) => {
    const valid = new Set(products.map((p) => p.id))
    return ids.filter((id) => valid.has(id))
  }

  // Visible (in-Space) product set, in the same order the canvas /
  // public storefront uses.
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

  // Group visible products into category buckets in the user's
  // declared order, with anything else trailing in "Other".
  const groupedSections = useMemo(() => {
    const buckets: Record<string, schemas['ProductStorefront'][]> = {}
    const uncategorized: schemas['ProductStorefront'][] = []
    for (const p of visibleProducts) {
      const cat = p.category
      if (cat && cat in CATEGORY_LABELS) (buckets[cat] ??= []).push(p)
      else uncategorized.push(p)
    }
    const presentKeys = Object.keys(buckets).filter(
      (k) => k !== 'other' && buckets[k].length > 0 && k in CATEGORY_LABELS,
    )
    const rank = new Map(categoryOrder.map((k, i) => [k, i]))
    const ranked = presentKeys
      .filter((k) => rank.has(k))
      .sort((a, b) => rank.get(a)! - rank.get(b)!)
    const unranked = (
      Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>
    ).filter(
      (k) => k !== 'other' && presentKeys.includes(k) && !rank.has(k),
    )
    const orderedKeys = [...ranked, ...unranked]
    const out = orderedKeys.map((k) => ({
      key: k,
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

  const allCategoryIds = groupedSections.map((s) => CATEGORY_PREFIX + s.key)

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const a = String(active.id)
    const b = String(over.id)

    // Category reorder
    if (a.startsWith(CATEGORY_PREFIX) && b.startsWith(CATEGORY_PREFIX)) {
      const aKey = a.slice(CATEGORY_PREFIX.length)
      const bKey = b.slice(CATEGORY_PREFIX.length)
      const presentKeys = groupedSections.map((s) => s.key as string)
      const seed = categoryOrder.length > 0 ? categoryOrder : presentKeys
      const tail = presentKeys.filter((k) => !seed.includes(k))
      const full = [...seed, ...tail]
      const from = full.indexOf(aKey)
      const to = full.indexOf(bKey)
      if (from < 0 || to < 0) return
      writeSettings({ category_order: arrayMove(full, from, to) } as Partial<Settings>)
      return
    }

    // Product reorder (only within the SAME category, signalled by
    // the section id we encode in the DnD id below).
    if (a.startsWith(PRODUCT_PREFIX) && b.startsWith(PRODUCT_PREFIX)) {
      const [, aSection, aId] = a.split('|')
      const [, bSection, bId] = b.split('|')
      if (aSection !== bSection) return
      const sectionItems = groupedSections.find(
        (s) => s.key === aSection,
      )?.items
      if (!sectionItems) return
      const sectionIds = sectionItems.map((p) => p.id)
      const from = sectionIds.indexOf(aId)
      const to = sectionIds.indexOf(bId)
      if (from < 0 || to < 0) return
      const newSectionOrder = arrayMove(sectionIds, from, to)
      // Weave the new section order back into featuredIds. Items
      // outside this section keep their slots; ids in the section get
      // overwritten in document order. Hidden / unknown ids stay out.
      const visibleSet = new Set(sectionIds)
      const queue = [...newSectionOrder]
      const woven: string[] = []
      for (const id of featuredIds) {
        if (visibleSet.has(id)) {
          const next = queue.shift()
          if (next) woven.push(next)
        } else {
          woven.push(id)
        }
      }
      for (const id of queue) woven.push(id)
      writeSettings({ featured_product_ids: cleanFeaturedIds(woven) })
      return
    }

    // Link reorder
    if (a.startsWith(LINK_PREFIX) && b.startsWith(LINK_PREFIX)) {
      const aId = a.slice(LINK_PREFIX.length)
      const bId = b.slice(LINK_PREFIX.length)
      const from = links.findIndex((l) => l.id === aId)
      const to = links.findIndex((l) => l.id === bId)
      if (from < 0 || to < 0) return
      writeSettings({ storefront_links: arrayMove(links, from, to) })
    }
  }

  const hideProduct = (productId: string) => {
    // Curated mode: drop the id from featured_product_ids. All mode:
    // switch to curated and keep the remaining visible products.
    if (featuredMode === 'curated') {
      writeSettings({
        featured_product_ids: cleanFeaturedIds(
          featuredIds.filter((id) => id !== productId),
        ),
      })
    } else {
      const remainingIds = visibleProducts
        .filter((p) => p.id !== productId)
        .map((p) => p.id)
      writeSettings({
        featured_mode: 'curated',
        featured_product_ids: cleanFeaturedIds(remainingIds),
      })
    }
  }

  const showAllProducts = () => {
    writeSettings({ featured_mode: 'all', featured_product_ids: [] })
  }

  const removeLink = (linkId: string) => {
    writeSettings({ storefront_links: links.filter((l) => l.id !== linkId) })
  }

  const totalItems =
    groupedSections.reduce((n, s) => n + s.items.length, 0) + links.length

  return (
    <aside className="arrange-panel">
      <div className="ap-header">
        <div>
          <h2>Arrange</h2>
          <p className="ap-sub">
            Drag to reorder. Changes preview immediately and apply to
            your published Space when you click Publish.
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

      {totalItems === 0 ? (
        <div className="ap-empty">
          Nothing in your Space yet. Use the &ldquo;+ Add to Space&rdquo;
          button to add products or links.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={onDragEnd}
        >
          {/* ── Products grouped by category ───────────────────────── */}
          {groupedSections.length > 0 && (
            <section className="ap-section">
              <div className="ap-section-head">
                <h3>Products</h3>
                {featuredMode === 'curated' && (
                  <button
                    type="button"
                    className="ap-mini-action"
                    onClick={showAllProducts}
                    title="Show every active product on your Space"
                  >
                    Show all products
                  </button>
                )}
              </div>
              <SortableContext
                items={allCategoryIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="ap-cat-list">
                  {groupedSections.map((section) => (
                    <ListRow
                      key={section.key}
                      id={CATEGORY_PREFIX + section.key}
                    >
                      {({ listeners, attributes }) => (
                        <div className="ap-cat">
                          <div className="ap-cat-head">
                            <Grip
                              listeners={listeners}
                              attributes={attributes}
                              label={`Drag ${section.label} category`}
                            />
                            <span className="ap-cat-label">
                              {section.label}
                            </span>
                            <span className="ap-count">
                              {section.items.length}
                            </span>
                          </div>
                          <SortableContext
                            items={section.items.map(
                              (p) => `${PRODUCT_PREFIX}|${section.key}|${p.id}`,
                            )}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="ap-row-list">
                              {section.items.map((product) => (
                                <ListRow
                                  key={product.id}
                                  id={`${PRODUCT_PREFIX}|${section.key}|${product.id}`}
                                >
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
                                      <span
                                        className="ap-row-name"
                                        title={product.name}
                                      >
                                        {product.name}
                                      </span>
                                      <button
                                        type="button"
                                        className="ap-row-action"
                                        onClick={() => hideProduct(product.id)}
                                        title="Hide from Space"
                                        aria-label={`Hide ${product.name} from Space`}
                                      >
                                        <VisibilityOffOutlined
                                          style={{ fontSize: 16 }}
                                        />
                                      </button>
                                    </div>
                                  )}
                                </ListRow>
                              ))}
                            </div>
                          </SortableContext>
                        </div>
                      )}
                    </ListRow>
                  ))}
                </div>
              </SortableContext>

              {/* Hidden / available products (curated mode only) so the
                  user can bring them back without leaving the panel. */}
              {featuredMode === 'curated' && (
                <HiddenProductsList
                  hidden={products.filter(
                    (p) => !featuredIds.includes(p.id),
                  )}
                  onAdd={(id) =>
                    writeSettings({
                      featured_product_ids: cleanFeaturedIds([
                        ...featuredIds,
                        id,
                      ]),
                    })
                  }
                />
              )}
            </section>
          )}

          {/* ── Links ──────────────────────────────────────────────── */}
          {links.length > 0 && (
            <section className="ap-section">
              <h3>Links</h3>
              <SortableContext
                items={links.map((l) => LINK_PREFIX + l.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="ap-row-list">
                  {links.map((link) => (
                    <ListRow key={link.id} id={LINK_PREFIX + link.id}>
                      {({ listeners, attributes }) => (
                        <div className="ap-row">
                          <Grip
                            listeners={listeners}
                            attributes={attributes}
                            label={`Drag ${link.title || 'link'}`}
                          />
                          <span className="ap-thumb ap-thumb-empty">
                            <LinkOutlined style={{ fontSize: 18 }} />
                          </span>
                          <span
                            className="ap-row-name"
                            title={link.title || link.url}
                          >
                            {link.title || link.url}
                          </span>
                          <button
                            type="button"
                            className="ap-row-action"
                            onClick={() => removeLink(link.id)}
                            title="Remove link"
                            aria-label={`Remove ${link.title || 'link'}`}
                          >
                            <VisibilityOffOutlined
                              style={{ fontSize: 16 }}
                            />
                          </button>
                        </div>
                      )}
                    </ListRow>
                  ))}
                </div>
              </SortableContext>
            </section>
          )}
        </DndContext>
      )}
    </aside>
  )
}

const HiddenProductsList = ({
  hidden,
  onAdd,
}: {
  hidden: schemas['ProductStorefront'][]
  onAdd: (id: string) => void
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
              onClick={() => onAdd(product.id)}
              title="Add to Space"
              aria-label={`Add ${product.name} to Space`}
            >
              <VisibilityOutlined style={{ fontSize: 16 }} />
            </button>
          </div>
        ))}
      </div>
    </details>
  )
}
