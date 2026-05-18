import { useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import { EditableText } from '../../email-marketing/_components/blockEditor/EditableText'
import {
  AudioBlock,
  CalloutBlock,
  EmbedBlock,
  GalleryBlock,
  GalleryImage,
  PaywallBlock,
  PollBlock,
  PollOption,
  PullQuoteBlock,
  newId,
} from '../../email-marketing/_components/blockEditor/types'

// Per-block edit surfaces for the seven newsletter-specific block
// types. Each body is self-contained (no external state), mirrors the
// block's rendered look, and writes via the supplied `patch` callback
// — matching the BlockEditor convention so they can be slotted into
// the same canvas hover-chrome.

export function PullQuoteBody({
  block,
  onChange,
}: {
  block: PullQuoteBlock
  onChange: (next: PullQuoteBlock) => void
}) {
  return (
    <EditableText
      multiline
      value={block.text}
      onChange={(text) => onChange({ ...block, text })}
      placeholder="Words worth pulling out"
      style={{
        margin: '28px 0',
        padding: '0 16px',
        textAlign: 'center',
        fontFamily:
          'Georgia, "New York", "Iowan Old Style", Charter, serif',
        fontSize: 24,
        lineHeight: 1.35,
        color: '#1d1d1f',
        fontStyle: 'italic',
        letterSpacing: '-0.01em',
      }}
    />
  )
}

export function CalloutBody({
  block,
  onChange,
}: {
  block: CalloutBlock
  onChange: (next: CalloutBlock) => void
}) {
  return (
    <div
      style={{
        margin: '20px 0',
        padding: '16px 18px',
        border: '1px solid #e5e5ea',
        borderRadius: 10,
        background: '#fafafa',
      }}
    >
      <EditableText
        value={block.label ?? ''}
        onChange={(label) => onChange({ ...block, label })}
        placeholder="Editor's note"
        style={{
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#86868b',
          fontWeight: 600,
          marginBottom: 6,
        }}
      />
      <EditableText
        multiline
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        placeholder="A boxed aside readers should notice."
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: '#1d1d1f',
        }}
      />
    </div>
  )
}

