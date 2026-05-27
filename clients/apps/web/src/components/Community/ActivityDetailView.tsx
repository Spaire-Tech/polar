'use client'

// Community v5 — full-page detail for a single activity.
// Open the activity card on the Activities tab → this replaces the
// rest of the view. Hero + prompt + submitters strip + tabs.
//
// Submissions tab renders the 2-col gallery of bakes; tapping a card
// opens the SubmissionThreadModal side-by-side viewer.
// Discussion + Resources tabs are placeholders for future surfaces.

import {
  type CommunityActivitySubmissionRead,
  useCommunityActivitySubmissions,
} from '@/hooks/queries/community'
import { useEffect, useRef, useState } from 'react'
import type {
  ActivitySubmissionInput,
  CommunityActivity,
} from './ActivitiesView'
import { Avatar } from './Avatar'
import styles from './community.module.css'
import {
  IconCamera,
  IconChat,
  IconClock,
  IconImage,
  IconPlayCircle,
  IconVideo,
} from './icons'
import { SubmissionThreadModal } from './SubmissionThreadModal'

type Props = {
  activity: CommunityActivity
  courseId: string | undefined
  customerSessionToken: string | null | undefined
  /** 'creator' = host viewing from the editor; 'customer' = student. */
  mode: 'creator' | 'customer'
  onBack: () => void
  onSubmit: (
    activityId: string,
    submission: ActivitySubmissionInput,
  ) => Promise<void> | void
  onOpenSubmit: () => void
  /** Host-side manage actions. Surfaced inline with the back button
   * so the activity list cards can stay clean (the submit CTA owns
   * the bottom-right corner there). */
  canManage?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function ActivityDetailView({
  activity,
  courseId,
  customerSessionToken,
  mode,
  onBack,
  onOpenSubmit,
  canManage,
  onEdit,
  onDelete,
}: Props) {
  const [tab, setTab] = useState<'subs' | 'disc' | 'res'>('subs')
  const [manageOpen, setManageOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // The activities list may have left the scroll position halfway down
  // the page. When we mount the detail view, walk up the DOM to find
  // the closest scrollable ancestor and snap it back to the top so the
  // hero is what the user sees first.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let foundScrollable = false
    let node: HTMLElement | null = el.parentElement
    while (node && node !== document.body) {
      const style = getComputedStyle(node)
      const overflowY = style.overflowY
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight
      ) {
        node.scrollTo({ top: 0, behavior: 'auto' })
        foundScrollable = true
        break
      }
      node = node.parentElement
    }
    // Always also reset the document scroll — covers browsers where the
    // page itself is the scroll container, and acts as a fallback when
    // no scrollable ancestor was found (e.g. nested iframe layouts).
    window.scrollTo({ top: 0, behavior: 'auto' })
    if (!foundScrollable && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug(
        '[ActivityDetailView] No scrollable ancestor found; fell back to window.scrollTo.',
      )
    }
  }, [activity.id])
  const [openSub, setOpenSub] =
    useState<CommunityActivitySubmissionRead | null>(null)

  const submissionsQ = useCommunityActivitySubmissions(
    customerSessionToken,
    courseId,
    activity.id,
    mode,
  )
  const subs = submissionsQ.data ?? []

  const pct =
    activity.totalMembers > 0
      ? Math.round((activity.distinctSubmitters / activity.totalMembers) * 100)
      : 0

  const closed = activity.status === 'closed'

  const coverPos = activity.coverObjectPosition || '50% 50%'
  const coverStyle: React.CSSProperties = activity.coverUrl
    ? {
        backgroundImage: `url(${activity.coverUrl})`,
        backgroundPosition: coverPos,
        backgroundSize: 'cover',
      }
    : { background: 'linear-gradient(135deg, #1f1f1f, #4a4a4a)' }

  const channelWord = activity.channelKind === 'lesson' ? 'Episode' : 'Module'

  const navigate = (dir: number) => {
    if (!openSub) return
    const idx = subs.findIndex((s) => s.id === openSub.id)
    if (idx < 0) return
    const nextIdx = (idx + dir + subs.length) % subs.length
    setOpenSub(subs[nextIdx])
  }

  return (
    <div ref={rootRef}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <button type="button" className={styles.detailBack} onClick={onBack}>
          ‹ Back to activities
        </button>
        {canManage && (onEdit || onDelete) && (
          <div
            style={{ position: 'relative' }}
            onMouseLeave={() => setManageOpen(false)}
          >
            <button
              type="button"
              aria-label="Manage activity"
              onClick={(e) => {
                e.stopPropagation()
                setManageOpen((v) => !v)
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: 'var(--c-panel)',
                color: 'var(--c-ink)',
                border: 0,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: -1,
                padding: 0,
              }}
            >
              ⋯
            </button>
            {manageOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 36,
                  right: 0,
                  minWidth: 160,
                  background: '#fff',
                  border: '1px solid var(--c-line)',
                  borderRadius: 12,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.16)',
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  zIndex: 10,
                }}
              >
                {onEdit && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation()
                      setManageOpen(false)
                      onEdit()
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--c-ink)',
                    }}
                  >
                    Edit activity
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation()
                      setManageOpen(false)
                      onDelete()
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#dc2626',
                    }}
                  >
                    Delete activity
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.adHero}>
        <div className={styles.adHeroImg} style={coverStyle} />
        <div className={styles.adHeroGrad} />
        <div className={styles.adHeroContent}>
          <span className={styles.adHeroOverline}>
            <span className={styles.num}>∙</span>
            {channelWord} · {activity.channelLabel || 'Activity'}
            {closed && (
              <span
                className={`${styles.adHeroStatus} ${styles.adHeroStatusClosed}`}
              >
                Closed
              </span>
            )}
          </span>
          <div className={styles.adHeroTitle}>{activity.title}</div>
        </div>
      </div>

      <div className={styles.adPrompt}>
        <div className={styles.adPromptBody}>
          {activity.desc || 'No prompt yet.'}
        </div>
        {!closed && (
          <div className={styles.adPromptActions}>
            <button
              type="button"
              className={styles.adSubmitCta}
              onClick={onOpenSubmit}
            >
              <IconCamera size={14} />
              {activity.submissionType === 'video'
                ? 'Upload video'
                : activity.hasOwnSubmission
                  ? 'Submit again'
                  : 'Submit your work'}
            </button>
          </div>
        )}
      </div>

      <div className={styles.adMetaStrip}>
        <span className={styles.adMetaStripBit}>
          <span>
            <strong>{activity.distinctSubmitters}</strong> of{' '}
            {activity.totalMembers} submitted
          </span>
        </span>
        {closed && (
          <span className={styles.adMetaStripBit}>
            <IconClock size={12} />
            <span>
              <strong>Closed</strong>
            </span>
          </span>
        )}
        <span
          className={styles.adMetaStripBit}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <span style={{ fontSize: 11.5 }}>{pct}%</span>
          <div className={styles.adProgressThin}>
            <div style={{ width: `${pct}%` }} />
          </div>
        </span>
      </div>

      <div className={styles.adTabs}>
        <button
          type="button"
          className={`${styles.adTab} ${tab === 'subs' ? styles.adTabActive : ''}`}
          onClick={() => setTab('subs')}
        >
          Submissions<span className={styles.ct}>{subs.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.adTab} ${tab === 'disc' ? styles.adTabActive : ''}`}
          onClick={() => setTab('disc')}
        >
          Discussion
        </button>
        <button
          type="button"
          className={`${styles.adTab} ${tab === 'res' ? styles.adTabActive : ''}`}
          onClick={() => setTab('res')}
        >
          Resources
        </button>
        <span className={styles.adTabSpacer} />
      </div>

      {tab === 'subs' &&
        (submissionsQ.isLoading ? (
          <div
            style={{
              height: 200,
              borderRadius: 16,
              background: 'var(--c-panel)',
            }}
          />
        ) : subs.length === 0 ? (
          <div className={styles.eventsEmpty} style={{ marginTop: 8 }}>
            <div className={styles.eventsEmptyIcon}>
              <IconCamera size={28} />
            </div>
            <div>
              <div className={styles.eventsEmptyTitle}>
                Be the first to submit
              </div>
              <p className={styles.eventsEmptySub}>
                Nobody has shared their work for this activity yet. Yours could
                kick off the gallery.
              </p>
            </div>
            {!closed && (
              <div className={styles.eventsEmptyActions}>
                <button
                  type="button"
                  className={styles.eventsEmptyBtn}
                  onClick={onOpenSubmit}
                >
                  <IconCamera size={13} /> Submit yours
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.subsGrid}>
            {subs.map((s) => (
              <SubmissionCard
                key={s.id}
                submission={s}
                onOpen={() => setOpenSub(s)}
              />
            ))}
          </div>
        ))}

      {tab === 'disc' && (
        <div
          style={{
            padding: '40px 12px',
            color: 'var(--c-muted)',
            textAlign: 'center',
            fontSize: 13.5,
          }}
        >
          Pure-text discussion thread for this activity is coming next.
        </div>
      )}

      {tab === 'res' && (
        <div
          style={{
            padding: '40px 12px',
            color: 'var(--c-muted)',
            textAlign: 'center',
            fontSize: 13.5,
          }}
        >
          Recipes, reference photos, and reading attached by your instructor.
        </div>
      )}

      {openSub && courseId && (
        <SubmissionThreadModal
          submission={openSub}
          submissions={subs}
          customerSessionToken={customerSessionToken}
          courseId={courseId}
          activityId={activity.id}
          mode={mode}
          onClose={() => setOpenSub(null)}
          onNavigate={navigate}
        />
      )}
    </div>
  )
}

function SubmissionCard({
  submission,
  onOpen,
}: {
  submission: CommunityActivitySubmissionRead
  onOpen: () => void
}) {
  const s = submission
  const photo =
    s.file_url ||
    (s.mux_playback_id
      ? `https://image.mux.com/${s.mux_playback_id}/thumbnail.jpg`
      : null)
  const isVideo = s.submission_type === 'video'
  const hasFeedback = false // TODO: wire when activity-submission comments backend lands
  const when = relativeTime(s.created_at)

  return (
    <article className={styles.subCard} onClick={onOpen}>
      <div className={styles.subCoverFrame}>
        {photo ? (
          <img
            src={photo}
            alt=""
            className={styles.subCoverImg}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: s.image_object_position || '50% 50%',
              display: 'block',
            }}
            loading="lazy"
          />
        ) : (
          <div
            className={styles.subCoverImg}
            style={{ background: '#3a2a18' }}
          />
        )}
        {hasFeedback && (
          <div className={styles.subCoverOverlay}>
            <span className={styles.subCoverFb}>
              <span className={styles.dot} /> Instructor feedback
            </span>
          </div>
        )}
        {isVideo && (
          <div className={styles.subCoverVideoBtn}>
            <span className={styles.play}>
              <IconPlayCircle size={20} />
            </span>
          </div>
        )}
      </div>
      <div className={styles.subBody}>
        <div className={styles.subAuthorRow}>
          <Avatar name={s.author_name} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.subAuthorName}>{s.author_name}</div>
            <div className={styles.subAuthorMeta}>{when}</div>
          </div>
        </div>
        {s.body && <div className={styles.subCaption}>{s.body}</div>}
        {!s.body && s.submission_type === 'link' && s.link_url && (
          <div className={styles.subCaption}>{s.link_url}</div>
        )}
        <div className={styles.subFoot}>
          <div className={styles.subFootStats}>
            <span className={styles.subFootStat}>
              {isVideo ? <IconVideo size={12} /> : <IconImage size={12} />}{' '}
              {TYPE_SHORT[s.submission_type] ?? s.submission_type}
            </span>
            <span className={styles.subFootStat}>
              <IconChat size={12} /> 0
            </span>
          </div>
          <span>View</span>
        </div>
      </div>
    </article>
  )
}

const TYPE_SHORT: Record<string, string> = {
  photo: 'Photo',
  video: 'Video',
  text: 'Text',
  link: 'Link',
}

const relativeTime = (iso: string): string => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
