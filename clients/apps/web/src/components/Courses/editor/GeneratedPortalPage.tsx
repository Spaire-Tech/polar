'use client'

// GeneratedPortalPage — THE page the AI generates. A literal clone of the
// two course-page designs, composed by the onboarding choices:
//
//   "Marquee Course Page.html"     → marquee hero (.panel + frosted band
//                                    fading into the page colour) and the
//                                    catalog episode strip (.lc-catalog) with
//                                    scroll-snap + hover arrows.
//   "Course Page Empty State.html" → cover hero (.hero), the Free Sample
//                                    screen (.sample), spotlight cards
//                                    (.card) in module rows, liquid-glass
//                                    placeholders (.ph-ambient/.glass-tint).
//
// The DOM uses the designs' exact class names and the CSS below is copied
// from the design files verbatim — selectors are only prefixed with the
// root class (.gpp) and `body.dark` becomes `.gpp.dark`. The styles are
// emitted via <style jsx global> so they apply to every node exactly like
// the designs' plain stylesheets do (no styled-jsx scoping to silently miss
// elements rendered by helpers — the bug that flattened the cards).
//
// MEDIA RULE: missing media renders the designs' liquid-glass placeholder —
// never the cover photo on every tile, and NO "Add image / Add trailer"
// affordances here (media is added later in the editor). A lesson tile only
// shows a photo if THAT lesson has one.

import { useCallback, useEffect, useRef, useState } from 'react'
import { HlsVideo } from '../HlsVideo'

const PLAY_PATH =
  'M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z'

const ImageGlyph = () => (
  <svg
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.1"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 15l-4.35-4.35a1.4 1.4 0 0 0-2 0L5 20" />
  </svg>
)

const ClockIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

const FreeChip = () => (
  <div className="lc-state lc-free">
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
    Free
  </div>
)

const LockChip = () => (
  <div className="lc-state lc-lock">
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </svg>
  </div>
)


// Touch-to-edit text (the design's contenteditable). Module-level so its
// identity is stable across renders — defined inline it would REMOUNT on
// every parent re-render (FAQ toggle, trailer peek, strip scroll), killing
// focus mid-typing. React renders NO children here; the text is written via
// effects and only synced from props while the element is NOT focused, so an
// in-flight edit can never be clobbered by a background refetch.
function EditText({
  field,
  value,
  className,
  tag: Tag = 'span',
  ctx,
  editable,
  onEditText,
}: {
  field: EditField
  value: string
  className?: string
  tag?: 'span' | 'div' | 'h1' | 'h2' | 'p'
  ctx?: { flatIdx?: number; groupIdx?: number; idx?: number }
  editable?: boolean
  onEditText?: (
    field: EditField,
    value: string,
    ctx?: { flatIdx?: number; groupIdx?: number; idx?: number },
  ) => void
}) {
  const ref = useRef<HTMLElement | null>(null)
  const focusedRef = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (el && !focusedRef.current && el.textContent !== value) {
      el.textContent = value
    }
  }, [value])
  if (!editable || !onEditText) {
    return <Tag className={className}>{value}</Tag>
  }
  return (
    <Tag
      ref={ref as never}
      className={`${className ?? ''} gpp-editable`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      onFocus={() => {
        focusedRef.current = true
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        focusedRef.current = false
        const next = (e.currentTarget.textContent ?? '').trim()
        if (next !== value) onEditText(field, next, ctx)
      }}
    />
  )
}

export type GeneratedLesson = {
  title: string
  description: string
  flatIdx: number
  /** Real lesson still when it exists; otherwise the glass placeholder. */
  imageUrl?: string | null
  durationLabel?: string | null
  free: boolean
  locked: boolean
}

export type GeneratedGroup = {
  /** Module title; null for the flat episodic season. */
  title: string | null
  lessons: GeneratedLesson[]
}

export type GeneratedPortalPageProps = {
  brand: string
  title: string
  /** Cover hero's two-line title break (AI titleLines). */
  titleLines?: string[] | null
  /** "Documentary Series · Golf" (AI eyebrow). */
  eyebrow: string
  /** "New Series" (AI badge — cover hero). */
  badge: string
  /** AI hero description (never the creator's raw brief). */
  desc: string
  /** Instructor credential line (AI byline). */
  byline: string
  instructorName: string
  heroVariant: 'marquee' | 'cover'
  cardVariant: 'spotlight' | 'catalog'
  structure: 'modules' | 'episodic'
  trialMode: 'free_preview' | 'lesson_sample'
  paywallEnabled: boolean
  freeLessons: number
  playLabel: string
  buyLabel: string
  freeLine: string
  coverUrl?: string | null
  coverPosition?: string | null
  /** Real sample poster/clip (public page); placeholder otherwise. */
  sampleImageUrl?: string | null
  samplePlayable?: boolean
  /** Inline sample playback — the clip window from course.sample. The
   *  player seeks to sampleStart, stops after sampleDuration, and pauses
   *  the moment the screen scrolls out of view. */
  samplePlaybackId?: string | null
  samplePlaybackUrl?: string | null
  sampleStart?: number
  sampleDuration?: number
  /** Hero Play starts the inline sample (sample-trial pages). */
  playStartsSample?: boolean
  /** Instructor section — avatar comes from the platform (org avatar);
   *  the writing is AI-polished from the creator's instructor details. */
  avatarUrl?: string | null
  instructorSub?: string
  instructorBio?: string[]
  portraitUrl?: string | null
  portraitCaption?: string
  onAddPortrait?: () => void
  portraitBusy?: boolean
  /** FAQ — AI-written Q/A pairs, all editable. */
  faq?: { q: string; a: string }[]
  groups: GeneratedGroup[]
  lessonCount: number
  unit: 'lesson' | 'episode'
  dark: boolean
  /** Theme toggle (creator-facing). Omit to hide (public page). */
  onToggleDark?: () => void
  showTrailerButton?: boolean
  onPlay?: () => void
  onBuy?: () => void
  onTrailer?: () => void
  onSample?: () => void
  onLessonClick?: (flatIdx: number) => void

  // ── Editor mode (the design's creator affordances) ──────────────────────
  /** Show the design's creator pills (Add cover / Add trailer / per-card
   *  Add image / Reposition). Used by the dashboard editor surface. */
  editable?: boolean
  /** Hover-trailer peek: when set, hovering the hero plays the trailer
   *  muted; leaving or scrolling snaps back to the still. */
  trailerUrl?: string | null
  onAddCover?: () => void
  coverBusy?: boolean
  onAddTrailer?: () => void
  trailerBusy?: boolean
  /** Live object-position updates while the creator drags the cover.
   *  Commit/debounce is the caller's job. */
  onCoverPosition?: (pos: string) => void
  onAddLessonImage?: (flatIdx: number) => void
  lessonImageBusy?: number | null
  /** Configure-sample affordance on the sample screen (editor only). */
  onConfigureSample?: () => void
  /** Touch-to-edit text commits (editor only). ctx carries the lesson's
   *  flatIdx or the module's groupIdx where relevant. */
  onEditText?: (
    field: EditField,
    value: string,
    ctx?: { flatIdx?: number; groupIdx?: number; idx?: number },
  ) => void
}

export type EditField =
  | 'title'
  | 'desc'
  | 'byline'
  | 'eyebrow'
  | 'badge'
  | 'instructorName'
  | 'lessonTitle'
  | 'lessonDesc'
  | 'moduleTitle'
  | 'instructorSub'
  | 'instructorBioP'
  | 'portraitCaption'
  | 'faqQ'
  | 'faqA'