export function GalleryBody({
  block,
  onChange,
  uploadImage,
}: {
  block: GalleryBlock
  onChange: (next: GalleryBlock) => void
  uploadImage: ((file: File) => Promise<string>) | undefined
}) {
  const setImage = (id: string, patch: Partial<GalleryImage>) =>
    onChange({
      ...block,
      images: block.images.map((im) => (im.id === id ? { ...im, ...patch } : im)),
    })

  const addImage = () =>
    onChange({
      ...block,
      images: [...block.images, { id: newId(), src: '', alt: '' }],
    })

  const removeImage = (id: string) =>
    onChange({
      ...block,
      images: block.images.filter((im) => im.id !== id),
    })

  return (
    <div style={{ margin: '14px 0' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(block.images.length, 1)}, 1fr)`,
          gap: 8,
        }}
      >
        {block.images.map((im) => (
          <GalleryCell
            key={im.id}
            image={im}
            uploadImage={uploadImage}
            onChange={(patch) => setImage(im.id, patch)}
            onRemove={() => removeImage(im.id)}
          />
        ))}
      </div>
      {block.images.length < 4 && (
        <button
          type="button"
          onClick={addImage}
          style={{
            marginTop: 10,
            padding: '5px 10px',
            border: '1px dashed #d1d1d6',
            borderRadius: 7,
            background: 'transparent',
            color: '#86868b',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          + Add image
        </button>
      )}
    </div>
  )
}

function GalleryCell({
  image,
  uploadImage,
  onChange,
  onRemove,
}: {
  image: GalleryImage
  uploadImage: ((file: File) => Promise<string>) | undefined
  onChange: (patch: Partial<GalleryImage>) => void
  onRemove: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const onFile = async (file: File | undefined) => {
    if (!file || !uploadImage) return
    setUploading(true)
    try {
      const url = await uploadImage(file)
      onChange({ src: url, alt: file.name })
    } finally {
      setUploading(false)
    }
  }
  return (
    <div style={{ position: 'relative' }}>
      <label
        style={{
          display: 'block',
          aspectRatio: '4 / 3',
          borderRadius: 8,
          border: '1px dashed #d1d1d6',
          background: image.src ? 'transparent' : '#fafafa',
          color: '#86868b',
          fontSize: 12,
          textAlign: 'center',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        {image.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.src}
            alt={image.alt ?? ''}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              opacity: uploading ? 0.5 : 1,
            }}
          />
        ) : (
          <span style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
            {uploading ? 'Uploading…' : 'Click to upload'}
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      <EditableText
        value={image.caption ?? ''}
        onChange={(caption) => onChange({ caption })}
        placeholder="Caption (optional)"
        style={{
          marginTop: 6,
          fontSize: 11.5,
          color: '#86868b',
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove image"
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 22,
          height: 22,
          borderRadius: 6,
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid rgba(0,0,0,0.06)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon name="x" size={11} />
      </button>
    </div>
  )
}

export function EmbedBody({
  block,
  onChange,
}: {
  block: EmbedBlock
  onChange: (next: EmbedBlock) => void
}) {
  return (
    <div
      style={{
        margin: '16px 0',
        padding: '14px 18px',
        border: '1px solid #e5e5ea',
        borderRadius: 10,
        background: '#fafafa',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#86868b',
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        Embed
      </div>
      <input
        value={block.url}
        onChange={(e) => onChange({ ...block, url: e.target.value })}
        placeholder="Paste a YouTube, X, Spotify, or oEmbed URL"
        style={{
          width: '100%',
          padding: '7px 10px',
          border: '1px solid #e5e5ea',
          borderRadius: 7,
          fontSize: 13,
          background: '#fff',
          outline: 'none',
        }}
      />
      <EditableText
        value={block.caption ?? ''}
        onChange={(caption) => onChange({ ...block, caption })}
        placeholder="Caption (optional)"
        style={{ marginTop: 8, fontSize: 12, color: '#86868b' }}
      />
    </div>
  )
}

export function PollBody({
  block,
  onChange,
}: {
  block: PollBlock
  onChange: (next: PollBlock) => void
}) {
  const setOption = (id: string, patch: Partial<PollOption>) =>
    onChange({
      ...block,
      options: block.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })

  const addOption = () =>
    onChange({
      ...block,
      options: [...block.options, { id: newId(), text: 'New option' }],
    })

  const removeOption = (id: string) =>
    onChange({
      ...block,
      options: block.options.filter((o) => o.id !== id),
    })

  return (
    <div
      style={{
        margin: '20px 0',
        padding: 16,
        border: '1px solid #e5e5ea',
        borderRadius: 12,
        background: '#fafafa',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#86868b',
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Poll
      </div>
      <EditableText
        value={block.question}
        onChange={(question) => onChange({ ...block, question })}
        placeholder="Ask your subscribers a question"
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#1d1d1f',
          marginBottom: 12,
          letterSpacing: '-0.01em',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {block.options.map((o) => (
          <div
            key={o.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: '#fff',
              border: '1px solid #e5e5ea',
              borderRadius: 8,
            }}
          >
            <EditableText
              value={o.text}
              onChange={(text) => setOption(o.id, { text })}
              placeholder="Option text"
              style={{ flex: 1, fontSize: 13.5, color: '#1d1d1f' }}
            />
            <button
              type="button"
              onClick={() => removeOption(o.id)}
              aria-label="Remove option"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#86868b',
                display: 'inline-flex',
                padding: 0,
              }}
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addOption}
        style={{
          marginTop: 8,
          padding: '5px 10px',
          border: '1px dashed #d1d1d6',
          borderRadius: 7,
          background: 'transparent',
          color: '#86868b',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        + Add option
      </button>
    </div>
  )
}

export function PaywallBody({
  block,
  accent,
  onChange,
}: {
  block: PaywallBlock
  accent: string
  onChange: (next: PaywallBlock) => void
}) {
  return (
    <div
      style={{
        margin: '28px 0',
        padding: 24,
        border: '1px solid #e5e5ea',
        borderRadius: 14,
        background: '#fff',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: accent,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        ✨ Members only
      </div>
      <EditableText
        value={block.headline ?? ''}
        onChange={(headline) => onChange({ ...block, headline })}
        placeholder="Subscribe to keep reading"
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: '#1d1d1f',
          letterSpacing: '-0.01em',
          marginBottom: 8,
        }}
      />
      <EditableText
        multiline
        value={block.body ?? ''}
        onChange={(body) => onChange({ ...block, body })}
        placeholder="The rest of this post is for paying subscribers."
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: '#6e6e73',
          marginBottom: 14,
        }}
      />
      <EditableText
        as="span"
        value={block.cta_text ?? ''}
        onChange={(cta_text) => onChange({ ...block, cta_text })}
        placeholder="Become a subscriber"
        style={{
          display: 'inline-block',
          background: accent,
          color: '#fff',
          padding: '11px 22px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
        }}
      />
      <div style={{ marginTop: 10, fontSize: 11, color: '#86868b' }}>
        Everything below this block is hidden from non-subscribers.
      </div>
    </div>
  )
}

export function AudioBody({
  block,
  accent,
  onChange,
}: {
  block: AudioBlock
  accent: string
  onChange: (next: AudioBlock) => void
}) {
  return (
    <div
      style={{
        margin: '20px 0',
        padding: 16,
        border: '1px solid #e5e5ea',
        borderRadius: 12,
        background: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: accent,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          ▶
        </div>
        <EditableText
          value={block.title ?? ''}
          onChange={(title) => onChange({ ...block, title })}
          placeholder="Listen to this issue"
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 600,
            color: '#1d1d1f',
          }}
        />
      </div>
      <input
        value={block.src ?? ''}
        onChange={(e) => onChange({ ...block, src: e.target.value })}
        placeholder="Audio URL (mp3 / wav)"
        style={{
          width: '100%',
          padding: '7px 10px',
          border: '1px solid #e5e5ea',
          borderRadius: 7,
          fontSize: 12.5,
          background: '#fff',
          outline: 'none',
          marginBottom: 6,
        }}
      />
      <input
        value={block.embed_url ?? ''}
        onChange={(e) => onChange({ ...block, embed_url: e.target.value })}
        placeholder="…or a Spotify / Apple Podcasts link"
        style={{
          width: '100%',
          padding: '7px 10px',
          border: '1px solid #e5e5ea',
          borderRadius: 7,
          fontSize: 12.5,
          background: '#fff',
          outline: 'none',
        }}
      />
    </div>
  )
}
