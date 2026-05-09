'use client'

import { Storefront } from '@/components/Profile/Storefront'
import { StorefrontLinks } from '@/components/Profile/StorefrontLinks'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { schemas } from '@spaire/client'
import { useFormContext } from 'react-hook-form'

type BlockKind = 'products' | 'links' | 'forms'

const DEFAULT_ORDER: BlockKind[] = ['products', 'links']

// Pull block_order off settings (with the same backfill from
// links_position the renderer uses, so a fresh org with no
// block_order set still drags from a sensible state).
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

const Sortable = ({
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
  } = useSortable({ id })
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

/**
 * Editor-only wrapper around the public Storefront renderer that
 * exposes block-level drag-to-reorder. The user's block_order is the
 * source of truth — whatever order they leave the canvas in is what
 * visitors will see when published.
 *
 * Per-item drag (reordering products within a category, links within
 * their layout) is a follow-up; this PR ships block-level reorder
 * because that's the highest-value bit and the smallest contract
 * change.
 */
export const DraggableBlocks = ({
  organization,
  products,
}: {
  organization: schemas['Organization']
  products: schemas['ProductStorefront'][]
}) => {
  const { watch, setValue } = useFormContext<schemas['OrganizationUpdate']>()
  const settings = (watch('storefront_settings') ??
    organization.storefront_settings) as
    | schemas['OrganizationStorefrontSettings']
    | undefined

  const blockOrder = getBlockOrder(settings)

  // Filter blocks down to ones that have content. Empty blocks render
  // nothing; we still allow dragging them so the user's intended order
  // is preserved when they later add content.
  const linksLayout = settings?.links_layout ?? 'classic'
  const storefrontLinks =
    (settings as { storefront_links?: Parameters<typeof StorefrontLinks>[0]['links'] } | undefined)
      ?.storefront_links ?? []

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Tiny activation distance so a click on an inline-editable
      // target doesn't accidentally start a drag.
      activationConstraint: { distance: 4 },
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = blockOrder.indexOf(active.id as BlockKind)
    const to = blockOrder.indexOf(over.id as BlockKind)
    if (from < 0 || to < 0) return
    const next = arrayMove(blockOrder, from, to)
    setValue(
      'storefront_settings',
      { ...(settings ?? {}), block_order: next },
      { shouldDirty: true },
    )
  }

  // Render helpers for each block. We delegate the actual rendering
  // back to Storefront for products (so categorization + featured_mode
  // logic stays in one place) and StorefrontLinks for links.
  const renderBlock = (kind: BlockKind) => {
    if (kind === 'products') {
      // Reuse Storefront with a synthetic block_order containing only
      // 'products' so it renders just the product sections.
      const orgWithProductsOnly = {
        ...organization,
        storefront_settings: {
          ...(settings ?? {}),
          block_order: ['products'],
        },
      } as schemas['Organization']
      return (
        <Storefront
          organization={orgWithProductsOnly}
          products={products}
          preview
        />
      )
    }
    if (kind === 'links') {
      if (storefrontLinks.length === 0) return null
      return (
        <StorefrontLinks
          links={storefrontLinks}
          layout={linksLayout}
        />
      )
    }
    return null
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={blockOrder} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-12">
          {blockOrder.map((kind) => {
            const content = renderBlock(kind)
            if (!content) return null
            return (
              <Sortable key={kind} id={kind}>
                {({ listeners, attributes }) => (
                  <>
                    <button
                      type="button"
                      className="block-drag-handle"
                      aria-label={`Drag ${kind} block`}
                      {...listeners}
                      {...attributes}
                    >
                      ⋮⋮
                    </button>
                    <div className="canvas-card">{content}</div>
                  </>
                )}
              </Sortable>
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}
