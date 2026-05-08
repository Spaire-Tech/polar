'use client'

// Modules tab — wires add / rename / delete on modules and lessons.
// Deep lesson editing (video upload, content) lives in the existing
// course outline editor. We deep-link to it from each lesson row so we
// don't duplicate that stack here.

import {
  useAddCourseLesson,
  useAddCourseModule,
  useCourseById,
  useDeleteCourseLesson,
  useDeleteCourseModule,
  useUpdateCourseLesson,
  useUpdateCourseModule,
  type CourseLessonRead,
  type CourseRead,
} from '@/hooks/queries/courses'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { toast } from '../../../Toast/use-toast'
import { Ic } from '../icons'
import { Btn, EmptyState, Menu, Modal, Pill, SectionHead } from '../ui'

type LessonContentType = 'video' | 'text' | 'download'

const lessonGlyph = (type: string) => {
  if (type === 'video') return <Ic.Video size={12} />
  if (type === 'download') return <Ic.Upload size={12} />
  return <Ic.File size={12} />
}

function lessonMeta(l: CourseLessonRead): string {
  if (l.duration_seconds) {
    const mins = Math.round(l.duration_seconds / 60)
    return `${mins} min`
  }
  return l.content_type
}

export function ModulesTab({ course: initialCourse }: { course: CourseRead }) {
  // Subscribe to fresh course data so add/delete reflect immediately.
  const { data: course = initialCourse } = useCourseById(initialCourse.id)
  const params = useParams<{ organization: string }>()

  const addModule = useAddCourseModule()
  const updateModule = useUpdateCourseModule()
  const deleteModule = useDeleteCourseModule()
  const addLesson = useAddCourseLesson()
  const updateLesson = useUpdateCourseLesson()
  const deleteLesson = useDeleteCourseLesson()

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [newModuleOpen, setNewModuleOpen] = useState(false)
  const [draftModuleTitle, setDraftModuleTitle] = useState('')
  const [renaming, setRenaming] = useState<
    | {
        kind: 'module'
        id: string
        title: string
      }
    | { kind: 'lesson'; id: string; title: string }
    | null
  >(null)
  const [addingLessonTo, setAddingLessonTo] = useState<string | null>(null)
  const [lessonDraft, setLessonDraft] = useState({
    title: '',
    content_type: 'video' as LessonContentType,
  })

  const modules = course.modules ?? []

  const handleAddModule = async () => {
    const title = draftModuleTitle.trim()
    if (!title) return
    try {
      await addModule.mutateAsync({
        courseId: course.id,
        body: { title, position: modules.length },
      })
      setNewModuleOpen(false)
      setDraftModuleTitle('')
    } catch (e) {
      toast({
        title: 'Could not add module',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  const handleRename = async () => {
    if (!renaming) return
    const title = renaming.title.trim()
    if (!title) return
    try {
      if (renaming.kind === 'module') {
        await updateModule.mutateAsync({
          moduleId: renaming.id,
          body: { title },
        })
      } else {
        await updateLesson.mutateAsync({
          lessonId: renaming.id,
          body: { title },
        })
      }
      setRenaming(null)
    } catch (e) {
      toast({
        title: 'Could not rename',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  const handleAddLesson = async () => {
    if (!addingLessonTo) return
    const title = lessonDraft.title.trim()
    if (!title) return
    try {
      const targetModule = modules.find((m) => m.id === addingLessonTo)
      const position = targetModule?.lessons.length ?? 0
      await addLesson.mutateAsync({
        moduleId: addingLessonTo,
        body: {
          title,
          content_type: lessonDraft.content_type,
          position,
        },
      })
      setAddingLessonTo(null)
      setLessonDraft({ title: '', content_type: 'video' })
    } catch (e) {
      toast({
        title: 'Could not add lesson',
        description: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  if (modules.length === 0) {
    return (
      <>
        <SectionHead
          title="Modules"
          subtitle="Optional pre-recorded content — videos, lessons, downloads."
          actions={
            <Btn
              variant="primary"
              icon={<Ic.Plus size={14} />}
              onClick={() => setNewModuleOpen(true)}
            >
              Add a module
            </Btn>
          }
        />
        <EmptyState
          glyph={<Ic.File size={20} />}
          title="No modules yet — and that's totally fine"
          body="Many cohorts run on live calls alone. Add modules later if you want a workbook, a pre-call video, or a recorded mini-lesson."
          action={
            <Btn
              variant="primary"
              icon={<Ic.Plus size={14} />}
              onClick={() => setNewModuleOpen(true)}
            >
              Add your first module
            </Btn>
          }
        />
        <NewModuleModal
          open={newModuleOpen}
          title={draftModuleTitle}
          onChangeTitle={setDraftModuleTitle}
          onClose={() => {
            setNewModuleOpen(false)
            setDraftModuleTitle('')
          }}
          onSave={handleAddModule}
          saving={addModule.isPending}
        />
      </>
    )
  }

  return (
    <>
      <SectionHead
        title="Modules"
        subtitle="Pre-recorded prep content. Members access this any time."
        actions={
          <Btn
            variant="primary"
            icon={<Ic.Plus size={14} />}
            onClick={() => setNewModuleOpen(true)}
          >
            Add module
          </Btn>
        }
      />

      {modules.map((m, i) => (
        <div className="ce-module-card" key={m.id}>
          <div className="ce-module-head">
            <Ic.Drag
              size={14}
              style={{ color: 'var(--ink-5)', cursor: 'grab' }}
            />
            <div className="ce-module-num">
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="ce-module-title">{m.title}</div>
            <Pill>
              {m.lessons.length} lesson{m.lessons.length === 1 ? '' : 's'}
            </Pill>
            <Btn
              variant="ghost"
              size="icon"
              onClick={() =>
                setRenaming({ kind: 'module', id: m.id, title: m.title })
              }
            >
              <Ic.Edit size={13} />
            </Btn>
            <div style={{ position: 'relative' }}>
              <Btn
                variant="ghost"
                size="icon"
                onClick={() =>
                  setOpenMenu(openMenu === `m:${m.id}` ? null : `m:${m.id}`)
                }
              >
                <Ic.More size={14} />
              </Btn>
              <Menu
                open={openMenu === `m:${m.id}`}
                onClose={() => setOpenMenu(null)}
              >
                <button
                  className="danger"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Delete the "${m.title}" module and its ${m.lessons.length} lesson${m.lessons.length === 1 ? '' : 's'}?`,
                      )
                    )
                      return
                    setOpenMenu(null)
                    try {
                      await deleteModule.mutateAsync(m.id)
                    } catch (e) {
                      toast({
                        title: 'Could not delete',
                        description:
                          e instanceof Error ? e.message : 'Unknown error',
                      })
                    }
                  }}
                >
                  <Ic.Trash size={13} /> Delete module
                </button>
              </Menu>
            </div>
          </div>
          {m.lessons.map((l) => (
            <div className="ce-lesson-row" key={l.id}>
              <Ic.Drag size={12} style={{ color: 'var(--ink-5)' }} />
              <div className="ce-lesson-icon">{lessonGlyph(l.content_type)}</div>
              <button
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  // Deep-link to the existing course editor's lesson surface.
                  // Reuses the full video upload / content editor we already have.
                  window.open(
                    `/dashboard/${params.organization}/courses/${course.id}?tab=outline&lesson=${l.id}`,
                    '_blank',
                  )
                }}
              >
                {l.title}
              </button>
              <span className="ce-mini">{lessonMeta(l)}</span>
              <div style={{ position: 'relative' }}>
                <Btn
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setOpenMenu(openMenu === `l:${l.id}` ? null : `l:${l.id}`)
                  }
                >
                  <Ic.More size={14} />
                </Btn>
                <Menu
                  open={openMenu === `l:${l.id}`}
                  onClose={() => setOpenMenu(null)}
                >
                  <button
                    onClick={() => {
                      setOpenMenu(null)
                      setRenaming({ kind: 'lesson', id: l.id, title: l.title })
                    }}
                  >
                    <Ic.Edit size={13} /> Rename
                  </button>
                  <div className="menu-divider" />
                  <button
                    className="danger"
                    onClick={async () => {
                      if (!confirm(`Delete "${l.title}"?`)) return
                      setOpenMenu(null)
                      try {
                        await deleteLesson.mutateAsync(l.id)
                      } catch (e) {
                        toast({
                          title: 'Could not delete',
                          description:
                            e instanceof Error ? e.message : 'Unknown error',
                        })
                      }
                    }}
                  >
                    <Ic.Trash size={13} /> Delete lesson
                  </button>
                </Menu>
              </div>
            </div>
          ))}
          <button
            className="ce-lesson-add"
            onClick={() => {
              setAddingLessonTo(m.id)
              setLessonDraft({ title: '', content_type: 'video' })
            }}
          >
            <Ic.Plus size={12} /> Add lesson — video, text, or download
          </button>
        </div>
      ))}

      <button
        className="ce-btn"
        style={{
          width: '100%',
          padding: 14,
          justifyContent: 'center',
          borderStyle: 'dashed',
          color: 'var(--ink-3)',
          marginTop: 8,
        }}
        onClick={() => setNewModuleOpen(true)}
      >
        <Ic.Plus size={14} /> Add another module
      </button>

      <div
        style={{
          marginTop: 16,
          padding: '12px 14px',
          background: 'var(--bg-muted)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r)',
          color: 'var(--ink-3)',
          fontSize: 12.5,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        <Ic.Sparkles
          size={14}
          style={{ color: 'var(--ink-3)', marginTop: 2 }}
        />
        <div>
          <strong style={{ color: 'var(--ink-2)' }}>Tip.</strong> Modules are
          optional. Your live Events are the heartbeat — Modules are just where
          you put homework, workbooks, and anything pre-recorded.
        </div>
      </div>

      <NewModuleModal
        open={newModuleOpen}
        title={draftModuleTitle}
        onChangeTitle={setDraftModuleTitle}
        onClose={() => {
          setNewModuleOpen(false)
          setDraftModuleTitle('')
        }}
        onSave={handleAddModule}
        saving={addModule.isPending}
      />

      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title={renaming?.kind === 'module' ? 'Rename module' : 'Rename lesson'}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              onClick={handleRename}
              disabled={
                !renaming?.title.trim() ||
                updateModule.isPending ||
                updateLesson.isPending
              }
            >
              Save
            </Btn>
          </>
        }
      >
        {renaming && (
          <input
            className="ce-input"
            autoFocus
            value={renaming.title}
            onChange={(e) =>
              setRenaming({ ...renaming, title: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renaming.title.trim()) handleRename()
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!addingLessonTo}
        onClose={() => {
          setAddingLessonTo(null)
          setLessonDraft({ title: '', content_type: 'video' })
        }}
        title="Add lesson"
        subtitle="The lesson content (video, text, downloadable) is editable from the lesson detail page."
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAddingLessonTo(null)}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              onClick={handleAddLesson}
              disabled={!lessonDraft.title.trim() || addLesson.isPending}
            >
              {addLesson.isPending ? 'Adding…' : 'Add lesson'}
            </Btn>
          </>
        }
      >
        <div className="ce-stack-16">
          <div>
            <label className="ce-label">Title</label>
            <input
              className="ce-input"
              autoFocus
              value={lessonDraft.title}
              onChange={(e) =>
                setLessonDraft({ ...lessonDraft, title: e.target.value })
              }
              placeholder="What students do or watch"
            />
          </div>
          <div>
            <label className="ce-label">Type</label>
            <select
              className="ce-select"
              value={lessonDraft.content_type}
              onChange={(e) =>
                setLessonDraft({
                  ...lessonDraft,
                  content_type: e.target.value as LessonContentType,
                })
              }
            >
              <option value="video">Video</option>
              <option value="text">Text</option>
              <option value="download">Download</option>
            </select>
          </div>
        </div>
      </Modal>
    </>
  )
}

function NewModuleModal({
  open,
  title,
  onChangeTitle,
  onClose,
  onSave,
  saving,
}: {
  open: boolean
  title: string
  onChangeTitle: (next: string) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New module"
      subtitle="Group related lessons. You can rename or reorder later."
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            onClick={onSave}
            disabled={!title.trim() || saving}
          >
            {saving ? 'Adding…' : 'Add module'}
          </Btn>
        </>
      }
    >
      <input
        className="ce-input"
        autoFocus
        value={title}
        placeholder="e.g. Workbook"
        onChange={(e) => onChangeTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) onSave()
        }}
      />
    </Modal>
  )
}