export function GeneratedPortalPage({
  brand,
  title,
  titleLines,
  eyebrow,
  badge,
  desc,
  byline,
  instructorName,
  heroVariant,
  cardVariant,
  structure,
  trialMode,
  paywallEnabled,
  freeLessons,
  playLabel,
  buyLabel,
  freeLine,
  coverUrl,
  coverPosition,
  sampleImageUrl,
  samplePlayable = false,
  samplePlaybackId = null,
  samplePlaybackUrl = null,
  sampleStart = 0,
  sampleDuration = 0,
  playStartsSample = false,
  avatarUrl = null,
  instructorSub = '',
  instructorBio = [],
  portraitUrl = null,
  portraitCaption = '',
  onAddPortrait,
  portraitBusy = false,
  faq = [],
  groups,
  lessonCount,
  unit,
  dark,
  onToggleDark,
  showTrailerButton = true,
  onPlay,
  onBuy,
  onTrailer,
  onSample,
  onLessonClick,
  editable = false,
  trailerUrl,
  onAddCover,
  coverBusy = false,
  onAddTrailer,
  trailerBusy = false,
  onCoverPosition,
  onAddLessonImage,
  lessonImageBusy = null,
  onConfigureSample,
  onEditText,
}: GeneratedPortalPageProps) {
  const isEpisodic = structure === 'episodic'
  const unitCap = unit === 'episode' ? 'Episode' : 'Lesson'
  const year = new Date().getFullYear()

  // ── hover-trailer peek: play muted on hover, snap back on leave/scroll.
  //    (The protected behavior from the original landing's HeroMedia.) ──
  const heroRef = useRef<HTMLElement | null>(null)
  const trailerVideoRef = useRef<HTMLVideoElement | null>(null)
  const [trailerPeek, setTrailerPeek] = useState(false)
  useEffect(() => {
    if (!trailerUrl) return
    const v = trailerVideoRef.current
    if (!v) return
    if (trailerPeek) {
      v.currentTime = 0
      v.muted = true
      void v.play().catch(() => setTrailerPeek(false))
    } else {
      v.pause()
    }
  }, [trailerPeek, trailerUrl])
  useEffect(() => {
    if (!trailerUrl || !trailerPeek) return
    // Any scroll pauses the peek — same rule the original hero enforced.
    const onScroll = () => setTrailerPeek(false)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [trailerUrl, trailerPeek])

  // ── reposition: drag the cover to move object-position; live callback,
  //    caller persists. Activated from the design's ⤧ pill. ──
  const [repositioning, setRepositioning] = useState(false)
  const dragRef = useRef<{
    startX: number
    startY: number
    posX: number
    posY: number
  } | null>(null)
  const parsePos = (pos: string | null | undefined): [number, number] => {
    const m = /([\d.]+)%\s+([\d.]+)%/.exec(pos ?? '')
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 50]
  }
  const [livePos, setLivePos] = useState<string | null>(null)
  const effectiveCoverPos = livePos ?? coverPosition ?? null
  const onDragStart = (e: React.PointerEvent) => {
    if (!repositioning) return
    const [px, py] = parsePos(effectiveCoverPos)
    dragRef.current = { startX: e.clientX, startY: e.clientY, posX: px, posY: py }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    const hero = heroRef.current
    if (!repositioning || !d || !hero) return
    const r = hero.getBoundingClientRect()
    // Dragging right shows more of the image's left side → position decreases.
    const nx = Math.min(100, Math.max(0, d.posX - ((e.clientX - d.startX) / r.width) * 100))
    const ny = Math.min(100, Math.max(0, d.posY - ((e.clientY - d.startY) / r.height) * 100))
    const next = `${nx.toFixed(1)}% ${ny.toFixed(1)}%`
    setLivePos(next)
    onCoverPosition?.(next)
  }
  const onDragEnd = () => {
    dragRef.current = null
  }

  // ── inline sample playback: seek to the clip start, stop at the clip end,
  //    and STOP when the screen scrolls out of view (the protected
  //    "sample stops when you scroll past it" behavior). ──
  const sampleScreenRef = useRef<HTMLDivElement | null>(null)
  const sampleVideoRef = useRef<HTMLVideoElement | null>(null)
  const [samplePlaying, setSamplePlaying] = useState(false)
  const sampleSrc = samplePlaybackUrl ?? null
  const sampleIsHls = Boolean(
    samplePlaybackId || (sampleSrc && sampleSrc.includes('.m3u8')),
  )
  const startSample = useCallback(() => {
    if (!samplePlayable) return
    setSamplePlaying(true)
    sampleScreenRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [samplePlayable])
  const stopSample = useCallback(() => {
    sampleVideoRef.current?.pause()
    setSamplePlaying(false)
  }, [])
  const onSampleVideoEl = useCallback(
    (el: HTMLVideoElement | null) => {
      sampleVideoRef.current = el
      if (!el) return
      const seekAndPlay = () => {
        if (sampleStart > 0) el.currentTime = sampleStart
        void el.play().catch(() => setSamplePlaying(false))
      }
      if (el.readyState >= 1) seekAndPlay()
      else el.addEventListener('loadedmetadata', seekAndPlay, { once: true })
    },
    [sampleStart],
  )
  // Clip window: stop once the configured duration has played.
  useEffect(() => {
    if (!samplePlaying || sampleDuration <= 0) return
    const el = sampleVideoRef.current
    if (!el) return
    const onTime = () => {
      if (el.currentTime >= sampleStart + sampleDuration) stopSample()
    }
    el.addEventListener('timeupdate', onTime)
    return () => el.removeEventListener('timeupdate', onTime)
  }, [samplePlaying, sampleStart, sampleDuration, stopSample])
  // Scroll-past: pause the sample when its screen leaves the viewport.
  // The observer only ARMS once the screen has actually been visible —
  // otherwise starting from the hero (which smooth-scrolls to the sample)
  // would fire ratio≈0 immediately and kill the playback it protects.
  useEffect(() => {
    if (!samplePlaying) return
    const screen = sampleScreenRef.current
    if (!screen) return
    let armed = false
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio >= 0.5) armed = true
          else if (armed && e.intersectionRatio < 0.35) stopSample()
        }
      },
      { threshold: [0, 0.35, 0.5, 0.7] },
    )
    io.observe(screen)
    return () => io.disconnect()
  }, [samplePlaying, stopSample])

  // ── FAQ accordion — design's measured-height open/close ──
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const faqWrapRefs = useRef<(HTMLDivElement | null)[]>([])
  const faqClipRefs = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    faqWrapRefs.current.forEach((wrap, i) => {
      if (!wrap) return
      const clip = faqClipRefs.current[i]
      wrap.style.height =
        openFaq === i && clip ? `${clip.scrollHeight}px` : '0px'
    })
  }, [openFaq, faq])

  const trialShort = !paywallEnabled
    ? `all ${unit}s free`
    : trialMode === 'lesson_sample'
      ? 'sample clip free'
      : `first ${freeLessons} free`

  // ── strip arrows: show/hide by scroll position (the design's script) ──
  const stripRef = useRef<HTMLDivElement | null>(null)
  const [showPrev, setShowPrev] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const updateArrows = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return
    const max = strip.scrollWidth - strip.clientWidth - 2
    setShowPrev(strip.scrollLeft > 2)
    setShowNext(strip.scrollLeft < max)
  }, [])
  useEffect(() => {
    if (!isEpisodic) return
    updateArrows()
    const strip = stripRef.current
    if (!strip) return
    strip.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    const raf = requestAnimationFrame(updateArrows)
    return () => {
      strip.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
      cancelAnimationFrame(raf)
    }
  }, [isEpisodic, updateArrows])
  const scrollStrip = (dir: 1 | -1) => {
    const strip = stripRef.current
    if (!strip) return
    strip.scrollBy({ left: dir * strip.clientWidth, behavior: 'smooth' })
  }

  const themeToggle = onToggleDark ? (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Toggle dark mode"
      onClick={onToggleDark}
    >
      <svg
        className="ic-moon"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      <svg
        className="ic-sun"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  ) : null

  const showChips = paywallEnabled && trialMode === 'free_preview'

  const PillImageIcon = (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-4.35-4.35a1.4 1.4 0 0 0-2 0L5 20" />
    </svg>
  )

  // The design's creator bar: frosted Add pills + the theme toggle.
  const creatorBarVisible = Boolean(
    (editable && (onAddCover || onAddTrailer || onCoverPosition)) ||
      onToggleDark,
  )
  const creatorBar = !creatorBarVisible ? null : (
    <div className="creator-bar">
      {editable && onAddCover && (
        <button
          className="add-pill"
          type="button"
          onClick={onAddCover}
          disabled={coverBusy}
        >
          {PillImageIcon}
          <span>
            {coverBusy ? 'Uploading…' : coverUrl ? 'Change cover' : 'Add cover'}
          </span>
        </button>
      )}
      {editable && coverUrl && onCoverPosition && (
        <button
          className={`add-pill${repositioning ? ' active' : ''}`}
          type="button"
          onClick={() => {
            setRepositioning((r) => !r)
            setTrailerPeek(false)
          }}
          title="Drag the cover to reposition it"
        >
          ⤧ {repositioning ? 'Done' : 'Reposition'}
        </button>
      )}
      {editable && onAddTrailer && (
        <button
          className="add-pill"
          type="button"
          onClick={onAddTrailer}
          disabled={trailerBusy}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d={PLAY_PATH} />
          </svg>
          {trailerBusy
            ? 'Uploading…'
            : trailerUrl
              ? 'Change trailer'
              : 'Add trailer'}
        </button>
      )}
      {themeToggle}
    </div>
  )

  // Hover-trailer layer — shared by both heroes. Sits above the still,
  // below the text/band. Muted; fades in while peeking.
  const trailerLayer = trailerUrl ? (
    <video
      ref={trailerVideoRef}
      className={`trailer-layer${trailerPeek ? ' on' : ''}`}
      src={trailerUrl}
      muted
      playsInline
      loop
      preload="metadata"
    />
  ) : null
  const heroHoverProps =
    trailerUrl && !repositioning
      ? {
          onMouseEnter: () => setTrailerPeek(true),
          onMouseLeave: () => setTrailerPeek(false),
        }
      : {}
  const repositionProps = repositioning
    ? {
        onPointerDown: onDragStart,
        onPointerMove: onDragMove,
        onPointerUp: onDragEnd,
        onPointerCancel: onDragEnd,
      }
    : {}

  // ── spotlight card — design's .card from Course Page Empty State ──
  // Vary the ambient tint per card so unfilled tiles keep the row's visual
  // rhythm (the design's formula; n is the 1-based card number).
  const ambientTint = (n: number): React.CSSProperties => ({
    filter: `blur(40px) hue-rotate(${((n * 53) % 44) - 22}deg) brightness(${(
      0.94 +
      (n % 3) * 0.06
    ).toFixed(2)})`,
  })

  const spotlightCard = (l: GeneratedLesson) => (
    <div
      className={`card${l.imageUrl ? ' filled' : ''}`}
      key={l.flatIdx}
      onClick={onLessonClick ? () => onLessonClick(l.flatIdx) : undefined}
      role={onLessonClick ? 'button' : undefined}
    >
      <div className="ph-ambient" style={ambientTint(l.flatIdx + 1)} />
      <div className="glass-tint" />
      <div
        className="photo"
        style={
          l.imageUrl ? { backgroundImage: `url("${l.imageUrl}")` } : undefined
        }
      />
      <div className="photo-shade" />
      {showChips && (l.free ? <FreeChip /> : <LockChip />)}
      {editable && onAddLessonImage && (
        <button
          className="card-add"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAddLessonImage(l.flatIdx)
          }}
        >
          {lessonImageBusy === l.flatIdx ? (
            'Uploading…'
          ) : (
            <>
              {PillImageIcon}
              Add image or cover
            </>
          )}
        </button>
      )}
      <div className="card-info">
        <div className="ep">
          {unitCap} {l.flatIdx + 1}
        </div>
        <EditText
          editable={editable}
          onEditText={onEditText}
          field="lessonTitle"
          value={l.title}
          className="title"
          tag="div"
          ctx={{ flatIdx: l.flatIdx }}
        />
        <EditText
          editable={editable}
          onEditText={onEditText}
          field="lessonDesc"
          value={l.description}
          className="desc"
          tag="div"
          ctx={{ flatIdx: l.flatIdx }}
        />
        <div className="foot">
          <span className="time">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d={PLAY_PATH} />
            </svg>
            {l.durationLabel || '0m'}
          </span>
          <span className="dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  )

  // ── catalog card — design's .lc-catalog from Marquee Course Page ──
  const catalogCard = (l: GeneratedLesson) => (
    <div
      className="lc-catalog"
      key={l.flatIdx}
      onClick={onLessonClick ? () => onLessonClick(l.flatIdx) : undefined}
      role={onLessonClick ? 'button' : undefined}
    >
      <div className="lc-card">
        <div className={`lc-thumb${l.imageUrl ? '' : ' ph'}`}>
          {l.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.imageUrl} alt="" />
          ) : (
            <>
              <div
                className="ph-ambient"
                style={ambientTint(l.flatIdx + 1)}
              />
              <div className="glass-tint" />
            </>
          )}
          {showChips && (l.free ? <FreeChip /> : <LockChip />)}
          {editable && onAddLessonImage && (
            <button
              className="thumb-add"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAddLessonImage(l.flatIdx)
              }}
            >
              {lessonImageBusy === l.flatIdx ? (
                'Uploading…'
              ) : (
                <>
                  {PillImageIcon}
                  Add image or cover
                </>
              )}
            </button>
          )}
          {l.durationLabel && (
            <div className="lc-dur">
              <ClockIcon />
              <span>{l.durationLabel}</span>
            </div>
          )}
          {onLessonClick && (
            <div className="lc-play">
              <div className="lc-play-btn">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
        <div className="lc-info">
          <div className="lc-num">
            {unitCap} {l.flatIdx + 1}
          </div>
          <EditText
          editable={editable}
          onEditText={onEditText}
            field="lessonTitle"
            value={l.title}
            className="lc-title"
            tag="div"
            ctx={{ flatIdx: l.flatIdx }}
          />
          <EditText
          editable={editable}
          onEditText={onEditText}
            field="lessonDesc"
            value={l.description}
            className="lc-desc"
            tag="div"
            ctx={{ flatIdx: l.flatIdx }}
          />
          <div className="lc-meta">
            <ClockIcon />
            <span>{l.durationLabel || '0m'}</span>
          </div>
        </div>
      </div>
    </div>
  )

  const card = cardVariant === 'spotlight' ? spotlightCard : catalogCard

  return (
    <div className={`gpp${dark ? ' dark' : ''}`}>
      {/* ════════ MARQUEE HERO (Marquee Course Page.html) ════════ */}
      {heroVariant === 'marquee' ? (
        <header
          ref={heroRef as React.RefObject<HTMLElement>}
          className={`panel${coverUrl ? ' filled' : ''}${
            repositioning ? ' repositioning' : ''
          }`}
          {...heroHoverProps}
          {...repositionProps}
        >
          {coverUrl ? (
            <>
              <div
                className="panel-art"
                style={{
                  backgroundImage: `url('${coverUrl}')`,
                  backgroundPosition: effectiveCoverPos || 'center 18%',
                }}
              />
              {trailerLayer}
              <div className="panel-scrim" />
            </>
          ) : (
            <>
              <div className="ph-ambient" />
              <div className="glass-tint" />
              {trailerLayer}
              <div className="hero-ph-glyph">
                <ImageGlyph />
              </div>
            </>
          )}
          <div className="panel-grain" />

          <div className="panel-brand rise">{brand}</div>
          {creatorBar}

          <div className="panel-title">
            <EditText
          editable={editable}
          onEditText={onEditText}
              field="eyebrow"
              value={eyebrow}
              className="pt-eyebrow rise d1"
              tag="div"
            />
            <EditText editable={editable} onEditText={onEditText} field="title" value={title} className="pt-h rise d1" tag="h1" />
          </div>

          <div className="band rise d2">
            <div className="band-actions">
              <button
                className="abtn play"
                type="button"
                onClick={
                  playStartsSample && samplePlayable ? startSample : onPlay
                }
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d={PLAY_PATH} />
                </svg>
                {playLabel}
              </button>
              <button className="abtn buy" type="button" onClick={onBuy}>
                {buyLabel}
              </button>
              {freeLine ? <div className="band-free">{freeLine}</div> : null}
            </div>

            <div className="band-desc">
              <EditText editable={editable} onEditText={onEditText} field="desc" value={desc} className="bd-text" tag="p" />
              <div className="bd-meta">
                {eyebrow}&nbsp;&nbsp;·&nbsp;&nbsp;{year}
                &nbsp;&nbsp;·&nbsp;&nbsp;{lessonCount} {unitCap}
                {lessonCount === 1 ? '' : 's'}
              </div>
              <div className="bd-badges">
                <span className="bdg rate">All Levels</span>
                <span className="bdg">Self-paced</span>
                <span className="bdg">Captions</span>
                <span className="bdg">Mobile &amp; TV</span>
                {showTrailerButton && (
                  <button
                    className="bd-trailer"
                    type="button"
                    onClick={onTrailer}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d={PLAY_PATH} />
                    </svg>
                    Trailer
                  </button>
                )}
              </div>
            </div>

            <div className="band-cast">
              <div className="bc-k">Instructor</div>
              <EditText
          editable={editable}
          onEditText={onEditText}
                field="instructorName"
                value={instructorName}
                className="bc-v"
                tag="div"
              />
              <EditText editable={editable} onEditText={onEditText} field="byline" value={byline} className="bc-sub" tag="div" />
            </div>
          </div>
        </header>
      ) : (
        /* ════════ COVER HERO (Course Page Empty State.html) ════════ */
        <section
          ref={heroRef as React.RefObject<HTMLElement>}
          className={`hero${coverUrl ? ' filled' : ''}${
            repositioning ? ' repositioning' : ''
          }`}
          {...heroHoverProps}
          {...repositionProps}
        >
          <div className="ph-ambient" />
          <div className="hero-art" />
          <div
            className="photo"
            style={
              coverUrl
                ? {
                    backgroundImage: `url("${coverUrl}")`,
                    backgroundPosition: effectiveCoverPos || 'center',
                  }
                : undefined
            }
          />
          {trailerLayer}
          <div className="photo-shade" />
          <div className="hero-ph">
            <ImageGlyph />
          </div>
          <div className="hero-shade" />
          <div className="hero-blend" />

          <div className="hero-eyebrow">
            <span className="dot" />
            <span>Spaire Original</span>
          </div>

          {creatorBar}

          <div className="hero-content">
            <div className="hero-meta">
              <EditText editable={editable} onEditText={onEditText} field="badge" value={badge} className="badge" />
              <div className="meta-line">
                <span>
                  {lessonCount} {unit}
                  {lessonCount === 1 ? '' : 's'}
                </span>
                <span className="sep">·</span>
                <span>All levels</span>
              </div>
            </div>

            {editable && onEditText ? (
              <EditText editable={editable} onEditText={onEditText} field="title" value={title} className="hero-title" tag="h1" />
            ) : (
              <h1 className="hero-title">
                {titleLines && titleLines.length > 1
                  ? titleLines.map((line, i) => (
                      <span key={i}>
                        {i > 0 && <br />}
                        {line}
                      </span>
                    ))
                  : title}
              </h1>
            )}

            <p className="hero-desc">
              <EditText editable={editable} onEditText={onEditText} field="desc" value={desc} />{' '}
              <span className="with">
                — <EditText editable={editable} onEditText={onEditText} field="byline" value={byline || `with ${instructorName}`} />
              </span>
            </p>

            <div className="hero-actions">
              {showTrailerButton && (
                <button
                  className="btn-trailer"
                  type="button"
                  onClick={
                    playStartsSample && samplePlayable
                      ? startSample
                      : (onTrailer ?? onPlay)
                  }
                >
                  <span className="play">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d={PLAY_PATH} />
                    </svg>
                  </span>
                  {trialMode === 'lesson_sample' ? playLabel : 'Watch trailer'}
                </button>
              )}
              <button className="btn-enroll" type="button" onClick={onBuy}>
                {buyLabel}
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ════════ INSTRUCTOR (Course Page Empty State.html) ════════ */}
      {(instructorName || instructorSub || instructorBio.length > 0) && (
        <section className="instructor">
          <div className="inst-inner">
            <div className="inst-copy">
              <div className="inst-head">
                <div className={`inst-avatar${avatarUrl ? ' filled' : ''}`}>
                  <div className="ph-ambient" />
                  <div className="glass-tint" />
                  <div
                    className="photo"
                    style={
                      avatarUrl
                        ? { backgroundImage: `url("${avatarUrl}")` }
                        : undefined
                    }
                  />
                  <svg
                    className="av-ic"
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="8" r="3.6" />
                    <path d="M5 20c.8-3.6 3.7-5.6 7-5.6s6.2 2 7 5.6" />
                  </svg>
                </div>
                <div className="inst-id">
                  <EditText
          editable={editable}
          onEditText={onEditText}
                    field="instructorName"
                    value={instructorName}
                    className="inst-name"
                    tag="h2"
                  />
                  <EditText
          editable={editable}
          onEditText={onEditText}
                    field="instructorSub"
                    value={instructorSub}
                    className="inst-sub"
                    tag="p"
                  />
                </div>
              </div>
              {instructorBio.map((p, i) => (
                <EditText
          editable={editable}
          onEditText={onEditText}
                  key={i}
                  field="instructorBioP"
                  value={p}
                  className="inst-bio"
                  tag="p"
                  ctx={{ idx: i }}
                />
              ))}
            </div>

            <div className={`inst-media${portraitUrl ? ' filled' : ''}`}>
              <div className="ph-ambient" />
              <div className="glass-tint" />
              <div
                className="photo"
                style={
                  portraitUrl
                    ? { backgroundImage: `url("${portraitUrl}")` }
                    : undefined
                }
              />
              <div className="photo-shade" />
              {!portraitUrl && (
                <div className="ph-cta">
                  {editable && onAddPortrait ? (
                    <>
                      <span
                        className="ph-ic"
                        role="button"
                        tabIndex={0}
                        onClick={onAddPortrait}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ')
                            onAddPortrait()
                        }}
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="8" r="3.6" />
                          <path d="M5 20c.8-3.6 3.7-5.6 7-5.6s6.2 2 7 5.6" />
                        </svg>
                      </span>
                      <span className="ph-k">
                        {portraitBusy ? 'Uploading…' : 'Add a portrait'}
                      </span>
                      <span className="ph-s">
                        A square photo of you mid-lesson works best
                      </span>
                    </>
                  ) : null}
                </div>
              )}
              {portraitCaption && (
                <EditText
          editable={editable}
          onEditText={onEditText}
                  field="portraitCaption"
                  value={portraitCaption}
                  className="inst-caption"
                  tag="div"
                />
              )}
              {editable && onAddPortrait && portraitUrl && (
                <button
                  className="change-pill"
                  type="button"
                  onClick={onAddPortrait}
                >
                  {PillImageIcon}
                  Change
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ════════ FREE SAMPLE (Course Page Empty State.html) ════════ */}
      {paywallEnabled && trialMode === 'lesson_sample' && (
        <section className="sample">
          <div className="sample-eyebrow">Free Sample</div>
          <h2>Watch a free sample</h2>
          <p className="sample-sub">
            A few minutes inside the {unit === 'episode' ? 'series' : 'course'}.
            No account, no card.
          </p>
          <div
            ref={sampleScreenRef}
            className={`sample-screen${sampleImageUrl ? ' filled' : ''}${
              samplePlayable ? ' playable' : ''
            }${samplePlaying ? ' playing' : ''}`}
            onClick={
              samplePlayable && !samplePlaying
                ? sampleSrc || samplePlaybackId
                  ? startSample
                  : onSample
                : undefined
            }
            role={samplePlayable && !samplePlaying ? 'button' : undefined}
          >
            <div className="ph-ambient" />
            <div className="glass-tint" />
            <div
              className="photo"
              style={
                sampleImageUrl
                  ? { backgroundImage: `url("${sampleImageUrl}")` }
                  : undefined
              }
            />
            <div className="photo-shade" />
            {samplePlaying &&
              (sampleIsHls ? (
                <HlsVideo
                  playbackId={samplePlaybackId}
                  playbackUrl={sampleSrc}
                  poster={sampleImageUrl}
                  controls
                  className="sample-video"
                  onVideoElement={onSampleVideoEl}
                  onEnded={stopSample}
                />
              ) : (
                <video
                  className="sample-video"
                  src={sampleSrc ?? undefined}
                  poster={sampleImageUrl ?? undefined}
                  controls
                  playsInline
                  ref={onSampleVideoEl}
                  onEnded={stopSample}
                />
              ))}
            {samplePlayable && !samplePlaying ? (
              <div className="ph-cta">
                <span className="ph-ic">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d={PLAY_PATH} />
                  </svg>
                </span>
              </div>
            ) : editable && onConfigureSample && !samplePlaying ? (
              // The design's "Add your sample" CTA, wired to the existing
              // sample configuration (pick a lesson + clip window).
              <div className="ph-cta">
                <span
                  className="ph-ic"
                  role="button"
                  tabIndex={0}
                  onClick={onConfigureSample}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onConfigureSample()
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span className="ph-k">Set up your sample</span>
                <span className="ph-s">A 2–3 minute clip from any {unit}</span>
              </div>
            ) : null}
            {editable && onConfigureSample && samplePlayable && !samplePlaying && (
              <button
                className="change-pill"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onConfigureSample()
                }}
              >
                {PillImageIcon}
                Change
              </button>
            )}
          </div>
        </section>
      )}

      {/* ════════ LESSONS — module rows (CPES) or episode strip (MCP) ════════ */}
      {isEpisodic ? (
        <div className="lessons">
          <div className="row-head strip-rh">
            <span className="rh">Episodes</span>
            <span className="rh-meta">
              {lessonCount} episode{lessonCount === 1 ? '' : 's'} · {trialShort}
            </span>
          </div>
          <div className="strip-wrap">
            <button
              className={`arrow prev${showPrev ? ' show' : ''}`}
              aria-label="Previous"
              type="button"
              onClick={() => scrollStrip(-1)}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 5l-6.5 7 6.5 7" />
              </svg>
            </button>
            <button
              className={`arrow next${showNext ? ' show' : ''}`}
              aria-label="Next"
              type="button"
              onClick={() => scrollStrip(1)}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9.5 5l6.5 7-6.5 7" />
              </svg>
            </button>
            <div className="grid" ref={stripRef}>
              {groups.flatMap((g) => g.lessons).map((l) => card(l))}
            </div>
          </div>
        </div>
      ) : (
        <div className="lessons">
          {groups.map((g, gi) => (
            <section className="row" key={gi}>
              <div className="row-head">
                <span className="mod">Module {gi + 1}</span>
                <EditText
          editable={editable}
          onEditText={onEditText}
                  field="moduleTitle"
                  value={g.title ?? ''}
                  ctx={{ groupIdx: gi }}
                />
              </div>
              <div className="grid">{g.lessons.map((l) => card(l))}</div>
            </section>
          ))}
        </div>
      )}


      {/* ════════ FAQ (Course Page Empty State.html) ════════ */}
      {faq.length > 0 && (
        <section className="faq">
          <div className="faq-inner">
            <h2>Questions? Answers.</h2>
            <div className="faq-list">
              {faq.map((item, i) => (
                <div className={`faq-item${openFaq === i ? ' open' : ''}`} key={i}>
                  <button
                    className="faq-q"
                    type="button"
                    onClick={() => setOpenFaq((o) => (o === i ? null : i))}
                  >
                    <EditText
          editable={editable}
          onEditText={onEditText}
                      field="faqQ"
                      value={item.q}
                      ctx={{ idx: i }}
                    />
                    <svg
                      className="chev"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  <div
                    className="faq-a-wrap"
                    ref={(el) => {
                      faqWrapRefs.current[i] = el
                    }}
                  >
                    <div
                      className="faq-a-clip"
                      ref={(el) => {
                        faqClipRefs.current[i] = el
                      }}
                    >
                      <EditText
          editable={editable}
          onEditText={onEditText}
                        field="faqA"
                        value={item.a}
                        className="faq-a"
                        tag="div"
                        ctx={{ idx: i }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CSS — copied verbatim from the two design files. Selectors are
          prefixed with .gpp (root) and body.dark → .gpp.dark; keyframes get
          a gpp- prefix because this style block is global. */}
      <style jsx global>{`
        .gpp {
          --bg: #ffffff;
          --band: 255, 255, 255;
          --bt: #1d1d1f;
          --bt2: rgba(0, 0, 0, 0.56);
          --bt3: rgba(0, 0, 0, 0.4);
          --text: #1d1d1f;
          --text-2: #86868b;
          --blue: #0071e3;
          --ink: #07080a;
          --sf: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
            'SF Pro Text', system-ui, sans-serif;
          --po: 'Poppins', var(--font-poppins), -apple-system,
            BlinkMacSystemFont, system-ui, sans-serif;
          --gut: 64px;
          font-family: var(--sf);
          background: var(--bg);
          color: var(--text);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          letter-spacing: -0.014em;
          transition: background 0.4s ease;
          min-height: 100%;
        }
        .gpp.dark {
          --bg: #141416;
          --band: 20, 20, 22;
          --bt: #f5f5f7;
          --bt2: rgba(245, 245, 247, 0.65);
          --bt3: rgba(245, 245, 247, 0.45);
          --text: #f5f5f7;
          --text-2: rgba(245, 245, 247, 0.6);
        }
        .gpp * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .gpp button {
          font-family: inherit;
          cursor: pointer;
          border: none;
          background: none;
          color: inherit;
        }

        /* ── liquid glass: blurred ambient color under a glass tint ── */
        .gpp .ph-ambient {
          position: absolute;
          inset: -15%;
          background: radial-gradient(
              42% 52% at 20% 28%,
              #6e7a5e 0%,
              transparent 70%
            ),
            radial-gradient(46% 56% at 76% 22%, #8a7565 0%, transparent 70%),
            radial-gradient(52% 62% at 62% 82%, #46464c 0%, transparent 72%),
            radial-gradient(36% 46% at 28% 78%, #5d6e6a 0%, transparent 70%),
            #57544e;
          filter: blur(40px);
        }
        .gpp .glass-tint {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.18);
          -webkit-backdrop-filter: blur(60px) saturate(140%);
          backdrop-filter: blur(60px) saturate(140%);
          box-shadow: none;
        }

        /* ── uploaded photo state ── */
        .gpp .photo {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          display: none;
        }
        .gpp .photo-shade {
          position: absolute;
          inset: 0;
          display: none;
        }
        .gpp .filled .photo,
        .gpp .filled .photo-shade {
          display: block;
        }
        .gpp .hero.filled .ph-ambient,
        .gpp .hero.filled .hero-art,
        .gpp .hero.filled .hero-ph {
          display: none;
        }
        .gpp .hero .photo-shade {
          z-index: 2; /* above the trailer-layer so the title stays readable */
          background: linear-gradient(
            0deg,
            rgba(5, 5, 8, 0.62) 0%,
            rgba(5, 5, 8, 0.28) 32%,
            transparent 58%
          );
        }
        .gpp .sample-screen.filled .ph-ambient,
        .gpp .sample-screen.filled .glass-tint {
          display: none;
        }
        .gpp .sample-screen .photo-shade {
          background: linear-gradient(
            0deg,
            rgba(7, 8, 10, 0.55) 0%,
            rgba(7, 8, 10, 0.12) 30%,
            transparent 50%
          );
        }
        .gpp .card.filled .ph-ambient,
        .gpp .card.filled .glass-tint {
          display: none;
        }
        .gpp .card .photo-shade {
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.85) 0%,
            rgba(0, 0, 0, 0.4) 40%,
            rgba(0, 0, 0, 0.1) 100%
          );
        }

        /* ============================================================ MARQUEE HERO */
        .gpp .panel {
          position: relative;
          width: 100%;
          height: 92vh;
          min-height: 560px;
          overflow: hidden;
          background: var(--ink);
        }
        .gpp .panel-art {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center 24%;
          transform: scale(1.04);
          animation: gpp-kb 26s ease-out forwards;
        }
        @keyframes gpp-kb {
          to {
            transform: scale(1.13);
          }
        }
        .gpp .panel-scrim {
          position: absolute;
          inset: 0;
          z-index: 2; /* above the trailer-layer so band/title stay readable */
          background: linear-gradient(
            115deg,
            rgba(0, 0, 0, 0.55) 0%,
            rgba(0, 0, 0, 0.16) 40%,
            transparent 62%
          );
        }
        .gpp .panel-grain {
          position: absolute;
          inset: 0;
          opacity: 0.05;
          pointer-events: none;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .gpp .hero-ph-glyph {
          position: absolute;
          top: 38%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1;
          color: rgba(255, 255, 255, 0.22);
          pointer-events: none;
        }
        .gpp .panel-brand {
          position: absolute;
          left: var(--gut);
          top: 32px;
          z-index: 4;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.78);
          text-shadow: 0 1px 12px rgba(0, 0, 0, 0.4);
        }
        .gpp .panel .theme-toggle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(20, 20, 24, 0.4);
          color: #fff;
          -webkit-backdrop-filter: blur(14px) saturate(150%);
          backdrop-filter: blur(14px) saturate(150%);
          box-shadow: none;
          display: grid;
          place-items: center;
          transition: background 0.2s, transform 0.16s;
        }
        .gpp .panel .theme-toggle:hover {
          background: rgba(40, 40, 46, 0.6);
          transform: scale(1.06);
        }
        .gpp .panel .theme-toggle:active {
          transform: scale(0.94);
        }
        .gpp .theme-toggle .ic-sun {
          display: none;
        }
        .gpp.dark .theme-toggle .ic-sun {
          display: block;
        }
        .gpp.dark .theme-toggle .ic-moon {
          display: none;
        }

        .gpp .panel-title {
          position: absolute;
          left: var(--gut);
          right: var(--gut);
          bottom: 242px;
          z-index: 4;
        }
        .gpp .pt-eyebrow {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: rgba(255, 255, 255, 0.82);
          margin-bottom: 14px;
          text-shadow: 0 2px 18px rgba(0, 0, 0, 0.5);
        }
        .gpp .pt-h {
          font-size: clamp(40px, 4.8vw, 72px);
          font-weight: 800;
          letter-spacing: -0.035em;
          line-height: 0.92;
          max-width: 14ch;
          color: #fff;
          text-shadow: 0 4px 50px rgba(0, 0, 0, 0.4);
        }

        /* frosted control band — fades into the page color */
        .gpp .band {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 5;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr) 250px;
          gap: 44px;
          align-items: start;
          padding: 76px var(--gut) 38px;
          -webkit-backdrop-filter: blur(32px) saturate(140%);
          backdrop-filter: blur(32px) saturate(140%);
          background: linear-gradient(
            0deg,
            rgba(var(--band), 0.97) 30%,
            rgba(var(--band), 0.82) 58%,
            rgba(var(--band), 0.45) 82%,
            rgba(var(--band), 0) 100%
          );
          -webkit-mask-image: linear-gradient(0deg, #000 78%, transparent 100%);
          mask-image: linear-gradient(0deg, #000 78%, transparent 100%);
          color: var(--bt);
          transition: color 0.4s ease;
        }
        .gpp .band-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .gpp .abtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          height: 46px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          transition: transform 0.16s cubic-bezier(0.2, 1.2, 0.3, 1),
            background 0.16s, box-shadow 0.16s;
        }
        .gpp .abtn:active {
          transform: scale(0.975);
        }
        .gpp .abtn.play {
          background: var(--bt);
          color: var(--bg);
          box-shadow: 0 8px 26px rgba(0, 0, 0, 0.18);
        }
        .gpp .abtn.play:hover {
          transform: translateY(-1px);
        }
        .gpp .abtn.buy {
          background: rgba(var(--band), 0.55);
          color: var(--bt);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          backdrop-filter: blur(20px) saturate(160%);
          box-shadow: inset 0 0 0 1px var(--bt3);
        }
        .gpp .abtn.buy:hover {
          transform: translateY(-1px);
        }
        .gpp.dark .abtn.buy {
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          box-shadow: none;
        }
        .gpp.dark .abtn.buy:hover {
          background: rgba(255, 255, 255, 0.24);
        }
        .gpp.dark .bdg {
          background: rgba(255, 255, 255, 0.12);
        }
        .gpp.dark .bdg.rate {
          background: transparent;
          box-shadow: none;
        }
        .gpp .band-free {
          font-size: 13px;
          font-weight: 500;
          color: var(--bt2);
          text-align: center;
          margin-top: 3px;
        }

        .gpp .band-desc {
          padding-top: 2px;
        }
        .gpp .bd-text {
          font-size: 16px;
          line-height: 1.5;
          font-weight: 400;
          color: var(--bt);
          max-width: 62ch;
        }
        .gpp .bd-meta {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--bt2);
          margin-top: 12px;
        }
        .gpp .bd-badges {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }
        .gpp .bdg {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--bt2);
          background: rgba(125, 125, 135, 0.16);
          border-radius: 5px;
          padding: 3px 7px;
        }
        .gpp .bdg.rate {
          background: transparent;
          box-shadow: inset 0 0 0 1.5px var(--bt3);
        }
        .gpp .bd-trailer {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--bt);
          padding: 3px 5px;
          margin-left: 3px;
        }

        .gpp .band-cast {
          padding-top: 2px;
        }
        .gpp .bc-k {
          font-size: 12px;
          font-weight: 600;
          color: var(--bt3);
          margin-bottom: 5px;
        }
        .gpp .bc-v {
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--bt);
        }
        .gpp .bc-sub {
          font-size: 13.5px;
          line-height: 1.45;
          color: var(--bt2);
          margin-top: 4px;
        }

        /* entrance */
        .gpp .rise {
          opacity: 0;
          transform: translateY(22px);
          animation: gpp-rise 1s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
        }
        .gpp .rise.d1 {
          animation-delay: 0.15s;
        }
        .gpp .rise.d2 {
          animation-delay: 0.35s;
        }
        @keyframes gpp-rise {
          to {
            opacity: 1;
            transform: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .gpp .rise,
          .gpp .panel-art {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }

        /* ============================================================ COVER HERO */
        .gpp .hero {
          position: relative;
          width: 100%;
          height: 92vh;
          min-height: 540px;
          overflow: hidden;
          background: transparent;
          font-family: var(--po);
          letter-spacing: normal;
        }
        .gpp .hero-art {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.18);
          -webkit-backdrop-filter: blur(60px) saturate(140%);
          backdrop-filter: blur(60px) saturate(140%);
          box-shadow: none;
        }
        .gpp .hero-ph {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -64%);
          color: rgba(255, 255, 255, 0.22);
          pointer-events: none;
        }
        .gpp .hero-shade {
          display: none;
        }
        .gpp .hero-blend {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 48px;
          z-index: 2;
          background: linear-gradient(180deg, transparent, #141416);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.4s ease;
        }
        .gpp.dark .hero-blend {
          opacity: 1;
        }

        .gpp .hero-eyebrow {
          position: absolute;
          top: 48px;
          left: 64px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }
        .gpp .hero-eyebrow .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #e0482e;
        }

        /* ── touch-to-edit text (Course Page Empty State.html) ── */
        .gpp .gpp-editable {
          outline: none;
          border-radius: 6px;
          transition: box-shadow 0.15s;
          cursor: text;
        }
        .gpp .gpp-editable:hover {
          box-shadow: 0 0 0 1.5px rgba(0, 113, 227, 0.35);
        }
        .gpp .gpp-editable:focus {
          box-shadow: 0 0 0 2px #0071e3;
        }

        /* ── editor affordances (Course Page Empty State.html, verbatim) ── */
        .gpp .add-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 40px;
          padding: 0 18px;
          border-radius: 980px;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          box-shadow: none;
          font-family: var(--sf);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
          transition: background 0.2s, transform 0.16s;
        }
        .gpp .add-pill:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: scale(1.04);
        }
        .gpp .add-pill:active {
          transform: scale(0.96);
        }
        .gpp .add-pill:disabled {
          opacity: 0.6;
          pointer-events: none;
        }
        .gpp .add-pill.active {
          background: rgba(255, 255, 255, 0.92);
          color: #111;
        }
        .gpp .card-add {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 4;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 32px;
          padding: 0 14px;
          border-radius: 980px;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          box-shadow: none;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.005em;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.18s, transform 0.18s;
        }
        .gpp .card-add:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: translateX(-50%) scale(1.05);
        }
        /* once filled, the change control hides until hover */
        .gpp .card.filled .card-add {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s, background 0.18s;
        }
        .gpp .card.filled:hover .card-add {
          opacity: 1;
          pointer-events: auto;
        }
        .gpp .thumb-add {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 4;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 32px;
          padding: 0 14px;
          border-radius: 980px;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.005em;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.18s, transform 0.18s;
        }
        .gpp .thumb-add:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: translate(-50%, -50%) scale(1.05);
        }
        .gpp .lc-thumb:not(.ph) .thumb-add {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
        }
        .gpp .lc-catalog:hover .lc-thumb:not(.ph) .thumb-add {
          opacity: 1;
          pointer-events: auto;
        }
        .gpp .change-pill {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          height: 32px;
          padding: 0 14px;
          border-radius: 980px;
          background: rgba(10, 11, 13, 0.46);
          color: #fff;
          -webkit-backdrop-filter: blur(14px) saturate(150%);
          backdrop-filter: blur(14px) saturate(150%);
          box-shadow: none;
          font-family: var(--sf);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s, background 0.18s;
        }
        .gpp .sample-screen:hover .change-pill {
          opacity: 1;
        }
        .gpp .change-pill:hover {
          background: rgba(40, 40, 46, 0.7);
        }
        .gpp .ph-cta .ph-k {
          font-family: var(--sf);
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .gpp .ph-cta .ph-s {
          font-family: var(--sf);
          font-size: 13px;
          color: rgba(235, 235, 245, 0.6);
          margin-top: -8px;
        }

        /* ── hover-trailer peek layer ── */
        .gpp .trailer-layer {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0;
          transition: opacity 0.45s ease;
          pointer-events: none;
          z-index: 1;
        }
        .gpp .trailer-layer.on {
          opacity: 1;
        }

        /* ── reposition mode ── */
        .gpp .panel.repositioning,
        .gpp .hero.repositioning {
          cursor: grab;
        }
        .gpp .panel.repositioning:active,
        .gpp .hero.repositioning:active {
          cursor: grabbing;
        }
        .gpp .panel.repositioning .band,
        .gpp .panel.repositioning .panel-title,
        .gpp .hero.repositioning .hero-content {
          pointer-events: none;
          opacity: 0.35;
          transition: opacity 0.2s;
        }

        /* creator controls, top right */
        .gpp .creator-bar {
          position: absolute;
          top: 40px;
          right: 64px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .gpp .panel .creator-bar {
          top: 26px;
          right: var(--gut);
        }
        .gpp .creator-bar .theme-toggle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          box-shadow: none;
          display: grid;
          place-items: center;
          transition: background 0.2s, transform 0.16s;
        }
        .gpp .creator-bar .theme-toggle:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: scale(1.06);
        }
        .gpp .creator-bar .theme-toggle:active {
          transform: scale(0.94);
        }

        .gpp .hero-content {
          position: absolute;
          left: 64px;
          right: 64px;
          bottom: 52px;
          max-width: 760px;
          color: #fff;
          z-index: 3;
        }
        .gpp .hero-meta {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 18px;
        }
        .gpp .badge {
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.92);
          color: #1d1d1f;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 7px 14px;
          border-radius: 980px;
        }
        .gpp .meta-line {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 15px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.78);
        }
        .gpp .meta-line .sep {
          opacity: 0.55;
        }
        .gpp .hero-title {
          font-size: clamp(46px, 5.6vw, 84px);
          font-weight: 700;
          line-height: 1.02;
          letter-spacing: -0.025em;
          text-wrap: balance;
        }
        .gpp .hero-desc {
          margin-top: 18px;
          max-width: 580px;
          font-size: 16px;
          font-weight: 500;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.88);
        }
        .gpp .hero-desc .with {
          color: rgba(255, 255, 255, 0.62);
        }
        .gpp .hero-actions {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-top: 26px;
        }
        .gpp .btn-trailer {
          display: inline-flex;
          align-items: center;
          gap: 11px;
          background: #fff;
          color: #111;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          padding: 12px 24px 12px 12px;
          border-radius: 980px;
          font-family: var(--sf);
          transition: transform 0.16s ease;
        }
        .gpp .btn-trailer:hover {
          transform: scale(1.03);
        }
        .gpp .btn-trailer:active {
          transform: scale(0.98);
        }
        .gpp .btn-trailer .play {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #111;
          color: #fff;
          display: grid;
          place-items: center;
          flex: none;
        }
        .gpp .btn-enroll {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          box-shadow: none;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          padding: 15px 26px;
          border-radius: 980px;
          font-family: var(--sf);
          transition: background 0.18s, transform 0.16s ease;
        }
        .gpp .btn-enroll:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: scale(1.03);
        }
        .gpp .btn-enroll:active {
          transform: scale(0.98);
        }

        /* ============================================================ FREE SAMPLE */
        .gpp .sample {
          padding: 76px 64px 12px;
          text-align: center;
        }
        .gpp .sample-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--text-2);
          margin-bottom: 14px;
          transition: color 0.4s ease;
        }
        .gpp .sample h2 {
          font-family: var(--po);
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 600;
          letter-spacing: -0.025em;
          color: var(--text);
          transition: color 0.4s ease;
        }
        .gpp .sample-sub {
          font-size: 16px;
          color: var(--text-2);
          margin-top: 10px;
          transition: color 0.4s ease;
        }
        .gpp .sample-screen {
          position: relative;
          width: min(1040px, 100%);
          aspect-ratio: 16 / 9;
          margin: 36px auto 0;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 40px 30px rgba(0, 0, 0, 0.05);
          display: grid;
          place-items: center;
        }
        .gpp .sample-screen.playable {
          cursor: pointer;
        }
        .gpp .sample-screen.playing {
          cursor: default;
        }
        .gpp .sample-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: #000;
          z-index: 3;
        }
        .gpp .sample-screen.playing .photo,
        .gpp .sample-screen.playing .photo-shade,
        .gpp .sample-screen.playing .ph-ambient,
        .gpp .sample-screen.playing .glass-tint {
          display: none;
        }
        .gpp .ph-cta {
          position: relative;
          z-index: 2;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          color: #fff;
        }
        .gpp .ph-cta .ph-ic {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.14);
          -webkit-backdrop-filter: blur(40px) saturate(150%);
          backdrop-filter: blur(40px) saturate(150%);
          box-shadow: none;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: background 0.2s, transform 0.18s;
        }
        .gpp .ph-cta .ph-ic:hover {
          background: rgba(255, 255, 255, 0.28);
          transform: scale(1.06);
        }

        /* ============================================================ LESSON ROWS (modules) */
        .gpp .lessons {
          padding: 48px var(--gut) 96px;
        }
        .gpp .row {
          margin-top: 48px;
        }
        .gpp .row:first-child {
          margin-top: 0;
        }
        .gpp .row-head {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.015em;
          color: var(--text);
          margin-bottom: 16px;
          transition: color 0.4s ease;
        }
        .gpp .row-head .mod {
          color: var(--text-2);
          font-weight: 600;
        }
        .gpp .row .grid {
          display: flex;
          gap: 30px;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x mandatory;
          scroll-padding-inline: var(--gut);
          scrollbar-width: none;
          -ms-overflow-style: none;
          margin: 0 calc(var(--gut) * -1);
          padding: 0 var(--gut);
        }
        .gpp .row .grid::-webkit-scrollbar {
          display: none;
        }
        /* 4-up when the viewport supports it; below that, cards hold a
           cinematic minimum width and the rail scrolls — never shrink into
           squat tiles. */
        .gpp .row .grid .card,
        .gpp .row .grid .lc-catalog {
          flex: 0 0 max(calc((100% - 90px) / 4), 400px);
          scroll-snap-align: start;
        }

        /* spotlight card — Apple TV-style episode card. Liquid glass while
           awaiting still. */
        .gpp .card {
          position: relative;
          aspect-ratio: 465 / 320;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 18px rgba(0, 0, 0, 0.04);
        }
        .gpp .card[role='button'] {
          cursor: pointer;
        }
        .gpp .card-info {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2;
          padding: 0 20px 16px;
        }
        .gpp .ep {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: rgba(235, 235, 245, 0.66);
        }
        .gpp .card .title {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.015em;
          line-height: 1.2;
          color: #fff;
          margin-top: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gpp .card .desc {
          font-size: 14px;
          line-height: 1.45;
          color: rgba(235, 235, 245, 0.72);
          margin-top: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 40px;
        }
        .gpp .foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
        }
        .gpp .time {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(235, 235, 245, 0.75);
          font-variant-numeric: tabular-nums;
        }
        .gpp .dots {
          display: inline-flex;
          align-items: center;
          gap: 3.5px;
          padding: 5px 2px;
          color: rgba(235, 235, 245, 0.65);
        }
        .gpp .dots span {
          width: 3.5px;
          height: 3.5px;
          border-radius: 50%;
          background: currentColor;
        }

        /* ============================================================ EPISODE STRIP (episodic) */
        .gpp .strip-rh {
          display: flex;
          align-items: baseline;
          gap: 13px;
          margin-bottom: 18px;
        }
        .gpp .strip-rh .rh {
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.015em;
          color: var(--text);
          transition: color 0.4s ease;
        }
        .gpp .strip-rh .rh-meta {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-2);
          transition: color 0.4s ease;
        }
        .gpp .strip-wrap {
          position: relative;
        }
        .gpp .strip-wrap .grid {
          display: flex;
          gap: 30px;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          padding: 4px 2px 16px;
          scrollbar-width: none;
        }
        .gpp .strip-wrap .grid::-webkit-scrollbar {
          display: none;
        }
        .gpp .strip-wrap .grid .lc-catalog,
        .gpp .strip-wrap .grid .card {
          flex: 0 0 max(calc((100% - 90px) / 4), 400px);
          scroll-snap-align: start;
        }

        .gpp .arrow {
          position: absolute;
          top: 0;
          bottom: 16px;
          z-index: 5;
          width: 52px;
          background: none;
          color: rgba(0, 0, 0, 0.5);
          display: grid;
          place-items: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s, color 0.15s;
        }
        .gpp .arrow:hover {
          color: #000;
        }
        .gpp.dark .arrow {
          color: rgba(255, 255, 255, 0.55);
        }
        .gpp.dark .arrow:hover {
          color: #fff;
        }
        .gpp .arrow.prev {
          left: -52px;
        }
        .gpp .arrow.next {
          right: -52px;
        }
        .gpp .arrow.show {
          opacity: 1;
          pointer-events: auto;
        }
        .gpp .arrow svg {
          transition: transform 0.15s;
        }
        .gpp .arrow:active svg {
          transform: scale(0.88);
        }

        /* ── catalog lesson card ── */
        .gpp .lc-catalog {
          cursor: pointer;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          letter-spacing: -0.014em;
        }
        .gpp .lc-card {
          width: 100%;
          border-radius: 24px;
          overflow: hidden;
          background: #ffffff;
          border: 1px solid #e6e6e9;
          display: flex;
          flex-direction: column;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04),
            0 4px 16px rgba(0, 0, 0, 0.05);
          transition: transform 0.26s cubic-bezier(0.34, 1.3, 0.64, 1),
            box-shadow 0.26s;
        }
        .gpp .lc-catalog:hover .lc-card {
          transform: translateY(-5px);
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14),
            0 2px 8px rgba(0, 0, 0, 0.06);
        }
        .gpp .lc-thumb {
          position: relative;
          flex: 0 0 auto;
          aspect-ratio: 380 / 214;
          background: #111111;
          overflow: hidden;
        }
        .gpp .lc-thumb.ph {
          background: none;
        }
        .gpp .lc-thumb img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .gpp .lc-play {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.25);
          display: grid;
          place-items: center;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .gpp .lc-catalog:hover .lc-play {
          opacity: 1;
        }
        .gpp .lc-play-btn {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.95);
          color: #07080a;
          display: grid;
          place-items: center;
          padding-left: 3px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        .gpp .lc-state {
          position: absolute;
          left: 12px;
          top: 12px;
        }
        .gpp .lc-free {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #111;
          background: rgba(255, 255, 255, 0.92);
          padding: 4px 9px;
          border-radius: 980px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }
        .gpp .lc-lock {
          width: 25px;
          height: 25px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: rgba(255, 255, 255, 0.92);
          background: rgba(0, 0, 0, 0.42);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          box-shadow: none;
        }
        /* chips on spotlight cards sit above the photo-shade */
        .gpp .card .lc-state {
          z-index: 3;
        }
        .gpp .lc-dur {
          position: absolute;
          right: 12px;
          top: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.92);
          font-variant-numeric: tabular-nums;
          background: rgba(0, 0, 0, 0.42);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          padding: 4px 9px 4px 7px;
          border-radius: 980px;
          box-shadow: none;
        }
        .gpp .lc-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 18px 20px 20px;
        }
        .gpp .lc-num {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #86868b;
          margin-bottom: 6px;
        }
        .gpp .lc-title {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 1.2;
          color: #1d1d1f;
          margin-bottom: 7px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gpp .lc-desc {
          font-size: 14px;
          color: rgba(0, 0, 0, 0.56);
          line-height: 1.45;
          text-wrap: pretty;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 41px;
        }
        .gpp .lc-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: auto;
          padding-top: 12px;
          font-size: 13px;
          font-weight: 500;
          color: #86868b;
          font-variant-numeric: tabular-nums;
        }

        /* ============================================================ INSTRUCTOR — Apple/MasterClass style */
        .gpp {
          --hair: rgba(0, 0, 0, 0.12);
          --faq-chev: rgba(0, 0, 0, 0.48);
          --faq-ans: #4a4a4f;
        }
        .gpp.dark {
          --hair: rgba(245, 245, 247, 0.16);
          --faq-chev: rgba(245, 245, 247, 0.5);
          --faq-ans: rgba(245, 245, 247, 0.78);
        }
        .gpp .instructor {
          padding: 88px var(--gut) 24px;
          background: var(--bg);
          transition: background 0.4s ease;
        }
        .gpp .inst-inner {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr minmax(380px, 540px);
          gap: clamp(48px, 6vw, 110px);
          align-items: start;
        }
        .gpp .inst-head {
          display: grid;
          grid-template-columns: 108px 1fr;
          gap: 26px;
          align-items: center;
          margin-bottom: 36px;
        }
        .gpp .inst-avatar {
          position: relative;
          width: 108px;
          height: 108px;
          border-radius: 50%;
          overflow: hidden;
          display: grid;
          place-items: center;
          color: #fff;
          box-shadow: inset 0 0 0 1px var(--hair);
        }
        .gpp .inst-avatar .av-ic {
          position: relative;
          z-index: 2;
          opacity: 0.92;
        }
        .gpp .inst-avatar.filled .ph-ambient,
        .gpp .inst-avatar.filled .glass-tint,
        .gpp .inst-avatar.filled .av-ic {
          display: none;
        }
        .gpp .inst-avatar .photo {
          display: none;
        }
        .gpp .inst-avatar.filled .photo {
          display: block;
        }
        .gpp .inst-name {
          font-family: var(--po);
          font-size: clamp(34px, 3.6vw, 54px);
          font-weight: 600;
          line-height: 1.05;
          letter-spacing: -0.03em;
          color: var(--text);
          transition: color 0.4s ease;
        }
        .gpp .inst-sub {
          margin-top: 10px;
          max-width: 520px;
          font-size: 17px;
          line-height: 1.5;
          font-weight: 400;
          color: var(--text-2);
          transition: color 0.4s ease;
        }
        .gpp .inst-bio {
          max-width: 620px;
          font-size: 17px;
          line-height: 1.65;
          color: var(--faq-ans);
          transition: color 0.4s ease;
        }
        .gpp .inst-bio + .inst-bio {
          margin-top: 20px;
        }
        .gpp .inst-media {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 28px;
          overflow: hidden;
          display: grid;
          place-items: center;
        }
        .gpp .inst-media .photo-shade {
          background: linear-gradient(
            0deg,
            rgba(7, 8, 10, 0.42) 0%,
            rgba(7, 8, 10, 0.1) 26%,
            transparent 44%
          );
        }
        .gpp .inst-media.filled .ph-ambient,
        .gpp .inst-media.filled .glass-tint,
        .gpp .inst-media.filled .ph-cta {
          display: none;
        }
        .gpp .inst-media.filled .change-pill {
          display: inline-flex;
        }
        .gpp .inst-media.filled:hover .change-pill {
          opacity: 1;
        }
        .gpp .inst-caption {
          position: absolute;
          left: 20px;
          bottom: 20px;
          z-index: 2;
          padding: 9px 15px;
          border-radius: 11px;
          background: rgba(15, 15, 18, 0.66);
          -webkit-backdrop-filter: blur(14px);
          backdrop-filter: blur(14px);
          color: rgba(255, 255, 255, 0.94);
          font-size: 13.5px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        /* ============================================================ FAQ — Apple style */
        .gpp .faq {
          padding: 40px var(--gut) 120px;
          background: var(--bg);
          transition: background 0.4s ease;
        }
        .gpp .faq-inner {
          max-width: 820px;
          margin: 0 auto;
        }
        .gpp .faq h2 {
          font-family: var(--po);
          font-size: clamp(26px, 7vw, 88px);
          font-weight: 600;
          line-height: 1.02;
          letter-spacing: -0.03em;
          text-align: center;
          color: var(--text);
          white-space: nowrap;
          margin-bottom: clamp(40px, 6vw, 80px);
          transition: color 0.4s ease;
        }
        .gpp .faq-list {
          border-top: 1px solid var(--hair);
        }
        .gpp .faq-item {
          border-bottom: 1px solid var(--hair);
        }
        .gpp .faq-q {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 26px 4px;
          text-align: left;
          font-size: clamp(19px, 2vw, 26px);
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--text);
          transition: color 0.2s ease, opacity 0.2s ease;
        }
        .gpp .faq-q:hover {
          opacity: 0.62;
        }
        .gpp .faq-q .chev {
          flex: none;
          color: var(--faq-chev);
          transition: transform 0.42s cubic-bezier(0.4, 0, 0.2, 1),
            color 0.2s ease;
        }
        .gpp .faq-item.open .faq-q .chev {
          transform: rotate(180deg);
          color: #0071e3;
        }
        .gpp .faq-item.open .faq-q {
          color: var(--text);
        }
        .gpp .faq-a-wrap {
          height: 0;
          overflow: hidden;
          transition: height 0.42s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .gpp .faq-a-clip {
          overflow: hidden;
        }
        .gpp .faq-a {
          padding: 0 64px 8px 4px;
          max-width: 660px;
          font-size: clamp(15px, 1.4vw, 17px);
          line-height: 1.6;
          font-weight: 400;
          color: var(--faq-ans);
          opacity: 0;
          transform: translateY(-6px);
          transition: opacity 0.32s ease 0.04s,
            transform 0.42s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .gpp .faq-item.open .faq-a {
          opacity: 1;
          transform: none;
          padding-bottom: 30px;
        }

        /* ============================================================ MEDIA QUERIES */
        @media (max-width: 1200px) {
          .gpp {
            --gut: 44px;
          }
          .gpp .band {
            grid-template-columns: 280px minmax(0, 1fr);
            gap: 36px;
          }
          .gpp .band-cast {
            display: none;
          }
        }
        @media (max-width: 1100px) {
          .gpp .lessons {
            padding: 40px 40px 72px;
          }
        }
        @media (max-width: 820px) {
          .gpp {
            --gut: 22px;
          }
          .gpp .panel-title {
            bottom: 234px;
          }
          .gpp .band {
            grid-template-columns: 1fr;
            gap: 18px;
            padding-bottom: 28px;
          }
          .gpp .band-desc {
            display: none;
          }
          .gpp .strip-wrap .grid .lc-catalog,
          .gpp .strip-wrap .grid .card {
            flex-basis: min(465px, 84%);
          }
        }
        @media (max-width: 760px) {
          .gpp .row {
            margin-top: 32px;
          }
          .gpp .row .grid {
            gap: 18px;
          }
          .gpp .row .grid .card,
          .gpp .row .grid .lc-catalog {
            flex: 0 0 min(465px, 84%);
          }
          .gpp .lessons {
            padding: 28px 20px 56px;
          }
          .gpp .sample {
            padding: 48px 20px 8px;
          }
          .gpp .hero-eyebrow {
            top: 30px;
            left: 24px;
          }
          .gpp .creator-bar {
            top: 24px;
            right: 20px;
          }
          .gpp .hero-content {
            left: 24px;
            right: 24px;
            bottom: 36px;
          }
          .gpp .hero-actions {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  )
}

export default GeneratedPortalPage
