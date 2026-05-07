'use client'

import {
  ChangeEvent,
  FocusEvent,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import './CoachingLanding.css'
import { defaultCoachingLandingData } from './CoachingLanding.defaults'
import type {
  CoachingLandingData,
  CoachingLandingMediaType,
} from './CoachingLanding.types'

type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'spaire-landing-theme'
const CAROUSEL_INTERVAL_MS = 3500

export type CoachingLandingProps = {
  program?: CoachingLandingData
  editable?: boolean
  onChange?: (next: CoachingLandingData) => void
  // When set (public-mode only), the Atlas "Order" button navigates here.
  // Ignored when editable is true (we show a tooltip instead).
  buyHref?: string
  // When provided AND `editable` is true, file inputs persist their selection
  // to the backend instead of relying on a temporary blob URL. The blob URL is
  // shown optimistically while the upload is in flight; on success it is
  // replaced with the persisted URL via `onChange`. On error the slot reverts
  // and shows a brief red border.
  onUploadFile?: (
    file: File,
  ) => Promise<{ url: string; kind: CoachingLandingMediaType }>
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

// Immutable nested-path setter: setIn(obj, ['a','b',0,'c'], value)
type PathSegment = string | number
const setIn = <T,>(obj: T, path: PathSegment[], value: unknown): T => {
  if (path.length === 0) return value as T
  const [head, ...rest] = path
  if (typeof head === 'number') {
    const arr = Array.isArray(obj) ? [...(obj as unknown[])] : []
    arr[head] = setIn(arr[head], rest, value)
    return arr as unknown as T
  }
  const next = { ...(obj as object) } as Record<string, unknown>
  next[head] = setIn(
    (obj as Record<string, unknown> | undefined)?.[head],
    rest,
    value,
  )
  return next as T
}

/* -------------------------------------------------------------------------- */
/*  Editable text primitive                                                   */
/* -------------------------------------------------------------------------- */

type EditableTextProps = {
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3'
  className?: string
  value: string
  editable: boolean
  onCommit: (next: string) => void
  children?: ReactNode
}

const EditableText = ({
  as = 'span',
  className,
  value,
  editable,
  onCommit,
  children,
}: EditableTextProps) => {
  const Tag = as as 'span'
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLElement>) => {
      const next = e.currentTarget.textContent ?? ''
      if (next !== value) onCommit(next)
    },
    [value, onCommit],
  )
  if (!editable) {
    return (
      <Tag className={className}>
        {children ?? value}
      </Tag>
    )
  }
  return (
    <Tag
      className={className}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
    >
      {children ?? value}
    </Tag>
  )
}

/* -------------------------------------------------------------------------- */
/*  Media slot (image or video, optional click-to-upload)                     */
/* -------------------------------------------------------------------------- */

type UploadFile = (
  file: File,
) => Promise<{ url: string; kind: CoachingLandingMediaType }>

// Shared file-input handler. Optimistically commits the blob URL via
// `onUpload`, awaits the persisted URL from `uploader` (if any) and then
// replaces it. On failure with a `uploader` set, reverts to the previous URL
// and flashes a red border on the slot via `onError`.
const useUploadHandler = ({
  prevUrl,
  prevType,
  uploader,
  onUpload,
  onError,
}: {
  prevUrl: string | null
  prevType: CoachingLandingMediaType
  uploader?: UploadFile
  onUpload: (url: string, type: CoachingLandingMediaType) => void
  onError?: () => void
}) =>
  useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const blobUrl = URL.createObjectURL(file)
      const kind: CoachingLandingMediaType = file.type.startsWith('video/')
        ? 'video'
        : 'image'
      onUpload(blobUrl, kind)
      if (!uploader) return
      try {
        const { url, kind: serverKind } = await uploader(file)
        onUpload(url, serverKind)
      } catch (err) {
        console.warn('[CoachingLanding] upload failed', err)
        onUpload(prevUrl ?? '', prevType)
        // Revert to "no media" if there was none originally.
        if (!prevUrl) onUpload('', prevType)
        onError?.()
      } finally {
        // Reset the input so picking the same file again re-triggers change.
        e.target.value = ''
      }
    },
    [onUpload, uploader, prevUrl, prevType, onError],
  )

