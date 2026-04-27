'use client'

import { cn } from '@spaire/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'

const ASPECT_RATIO = 16 / 9

/**
 * Modal-like overlay for repositioning (and re-cropping) an image into a
 * 16:9 frame. The user pans the image within the frame; on save we render
 * the visible region to a canvas and call back with a JPEG Blob.
 */
export function ThumbnailRepositioner({
  imageUrl,
  isSaving,
  onCancel,
  onSave,
}: {
  imageUrl: string
  isSaving: boolean
  onCancel: () => void
  onSave: (blob: Blob) => void | Promise<void>
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(
    null,
  )
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 })
  const dragRef = useRef<{
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  useEffect(() => {
    if (!frameRef.current) return
    const el = frameRef.current
    const update = () => {
      const w = el.clientWidth
      setFrameSize({ w, h: w / ASPECT_RATIO })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!imgNatural || !frameSize.w) return
    const coverScale = Math.max(
      frameSize.w / imgNatural.w,
      frameSize.h / imgNatural.h,
    )
    setScale(coverScale)
    setOffset({ x: 0, y: 0 })
  }, [imgNatural, frameSize.w, frameSize.h])

  const renderedW = imgNatural ? imgNatural.w * scale : 0
  const renderedH = imgNatural ? imgNatural.h * scale : 0

  const maxOffsetX = Math.max(0, (renderedW - frameSize.w) / 2)
  const maxOffsetY = Math.max(0, (renderedH - frameSize.h) / 2)

  const clamp = (x: number, y: number) => ({
    x: Math.max(-maxOffsetX, Math.min(maxOffsetX, x)),
    y: Math.max(-maxOffsetY, Math.min(maxOffsetY, y)),
  })

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const next = clamp(
      drag.originX + (e.clientX - drag.startX),
      drag.originY + (e.clientY - drag.startY),
    )
    setOffset(next)
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const handleSave = async () => {
    if (!imgRef.current || !imgNatural) return
    const outW = 1280
    const outH = Math.round(outW / ASPECT_RATIO)

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const visibleW = frameSize.w / scale
    const visibleH = frameSize.h / scale
    const cx = imgNatural.w / 2 - offset.x / scale
    const cy = imgNatural.h / 2 - offset.y / scale
    const sx = cx - visibleW / 2
    const sy = cy - visibleH / 2

    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(imgRef.current, sx, sy, visibleW, visibleH, 0, 0, outW, outH)

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!blob) return
    await onSave(blob)
  }

  const zoomValue = imgNatural
    ? scale / Math.max(frameSize.w / imgNatural.w, frameSize.h / imgNatural.h)
    : 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-base font-bold text-gray-900">
          Reposition thumbnail
        </h3>
        <p className="mb-4 text-xs text-gray-500">
          Drag the image to pick the part that appears in the 16:9 thumbnail.
        </p>

        <div
          ref={frameRef}
          className="relative w-full overflow-hidden rounded-xl bg-gray-900 select-none"
          style={{ aspectRatio: '16 / 9' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget
              setImgNatural({ w: el.naturalWidth, h: el.naturalHeight })
            }}
            className={cn(
              'absolute top-1/2 left-1/2 max-w-none cursor-grab active:cursor-grabbing',
              !imgNatural && 'opacity-0',
            )}
            style={{
              width: renderedW || 'auto',
              height: renderedH || 'auto',
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-xs text-gray-600">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoomValue}
            onChange={(e) => {
              if (!imgNatural) return
              const cover = Math.max(
                frameSize.w / imgNatural.w,
                frameSize.h / imgNatural.h,
              )
              const next = cover * parseFloat(e.target.value)
              setScale(next)
              const newRenderedW = imgNatural.w * next
              const newRenderedH = imgNatural.h * next
              const mx = Math.max(0, (newRenderedW - frameSize.w) / 2)
              const my = Math.max(0, (newRenderedH - frameSize.h) / 2)
              setOffset((prev) => ({
                x: Math.max(-mx, Math.min(mx, prev.x)),
                y: Math.max(-my, Math.min(my, prev.y)),
              }))
            }}
            className="flex-1"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !imgNatural}
            className="rounded-full bg-gray-900 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save thumbnail'}
          </button>
        </div>
      </div>
    </div>
  )
}
