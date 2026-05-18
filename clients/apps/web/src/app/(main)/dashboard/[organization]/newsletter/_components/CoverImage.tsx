import { useRef, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'

export type CoverImageUploader = (file: File) => Promise<string>

/**
 * Hero cover image for a NewsletterPost. Three states:
 *   - hidden (returns "Add cover image" affordance)
 *   - empty  (centred "Click to upload" zone)
 *   - filled (image with replace / remove actions on hover)
 *
 * Authoring concern only; the actual cover_url lives on the post.
 */
export function CoverImage({
  src,
  visible,
  uploadImage,
  onChange,
  onToggleVisible,
}: {
  src: string | null | undefined
  visible: boolean
  uploadImage: CoverImageUploader | undefined
  onChange: (next: string | null) => void
  onToggleVisible: (visible: boolean) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = () => fileRef.current?.click()

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (!uploadImage) {
      setError('Image upload not configured')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Not a recognised image format')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Image is over 12MB')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const url = await uploadImage(file)
      onChange(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (!visible) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => onToggleVisible(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            border: '1px dashed #d1d1d6',
            borderRadius: 8,
            background: 'transparent',
            color: '#86868b',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Icon name="image" size={14} />
          Add cover image
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', marginBottom: 28 }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {src ? (
        <div style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            style={{
              display: 'block',
              width: '100%',
              aspectRatio: '16 / 9',
              objectFit: 'cover',
              borderRadius: 12,
              opacity: uploading ? 0.6 : 1,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              display: 'flex',
              gap: 6,
            }}
          >
            <CoverButton title="Replace" onClick={pick} icon="refresh" />
            <CoverButton
              title="Remove"
              onClick={() => onChange(null)}
              icon="x"
            />
            <CoverButton
              title="Hide cover"
              onClick={() => onToggleVisible(false)}
              icon="eye-off"
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          style={{
            display: 'block',
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: 12,
            border: '1px dashed #d1d1d6',
            background: '#fafafa',
            color: '#86868b',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {uploading ? 'Uploading…' : 'Click to upload a cover image'}
        </button>
      )}
      {error && (
        <div style={{ marginTop: 8, color: '#c33', fontSize: 12 }}>{error}</div>
      )}
    </div>
  )
}

function CoverButton({
  title,
  icon,
  onClick,
}: {
  title: string
  icon: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        borderRadius: 7,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(0,0,0,0.06)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      <Icon name={icon} size={13} />
    </button>
  )
}
