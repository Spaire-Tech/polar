'use client'

import {
  CourseLessonRead,
  CourseModuleRead,
  CourseRead,
  LessonAttachment,
  useCreateMuxUpload,
  useDeleteLessonAttachment,
  usePreviewAccess,
  useUploadLessonAttachment,
  useUploadLessonThumbnail,
} from '@/hooks/queries/courses'
import AttachFileOutlined from '@mui/icons-material/AttachFileOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { useEffect, useRef, useState } from 'react'
import { HlsVideo } from '../HlsVideo'
import { RichTextEditor } from './RichTextEditor'
import { ThumbnailPositioner } from './ThumbnailPositioner'

type Media = 'none' | 'video' | 'audio'

export type LessonEdits = {
  title: string
  moduleId: string
  description: string
  media: Media
  textContent: string
  videoUrl: string
  published: boolean
  commentsMode: 'visible' | 'hidden' | 'locked'
  thumbnailObjectPosition: string | null
}

export function LessonDetail({
  lesson,
  module,
  course,
  organizationSlug,
  onSave,
  onDelete,
  isSaving,
  onGenerateAI,
  isGenerating,
  onStopAI,
}: {
  lesson: CourseLessonRead
  module: CourseModuleRead
  course: CourseRead
  organizationSlug: string
  onSave: (edits: LessonEdits) => void
  onDelete: () => void
  isSaving: boolean
  onGenerateAI?: (
    edits: LessonEdits,
    onChunk: (chunk: string) => void,
  ) => Promise<void>
  isGenerating?: boolean
  onStopAI?: () => void
}) {
  const previewAccess = usePreviewAccess()

  const handlePreview = async () => {
    try {
      const { portal_url } = await previewAccess.mutateAsync(course.id)
      const url = new URL(portal_url, window.location.origin)
      url.searchParams.set('lesson', lesson.id)
      window.open(url.toString(), '_blank', 'noopener,noreferrer')
    } catch {
      window.open(
        `/${organizationSlug}/portal/courses/${course.id}?lesson=${lesson.id}`,
        '_blank',
        'noopener,noreferrer',
      )
    }
  }
  const [edits, setEdits] = useState<LessonEdits>(() =>
    initEdits(lesson, module),
  )
  const [moduleSelectOpen, setModuleSelectOpen] = useState(false)
  const moduleSelectRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    lesson.thumbnail_url ?? null,
  )
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const initialAttachments =
    (lesson.content?.attachments as LessonAttachment[] | undefined) ?? []
  const [attachments, setAttachments] =
    useState<LessonAttachment[]>(initialAttachments)
  const createMuxUpload = useCreateMuxUpload()
  const uploadThumbnail = useUploadLessonThumbnail()
  const uploadAttachment = useUploadLessonAttachment()
  const deleteAttachment = useDeleteLessonAttachment()

  useEffect(() => {
    setEdits(initEdits(lesson, module))
    setThumbnailUrl(lesson.thumbnail_url ?? null)
    setAttachments(
      (lesson.content?.attachments as LessonAttachment[] | undefined) ?? [],
    )
  }, [lesson.id, module.id])

  const handleAttachmentFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const updated = await uploadAttachment.mutateAsync({
        lessonId: lesson.id,
        file,
      })
      setAttachments(
        (updated.content?.attachments as LessonAttachment[] | undefined) ?? [],
      )
    } catch {
      // mutation surfaces error
    }
    e.target.value = ''
  }

  const handleAttachmentDelete = async (attachmentId: string) => {
    try {
      const updated = await deleteAttachment.mutateAsync({
        lessonId: lesson.id,
        attachmentId,
      })
      setAttachments(
        (updated.content?.attachments as LessonAttachment[] | undefined) ?? [],
      )
    } catch {
      // mutation surfaces error
    }
  }

  const handleThumbnailFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const updated = await uploadThumbnail.mutateAsync({
        lessonId: lesson.id,
        file,
      })
      setThumbnailUrl(updated.thumbnail_url ?? null)
    } catch {
      // error feedback handled by mutation
    }
    e.target.value = ''
  }

  useEffect(() => {
    if (!moduleSelectOpen) return
    const onClick = (e: MouseEvent) => {
      if (!moduleSelectRef.current?.contains(e.target as Node))
        setModuleSelectOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [moduleSelectOpen])

  const update = <K extends keyof LessonEdits>(key: K, value: LessonEdits[K]) =>
    setEdits((prev) => ({ ...prev, [key]: value }))

  const currentModule =
    course.modules.find((m) => m.id === edits.moduleId) ?? module

  const handleGenerate = async () => {
    if (!onGenerateAI) return
    update('textContent', '')
    await onGenerateAI(edits, (chunk) =>
      setEdits((prev) => ({ ...prev, textContent: prev.textContent + chunk })),
    )
  }

  const handleVideoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { upload_url } = await createMuxUpload.mutateAsync(lesson.id)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable)
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
        }
        xhr.onload = () => {
          setUploadProgress(null)
          resolve()
        }
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.open('PUT', upload_url)
        xhr.send(file)
      })
    } catch {
      setUploadProgress(null)
    }
    e.target.value = ''
  }

  const isPublished = edits.published

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#f5f5f7', overflow: 'hidden' }}>
      {/* Lesson title bar */}
      <div style={{
        padding: '14px 24px 13px', borderBottom: '1px solid #e8e8ed',
        background: '#ffffff', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.015em' }}>
          {edits.title || 'Untitled lesson'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewAccess.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: '1.5px solid #e8e8ed', borderRadius: 100,
              padding: '6px 14px', fontSize: 12, fontWeight: 500, color: '#48484a',
              cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s', fontFamily: 'inherit',
            }}
          >
            <VisibilityOutlined sx={{ fontSize: 13 }} />
            {previewAccess.isPending ? 'Opening…' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => onSave(edits)}
            disabled={isSaving}
            style={{
              background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 100,
              padding: '7px 18px', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'inherit',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Main */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Lesson details card */}
          <EdCard>
            <EdCardTitle>Lesson details</EdCardTitle>
            <EdField label="Title">
              <input
                type="text"
                value={edits.title}
                onChange={(e) => update('title', e.target.value)}
                style={inputStyle}
              />
            </EdField>
            <EdField label="Description">
              <textarea
                value={edits.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Brief overview of this lesson"
                rows={3}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
              />
            </EdField>
          </EdCard>

          {/* Media card */}
          <EdCard>
            <EdCardTitle>Media</EdCardTitle>

            {/* Segmented media tabs */}
            <div style={{
              display: 'flex', background: '#f5f5f7', borderRadius: 10,
              padding: 3, marginBottom: 14, gap: 2,
            }}>
              {([
                { id: 'none', label: 'None', icon: <IconNone /> },
                { id: 'video', label: 'Video', icon: <IconVideo /> },
                { id: 'audio', label: 'Audio', icon: <IconAudio /> },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => update('media', m.id)}
                  style={{
                    flex: 1, padding: '7px 0', border: 'none', borderRadius: 8,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
                    fontFamily: 'inherit',
                    background: edits.media === m.id ? '#fff' : 'transparent',
                    color: edits.media === m.id ? '#0a0a0a' : '#8e8e93',
                    boxShadow: edits.media === m.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            {/* Video upload */}
            {edits.media === 'video' && (
              <>
                <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoFileChange} />
                {lesson.mux_playback_id && lesson.mux_status === 'ready' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ aspectRatio: '16/9', overflow: 'hidden', borderRadius: 10, background: '#000' }}>
                      <HlsVideo playbackId={lesson.mux_playback_id} />
                    </div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} style={ghostBtnStyle}>Replace video</button>
                  </div>
                ) : lesson.mux_status && lesson.mux_status !== 'errored' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1d4ed8' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #3b82f6', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                    {uploadProgress !== null ? `Uploading… ${uploadProgress}%` : 'Processing video…'}
                  </div>
                ) : (
                  <>
                    {lesson.mux_status === 'errored' && <p style={{ fontSize: 11, color: '#ff3b30', marginBottom: 8 }}>Upload failed — try again.</p>}
                    <label style={uploadZoneStyle}>
                      <UploadIcon />
                      <div style={{ fontSize: 12, color: '#0a0a0a', fontWeight: 600 }}>Upload video file</div>
                      <div style={{ fontSize: 11, color: '#c7c7cc' }}>MP4, MOV or WebM · max 10GB</div>
                      <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoFileChange} />
                    </label>
                  </>
                )}
              </>
            )}

            {/* Audio upload */}
            {edits.media === 'audio' && (
              <label style={uploadZoneStyle}>
                <UploadIcon />
                <div style={{ fontSize: 12, color: '#0a0a0a', fontWeight: 600 }}>Upload audio file</div>
                <div style={{ fontSize: 11, color: '#c7c7cc' }}>MP3, M4A or WAV · max 500MB</div>
                <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={() => {}} />
              </label>
            )}

            {edits.media === 'none' && (
              <div style={{ padding: '14px 0', fontSize: 12, color: '#8e8e93', textAlign: 'center' }}>
                No media attached to this lesson.
              </div>
            )}

            {/* Notes / Rich text */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#48484a', marginBottom: 8 }}>Notes</div>
              <RichTextEditor
                value={edits.textContent}
                onChange={(md) => update('textContent', md)}
                isGenerating={isGenerating}
                onGenerate={onGenerateAI && edits.media === 'none' ? handleGenerate : undefined}
                onStop={onStopAI}
              />
            </div>
          </EdCard>

          {/* Downloads card */}
          <EdCard>
            <EdCardTitle>Downloads</EdCardTitle>
            <input ref={attachmentInputRef} type="file" style={{ display: 'none' }} onChange={handleAttachmentFileChange} />
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {attachments.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #e8e8ed', borderRadius: 10, padding: '8px 12px' }}>
                    <AttachFileOutlined sx={{ fontSize: 14 }} style={{ color: '#8e8e93', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#0a0a0a', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.filename}
                      </a>
                      <span style={{ fontSize: 11, color: '#8e8e93' }}>{formatBytes(a.size)}</span>
                    </div>
                    <button type="button" onClick={() => handleAttachmentDelete(a.id)} disabled={deleteAttachment.isPending}
                      style={{ background: 'none', border: 'none', color: '#c7c7cc', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                      <CloseOutlined sx={{ fontSize: 14 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={uploadAttachment.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#f5f5f7', border: '1.5px dashed #c7c7cc', borderRadius: 10,
                padding: '9px 14px', fontSize: 12, fontWeight: 500, color: '#8e8e93',
                width: '100%', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                fontFamily: 'inherit',
              }}
            >
              <PlusIcon />
              {uploadAttachment.isPending ? 'Uploading…' : 'Add file'}
            </button>
          </EdCard>

          {/* Automations card */}
          <EdCard>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <EdCardTitle style={{ margin: 0 }}>Automations</EdCardTitle>
              <button type="button" style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 100,
                padding: '5px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <PlusIcon /> New automation
              </button>
            </div>
            <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M18 4l-4 10h8L14 28l4-11H10L18 4z" stroke="#c7c7cc" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
              </svg>
              <div style={{ fontSize: 12, color: '#8e8e93', textAlign: 'center', lineHeight: 1.5 }}>
                Automations using this lesson will appear here
              </div>
            </div>
          </EdCard>
        </div>

        {/* Sidebar */}
        <div style={{
          width: 268, flexShrink: 0, overflowY: 'auto',
          padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14,
          borderLeft: '1px solid #e8e8ed', background: '#fff',
        }}>

          {/* Status */}
          <SbCard>
            <SbCardTitle>Status</SbCardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                { id: false, label: 'Draft', badge: <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100, background: '#e8e8ed', color: '#48484a', letterSpacing: '0.04em' }}>Draft</span> },
                { id: true, label: 'Published', badge: <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100, background: '#dcfce7', color: '#15803d', letterSpacing: '0.04em' }}>Live</span> },
              ] as const).map((opt) => (
                <div key={String(opt.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => update('published', opt.id)}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${edits.published === opt.id ? '#0a0a0a' : '#c7c7cc'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color 0.15s',
                  }}>
                    {edits.published === opt.id && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0a0a0a' }} />}
                  </div>
                  <div style={{ fontSize: 12, color: '#0a0a0a' }}>{opt.label}</div>
                  {edits.published === opt.id && opt.badge}
                </div>
              ))}
            </div>
            {isPublished && (
              <div style={{
                marginTop: 10, padding: '9px 12px', background: '#f0fdf4',
                border: '1px solid #bbf7d0', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 11, fontWeight: 500, color: '#15803d',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 0 2px rgba(34,197,94,0.25)' }} />
                Live — visible to members
              </div>
            )}
          </SbCard>

          {/* Lesson Thumbnail */}
          <SbCard>
            <SbCardTitle>Lesson thumbnail</SbCardTitle>
            <input ref={thumbnailInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleThumbnailFileChange} />
            <div
              onClick={() => thumbnailInputRef.current?.click()}
              style={{
                aspectRatio: '16/9', background: '#e8e8ed', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                border: '1.5px dashed #c7c7cc', marginBottom: 10,
                transition: 'border-color 0.18s',
              }}
            >
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
              ) : (
                <ImageOutlined sx={{ fontSize: 28 }} style={{ color: '#c7c7cc' }} />
              )}
              {!thumbnailUrl && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.24)' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Upload</span>
                </div>
              )}
            </div>
            {thumbnailUrl && (
              <div style={{ marginBottom: 10 }}>
                <ThumbnailPositioner src={thumbnailUrl} value={edits.thumbnailObjectPosition} onChange={(v) => update('thumbnailObjectPosition', v)} />
              </div>
            )}
            <div style={{ fontSize: 10, color: '#8e8e93', lineHeight: 1.5, marginBottom: 8 }}>JPG, PNG, or WebP. Recommended 1920×1080.</div>
            <button
              type="button"
              onClick={() => thumbnailInputRef.current?.click()}
              disabled={uploadThumbnail.isPending}
              style={{ width: '100%', padding: 8, background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'inherit', opacity: uploadThumbnail.isPending ? 0.6 : 1 }}
            >
              {uploadThumbnail.isPending ? 'Uploading…' : 'Pick file'}
            </button>
          </SbCard>

          {/* Comments */}
          <SbCard>
            <SbCardTitle>Comments</SbCardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {(['visible', 'hidden', 'locked'] as const).map((opt) => (
                <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => update('commentsMode', opt)}>
                  <div style={{
                    width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${edits.commentsMode === opt ? '#0a0a0a' : '#c7c7cc'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color 0.15s',
                  }}>
                    {edits.commentsMode === opt && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0a0a0a' }} />}
                  </div>
                  <span style={{ fontSize: 12, color: '#0a0a0a', textTransform: 'capitalize' }}>{opt}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#8e8e93' }}>Comments enabled</div>
          </SbCard>

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', color: '#ff3b30',
              fontSize: 12, fontWeight: 500, padding: '8px 0',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
            }}
          >
            <TrashIcon /> Delete lesson
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function initEdits(
  lesson: CourseLessonRead,
  module: CourseModuleRead,
): LessonEdits {
  const text = (lesson.content as { text?: string } | null)?.text ?? ''
  const media: Media =
    lesson.content_type === 'video'
      ? 'video'
      : lesson.content_type === 'download'
        ? 'audio'
        : 'none'
  return {
    title: lesson.title,
    moduleId: module.id,
    description: (lesson as any).description ?? '',
    media,
    textContent: text,
    videoUrl: lesson.video_asset_id ?? '',
    published: lesson.published,
    commentsMode: 'visible',
    thumbnailObjectPosition: lesson.thumbnail_object_position ?? null,
  }
}

// ── Layout primitives ──────────────────────────────────────────────────────

function EdCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e8ed', padding: '18px 20px' }}>
      {children}
    </div>
  )
}

function EdCardTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: '#48484a', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14, ...style }}>
      {children}
    </div>
  )
}

function EdField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#48484a', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function SbCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8ed', padding: '14px 16px' }}>
      {children}
    </div>
  )
}

function SbCardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#48484a', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
      {children}
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#f5f5f7',
  border: '1px solid #e8e8ed',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: '#0a0a0a',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const uploadZoneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  border: '1.5px dashed #c7c7cc',
  borderRadius: 12,
  padding: '28px 20px',
  cursor: 'pointer',
  background: '#fafafa',
  textAlign: 'center',
}

const ghostBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1.5px solid #e8e8ed',
  borderRadius: 8,
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 500,
  color: '#48484a',
  cursor: 'pointer',
  fontFamily: 'inherit',
  width: '100%',
}

// ── SVG icons ──────────────────────────────────────────────────────────────

function IconNone() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconVideo() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="1" y="2.5" width="7.5" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.5 4.5l2.5-1.5v6l-2.5-1.5V4.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

function IconAudio() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4 2.5h4v6.5a2 2 0 01-4 0V2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 6a4 4 0 008 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="6" y1="10" x2="6" y2="11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: '#c7c7cc' }}>
      <path d="M12 16V8m0 0l-3 3m3-3l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3.5h9M5 3.5V2h3v1.5M4 3.5l.5 7h4l.5-7H4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
