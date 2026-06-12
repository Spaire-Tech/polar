'use client'

// Dashboard customize tab — a thin shell around CourseDesignEditor.
//
// Every edit on the canvas persists IMMEDIATELY (field-level PATCHes and
// S3/Mux-backed uploads inside CourseDesignEditor), so there is no
// save / publish / dirty cycle here anymore. The previous pipeline
// (EditorProvider seed → "Save & publish" → wholesale landing_overrides
// write) is gone for cause: it rewrote landing_overrides from a
// page-load-time snapshot, wiping ai_hero / ai_instructor / ai_faq /
// theme_mode / portrait_url, and its "media slot removed → null the
// column" mirror reverted freshly uploaded covers on publish.

import { CourseRead } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useState } from 'react'
import { CourseDesignEditor } from './CourseDesignEditor'

export function CustomizeTab({
  course,
  organization,
}: {
  course: CourseRead
  organization: schemas['Organization']
}) {
  const [saving, setSaving] = useState(false)

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Slim status bar — breadcrumb, autosave status, public preview. */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[12px] text-gray-500">Course landing</span>
          <span className="text-[13px] text-gray-400">›</span>
          <span className="truncate text-[13px] font-medium text-gray-900">
            {course.title ?? 'Untitled course'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-[11.5px] text-gray-400"
            role="status"
            aria-live="polite"
          >
            {saving ? 'Saving…' : 'Changes save automatically'}
          </span>
          <a
            href={`/${organization.slug}/products/${course.product_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-gray-200 bg-white px-3 py-[6px] text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Preview ↗
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <CourseDesignEditor
          course={course}
          organization={organization}
          onBusyChange={setSaving}
        />
      </div>
    </div>
  )
}
