import type { CourseLessonRead } from '@/hooks/queries/courses'

export interface TranscriptBadge {
  text: string
  /** Tailwind background + text color classes. */
  color: string
}

/**
 * Course Assistant transcription state for a lesson, or null when there's
 * nothing to show (not a video, or no upload yet). Every uploaded video gets a
 * state so the creator can watch the pipeline move instead of guessing:
 *   Processing video… → Preparing transcript… → Transcribing… → Transcribed
 *   (or Transcript failed / No captions)
 */
export function transcriptBadge(
  lesson: Pick<
    CourseLessonRead,
    'content_type' | 'mux_status' | 'mux_upload_id' | 'transcript_status'
  >,
): TranscriptBadge | null {
  if (lesson.content_type !== 'video') return null
  const hasUpload = !!lesson.mux_upload_id || !!lesson.mux_status
  if (!hasUpload) return null
  switch (lesson.transcript_status) {
    case 'ready':
      return { text: 'Transcribed', color: 'bg-emerald-50 text-emerald-700' }
    case 'pending':
      return { text: 'Transcribing…', color: 'bg-amber-50 text-amber-700' }
    case 'failed':
      return { text: 'Transcript failed', color: 'bg-red-50 text-red-600' }
    case 'unavailable':
      return { text: 'Transcript unavailable', color: 'bg-gray-100 text-gray-500' }
    default:
      // No transcript state yet.
      return lesson.mux_status !== 'ready'
        ? { text: 'Processing video…', color: 'bg-gray-100 text-gray-500' }
        : // Video is ready but captions haven't been requested/fetched yet.
          // If this never advances, the Mux caption webhook isn't reaching the
          // backend.
          { text: 'Preparing transcript…', color: 'bg-amber-50 text-amber-700' }
  }
}
