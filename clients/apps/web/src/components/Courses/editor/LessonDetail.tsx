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
import AddOutlined from '@mui/icons-material/AddOutlined'
import AttachFileOutlined from '@mui/icons-material/AttachFileOutlined'
import AudiotrackOutlined from '@mui/icons-material/AudiotrackOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { cn } from '@spaire/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { HlsVideo } from '../HlsVideo'
import { RichTextEditor } from './RichTextEditor'

type Media = 'none' | 'video' | 'audio'

export type LessonEdits = {
  title: string
  description: string
  moduleId: string
  media: Media
  textContent: string
  videoUrl: string
  published: boolean
  commentsMode: 'visible' | 'hidden' | 'locked'
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

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-8 py-4">
        <h2 className="flex items-center gap-1.5 text-xl font-bold text-gray-900">
          {edits.title || 'Untitled Lesson'}
          <HelpOutlineOutlined
            className="text-gray-300"
            sx={{ fontSize: 16 }}
          />
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handlePreview}
            disabled={previewAccess.isPending}
            className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <VisibilityOutlined sx={{ fontSize: 16 }} />
            {previewAccess.isPending ? 'Opening…' : 'Preview'}
          </button>
          <button
            onClick={() => onSave(edits)}
            disabled={isSaving}
            className="rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_320px] gap-6 px-8 py-6">
        {/* Main column */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Lesson Details" />

            <Field label="Title">
              <input
                type="text"
                value={edits.title}
                onChange={(e) => update('title', e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:ring-2 focus:ring-gray-100 focus:outline-none"
              />
            </Field>

            <Field label="Description">
              <textarea
                value={edits.description}
                onChange={(e) => update('description', e.target.value)}
                rows={3}
                className="w-full resize-y rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:ring-2 focus:ring-gray-100 focus:outline-none"
              />
            </Field>

            <Field label="Select module">
              <div ref={moduleSelectRef} className="relative">
                <button
                  type="button"
                  onClick={() => setModuleSelectOpen((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 hover:bg-gray-50"
                >
                  <span className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {currentModule.title}
                    <CloseOutlined
                      sx={{ fontSize: 12 }}
                      className="text-gray-400"
                    />
                  </span>
                  <span className="ml-auto text-gray-400">
                    <KeyboardArrowDownOutlined fontSize="small" />
                  </span>
                </button>
                {moduleSelectOpen && (
                  <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                    {course.modules.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          update('moduleId', m.id)
                          setModuleSelectOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50',
                          m.id === edits.moduleId && 'bg-gray-50 font-medium',
                        )}
                      >
                        {m.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <div className="mb-5">
              <h3 className="mb-2 text-base font-bold text-gray-900">Media</h3>
              <div className="grid grid-cols-3 gap-3">
                {(['none', 'video', 'audio'] as const).map((m) => {
                  const active = edits.media === m
                  const label = m[0].toUpperCase() + m.slice(1)
                  const Icon =
                    m === 'video'
                      ? OndemandVideoOutlined
                      : m === 'audio'
                        ? AudiotrackOutlined
                        : null
                  return (
                    <button
                      key={m}
                      onClick={() => update('media', m)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-2xl border-2 py-4 text-sm font-medium transition-colors',
                        active
                          ? 'border-gray-900 bg-white text-gray-900'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                      )}
                    >
                      {Icon && <Icon fontSize="small" />}
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {edits.media === 'video' && (
              <div className="mb-5">
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  Video
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoFileChange}
                />
                {lesson.mux_playback_id && lesson.mux_status === 'ready' ? (
                  <div className="flex flex-col gap-3">
                    <div className="aspect-video overflow-hidden rounded-xl bg-black">
                      <HlsVideo playbackId={lesson.mux_playback_id} />
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-fit rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Replace video
                    </button>
                  </div>
                ) : lesson.mux_status && lesson.mux_status !== 'errored' ? (
                  <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    {uploadProgress !== null
                      ? `Uploading… ${uploadProgress}%`
                      : 'Processing video…'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {lesson.mux_status === 'errored' && (
                      <p className="text-xs text-red-600">
                        Upload failed — try again.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={
                        createMuxUpload.isPending || uploadProgress !== null
                      }
                      className="flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-6 py-8 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 disabled:opacity-50"
                    >
                      <OndemandVideoOutlined fontSize="small" />
                      {uploadProgress !== null
                        ? `Uploading… ${uploadProgress}%`
                        : createMuxUpload.isPending
                          ? 'Preparing…'
                          : 'Upload video file'}
                    </button>
                    <p className="text-xs text-gray-400">
                      MP4, MOV, or WebM. Mux will transcode and deliver via HLS.
                    </p>
                  </div>
                )}
              </div>
            )}

            <RichTextEditor
              value={edits.textContent}
              onChange={(md) => update('textContent', md)}
              isGenerating={isGenerating}
              onGenerate={
                onGenerateAI && edits.media === 'none'
                  ? handleGenerate
                  : undefined
              }
              onStop={onStopAI}
            />

            <div className="mt-6">
              <h3 className="mb-2 text-base font-bold text-gray-900">
                Downloads
              </h3>
              <input
                ref={attachmentInputRef}
                type="file"
                className="hidden"
                onChange={handleAttachmentFileChange}
              />
              {attachments.length > 0 && (
                <div className="mb-3 flex flex-col gap-2">
                  {attachments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5"
                    >
                      <AttachFileOutlined
                        sx={{ fontSize: 16 }}
                        className="text-gray-400"
                      />
                      <div className="min-w-0 flex-1">
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-sm font-medium text-gray-900 hover:underline"
                        >
                          {a.filename}
                        </a>
                        <p className="text-xs text-gray-400">
                          {formatBytes(a.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAttachmentDelete(a.id)}
                        disabled={deleteAttachment.isPending}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        title="Remove file"
                      >
                        <DeleteOutlineOutlined sx={{ fontSize: 14 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                disabled={uploadAttachment.isPending}
                className="flex items-center gap-1.5 rounded-full border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <AddOutlined sx={{ fontSize: 16 }} />
                {uploadAttachment.isPending ? 'Uploading…' : 'Add Files'}
              </button>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Automations</h3>
              <button className="flex items-center gap-1.5 rounded-full bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800">
                <AddOutlined sx={{ fontSize: 16 }} />
                New automation
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Automations using this{' '}
              <span className="font-semibold text-gray-900">{edits.title}</span>{' '}
              will appear here.
            </p>
            <p className="mt-12 text-center text-sm text-gray-400">
              This resource is not used as a trigger or action within any
              workflow.
            </p>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4">
          <Card compact>
            <CardHeader title="Status" info />
            <RadioRow
              selected={!edits.published}
              onSelect={() => update('published', false)}
              label="Draft"
              tone="gray"
            />
            <RadioRow
              selected={edits.published}
              onSelect={() => update('published', true)}
              label="Published"
              tone="green"
            />
          </Card>

          <Card compact>
            <CardHeader title="Lesson Thumbnail" info />
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleThumbnailFileChange}
            />
            <div
              className="mb-3 flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-colors hover:border-gray-300"
              onClick={() => thumbnailInputRef.current?.click()}
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt="Lesson thumbnail"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageOutlined
                  className="text-gray-300"
                  sx={{ fontSize: 36 }}
                />
              )}
            </div>
            <p className="text-xs text-gray-500">
              JPG, PNG, or WebP. Recommended 1280×720.
            </p>
            <button
              className="mt-3 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              onClick={() => thumbnailInputRef.current?.click()}
              disabled={uploadThumbnail.isPending}
            >
              {uploadThumbnail.isPending
                ? 'Uploading…'
                : thumbnailUrl
                  ? 'Replace'
                  : 'Pick File'}
            </button>
          </Card>

          <Card compact>
            <CardHeader title="Comments" />
            <RadioRow
              selected={edits.commentsMode === 'visible'}
              onSelect={() => update('commentsMode', 'visible')}
              label="Visible"
            />
            <RadioRow
              selected={edits.commentsMode === 'hidden'}
              onSelect={() => update('commentsMode', 'hidden')}
              label="Hidden"
            />
            <RadioRow
              selected={edits.commentsMode === 'locked'}
              onSelect={() => update('commentsMode', 'locked')}
              label="Locked"
            />
            <a
              href="#"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Comments settings
              <OpenInNewOutlined sx={{ fontSize: 12 }} />
            </a>
          </Card>

          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 self-start text-sm font-medium text-red-600 hover:text-red-700"
          >
            <DeleteOutlineOutlined sx={{ fontSize: 16 }} />
            Delete Lesson
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
    description: lesson.description ?? '',
    moduleId: module.id,
    media,
    textContent: text,
    videoUrl: lesson.video_asset_id ?? '',
    published: lesson.published,
    commentsMode: 'visible',
  }
}

function Card({
  children,
  compact,
}: {
  children: React.ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-200 bg-white',
        compact ? 'p-5' : 'p-6',
      )}
    >
      {children}
    </div>
  )
}

function CardHeader({ title, info }: { title: string; info?: boolean }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      {info && (
        <HelpOutlineOutlined className="text-gray-300" sx={{ fontSize: 16 }} />
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-5">
      <label className="mb-1.5 block text-sm font-bold text-gray-900">
        {label}
      </label>
      {children}
    </div>
  )
}

function RadioRow({
  selected,
  onSelect,
  label,
  tone,
}: {
  selected: boolean
  onSelect: () => void
  label: string
  tone?: 'gray' | 'green'
}) {
  return (
    <button
      onClick={onSelect}
      className="mb-2 flex w-full items-center gap-3 text-left last:mb-0"
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          selected ? 'border-indigo-600' : 'border-gray-300',
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
      </span>
      {tone ? (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            tone === 'green'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700',
          )}
        >
          {tone === 'green' ? '✓' : '📝'} {label}
        </span>
      ) : (
        <span className="text-sm text-gray-700">{label}</span>
      )}
    </button>
  )
}
