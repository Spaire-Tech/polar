'use client'

import {
  CourseLessonRead,
  CourseModuleRead,
  CourseRead,
} from '@/hooks/queries/courses'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import AudiotrackOutlined from '@mui/icons-material/AudiotrackOutlined'
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined'
import FormatBoldOutlined from '@mui/icons-material/FormatBoldOutlined'
import FormatItalicOutlined from '@mui/icons-material/FormatItalicOutlined'
import FormatListBulletedOutlined from '@mui/icons-material/FormatListBulletedOutlined'
import FormatListNumberedOutlined from '@mui/icons-material/FormatListNumberedOutlined'
import FullscreenOutlined from '@mui/icons-material/FullscreenOutlined'
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import InsertLinkOutlined from '@mui/icons-material/InsertLinkOutlined'
import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined'
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import RemoveOutlined from '@mui/icons-material/RemoveOutlined'
import StopOutlined from '@mui/icons-material/StopOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { cn } from '@spaire/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { toast } from '../Toast/use-toast'

type Media = 'none' | 'video' | 'audio'

export type LessonEdits = {
  title: string
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
  onBack,
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
  onBack: () => void
  onSave: (edits: LessonEdits) => void
  onDelete: () => void
  isSaving: boolean
  onGenerateAI?: (edits: LessonEdits, onChunk: (chunk: string) => void) => Promise<void>
  isGenerating?: boolean
  onStopAI?: () => void
}) {
  const [edits, setEdits] = useState<LessonEdits>(() => initEdits(lesson, module))
  const [moduleSelectOpen, setModuleSelectOpen] = useState(false)
  const moduleSelectRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setEdits(initEdits(lesson, module))
  }, [lesson.id, module.id])

  useEffect(() => {
    if (!moduleSelectOpen) return
    const onClick = (e: MouseEvent) => {
      if (!moduleSelectRef.current?.contains(e.target as Node))
        setModuleSelectOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [moduleSelectOpen])

  const update = <K extends keyof LessonEdits>(
    key: K,
    value: LessonEdits[K],
  ) => setEdits((prev) => ({ ...prev, [key]: value }))

  const currentModule =
    course.modules.find((m) => m.id === edits.moduleId) ?? module

  const handleGenerate = async () => {
    if (!onGenerateAI) return
    update('textContent', '')
    await onGenerateAI(edits, (chunk) =>
      setEdits((prev) => ({ ...prev, textContent: prev.textContent + chunk })),
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Top bar - sticky */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white px-8 py-4 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowBackOutlined fontSize="small" />
        </button>
        <h2 className="flex items-center gap-1.5 text-xl font-bold text-gray-900">
          {edits.title || 'Untitled Lesson'}
          <HelpOutlineOutlined className="text-gray-300" sx={{ fontSize: 16 }} />
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => toast({ title: 'Preview coming soon' })} className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <VisibilityOutlined sx={{ fontSize: 16 }} />
            Preview
          </button>
          <button
            onClick={() => onSave(edits)}
            disabled={isSaving}
            className="rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
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
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-100"
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
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
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
              <Field label="Video URL">
                <input
                  type="url"
                  value={edits.videoUrl}
                  onChange={(e) => update('videoUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-100"
                />
              </Field>
            )}

            {/* Rich text editor */}
            <div className="overflow-hidden rounded-xl border border-gray-300">
              <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2 text-gray-500">
                <ToolbarBtn>{'<>'}</ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Undo coming soon' })}>↶</ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Redo coming soon' })}>↷</ToolbarBtn>
                <ToolbarDivider />
                <ToolbarBtn wide onClick={() => toast({ title: 'Text formatting coming soon' })}>
                  Formats <KeyboardArrowDownOutlined sx={{ fontSize: 14 }} />
                </ToolbarBtn>
                <ToolbarDivider />
                <ToolbarBtn onClick={() => toast({ title: 'Text formatting coming soon' })}>
                  <FormatBoldOutlined sx={{ fontSize: 16 }} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Text formatting coming soon' })}>
                  <FormatItalicOutlined sx={{ fontSize: 16 }} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Text formatting coming soon' })}>T</ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Text formatting coming soon' })}>A</ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Text formatting coming soon' })}>
                  <RemoveOutlined sx={{ fontSize: 16 }} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Text formatting coming soon' })}>
                  <FormatListBulletedOutlined sx={{ fontSize: 16 }} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Text formatting coming soon' })}>
                  <FormatListNumberedOutlined sx={{ fontSize: 16 }} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Add links coming soon' })}>
                  <InsertLinkOutlined sx={{ fontSize: 16 }} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Add images coming soon' })}>
                  <ImageOutlined sx={{ fontSize: 16 }} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => toast({ title: 'Fullscreen coming soon' })}>
                  <FullscreenOutlined sx={{ fontSize: 16 }} />
                </ToolbarBtn>
                <div className="ml-auto flex items-center gap-1">
                  {isGenerating ? (
                    <button
                      onClick={onStopAI}
                      className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                    >
                      <StopOutlined sx={{ fontSize: 14 }} />
                      Stop
                    </button>
                  ) : onGenerateAI ? (
                    <button
                      onClick={handleGenerate}
                      className="flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      <AutoAwesomeOutlined sx={{ fontSize: 14 }} />
                      {edits.textContent.trim() ? 'Regenerate' : 'Generate'}
                    </button>
                  ) : null}
                </div>
              </div>
              <textarea
                value={edits.textContent}
                onChange={(e) => update('textContent', e.target.value)}
                placeholder="Write your lesson content here…"
                rows={16}
                className="w-full resize-y px-4 py-4 text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 focus:outline-none"
              />
            </div>

            <div className="mt-6">
              <h3 className="mb-2 text-base font-bold text-gray-900">
                Downloads
              </h3>
              <button onClick={() => toast({ title: 'File uploads coming soon' })} className="flex items-center gap-1.5 rounded-full border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <AddOutlined sx={{ fontSize: 16 }} />
                Add Files
              </button>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Automations</h3>
              <button onClick={() => toast({ title: 'Automations coming soon' })} className="flex items-center gap-1.5 rounded-full bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition-colors">
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
            <div className="mb-3 flex h-32 items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
              <ImageOutlined
                className="text-gray-300"
                sx={{ fontSize: 36 }}
              />
            </div>
            <p className="text-xs text-gray-500">
              Please use .jpg or .png with non-transparent background.
            </p>
            <p className="mb-3 mt-1 text-xs text-gray-500">
              Recommended dimensions of 1280×720
            </p>
            <button onClick={() => toast({ title: 'File uploads coming soon' })} className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition-colors">
              Pick File
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
            <button
              onClick={() => toast({ title: 'Comments settings coming soon' })}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Comments settings
              <OpenInNewOutlined sx={{ fontSize: 12 }} />
            </button>
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
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
        {selected && (
          <span className="h-2 w-2 rounded-full bg-indigo-600" />
        )}
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

function ToolbarBtn({
  children,
  wide,
  onClick,
}: {
  children: React.ReactNode
  wide?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={!onClick ? 'Coming soon' : undefined}
      className={cn(
        'flex items-center gap-1 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100',
        wide ? 'px-2 py-1' : 'h-7 w-7 justify-center',
        !onClick && 'opacity-50 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px bg-gray-200" />
}
