'use client'

import { focalPointToObjectPosition } from '@/components/Customization/Storefront/StorefrontSidebar'
import {
  LANGUAGE_OPTIONS,
  PROFILE_TITLE_OPTIONS,
  SKILL_OPTIONS,
} from '@/components/Customization/Storefront/StorefrontSidebar/constants'
import { SocialLinkRow } from '@/components/Customization/Storefront/StorefrontSidebar/SocialLinkRow'
import { TagInput } from '@/components/Customization/Storefront/StorefrontSidebar/TagInput'
import {
  type FileObject,
  useFileUpload,
} from '@/components/FileUpload'
import LogoType from '@/components/Brand/LogoType'
import {
  SOCIAL_PLATFORMS,
  getSocialIcon,
} from '@/components/Profile/socialPlatforms'
import { toast } from '@/components/Toast/use-toast'
import AddOutlined from '@mui/icons-material/AddOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import TranslateOutlined from '@mui/icons-material/TranslateOutlined'
import Verified from '@mui/icons-material/Verified'
import { schemas } from '@spaire/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spaire/ui/components/atoms/Select'
import Switch from '@spaire/ui/components/atoms/Switch'
import { useCallback, useRef, useState } from 'react'
import { type FileRejection } from 'react-dropzone'
import { useFormContext } from 'react-hook-form'
import { Editable } from './Editable'
import { EditPopover } from './EditPopover'

type SocialLink = schemas['OrganizationSocialLink']

const parseFocalPosition = (raw: string): { x: number; y: number } => {
  if (raw.includes('%') && raw.includes(' ')) {
    const [px, py] = raw.split(' ')
    return { x: parseFloat(px), y: parseFloat(py) }
  }
  return { x: 50, y: 50 }
}

/**
 * Inline-editable mirror of ProfileCard. Same layout / classes as the
 * public ProfileCard so the visual stays identical, but every editable
 * surface is wrapped in a click-to-edit affordance:
 *
 * - Cover image — click "Replace" to upload, drag to reposition focal
 *   point.
 * - Avatar — click "Replace" to upload.
 * - Name, Profile title, Description — contentEditable text.
 * - Skills, Languages, Socials — open a popover (blurred backdrop).
 * - Available-for-work badge — popover with toggle + contact URL.
 *
 * Reads/writes via the surrounding react-hook-form context so the
 * canvas's published-preview branch and the Publish button stay in
 * sync.
 */