type MediaSlotProps = {
  url: string | null
  type: CoachingLandingMediaType
  editable: boolean
  onUpload: (url: string, type: CoachingLandingMediaType) => void
  uploader?: UploadFile
  className?: string
  children?: ReactNode
}

const MediaSlot = ({
  url,
  type,
  editable,
  onUpload,
  uploader,
  className,
  children,
}: MediaSlotProps) => {
  const [errorFlash, setErrorFlash] = useState(false)
  const handleChange = useUploadHandler({
    prevUrl: url,
    prevType: type,
    uploader,
    onUpload,
    onError: () => {
      setErrorFlash(true)
      window.setTimeout(() => setErrorFlash(false), 2000)
    },
  })

  const wrapperClass = `${className ?? ''}${editable ? ' img-slot' : ''}${
    errorFlash ? ' upload-error' : ''
  }`.trim()

  return (
    <div className={wrapperClass}>
      {editable ? (
        <input type="file" accept="image/*,video/*" onChange={handleChange} />
      ) : null}
      {url ? (
        type === 'video' ? (
          <video
            src={url}
            autoPlay
            muted
            loop
            playsInline
            key={url}
          />
        ) : (
          <img src={url} alt="" />
        )
      ) : null}
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Sub-sections                                                              */
/* -------------------------------------------------------------------------- */

type SectionProps = {
  data: CoachingLandingData
  editable: boolean
  update: (path: PathSegment[], value: unknown) => void
  uploader?: UploadFile
}

const NavPill = ({ data, editable, update }: SectionProps) => (
  <div className="nav-pill">
    <EditableText
      value={data.nav.brand}
      editable={editable}
      onCommit={(v) => update(['nav', 'brand'], v)}
    />
    <div className="menu-icon">
      <span></span>
      <span></span>
    </div>
  </div>
)

type HeroProps = SectionProps & {
  onSeePrograms: () => void
}

const Hero = ({ data, editable, update, onSeePrograms, uploader }: HeroProps) => {
  const { hero } = data
  const [errorFlash, setErrorFlash] = useState(false)
  const handleHeroFile = useUploadHandler({
    prevUrl: hero.heroMediaUrl,
    prevType: hero.heroMediaType,
    uploader,
    onUpload: (url, type) => {
      update(['hero', 'heroMediaUrl'], url || null)
      update(['hero', 'heroMediaType'], type)
    },
    onError: () => {
      setErrorFlash(true)
      window.setTimeout(() => setErrorFlash(false), 2000)
    },
  })
  return (
    <section className="hero">
      <div
        className={`hero-frame${editable ? ' img-slot' : ''}${
          errorFlash ? ' upload-error' : ''
        }`}
      >
        {editable ? (
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleHeroFile}
          />
        ) : null}
        {hero.heroMediaUrl ? (
          hero.heroMediaType === 'video' ? (
            <video
              src={hero.heroMediaUrl}
              autoPlay
              muted
              loop
              playsInline
              key={hero.heroMediaUrl}
            />
          ) : (
            <img src={hero.heroMediaUrl} alt="" />
          )
        ) : null}

        <div className="hero-content">
          <h1>
            {hero.titleParts.map((part, i) => {
              const next = hero.titleParts[i + 1]
              const cls = part.italic ? 'serif-i' : undefined
              // Match prototype layout: line-break after the 2nd part,
              // no space before a trailing punctuation-only part (e.g. "."),
              // single space between all other parts.
              let separator: ReactNode = null
              if (i === 1) {
                separator = <br />
              } else if (next) {
                const isPunctuation = /^[.,!?;:]+$/.test(next.text)
                separator = isPunctuation ? null : ' '
              }
              return (
                <span key={i}>
                  <EditableText
                    className={cls}
                    value={part.text}
                    editable={editable}
                    onCommit={(v) =>
                      update(['hero', 'titleParts', i, 'text'], v)
                    }
                  />
                  {separator}
                </span>
              )
            })}
          </h1>
          <EditableText
            as="p"
            className="sub"
            value={hero.subtitle}
            editable={editable}
            onCommit={(v) => update(['hero', 'subtitle'], v)}
          />
          <div className="cta-row">
            <button
              className="btn-primary"
              onClick={onSeePrograms}
              type="button"
            >
              <EditableText
                value={hero.ctaPrimary}
                editable={editable}
                onCommit={(v) => update(['hero', 'ctaPrimary'], v)}
              />
            </button>
            <button className="btn-ghost" type="button">
              <EditableText
                value={hero.ctaSecondary}
                editable={editable}
                onCommit={(v) => update(['hero', 'ctaSecondary'], v)}
              />{' '}
              <span className="arrow">→</span>
            </button>
          </div>
        </div>

        <div className="clients-pill">
          <div className="stack">
            {hero.clientsAvatars.map((src, i) => (
              <div key={i} style={{ backgroundImage: `url(${src})` }} />
            ))}
          </div>
          <EditableText
            value={hero.clientsPillText}
            editable={editable}
            onCommit={(v) => update(['hero', 'clientsPillText'], v)}
          />
        </div>
      </div>
    </section>
  )
}

type CoreEvolutionProps = SectionProps & {
  onJoin: () => void
  programsRef: RefObject<HTMLElement | null>
}

const CoreEvolution = ({
  data,
  editable,
  update,
  onJoin,
  programsRef,
  uploader,
}: CoreEvolutionProps) => {
  const { coreEvolution: ce } = data
  return (
    <section
      className="ce-section"
      ref={programsRef as RefObject<HTMLElement>}
    >
      <div className="ce-left">
        <EditableText
          as="h2"
          value={ce.heading}
          editable={editable}
          onCommit={(v) => update(['coreEvolution', 'heading'], v)}
        />
        <EditableText
          as="p"
          className="desc"
          value={ce.description}
          editable={editable}
          onCommit={(v) => update(['coreEvolution', 'description'], v)}
        />
        <div className="ce-results">
          <EditableText
            as="h3"
            value={ce.resultsHeading}
            editable={editable}
            onCommit={(v) => update(['coreEvolution', 'resultsHeading'], v)}
          />
          <div className="results-grid">
            {ce.stats.map((stat, i) => (
              <div className="result-stat" key={i}>
                <div className="row">
                  <EditableText
                    value={stat.label}
                    editable={editable}
                    onCommit={(v) =>
                      update(['coreEvolution', 'stats', i, 'label'], v)
                    }
                  />
                  <EditableText
                    className="val"
                    value={stat.value}
                    editable={editable}
                    onCommit={(v) =>
                      update(['coreEvolution', 'stats', i, 'value'], v)
                    }
                  />
                </div>
                <div className="bar">
                  <div style={{ width: `${stat.barPercent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={onJoin}
          type="button"
          style={{
            background: 'var(--btn-bg)',
            color: 'var(--btn-fg)',
          }}
        >
          <EditableText
            value={ce.cta}
            editable={editable}
            onCommit={(v) => update(['coreEvolution', 'cta'], v)}
          />
        </button>
      </div>
      <div className="ce-right">
        <MediaSlot
          className="ce-img-wrap"
          url={ce.mediaUrl}
          type={ce.mediaType}
          editable={editable}
          uploader={uploader}
          onUpload={(url, type) => {
            update(['coreEvolution', 'mediaUrl'], url || null)
            update(['coreEvolution', 'mediaType'], type)
          }}
        >
          <EditableText
            className="ce-img-caption"
            value={ce.caption}
            editable={editable}
            onCommit={(v) => update(['coreEvolution', 'caption'], v)}
          />
        </MediaSlot>
      </div>
    </section>
  )
}

const Courses = ({ data, editable, update }: SectionProps) => {
  const { courses } = data
  return (
    <section className="courses">
      <div className="courses-head">
        <div>
          <EditableText
            as="h2"
            value={courses.heading}
            editable={editable}
            onCommit={(v) => update(['courses', 'heading'], v)}
          />
          <EditableText
            as="p"
            value={courses.lede}
            editable={editable}
            onCommit={(v) => update(['courses', 'lede'], v)}
          />
        </div>
        <div className="courses-formats">
          <div>Formats explained:</div>
          <div className="row">
            {courses.formats.map((f, i) => (
              <div className="fmt" key={i}>
                {f}
                <sup>0</sup>
              </div>
            ))}
          </div>
        </div>
      </div>

      {courses.modules.map((mod, mi) => (
        <div className="module" key={mi}>
          <div className="num">{String(mi + 1).padStart(2, '0')}</div>
          <EditableText
            as="div"
            className="title"
            value={mod.title}
            editable={editable}
            onCommit={(v) => update(['courses', 'modules', mi, 'title'], v)}
          />
          <div className="lessons">
            {mod.lessons.map((lesson, li) => (
              <div className="lesson" key={li}>
                <span className="lnum">{lesson.code}</span>
                <EditableText
                  className="ltext"
                  value={lesson.text}
                  editable={editable}
                  onCommit={(v) =>
                    update(
                      ['courses', 'modules', mi, 'lessons', li, 'text'],
                      v,
                    )
                  }
                />
                <span className="lkind">{lesson.kind}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

const Faq = ({ data, editable, update }: SectionProps) => {
  const { faq } = data
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  return (
    <section className="faq">
      <EditableText
        as="h2"
        value={faq.heading}
        editable={editable}
        onCommit={(v) => update(['faq', 'heading'], v)}
      />
      <EditableText
        as="p"
        className="lede"
        value={faq.lede}
        editable={editable}
        onCommit={(v) => update(['faq', 'lede'], v)}
      />
      <button className="faq-cta" type="button">
        <EditableText
          value={faq.cta}
          editable={editable}
          onCommit={(v) => update(['faq', 'cta'], v)}
        />
      </button>
      <div className="faq-list">
        {faq.items.map((item, i) => {
          const isOpen = openIdx === i
          return (
            <div className={`faq-item${isOpen ? ' open' : ''}`} key={i}>
              <button
                className="faq-q"
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : i)}
              >
                <EditableText
                  value={item.q}
                  editable={editable}
                  onCommit={(v) => update(['faq', 'items', i, 'q'], v)}
                />
                <span className="plus">+</span>
              </button>
              <EditableText
                as="div"
                className="faq-a"
                value={item.a}
                editable={editable}
                onCommit={(v) => update(['faq', 'items', i, 'a'], v)}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

type AtlasModalProps = SectionProps & {
  open: boolean
  onClose: () => void
  buyHref?: string
}

const AtlasModal = ({
  data,
  editable,
  update,
  open,
  onClose,
  buyHref,
  uploader,
}: AtlasModalProps) => {
  const { atlas } = data
  const [activeSlide, setActiveSlide] = useState(0)
  const [atlasError, setAtlasError] = useState(false)

  const handleAtlasFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const blobUrl = URL.createObjectURL(file)
      const prev = atlas.slides[0] ?? null
      update(['atlas', 'slides', 0], blobUrl)
      if (uploader) {
        try {
          const { url } = await uploader(file)
          update(['atlas', 'slides', 0], url)
        } catch (err) {
          console.warn('[CoachingLanding] atlas slide upload failed', err)
          update(['atlas', 'slides', 0], prev ?? '')
          setAtlasError(true)
          window.setTimeout(() => setAtlasError(false), 2000)
        }
      }
      e.target.value = ''
    },
    [atlas.slides, uploader, update],
  )

  // Carousel — only when modal is open
  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => {
      setActiveSlide((prev) =>
        atlas.slides.length > 0
          ? (prev + 1) % atlas.slides.length
          : 0,
      )
    }, CAROUSEL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [open, atlas.slides.length])

  // Body scroll lock
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
    return undefined
  }, [open])

  // Reset to first slide when reopening
  useEffect(() => {
    if (open) setActiveSlide(0)
  }, [open])

  return (
    <div className={`modal-bg${open ? ' open' : ''}`}>
      <button
        className="modal-close"
        type="button"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <section className="program-detail">
        <div
          className={`pd-img${editable ? ' img-slot' : ''}${
            atlasError ? ' upload-error' : ''
          }`}
        >
          {editable ? (
            <input
              type="file"
              accept="image/*"
              onChange={handleAtlasFile}
            />
          ) : null}
          {atlas.slides.map((src, i) => (
            <div
              key={i}
              className={`slide${i === activeSlide ? ' active' : ''}`}
            >
              <img src={src} alt="" />
            </div>
          ))}
          <div className="pd-dots">
            {atlas.slides.map((_, i) => (
              <div
                key={i}
                className={`dot${i === activeSlide ? ' active' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="pd-right">
          <EditableText
            as="div"
            className="pd-eyebrow"
            value={atlas.eyebrow}
            editable={editable}
            onCommit={(v) => update(['atlas', 'eyebrow'], v)}
          />
          <EditableText
            as="h1"
            className="pd-title"
            value={atlas.title}
            editable={editable}
            onCommit={(v) => update(['atlas', 'title'], v)}
          />
          <div className="pd-meta">
            {atlas.meta.map((m, i) => (
              <div key={i}>
                <EditableText
                  as="div"
                  className="label"
                  value={m.label}
                  editable={editable}
                  onCommit={(v) => update(['atlas', 'meta', i, 'label'], v)}
                />
                <EditableText
                  as="div"
                  className="val"
                  value={m.value}
                  editable={editable}
                  onCommit={(v) => update(['atlas', 'meta', i, 'value'], v)}
                />
              </div>
            ))}
          </div>
          <button
            className="pd-order"
            type="button"
            onClick={() => {
              if (editable) return
              if (buyHref && typeof window !== 'undefined') {
                window.location.href = buyHref
              }
            }}
            title={
              editable
                ? "This is your buyer's checkout button."
                : undefined
            }
            style={editable ? { cursor: 'help' } : undefined}
          >
            <EditableText
              value={atlas.orderCta}
              editable={editable}
              onCommit={(v) => update(['atlas', 'orderCta'], v)}
            />
          </button>
          {atlas.sections.map((s, i) => (
            <div className="pd-section" key={i}>
              <EditableText
                as="div"
                className="label"
                value={s.label}
                editable={editable}
                onCommit={(v) => update(['atlas', 'sections', i, 'label'], v)}
              />
              <EditableText
                as="div"
                className="body"
                value={s.body}
                editable={editable}
                onCommit={(v) => update(['atlas', 'sections', i, 'body'], v)}
              />
            </div>
          ))}
          <div className="testimonial">
            <EditableText
              as="div"
              className="quote"
              value={atlas.testimonial.quote}
              editable={editable}
              onCommit={(v) =>
                update(['atlas', 'testimonial', 'quote'], v)
              }
            />
            <EditableText
              as="div"
              className="author"
              value={atlas.testimonial.author}
              editable={editable}
              onCommit={(v) =>
                update(['atlas', 'testimonial', 'author'], v)
              }
            />
            <EditableText
              as="div"
              className="author-sub"
              value={atlas.testimonial.authorSub}
              editable={editable}
              onCommit={(v) =>
                update(['atlas', 'testimonial', 'authorSub'], v)
              }
            />
          </div>
        </div>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Top-level component                                                       */
/* -------------------------------------------------------------------------- */

const CoachingLanding = ({
  program,
  editable = false,
  onChange,
  buyHref,
  onUploadFile,
}: CoachingLandingProps) => {
  // Only use the uploader when the page is editable. In public mode the prop
  // is ignored regardless.
  const uploader = editable ? onUploadFile : undefined
  const [internalData, setInternalData] = useState<CoachingLandingData>(
    program ?? defaultCoachingLandingData,
  )

  // Sync incoming prop into internal state (controlled-ish)
  useEffect(() => {
    if (program) setInternalData(program)
  }, [program])

  const update = useCallback(
    (path: PathSegment[], value: unknown) => {
      setInternalData((prev) => {
        const next = setIn(prev, path, value)
        onChange?.(next)
        return next
      })
    },
    [onChange],
  )

  const data = internalData

  // Theme
  const [theme, setTheme] = useState<Theme>('dark')
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') setTheme(stored)
    } catch {
      /* ignore */
    }
  }, [])
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  // Modal
  const [modalOpen, setModalOpen] = useState(false)

  // Smooth scroll to programs
  const programsRef = useRef<HTMLElement | null>(null)
  const scrollToPrograms = useCallback(() => {
    programsRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div className={`spaire-landing${theme === 'light' ? ' light' : ''}`}>
      <NavPill data={data} editable={editable} update={update} />
      <Hero
        data={data}
        editable={editable}
        update={update}
        onSeePrograms={scrollToPrograms}
        uploader={uploader}
      />
      <CoreEvolution
        data={data}
        editable={editable}
        update={update}
        onJoin={() => setModalOpen(true)}
        programsRef={programsRef}
        uploader={uploader}
      />
      <Courses data={data} editable={editable} update={update} />
      <Faq data={data} editable={editable} update={update} />
      <AtlasModal
        data={data}
        editable={editable}
        update={update}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        buyHref={buyHref}
        uploader={uploader}
      />
      <button
        className="theme-toggle"
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? 'Dark mode' : 'Light mode'}
      </button>
    </div>
  )
}

export default CoachingLanding
