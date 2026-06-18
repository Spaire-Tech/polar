'use client'

import { CourseRead } from '@/hooks/queries/courses'
import { schemas } from '@spaire/client'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from '../../Toast/use-toast'

const SIGN_IN_IMAGE_PATH = (organizationId: string) =>
  `${process.env.NEXT_PUBLIC_API_URL}/v1/organizations/${organizationId}/customer-portal-sign-in-image`

/**
 * Course-builder "Auth" tab.
 *
 * Lets the creator upload the image shown on their customer portal sign-in
 * screen. The portal sign-in is org-scoped (one screen shared across every
 * product and course), so this image applies to the creator's whole portal —
 * we say so plainly in the copy. When no image is uploaded, the portal falls
 * back to a course cover; the preview here uses *this* course's cover so the
 * default is tangible.
 */
export function AuthTab({
  course,
  organization,
}: {
  course: CourseRead
  organization: schemas['Organization']
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(
    organization.customer_portal_sign_in_image_url ?? null,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(SIGN_IN_IMAGE_PATH(organization.id), {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`API ${res.status}: ${text}`)
      }
      return res.json() as Promise<schemas['Organization']>
    },
    onSuccess: (data) => {
      setImageUrl(data.customer_portal_sign_in_image_url ?? null)
      toast({ title: 'Sign-in image updated' })
    },
    onError: (err) => {
      toast({
        title: 'Failed to upload image',
        description: err instanceof Error ? err.message : undefined,
      })
    },
  })

  const remove = useMutation({
    mutationFn: async () => {
      const res = await fetch(SIGN_IN_IMAGE_PATH(organization.id), {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`API ${res.status}: ${text}`)
      }
      return res.json() as Promise<schemas['Organization']>
    },
    onSuccess: (data) => {
      setImageUrl(data.customer_portal_sign_in_image_url ?? null)
      toast({ title: 'Sign-in image removed' })
    },
    onError: (err) => {
      toast({
        title: 'Failed to remove image',
        description: err instanceof Error ? err.message : undefined,
      })
    },
  })

  const handleFiles = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please choose an image file' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Image must be under 10 MB' })
      return
    }
    upload.mutate(file)
  }

  const [dragOver, setDragOver] = useState(false)
  const busy = upload.isPending || remove.isPending

  // What the customer actually sees: explicit upload → this course's cover
  // (the portal resolves the org-wide default the same way, from the most
  // recent course thumbnail).
  const previewUrl = imageUrl ?? course.thumbnail_url ?? null
  const usingCustom = !!imageUrl

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-medium text-gray-900">Sign-in design</h1>
        <p className="mt-1 text-gray-500">
          The image on your customer portal sign-in screen. Your customers see
          it when they sign in to access their purchases. It applies to your{' '}
          <span className="font-medium text-gray-700">whole portal</span> —
          every product and course — not just this one. If you don&apos;t upload
          an image, we use this course&apos;s cover image.
        </p>
      </div>

      {/* Live preview of the split sign-in layout */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-[1.05fr_1fr]">
          {/* Left — photo */}
          <div className="relative min-h-[260px] bg-gray-100">
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Sign-in preview"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(8,12,11,.30) 0%, transparent 30%, transparent 60%, rgba(8,12,11,.55) 100%)',
                  }}
                />
                <div className="absolute bottom-5 left-5 text-white">
                  <div className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-80">
                    {organization.name}
                  </div>
                  <div className="mt-1.5 text-xl font-semibold">
                    Welcome back.
                  </div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-gray-400">
                No cover image yet — upload one here or set a course cover in
                Settings.
              </div>
            )}
          </div>

          {/* Right — faux flow */}
          <div className="flex flex-col justify-center gap-4 bg-white px-8 py-10">
            <div className="text-2xl font-semibold tracking-tight text-gray-900">
              Sign in
            </div>
            <div className="text-[13px] leading-relaxed text-gray-500">
              Enter your email address to access your purchases. A verification
              code will be sent to you.
            </div>
            <div className="mt-1 h-[44px] rounded-xl border border-gray-200 bg-white px-3 text-[13px] leading-[44px] text-gray-400">
              you@example.com
            </div>
            <div className="flex h-[44px] items-center justify-center rounded-xl bg-gray-900 text-[13px] font-semibold text-white">
              Send code
            </div>
          </div>
        </div>
      </div>

      {/* Uploader / controls */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !busy) {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (!busy) handleFiles(e.dataTransfer.files?.[0])
        }}
        className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? 'border-[#0066cc] bg-[#0066cc]/5'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <p className="text-sm font-medium text-gray-900">
          {busy
            ? 'Uploading…'
            : usingCustom
              ? 'Replace sign-in image'
              : 'Upload a sign-in image'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Drag &amp; drop or click to browse · JPG, PNG, WEBP or GIF · up to 10
          MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {usingCustom
            ? 'Using your uploaded image.'
            : "Using this course's cover image as the default."}
        </p>
        {usingCustom && (
          <button
            type="button"
            onClick={() => !busy && remove.mutate()}
            disabled={busy}
            className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
          >
            Remove image
          </button>
        )}
      </div>
    </div>
  )
}