export const EditableProfileCard = ({
  organization: org,
}: {
  organization: schemas['Organization']
}) => {
  const { watch, setValue } = useFormContext<schemas['OrganizationUpdate']>()
  const watched = watch()
  const settings = watched.storefront_settings ?? org.storefront_settings ?? {}

  const name = watched.name ?? org.name
  const avatarUrl = watched.avatar_url ?? org.avatar_url
  const description = settings?.description ?? null
  const profileTitle = settings?.profile_title ?? null
  const skills = settings?.skills ?? []
  const languages = settings?.languages ?? []
  const availableForWork = settings?.available_for_work ?? false
  const contactUrl = settings?.contact_url ?? null
  const headerUrl = settings?.header_image_url ?? null
  const headerFocal = settings?.header_focal_point ?? '50% 50%'
  const showHeader = settings?.show_header ?? true
  const showLogo = settings?.show_logo ?? true
  const showName = settings?.show_name ?? true
  const showDescription = settings?.show_description ?? true
  const socials: SocialLink[] = (watched.socials ??
    org.socials ??
    []) as SocialLink[]

  // ── Form-write helpers ───────────────────────────────────────────
  const updateName = (next: string) =>
    setValue('name', next, { shouldDirty: true })

  const updateSetting = useCallback(
    <K extends keyof NonNullable<schemas['OrganizationStorefrontSettings']>>(
      key: K,
      value: NonNullable<schemas['OrganizationStorefrontSettings']>[K],
    ) => {
      setValue(
        'storefront_settings',
        { ...settings, [key]: value },
        { shouldDirty: true },
      )
    },
    [settings, setValue],
  )

  // ── Cover image upload ─────────────────────────────────────────
  const onBannerFilesUpdated = useCallback(
    (files: FileObject<schemas['StorefrontHeaderFileRead']>[]) => {
      if (files.length === 0) return
      const last = files[files.length - 1]
      updateSetting('header_image_url', last.public_url)
    },
    [updateSetting],
  )

  const onFilesRejected = useCallback((rejections: FileRejection[]) => {
    if (rejections.length > 0) {
      toast({
        title: 'Upload failed',
        description: rejections[0].errors[0].message,
      })
    }
  }, [])

  const {
    getRootProps: getBannerRootProps,
    getInputProps: getBannerInputProps,
    open: openBannerPicker,
  } = useFileUpload({
    organization: org,
    service: 'storefront_header',
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'image/webp': [],
      'image/svg+xml': [],
    },
    maxSize: 10 * 1024 * 1024,
    onFilesUpdated: onBannerFilesUpdated,
    onFilesRejected,
    initialFiles: [],
  })

  // ── Avatar upload ──────────────────────────────────────────────
  const onAvatarFilesUpdated = useCallback(
    (files: FileObject<schemas['OrganizationAvatarFileRead']>[]) => {
      if (files.length === 0) return
      const last = files[files.length - 1]
      setValue('avatar_url', last.public_url, { shouldDirty: true })
    },
    [setValue],
  )

  const {
    getRootProps: getAvatarRootProps,
    getInputProps: getAvatarInputProps,
    open: openAvatarPicker,
  } = useFileUpload({
    organization: org,
    service: 'organization_avatar',
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'image/webp': [],
      'image/svg+xml': [],
    },
    maxSize: 1 * 1024 * 1024,
    onFilesUpdated: onAvatarFilesUpdated,
    onFilesRejected,
    initialFiles: [],
  })

  // ── Cover drag-to-reposition ───────────────────────────────────
  const coverPos = parseFocalPosition(headerFocal)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{
    startX: number
    startY: number
    posX: number
    posY: number
    width: number
    height: number
    pointerId: number
  } | null>(null)

  const onCoverPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!headerUrl) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: coverPos.x,
      posY: coverPos.y,
      width: rect.width,
      height: rect.height,
      pointerId: e.pointerId,
    }
  }

  const onCoverPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId || !isDragging) return
    const dxPct = ((e.clientX - drag.startX) / drag.width) * 100
    const dyPct = ((e.clientY - drag.startY) / drag.height) * 100
    const newX = Math.max(0, Math.min(100, drag.posX - dxPct))
    const newY = Math.max(0, Math.min(100, drag.posY - dyPct))
    updateSetting(
      'header_focal_point',
      `${newX.toFixed(1)}% ${newY.toFixed(1)}%`,
    )
  }

  const onCoverPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (drag && e.currentTarget.hasPointerCapture(drag.pointerId)) {
      e.currentTarget.releasePointerCapture(drag.pointerId)
    }
    setIsDragging(false)
    dragRef.current = null
  }

  // ── Popover state ──────────────────────────────────────────────
  type PopoverKey =
    | 'profileTitle'
    | 'skills'
    | 'languages'
    | 'available'
    | 'socials'
    | null
  const [popover, setPopover] = useState<PopoverKey>(null)

  // Local draft for the available-for-work popover so the contact URL
  // doesn't write on every keystroke (we commit on Done).
  const [contactDraft, setContactDraft] = useState(contactUrl ?? '')

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Cover image — hover reveals Replace + Reposition buttons. The
          surrounding div hosts both the file picker (via dropzone) and
          the pointer-event drag for focal point. */}
      {showHeader && (
        <div
          className="hover-zone editable-image relative"
          {...getBannerRootProps({
            // Don't let dropzone hijack the click — we want the
            // explicit "Replace" button to drive uploads so the user
            // can also drag without immediately popping a file picker.
            onClick: (e) => e.stopPropagation(),
          })}
        >
          <input {...getBannerInputProps()} />
          {headerUrl ? (
            <div
              className="aspect-[16/5] w-full touch-none select-none"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              onPointerDown={onCoverPointerDown}
              onPointerMove={onCoverPointerMove}
              onPointerUp={onCoverPointerUp}
              onPointerCancel={onCoverPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={headerUrl}
                alt=""
                className="pointer-events-none h-full w-full object-cover"
                style={{ objectPosition: focalPointToObjectPosition(headerFocal) }}
                draggable={false}
              />
            </div>
          ) : (
            <div
              className="flex aspect-[16/5] w-full cursor-pointer items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950 text-sm text-white/70"
              onClick={openBannerPicker}
            >
              + Add a cover image
            </div>
          )}
          <div className="hover-controls">
            <button
              type="button"
              className="hc-btn"
              onClick={(e) => {
                e.stopPropagation()
                openBannerPicker()
              }}
            >
              <EditOutlined style={{ fontSize: 14 }} />
              Replace
            </button>
            {headerUrl && (
              <span
                className="hc-btn"
                style={{ pointerEvents: 'none' }}
              >
                Drag to reposition
              </span>
            )}
          </div>
        </div>
      )}

      <div className="relative flex flex-col px-6 pb-6">
        {/* Avatar — overlapping cover when shown */}
        {showLogo && (
          <div
            className={
              showHeader
                ? '-mt-10 hover-zone editable-image relative inline-block'
                : 'mt-6 hover-zone editable-image relative inline-block'
            }
            style={{ width: 80, height: 80 }}
            {...getAvatarRootProps({
              onClick: (e) => e.stopPropagation(),
            })}
          >
            <input {...getAvatarInputProps()} />
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-20 w-20 cursor-pointer rounded-xl border-4 border-white object-cover shadow-sm"
                onClick={openAvatarPicker}
              />
            ) : (
              <button
                type="button"
                onClick={openAvatarPicker}
                className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-4 border-white bg-gray-100 text-2xl text-gray-400 shadow-sm"
              >
                {name?.[0]?.toUpperCase() ?? '·'}
              </button>
            )}
            <div className="hover-controls">
              <button
                type="button"
                className="hc-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  openAvatarPicker()
                }}
              >
                <EditOutlined style={{ fontSize: 14 }} />
              </button>
            </div>
          </div>
        )}

        {/* Profile title (eyebrow) + Display name */}
        {showName && (
          <div className={`flex flex-col gap-y-0.5 ${showLogo ? 'mt-5' : 'mt-6'}`}>
            <button
              type="button"
              className="self-start text-[11px] font-semibold tracking-widest text-emerald-600 uppercase"
              style={{ minHeight: 16 }}
              onClick={() => setPopover('profileTitle')}
            >
              {profileTitle || (
                <span className="text-gray-300">+ Add a title</span>
              )}
            </button>
            <div className="flex flex-row items-center gap-x-1.5">
              <Editable
                as="h1"
                className="text-[26px] font-bold leading-tight text-gray-950"
                value={name}
                onCommit={(v) => v && updateName(v)}
                placeholder="Your name"
              />
              <Verified className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        )}

        {/* Description */}
        {showDescription && (
          <Editable
            as="p"
            className="mt-4 text-[14px] leading-relaxed text-gray-500"
            value={description ?? ''}
            onCommit={(v) => updateSetting('description', v || null)}
            placeholder="Introduce yourself in a sentence or two."
            multiline
            maxLength={160}
          />
        )}

        {/* Available for work + Languages */}
        <div className="mt-4 flex flex-row flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setContactDraft(contactUrl ?? '')
              setPopover('available')
            }}
            className={
              availableForWork
                ? 'rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[12px] font-medium text-green-600 transition-colors hover:bg-green-100'
                : 'rounded-full border border-dashed border-gray-300 px-3 py-1 text-[12px] text-gray-400 hover:border-gray-400'
            }
          >
            {availableForWork ? 'Available for work' : '+ Available for work'}
          </button>

          <button
            type="button"
            onClick={() => setPopover('languages')}
            className="flex flex-row items-center gap-x-1.5 rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-500 hover:border-gray-300"
          >
            <TranslateOutlined style={{ fontSize: 14 }} />
            {languages.length === 0
              ? '+ Languages'
              : languages.length <= 2
                ? languages.join(', ')
                : `${languages[0]}, ${languages.length - 1} more`}
          </button>
        </div>

        {/* Skills */}
        <button
          type="button"
          onClick={() => setPopover('skills')}
          className="mt-3 flex flex-row flex-wrap items-center gap-2 self-start text-left"
        >
          {skills.length === 0 ? (
            <span className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-[12px] text-gray-400">
              + Add skills
            </span>
          ) : (
            <>
              {skills.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-600"
                >
                  {s}
                </span>
              ))}
              {skills.length > 4 && (
                <span className="rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-400">
                  +{skills.length - 4}
                </span>
              )}
            </>
          )}
        </button>

        {/* Socials */}
        <div className="mt-4 hover-zone relative flex flex-row items-center gap-x-3">
          {socials.map((social, i) => {
            const Icon = getSocialIcon(social.platform)
            return (
              <span key={i} className="text-gray-800" aria-label={social.platform}>
                <Icon className="h-6 w-6" />
              </span>
            )
          })}
          <button
            type="button"
            onClick={() => setPopover('socials')}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600"
            aria-label="Edit social links"
          >
            <AddOutlined style={{ fontSize: 14 }} />
          </button>
        </div>

        {/* Subscribe form (not editable in canvas) */}
        <div className="mt-5 flex flex-row gap-2">
          <input
            type="email"
            disabled
            placeholder="Subscribe (disabled in editor)"
            className="min-w-0 flex-1 cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-[13px] text-gray-400 placeholder:text-gray-400"
          />
          <button
            type="button"
            disabled
            className="shrink-0 cursor-not-allowed rounded-xl bg-blue-500 px-5 py-2.5 text-[13px] font-medium text-white opacity-50"
          >
            Subscribe
          </button>
        </div>

        <div className="mt-6 flex flex-row items-center justify-center gap-x-1.5 border-t border-gray-100 pt-4">
          <span className="text-[11px] text-gray-400">Powered by</span>
          <LogoType className="h-4" />
        </div>
      </div>

      {/* ── Popovers ────────────────────────────────────────────────── */}

      <EditPopover
        title="Profile title"
        open={popover === 'profileTitle'}
        onClose={() => setPopover(null)}
      >
        <Select
          value={profileTitle ?? '__none__'}
          onValueChange={(v) =>
            updateSetting('profile_title', v === '__none__' ? null : v)
          }
        >
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-gray-400">None</span>
            </SelectItem>
            {PROFILE_TITLE_OPTIONS.map((title) => (
              <SelectItem key={title} value={title}>
                {title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Shown above your name in small caps.
        </p>
      </EditPopover>

      <EditPopover
        title="Skills"
        open={popover === 'skills'}
        onClose={() => setPopover(null)}
      >
        <p className="text-xs text-gray-500">
          Pick from the list or type a custom skill and press Enter.
        </p>
        <TagInput
          value={skills}
          onChange={(tags) => updateSetting('skills', tags)}
          options={SKILL_OPTIONS}
          placeholder="eg. Figma, Blender, etc."
          allowCustom
        />
      </EditPopover>

      <EditPopover
        title="Languages"
        open={popover === 'languages'}
        onClose={() => setPopover(null)}
      >
        <TagInput
          value={languages}
          onChange={(tags) => updateSetting('languages', tags)}
          options={LANGUAGE_OPTIONS}
          placeholder="eg. English, French, etc."
        />
      </EditPopover>

      <EditPopover
        title="Available for work"
        open={popover === 'available'}
        onClose={() => setPopover(null)}
        onConfirm={() =>
          updateSetting('contact_url', contactDraft.trim() || null)
        }
      >
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div>
            <div className="text-sm font-medium text-gray-900">
              Show the badge
            </div>
            <p className="text-xs text-gray-500">
              A green pill on your Space card.
            </p>
          </div>
          <Switch
            checked={availableForWork}
            onCheckedChange={(v) => updateSetting('available_for_work', v)}
          />
        </div>
        {availableForWork && (
          <div className="flex flex-col gap-y-1.5">
            <label className="text-xs font-medium text-gray-700">
              Contact link (optional)
            </label>
            <input
              type="text"
              value={contactDraft}
              onChange={(e) => setContactDraft(e.target.value)}
              placeholder="mailto:hello@example.com  or  https://cal.com/me"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
            />
            <p className="text-[11px] text-gray-400">
              When set, the badge becomes a clickable link.
            </p>
          </div>
        )}
      </EditPopover>

      <EditPopover
        title="Social links"
        open={popover === 'socials'}
        onClose={() => setPopover(null)}
      >
        <div className="flex flex-col gap-3">
          {socials.map((social, idx) => (
            <SocialLinkRow
              key={idx}
              social={social}
              onUpdate={(s) => {
                const updated = [...socials]
                updated[idx] = s
                setValue('socials', updated, { shouldDirty: true })
              }}
              onRemove={() => {
                setValue(
                  'socials',
                  socials.filter((_, i) => i !== idx),
                  { shouldDirty: true },
                )
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              setValue(
                'socials',
                [
                  ...socials,
                  {
                    platform: SOCIAL_PLATFORMS[0].value,
                    url: '',
                  } as SocialLink,
                ],
                { shouldDirty: true },
              )
            }}
            className="flex flex-row items-center gap-x-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
          >
            <AddOutlined style={{ fontSize: 18 }} />
            Add social link
          </button>
        </div>
      </EditPopover>
    </div>
  )
}
