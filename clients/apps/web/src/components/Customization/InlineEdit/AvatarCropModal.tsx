'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const CROP_FRAME = 320 // visible crop area in CSS px (square)
const OUTPUT_SIZE = 512 // produced JPEG side length
const MIN_ZOOM = 1
const MAX_ZOOM = 3

type Props = {
  file: File
  onCancel: () => void
  onSave: (blob: Blob) => void | Promise<void>
  // Mirrors the Space's dark theme. The modal portals to <body> (outside the
  // editor's `.space-dark` root), so it carries its own marker class — its
  // Tailwind utilities then theme via the shared space-dark remap.
  dark?: boolean
}

/**
 * Native HTML canvas avatar cropper. The user picks a file (any image
 * format their browser can decode), positions it inside a square frame
 * with drag + zoom, and we output a centred JPEG at OUTPUT_SIZE so the
 * uploaded asset is always small and always renders cleanly in <img>.
 *
 * HEIC / AVIF inputs depend on browser support. If the browser can't
 * decode the file we show a recoverable error instead of silently
 * uploading something the public Space can't render.
 */
export const AvatarCropModal = ({
  file,
  onCancel,
  onSave,
  dark = false,
}: Props) => {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dragRef = useRef<{
    startX: number
    startY: number
    x: number
    y: number
    pid: number
  } | null>(null)

  // Decode the file into an Image we can draw to canvas.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    const img = new Image()
    img.onload = () => setImgEl(img)
    img.onerror = () =>
      setError(
        "We couldn't read this image in your browser. If it's a HEIC photo, export it as JPEG first.",
      )
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // baseScale fills the frame edge-to-edge at zoom = 1.
  const baseScale = imgEl
    ? Math.max(
        CROP_FRAME / imgEl.naturalWidth,
        CROP_FRAME / imgEl.naturalHeight,
      )
    : 1
  const scale = baseScale * zoom
  const dispW = imgEl ? imgEl.naturalWidth * scale : 0
  const dispH = imgEl ? imgEl.naturalHeight * scale : 0

  const clamp = useCallback(
    (next: { x: number; y: number }) => {
      const maxX = Math.max(0, (dispW - CROP_FRAME) / 2)
      const maxY = Math.max(0, (dispH - CROP_FRAME) / 2)
      return {
        x: Math.max(-maxX, Math.min(maxX, next.x)),
        y: Math.max(-maxY, Math.min(maxY, next.y)),
      }
    },
    [dispW, dispH],
  )

  // Re-clamp the offset whenever the displayed image size changes
  // (zoom slider, or the image just finished loading).
  useEffect(() => {
    setOffset((prev) => clamp(prev))
  }, [clamp])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imgEl) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      x: offset.x,
      y: offset.y,
      pid: e.pointerId,
    }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pid !== e.pointerId) return
    setOffset(
      clamp({
        x: drag.x + (e.clientX - drag.startX),
        y: drag.y + (e.clientY - drag.startY),
      }),
    )
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pid === e.pointerId) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      dragRef.current = null
    }
  }

  const handleSave = async () => {
    if (!imgEl || saving) return
    setSaving(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError("Your browser doesn't support image cropping. Try Chrome or Safari.")
        return
      }
      // Source rect in image-natural pixels: the square visible inside
      // the crop frame. centre-of-image - offset/scale gives us the
      // current centre of the crop rectangle in source space.
      const sourceSide = CROP_FRAME / scale
      const cx = imgEl.naturalWidth / 2 - offset.x / scale
      const cy = imgEl.naturalHeight / 2 - offset.y / scale
      const sx = cx - sourceSide / 2
      const sy = cy - sourceSide / 2
      ctx.drawImage(
        imgEl,
        sx,
        sy,
        sourceSide,
        sourceSide,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      )
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      )
      if (!blob) {
        setError('Could not encode the cropped image. Please try again.')
        return
      }
      await onSave(blob)
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Position your avatar"
    >
      <div
        className={`flex w-[420px] max-w-full flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl${
          dark ? ' space-dark' : ''
        }`}
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Position your avatar
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Drag to reposition, slide to zoom. Saved at 512×512.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : !imgEl ? (
          <div
            className="self-center animate-pulse rounded-2xl bg-gray-100"
            style={{ width: CROP_FRAME, height: CROP_FRAME }}
          />
        ) : (
          <div
            className="relative self-center overflow-hidden rounded-2xl bg-gray-900 select-none"
            style={{ width: CROP_FRAME, height: CROP_FRAME, touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl ?? ''}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: dispW,
                height: dispH,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                pointerEvents: 'none',
                cursor: 'grab',
              }}
            />
            {/* Subtle inner border to show the crop bounds */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/30"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="avatar-zoom" className="text-xs font-medium text-gray-700">
            Zoom
          </label>
          <input
            id="avatar-zoom"
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            disabled={!imgEl}
            className="w-full"
          />
        </div>

        <div className="flex flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!imgEl || saving}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save avatar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
