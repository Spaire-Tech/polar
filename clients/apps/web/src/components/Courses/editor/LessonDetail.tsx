'use client'

import {
  CourseLessonRead,
  CourseModuleRead,
  CourseRead,
  LessonAttachment,
  useCreateMuxUpload,
  useDeleteLessonAttachment,
  usePreviewAccess,
  useUpdateCourseLesson,
  useUploadLessonAttachment,
  useUploadLessonThumbnail,
} from '@/hooks/queries/courses'
import AddOutlined from '@mui/icons-material/AddOutlined'
import AttachFileOutlined from '@mui/icons-material/AttachFileOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { schemas } from '@spaire/client'
import { cn } from '@spaire/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { AutomationsPanel } from './AutomationsPanel'
import { toast } from '../../Toast/use-toast'
import { HlsVideo } from '../HlsVideo'
import { RichTextEditor } from './RichTextEditor'
import { ThumbnailPositioner } from './ThumbnailPositioner'

type Media = 'none' | 'video'

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
  organization,
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
  organization: schemas['Organization']
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
  // Local object URL for the just-uploaded video file. Mux takes ~30s to
  // transcode and surface a `mux_playback_id`; until then we render the raw
  // file via a <video src=blob:…> so the creator sees what they uploaded
  // instead of an empty processing card.
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null)
  useEffect(
    () => () => {
      if (localVideoUrl) URL.revokeObjectURL(localVideoUrl)
    },
    [localVideoUrl],
  )
  // Once Mux finishes processing, drop the local preview so the HLS player
  // takes over.
  useEffect(() => {
    if (
      lesson.mux_playback_id &&
      lesson.mux_status === 'ready' &&
      localVideoUrl
    ) {
      URL.revokeObjectURL(localVideoUrl)
      setLocalVideoUrl(null)
    }
  }, [lesson.mux_playback_id, lesson.mux_status, localVideoUrl])
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const initialAttachments =
    (lesson.content?.attachments as LessonAttachment[] | undefined) ?? []
  const [attachments, setAttachments] =
    useState<LessonAttachment[]>(initialAttachments)
  const createMuxUpload = useCreateMuxUpload()
  const uploadThumbnail = useUploadLessonThumbnail()
  const updateLessonMut = useUpdateCourseLesson()
  const uploadAttachment = useUploadLessonAttachment()
  const deleteAttachment = useDeleteLessonAttachment()

  // Persist the thumbnail position the moment the user releases the drag,
  // so every other site that shows the lesson (outline grid, landing
  // preview, customer portal, mobile preview) reflects the new position
  // without having to wait for the user to remember to click Save.
  const positionCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const commitThumbnailPosition = (next: string) => {
    if (positionCommitTimerRef.current) {
      clearTimeout(positionCommitTimerRef.current)
    }
    positionCommitTimerRef.current = setTimeout(() => {
      updateLessonMut
        .mutateAsync({
          lessonId: lesson.id,
          body: { thumbnail_object_position: next },
        })
        .catch((err) => {
          toast({
            title: 'Failed to save thumbnail position',
            description: err instanceof Error ? err.message : String(err),
          })
        })
    }, 250)
  }
  useEffect(
    () => () => {
      if (positionCommitTimerRef.current) {
        clearTimeout(positionCommitTimerRef.current)
      }
    },
    [],
  )

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
      toast({ title: `Attached ${file.name}` })
    } catch {
      toast({ title: 'Failed to upload attachment' })
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
      toast({ title: 'Attachment removed' })
    } catch {
      toast({ title: 'Failed to remove attachment' })
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
      toast({ title: 'Thumbnail uploaded' })
    } catch {
      toast({ title: 'Failed to upload thumbnail' })
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
    const previous = edits.textContent
    if (previous.trim().length > 0) {
      const confirmed =
        typeof window === 'undefined' ||
        window.confirm(
          'Regenerating will replace the current lesson text. Continue?',
        )
      if (!confirmed) return
    }
    update('textContent', '')
    try {
      await onGenerateAI(edits, (chunk) =>
        setEdits((prev) => ({ ...prev, textContent: prev.textContent + chunk })),
      )
    } catch (error) {
      // Restore the previous content if generation fails so the user
      // doesn't lose their work to a network blip.
      update('textContent', previous)
      throw error
    }
  }

  const handleVideoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Show the file immediately via an object URL so the editor doesn't
    // look empty while Mux transcodes. Revoked once Mux is ready.
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl)
    setLocalVideoUrl(URL.createObjectURL(file))
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
      toast({ title: 'Video uploaded — Mux is now processing' })
    } catch {
      setUploadProgress(null)
      toast({ title: 'Video upload failed' })
    }
    e.target.value = ''
  }

  const titleError = edits.title.trim().length === 0
  const handleSaveClick = () => {
    if (titleError) {
      toast({ title: 'Lesson title is required' })
      return
    }
    onSave(edits)
  }

  return (
    <div className="flex flex-1 flex-col bg-gray-50">
      {/* Editor bar — lesson name on left, Preview/Save/status on right */}
      <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5">
        <div className="text-[13px] font-medium tracking-tight text-gray-900">
          {edits.title || 'Untitled lesson'}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreview}
            disabled={previewAccess.isPending}
            className="flex items-center gap-1 rounded-md px-2.5 py-[5px] text-[12px] font-medium tracking-tight text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            <VisibilityOutlined sx={{ fontSize: 13 }} />
            {previewAccess.isPending ? 'Opening…' : 'Preview'}
          </button>
          <button
            onClick={handleSaveClick}
            disabled={isSaving || titleError}
            title={titleError ? 'Title is required' : undefined}
            className="px-1 py-[5px] text-[12px] font-medium tracking-tight text-blue-600 transition-opacity hover:opacity-70 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <span className="ml-1 text-[11px] tracking-tight">
            {edits.published ? (
              <span className="text-green-700">● Live</span>
            ) : (
              <span className="text-gray-400">Draft</span>
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main column — centered, generous reading width */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[820px] flex-col gap-2.5 px-6 pt-6 pb-20">
            <Card>
              <CardHeader title="Lesson Details" />

              <Field label="Title">
                <input
                  type="text"
                  required
                  value={edits.title}
                  onChange={(e) => update('title', e.target.value)}
                  aria-invalid={titleError}
                  className={cn(
                    'w-full rounded-xl border px-3.5 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-gray-100 focus:outline-none',
                    titleError
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-gray-300 focus:border-gray-900',
                  )}
                />
                {titleError && (
                  <p className="mt-1 text-xs text-red-500">
                    Title is required.
                  </p>
                )}
              </Field>

              <Field label="Description">
                <textarea
                  value={edits.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Brief overview of this lesson (optional)"
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:ring-2 focus:ring-gray-100 focus:outline-none"
                  rows={3}
                />
              </Field>

              <div className="mb-5">
                <h3 className="mb-2 text-base font-bold text-gray-900">
                  Media
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {(['none', 'video'] as const).map((m) => {
                    const active = edits.media === m
                    const label = m[0].toUpperCase() + m.slice(1)
                    const Icon = m === 'video' ? OndemandVideoOutlined : null
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
                  ) : localVideoUrl ? (
                    <div className="flex flex-col gap-3">
                      <div className="aspect-video overflow-hidden rounded-xl bg-black">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video
                          src={localVideoUrl}
                          controls
                          playsInline
                          className="h-full w-full"
                        />
                      </div>
                      {lesson.mux_status &&
                      lesson.mux_status !== 'ready' &&
                      lesson.mux_status !== 'errored' ? (
                        <div className="flex items-center gap-2 text-xs text-indigo-700">
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                          {uploadProgress !== null
                            ? `Uploading… ${uploadProgress}%`
                            : 'Mux is processing — playback will switch to HLS once ready.'}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">
                          Local preview — Mux will take over once processing
                          finishes.
                        </p>
                      )}
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
                        MP4, MOV, or WebM. Mux will transcode and deliver via
                        HLS.
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
                <h3 className="mb-1 text-base font-bold text-gray-900">
                  Attachments
                </h3>
                <p className="mb-3 text-xs text-gray-500">
                  Files attached to this lesson — shown to students alongside
                  the lesson content.
                </p>
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
              </div>
              <p className="mt-2 mb-5 text-sm text-gray-500">
                Sequences that fire when a student completes this lesson, or
                templates you can adapt.
              </p>
              <AutomationsPanel
                organization={organization}
                courseId={course.id}
                lessonId={lesson.id}
                scopeLabel="lesson"
              />
            </Card>
          </div>
        </div>

        {/* Right sidebar — flush right */}
        <div className="flex w-80 flex-shrink-0 flex-col gap-6 overflow-y-auto border-l border-gray-200 bg-white px-5 pt-4 pb-10">
          <SbSection label="Status">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <StatusOpt
                selected={!edits.published}
                onSelect={() => update('published', false)}
                label="Draft"
                badge={
                  <span className="rounded-full bg-gray-200 px-1.5 py-[2px] text-[10px] font-semibold tracking-wide text-gray-500">
                    Draft
                  </span>
                }
              />
              <StatusOpt
                selected={edits.published}
                onSelect={() => update('published', true)}
                label="Published"
                isLast
                badge={
                  <span className="rounded-full bg-green-100 px-1.5 py-[2px] text-[10px] font-semibold tracking-wide text-green-700">
                    Live
                  </span>
                }
              />
            </div>
            {edits.published && (
              <div className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/5 px-2.5 py-2 text-[11.5px] font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 ring-2 ring-green-500/25" />
                Visible to members
              </div>
            )}
          </SbSection>

          <SbSection label="Thumbnail">
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleThumbnailFileChange}
            />
            {thumbnailUrl ? (
              <div className="flex flex-col gap-3">
                <ThumbnailPositioner
                  src={thumbnailUrl}
                  value={edits.thumbnailObjectPosition}
                  onChange={(next) => update('thumbnailObjectPosition', next)}
                  onCommit={commitThumbnailPosition}
                />
                <p className="text-xs text-gray-500">
                  Drag the image to reposition it inside the card.
                </p>
                <button
                  className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={uploadThumbnail.isPending}
                >
                  {uploadThumbnail.isPending ? 'Uploading…' : 'Replace'}
                </button>
              </div>
            ) : (
              <>
                <div
                  className="mb-3 flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-colors hover:border-gray-300"
                  onClick={() => thumbnailInputRef.current?.click()}
                >
                  <ImageOutlined
                    className="text-gray-300"
                    sx={{ fontSize: 36 }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  JPG, PNG, or WebP. Recommended 1280×720.
                </p>
                <button
                  className="mt-3 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={uploadThumbnail.isPending}
                >
                  {uploadThumbnail.isPending ? 'Uploading…' : 'Pick File'}
                </button>
              </>
            )}
          </SbSection>

          <SbSection label="Comments">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <CommentOpt
                selected={edits.commentsMode === 'visible'}
                onSelect={() => update('commentsMode', 'visible')}
                label="Visible"
              />
              <CommentOpt
                selected={edits.commentsMode === 'hidden'}
                onSelect={() => update('commentsMode', 'hidden')}
                label="Hidden"
              />
              <CommentOpt
                selected={edits.commentsMode === 'locked'}
                onSelect={() => update('commentsMode', 'locked')}
                label="Locked"
                isLast
              />
            </div>
          </SbSection>

          <div>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 self-start text-[12px] text-red-500 opacity-85 transition-opacity hover:opacity-100"
            >
              <DeleteOutlineOutlined sx={{ fontSize: 13 }} />
              Delete lesson
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SbSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[11px] font-semibold tracking-[0.05em] text-gray-500 uppercase">
        {label}
      </div>
      {children}
    </div>
  )
}

function StatusOpt({
  selected,
  onSelect,
  label,
  badge,
  isLast,
}: {
  selected: boolean
  onSelect: () => void
  label: string
  badge?: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div
      className={cn(
        'flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-white',
        !isLast && 'border-b border-gray-200',
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          'flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors',
          selected ? 'border-gray-900' : 'border-gray-400',
        )}
      >
        {selected && (
          <span className="h-[7px] w-[7px] rounded-full bg-gray-900" />
        )}
      </span>
      <span className="flex-1 text-[12.5px] tracking-tight text-gray-900">
        {label}
      </span>
      {selected && badge}
    </div>
  )
}

function CommentOpt({
  selected,
  onSelect,
  label,
  isLast,
}: {
  selected: boolean
  onSelect: () => void
  label: string
  isLast?: boolean
}) {
  return (
    <div
      className={cn(
        'flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white',
        !isLast && 'border-b border-gray-200',
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          'flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors',
          selected ? 'border-gray-900' : 'border-gray-400',
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-gray-900" />}
      </span>
      <span className="text-[12.5px] tracking-tight text-gray-900">
        {label}
      </span>
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
  const media: Media = lesson.content_type === 'video' ? 'video' : 'none'
  return {
    title: lesson.title,
    moduleId: module.id,
    description: (lesson as any).description ?? '',
    media,
    textContent: text,
    videoUrl: lesson.video_asset_id ?? '',
    published: lesson.published,
    commentsMode: ((lesson as any).comments_mode ?? 'visible') as
      | 'visible'
      | 'hidden'
      | 'locked',
    thumbnailObjectPosition: lesson.thumbnail_object_position ?? null,
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
