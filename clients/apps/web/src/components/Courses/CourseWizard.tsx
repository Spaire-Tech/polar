'use client'

import { Upload } from '@/components/FileUpload/Upload'
import {
  useCreateCourse,
  useCreateMuxUpload,
  useUpdateCourse,
  useUpdateCourseLesson,
  useUploadCourseTrailer,
  useUploadLandingMedia,
  useUploadLessonThumbnail,
} from '@/hooks/queries/courses'
import { useCreateProduct } from '@/hooks/queries/products'
import { ProductEditOrCreateForm } from '@/utils/product'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { schemas } from '@spaire/client'
import { Form } from '@spaire/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { OutlineScreen } from './CourseWizard.outline'
import { CreatingScreen, GeneratingScreen } from './CourseWizard.status'
import {
  Intro,
  SpaireOnboardingStyles,
  StepCourse,
  StepFormat,
  StepInstructor,
  StepPricingWizard,
  type WizardFormat,
  type WizardPaywallState,
} from './CourseWizard.steps'
import {
  WizardLandingEditor,
  type WizardFinalizationData,
} from './editor/WizardLandingEditor'
import { normalizeLandingCardinality } from './landing-style'
import { landingSchema, outlineSchema } from './schemas'

type WizardStep =
  | 'intro'
  | 'format'
  | 'instructor'
  | 'course'
  | 'pricing'
  | 'generating-outline'
  | 'outline'
  | 'generating-landing'
  | 'preview'
  | 'creating'

type InstructorState = { name: string; bio: string }
type CourseState = {
  title: string
  desc: string
  targetAudience: string
  differentiator: string
}
type DraftState = {
  name: string
  courseTitle: string
  desc: string
  // Italic is permanently off — kept on the type for the create payload only.
  nameItalic: boolean
  nameBold: boolean
  nameUppercase: boolean
}

type PartialModule = {
  title?: string
  description?: string
  lessons?: { title?: string; content_type?: 'text' | 'video' }[]
}
type PartialOutline = { modules?: PartialModule[] }

// Upload a hero/thumbnail file as a *product media*. Going through the
// canonical product-media pipeline (rather than organization_avatar) means
// the file lands on the product's `medias` list and is surfaced in checkout,
// emails, and social previews — same as a media uploaded from the regular
// product create/edit form. The course thumbnail_url is sourced from the same
// response so the cinematic hero keeps the same image.
function uploadCourseThumbnail(
  organization: schemas['Organization'],
  file: File,
): Promise<schemas['ProductMediaFileRead'] | null> {
  return new Promise((resolve) => {
    const upload = new Upload({
      organization,
      service: 'product_media',
      file,
      onFileProcessing: () => {},
      onFileCreate: () => {},
      onFileUploadProgress: () => {},
      onFileUploaded: (response) => {
        resolve(response as schemas['ProductMediaFileRead'])
      },
      onFileError: () => resolve(null),
    })
    upload.run()
  })
}

// ─── Main wizard ─────────────────────────────────────────────────────────────

export default function CourseWizard({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const createProduct = useCreateProduct(organization)
  const createCourse = useCreateCourse()
  const updateCourse = useUpdateCourse()

  const [screen, setScreen] = useState<WizardStep>('intro')
  // Series vs Course discriminator. Drives the AI prompt branch on every
  // generation call (outline, landing, lesson-content) and the format value
  // persisted on the Course row when finalizeCourse runs.
  const [format, setFormat] = useState<WizardFormat>('course')
  const [instructor, setInstructor] = useState<InstructorState>({
    name: organization.name ?? '',
    bio: '',
  })
  const [course, setCourse] = useState<CourseState>({
    title: '',
    desc: '',
    targetAudience: '',
    differentiator: '',
  })
  // Pricing/currency/billing-cycle live exclusively on the form below — same
  // primitives as the regular product create flow. The wizard tracks only the
  // course-specific paywall toggle + free preview lesson count.
  const [paywall, setPaywall] = useState<WizardPaywallState>({
    paywallEnabled: true,
    freePreviewLessons: 3,
  })
  const [draft, setDraft] = useState<DraftState>({
    name: '',
    courseTitle: '',
    desc: '',
    // Italics removed from the design entirely.
    nameItalic: false,
    nameBold: true,
    nameUppercase: true,
  })
  const [generateError, setGenerateError] = useState<string | null>(null)

  // The wizard hosts the same react-hook-form instance that ProductPricing
  // Section + ProductMediaSection bind to — every choice the user makes there
  // (one-time / recurring, fixed / free, currency tabs, media uploads) lands
  // straight on form values, so finalizeCourse just hands form.getValues() to
  // useCreateProduct. No bespoke mappers.
  const defaultCurrency = organization.default_presentment_currency ?? 'usd'
  const form = useForm<ProductEditOrCreateForm>({
    defaultValues: {
      name: '',
      description: '',
      recurring_interval: null,
      visibility: 'public',
      prices: [
        {
          amount_type: 'fixed',
          price_amount: 0,
          price_currency: defaultCurrency,
        } as schemas['ProductCreate']['prices'][number],
      ],
      medias: [],
      full_medias: [],
      organization_id: organization.id,
      metadata: [],
    },
  })

  // ── Outline streaming ─────────────────────────────────────────────────────
  const {
    object: partialOutline,
    submit: submitOutline,
    isLoading: isOutlineStreaming,
    error: outlineError,
    stop: stopOutline,
  } = useObject({
    api: `/dashboard/${organization.slug}/courses/outline`,
    schema: outlineSchema,
    onFinish: () => setScreen('outline'),
    onError: () => {
      setGenerateError('Failed to generate outline. Please try again.')
      setScreen('pricing')
    },
  })

  // ── Landing-page streaming ────────────────────────────────────────────────
  const {
    object: partialLanding,
    submit: submitLanding,
    isLoading: isLandingStreaming,
    error: landingError,
    stop: stopLanding,
  } = useObject({
    api: `/dashboard/${organization.slug}/courses/landing`,
    schema: landingSchema,
    onFinish: ({ error }) => {
      if (error) {
        console.error('[CourseWizard] landing onFinish validation error:', error)
      }
      setScreen('preview')
    },
    onError: (error) => {
      console.error('[CourseWizard] landing stream error:', error)
      // Non-fatal — drop the user into the preview anyway with placeholders.
      setScreen('preview')
    },
  })

  const handleClose = () => {
    stopOutline()
    stopLanding()
    router.push(`/dashboard/${organization.slug}/products`)
  }

  // Outline submission — happens after pricing step.
  const startOutlineGeneration = async () => {
    setGenerateError(null)

    form.setValue('name', draft.courseTitle || course.title)
    form.setValue('description', draft.desc || course.desc)

    setScreen('generating-outline')
    submitOutline({
      title: draft.courseTitle || course.title,
      description: draft.desc || course.desc || '',
      targetAudience: course.targetAudience || null,
      differentiator: course.differentiator || null,
      instructorName: instructor.name || null,
      instructorBio: instructor.bio || null,
      paywallEnabled: paywall.paywallEnabled,
      freePreviewLessons: paywall.paywallEnabled
        ? paywall.freePreviewLessons
        : null,
      format,
    })
  }

  // Landing submission — kicked off from the outline screen.
  const startLandingGeneration = () => {
    const outline = partialOutline as PartialOutline | undefined
    const lessonCount =
      outline?.modules?.reduce(
        (acc, m) => acc + (m?.lessons?.length ?? 0),
        0,
      ) ?? 0
    const recurringInterval = form.getValues('recurring_interval')
    const billingType: 'one_time' | 'subscription' = recurringInterval
      ? 'subscription'
      : 'one_time'
    setScreen('generating-landing')
    submitLanding({
      title: draft.courseTitle || course.title,
      description: draft.desc || course.desc || '',
      targetAudience: course.targetAudience || null,
      differentiator: course.differentiator || null,
      instructorName: instructor.name || null,
      instructorBio: instructor.bio || null,
      moduleCount: outline?.modules?.length ?? 0,
      moduleTitles:
        outline?.modules
          ?.map((m) => (m?.title ?? '').trim())
          .filter((t): t is string => !!t) ?? [],
      // Pass lesson titles too — the landing prompt uses them to ground
      // learn_items and FAQ answers in real subject matter instead of
      // generic outcomes.
      lessonTitles:
        outline?.modules
          ?.flatMap(
            (m) =>
              m?.lessons
                ?.map((l) => (l?.title ?? '').trim())
                .filter((t): t is string => !!t) ?? [],
          ) ?? [],
      lessonCount,
      paywallEnabled: paywall.paywallEnabled,
      freePreviewLessons: paywall.paywallEnabled
        ? paywall.freePreviewLessons
        : null,
      billingType: paywall.paywallEnabled ? billingType : null,
      recurringInterval:
        paywall.paywallEnabled && billingType === 'subscription'
          ? recurringInterval
          : null,
      format,
    })
  }

  const uploadTrailerMutation = useUploadCourseTrailer()
  const uploadLandingMediaMutation = useUploadLandingMedia()
  const updateLessonMutation = useUpdateCourseLesson()
  const uploadLessonThumbMutation = useUploadLessonThumbnail()
  const createMuxUploadMutation = useCreateMuxUpload()

  const finalizeCourse = async (wizardData?: WizardFinalizationData) => {
    const outline = partialOutline as PartialOutline | undefined
    if (!outline?.modules?.length) return
    // Idempotent: a double-click can fire two onPublish calls before
    // setScreen flushes. Bail if we're already creating so we don't
    // create the product twice.
    if (screen === 'creating') return
    // Stop any in-flight AI generation so we stop paying for tokens we no
    // longer care about, and so onFinish can't fire setScreen() after we've
    // moved on to the create flow.
    stopOutline()
    stopLanding()
    setScreen('creating')

    try {
      // Hero source for course.thumbnail_url:
      // 1) inline upload from the wizard landing preview (pendingHeroFile)
      // 2) otherwise the first media the user added in StepProductMedia
      let heroMedia: schemas['ProductMediaFileRead'] | null = null
      if (wizardData?.pendingHeroFile) {
        heroMedia = await uploadCourseThumbnail(
          organization,
          wizardData.pendingHeroFile,
        )
        if (heroMedia) {
          const existing = form.getValues('full_medias') ?? []
          if (!existing.some((m) => m.id === heroMedia!.id)) {
            form.setValue('full_medias', [heroMedia, ...existing])
          }
        }
      } else {
        heroMedia = (form.getValues('full_medias') ?? [])[0] ?? null
      }
      const thumbnailUrl = heroMedia?.public_url ?? null

      // Pricing + medias are already on `form` — ProductPricingSection and
      // ProductMediaSection bound to it directly. Hand it straight to
      // useCreateProduct without any wizard-specific mapping.
      const formValues = form.getValues()
      const { full_medias, metadata, ...rest } = formValues
      const mediaIds = full_medias.map((m) => m.id)

      // The AI-generated landing payload is persisted in the course's
      // landing_overrides.ai_landing field. The human description stays clean.
      // Cardinality is enforced here (not in Zod) because min/max stalls
      // useObject on streamed partial JSON — so the prompt requests N items
      // and the renderer is guaranteed N items by padding/slicing at save.
      const normalizedLanding = normalizeLandingCardinality(
        partialLanding as Record<string, unknown> | null | undefined,
        format,
      )
      const landingForStorage = {
        ...normalizedLanding,
        // Snapshot the editable surface bits the user might have changed in
        // the preview (instructor name, course title, description) so the
        // saved landing matches what they saw.
        editable: {
          instructorName: draft.name || instructor.name || null,
          courseTitle: draft.courseTitle || course.title || null,
          description: draft.desc || course.desc || null,
        },
      }

      const productResult = await createProduct.mutateAsync({
        ...rest,
        name: draft.courseTitle || course.title || 'Untitled Course',
        description: draft.desc || course.desc || null,
        // Tag the underlying product as a course so the public Spaire
        // Space buckets it under "Courses" instead of "Other", and so
        // the editor's Course tab can filter the catalog without
        // hitting useOrganizationCourses for every render.
        category: 'course',
        medias: mediaIds,
        metadata: metadata.reduce<Record<string, string | number | boolean>>(
          (acc, { key, value }) => ({ ...acc, [key]: value }),
          {},
        ),
      } as schemas['ProductCreate'])

      if (productResult.error || !productResult.data) {
        console.error(
          '[CourseWizard] product creation error:',
          JSON.stringify(productResult.error),
        )
        throw new Error(
          `Product creation failed: ${JSON.stringify(productResult.error)}`,
        )
      }

      const totalLessons =
        outline.modules?.reduce(
          (acc, m) => acc + (m?.lessons?.length ?? 0),
          0,
        ) ?? 0
      const paywallPosition = paywall.paywallEnabled
        ? Math.max(0, Math.min(totalLessons, paywall.freePreviewLessons))
        : null

      const humanDescription = draft.desc || course.desc || null

      // If the user repositioned the hero in the wizard preview, the new
      // object-position lives on the hero.backdrop override slot. Promote
      // it onto the course row at creation time so the customer portal,
      // course list, etc. all show the same crop.
      const heroBackdrop = wizardData?.overrides.media['hero.backdrop']
      const heroObjectPosition =
        heroBackdrop && heroBackdrop.kind === 'image'
          ? heroBackdrop.objectPosition ?? null
          : null

      const outlineModules = outline.modules
      const created = await createCourse.mutateAsync({
        product_id: productResult.data.id,
        organization_id: organization.id,
        title:
          draft.courseTitle ||
          course.title ||
          (format === 'series' ? 'Untitled Series' : 'Untitled Course'),
        course_type: 'evergreen',
        format,
        paywall_enabled: paywall.paywallEnabled,
        ai_generated: true,
        description: humanDescription,
        thumbnail_url: thumbnailUrl,
        thumbnail_object_position: heroObjectPosition,
        instructor_name: draft.name || instructor.name || null,
        instructor_bio: instructor.bio || null,
        instructor_name_italic: false,
        instructor_name_bold: draft.nameBold,
        instructor_name_uppercase: draft.nameUppercase,
        modules: outlineModules
          .filter(
            (
              m,
            ): m is {
              title: string
              description?: string
              lessons?: { title?: string; content_type?: 'text' | 'video' }[]
            } => Boolean(m?.title),
          )
          .map((mod, i) => {
            // Match the wizard preview's filter (title-only — see
            // WizardLandingEditor.fakeCourse) so the flat wizard-N
            // index maps 1:1 to the lessons we're about to create.
            // Default content_type to 'text' when missing.
            const lessonInputs = (mod.lessons ?? []).filter(
              (l): l is { title: string; content_type?: 'text' | 'video' } =>
                Boolean(l?.title),
            )
            return {
              title: mod.title!,
              description: mod.description ?? null,
              position: i,
              lessons: lessonInputs.map((lesson, j) => {
                const flatIdx =
                  outlineModules
                    .slice(0, i)
                    .reduce((acc, m2) => {
                      return (
                        acc +
                        (m2?.lessons?.filter((l) => Boolean(l?.title))
                          .length ?? 0)
                      )
                    }, 0) + j
                const wizardId = `wizard-${flatIdx + 1}`
                const edit = wizardData?.lessonEdits.get(wizardId)
                const baseContentType: 'text' | 'video' =
                  lesson.content_type ?? 'text'
                return {
                  title: edit?.title ?? lesson.title,
                  content_type: edit?.muxUploadId ? 'video' : baseContentType,
                  position: j,
                  // Pass pre-staged uploads straight into the create
                  // payload so the lesson is born already pointing at
                  // its video / thumbnail.
                  mux_upload_id: edit?.muxUploadId ?? null,
                  thumbnail_url: edit?.thumbnailStagedUrl ?? null,
                  description:
                    edit?.description !== undefined ? edit.description : null,
                }
              }),
            }
          }),
      })

      // Persist AI-generated challenges. The outline schema now
      // streams a top-level `challenges` array (one per module for
      // courses, all four anchored to the single season-module for
      // series). Map each challenge's module_index onto the
      // just-persisted modules; skip silently on errors so a flaky
      // challenge create doesn't fail the whole course creation.
      const outlineChallenges =
        (
          outline as {
            challenges?: Array<{
              title?: string
              prompt?: string
              module_index?: number
            }>
          }
        ).challenges ?? []
      if (outlineChallenges.length > 0) {
        const createdModules = [...(created.modules ?? [])].sort(
          (a, b) => a.position - b.position,
        )
        for (const ch of outlineChallenges) {
          if (!ch.title) continue
          const idx = ch.module_index ?? 0
          const mod = createdModules[idx] ?? createdModules[0]
          if (!mod) continue
          try {
            await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${created.id}/challenges`,
              {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  module_id: mod.id,
                  title: ch.title,
                  prompt: ch.prompt ?? '',
                  ai_generated: true,
                }),
              },
            )
          } catch (e) {
            console.warn('[CourseWizard] challenge create failed:', e)
          }
        }
      }

      // The create endpoint doesn't accept paywall_position; patch it in
      // immediately after if the wizard collected one.
      if (paywall.paywallEnabled && paywallPosition !== null) {
        try {
          await updateCourse.mutateAsync({
            courseId: created.id,
            body: { paywall_position: paywallPosition },
          })
        } catch (e) {
          console.warn('[CourseWizard] paywall_position patch failed:', e)
        }
      }

      // Apply landing overrides + upload anything that didn't finish
      // staging during the wizard. The wizard kicks uploads off the
      // moment the user picks each file, so by the time we get here the
      // common case is "all done already" — we only re-upload the
      // stragglers (files in pendingFiles, files where staging failed).
      if (wizardData) {
        const ov = { ...wizardData.overrides }
        ov.media = { ...ov.media }
        ov.text = { ...ov.text }
        // Drop the hero blob URL — the canonical hero lives on
        // course.thumbnail_url which we just set.
        delete ov.media['hero.backdrop']

        // Trailer: prefer the URL that landed via staging during the
        // wizard. Fall back to the buffered File only if staging
        // failed.
        if (wizardData.stagedTrailerUrl) {
          try {
            await updateCourse.mutateAsync({
              courseId: created.id,
              body: { trailer_url: wizardData.stagedTrailerUrl },
            })
          } catch (e) {
            console.warn('[CourseWizard] trailer URL patch failed:', e)
          }
          delete ov.media['trailer.video']
        } else if (wizardData.pendingTrailerFile) {
          try {
            await uploadTrailerMutation.mutateAsync({
              courseId: created.id,
              file: wizardData.pendingTrailerFile,
            })
          } catch (e) {
            console.warn('[CourseWizard] trailer upload failed:', e)
          }
          delete ov.media['trailer.video']
        }

        // Promote already-staged slot media URLs straight onto
        // landing_overrides.media so the canonical landing renders the
        // S3 URL (not a dead blob: URL that only lived in the wizard).
        for (const [
          slotId,
          res,
        ] of wizardData.stagedSlotMedia.entries()) {
          if (slotId === 'hero.backdrop' || slotId === 'trailer.video') continue
          ov.media[slotId] = { kind: res.kind, url: res.url }
        }
        // Stragglers — slots whose staging upload didn't land before
        // Create was clicked. Upload them through the per-course
        // landing-media endpoint, then drop them from `pendingFiles`.
        for (const [slotId, file] of wizardData.pendingFiles.entries()) {
          if (slotId === 'hero.backdrop' || slotId === 'trailer.video') continue
          if (wizardData.stagedSlotMedia.has(slotId)) continue
          try {
            const res = await uploadLandingMediaMutation.mutateAsync({
              courseId: created.id,
              file,
            })
            ov.media[slotId] = { kind: res.kind, url: res.url, name: file.name }
          } catch (e) {
            console.warn(
              '[CourseWizard] landing-media upload failed for',
              slotId,
              e,
            )
          }
        }

        // Rewrite any section-keyed overrides the wizard staged under the
        // fake `wizard-module-N` ids onto the real module ids the create
        // endpoint just minted. Without this, section thumbnails (and any
        // user-edited section titles) uploaded during onboarding live under
        // dead keys that nothing on the published landing reads.
        const sortedRealModules = [...created.modules].sort(
          (a, b) => a.position - b.position,
        )
        const wizardSectionKey = /^sections\.module\.wizard-module-(\d+)\.(.+)$/
        const remapSectionKeys = (bag: Record<string, unknown>) => {
          for (const key of Object.keys(bag)) {
            const match = wizardSectionKey.exec(key)
            if (!match) continue
            const idx = parseInt(match[1], 10)
            const realMod = sortedRealModules[idx]
            const value = bag[key]
            delete bag[key]
            if (!realMod) continue
            const nextKey = `sections.module.${realMod.id}.${match[2]}`
            // Don't clobber a value the AI-section mapping below will write.
            if (!(nextKey in bag)) bag[nextKey] = value
          }
        }
        remapSectionKeys(ov.media as Record<string, unknown>)
        remapSectionKeys(ov.text as Record<string, unknown>)

        // Map AI-generated section titles (from the "sections" array) onto
        // the actual created modules by position, but only where the user
        // hasn't already provided one through the wizard preview.
        const aiSections = (partialLanding as { sections?: unknown } | null)
          ?.sections
        if (Array.isArray(aiSections) && sortedRealModules.length > 0) {
          aiSections.forEach((entry, i) => {
            const mod = sortedRealModules[i]
            if (!mod) return
            const t =
              entry && typeof entry === 'object' && 'title' in entry
                ? (entry as { title?: unknown }).title
                : null
            const key = `sections.module.${mod.id}.title`
            if (typeof t === 'string' && t.trim() && !(key in ov.text!)) {
              ov.text![key] = t.trim()
            }
          })
        }

        try {
          await updateCourse.mutateAsync({
            courseId: created.id,
            body: {
              landing_overrides: { ...ov, ai_landing: landingForStorage },
            },
          })
        } catch (e) {
          console.warn('[CourseWizard] landing_overrides patch failed:', e)
        }

        // Replay buffered per-lesson edits onto the real lessons. The
        // create payload already carried mux_upload_id + thumbnail_url
        // for anything that staged successfully — so this loop only has
        // to handle title/description text edits and rare uploads that
        // didn't make it through staging.
        if (wizardData.lessonEdits && wizardData.lessonEdits.size > 0) {
          const flatCreatedLessons = (created.modules ?? []).flatMap(
            (m) => m.lessons ?? [],
          )
          for (const [wizardId, edit] of wizardData.lessonEdits.entries()) {
            const idxMatch = /^wizard-(\d+)$/.exec(wizardId)
            if (!idxMatch) continue
            const lessonIdx = parseInt(idxMatch[1], 10) - 1
            const realLesson = flatCreatedLessons[lessonIdx]
            if (!realLesson) continue
            // Patch title/description if the user changed them. Title /
            // description go through CourseLessonCreate now, so only
            // patch when the edit value differs from what came back.
            const needsTitlePatch =
              edit.title !== undefined && edit.title !== realLesson.title
            const needsDescriptionPatch =
              edit.description !== undefined &&
              edit.description !== realLesson.description
            if (needsTitlePatch || needsDescriptionPatch) {
              try {
                await updateLessonMutation.mutateAsync({
                  lessonId: realLesson.id,
                  body: {
                    ...(needsTitlePatch ? { title: edit.title } : {}),
                    ...(needsDescriptionPatch
                      ? { description: edit.description }
                      : {}),
                  },
                })
              } catch (e) {
                console.warn(
                  '[CourseWizard] lesson patch failed for',
                  wizardId,
                  e,
                )
              }
            }
            // Thumbnail fallback — only when staging didn't land.
            if (edit.thumbnailFile && !edit.thumbnailStagedUrl) {
              try {
                await uploadLessonThumbMutation.mutateAsync({
                  lessonId: realLesson.id,
                  file: edit.thumbnailFile,
                })
              } catch (e) {
                console.warn(
                  '[CourseWizard] lesson thumbnail upload failed for',
                  wizardId,
                  e,
                )
              }
            }
            // Video fallback — only when the staged Mux upload didn't
            // make it through (network blip, page kept open too short).
            if (edit.videoFile && !edit.muxUploadId) {
              try {
                const { upload_url } =
                  await createMuxUploadMutation.mutateAsync(realLesson.id)
                await new Promise<void>((resolve, reject) => {
                  const xhr = new XMLHttpRequest()
                  xhr.onload = () =>
                    xhr.status >= 200 && xhr.status < 300
                      ? resolve()
                      : reject(new Error(`Upload failed (${xhr.status})`))
                  xhr.onerror = () =>
                    reject(new Error('Network error during upload'))
                  xhr.open('PUT', upload_url)
                  xhr.send(edit.videoFile)
                })
              } catch (e) {
                console.warn(
                  '[CourseWizard] lesson video upload failed for',
                  wizardId,
                  e,
                )
              }
            }
          }
        }
      }

      toast({
        title: format === 'series' ? 'Series Created' : 'Course Created',
        description: `"${draft.courseTitle || course.title}" is ready to edit`,
      })
      router.replace(
        `/dashboard/${organization.slug}/courses/${created.id}?tab=outline`,
      )
    } catch (err) {
      console.error('[CourseWizard] create error:', err)
      toast({
        title: 'Something went wrong',
        description: 'Could not create the course. Please try again.',
      })
      setScreen('preview')
    }
  }

  // Promote step-1/2 inputs into the editable draft snapshot used by the
  // landing preview. Called as the user leaves the Course step.
  const seedDraftFromInputs = () => {
    setDraft((d) => ({
      ...d,
      name: d.name || instructor.name,
      courseTitle: d.courseTitle || course.title,
      desc: d.desc || course.desc || instructor.bio,
    }))
  }

  const partialOutlineSafe = (partialOutline as PartialOutline) ?? {
    modules: [],
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="spaire-onboarding"
        style={{ minHeight: '100vh' }}
      >
        <SpaireOnboardingStyles />
        <div className="spaire-shell">
          {screen === 'intro' && (
            <Intro
              onNext={() => setScreen('format')}
              onClose={handleClose}
            />
          )}
          {screen === 'format' && (
            <StepFormat
              value={format}
              onChange={setFormat}
              onNext={() => setScreen('instructor')}
              onBack={() => setScreen('intro')}
              onClose={handleClose}
            />
          )}
          {screen === 'instructor' && (
            <StepInstructor
              data={instructor}
              onChange={setInstructor}
              onNext={() => setScreen('course')}
              onBack={() => setScreen('format')}
              onClose={handleClose}
              format={format}
            />
          )}
          {screen === 'course' && (
            <StepCourse
              data={course}
              onChange={setCourse}
              onNext={() => {
                seedDraftFromInputs()
                setScreen('pricing')
              }}
              onBack={() => setScreen('instructor')}
              onClose={handleClose}
              format={format}
            />
          )}
          {screen === 'pricing' && (
            <StepPricingWizard
              organization={organization}
              paywall={paywall}
              onPaywallChange={setPaywall}
              onNext={startOutlineGeneration}
              onBack={() => setScreen('course')}
              onClose={handleClose}
              courseTitle={draft.courseTitle || course.title}
              courseDesc={draft.desc || course.desc}
              courseLessons={12}
              format={format}
            />
          )}
          {screen === 'generating-outline' && (
            <GeneratingScreen onClose={handleClose} format={format} />
          )}
          {screen === 'outline' && (
            <OutlineScreen
              title={draft.courseTitle || course.title}
              partialOutline={partialOutlineSafe}
              isStreaming={isOutlineStreaming}
              error={outlineError ? 'Failed to generate outline.' : null}
              onRegenerate={() => {
                stopOutline()
                setScreen('pricing')
              }}
              onCreate={startLandingGeneration}
              onClose={handleClose}
              format={format}
            />
          )}
          {screen === 'generating-landing' && (
            <GeneratingScreen
              onClose={handleClose}
              phase="landing"
              format={format}
            />
          )}
          {screen === 'preview' &&
            (() => {
              const wizardPrice = form.getValues('prices')?.[0]
              const priceCents =
                wizardPrice && 'price_amount' in wizardPrice
                  ? (wizardPrice.price_amount as number)
                  : null
              const priceCurrency =
                (wizardPrice && 'price_currency' in wizardPrice
                  ? (wizardPrice.price_currency as string)
                  : null) ?? defaultCurrency
              return (
                <WizardLandingEditor
                  organization={organization}
                  draft={{
                    name: draft.name || instructor.name,
                    courseTitle: draft.courseTitle || course.title,
                    desc: draft.desc || course.desc,
                    priceCents,
                    priceCurrency,
                    paywallEnabled: paywall.paywallEnabled,
                    paywallPosition: paywall.paywallEnabled
                      ? paywall.freePreviewLessons
                      : null,
                  }}
                  outline={partialOutlineSafe}
                  initialLanding={
                    (partialLanding as Record<string, unknown> | null) ?? null
                  }
                  initialThumbFile={null}
                  initialThumbName=""
                  onPublish={finalizeCourse}
                  onBack={() => setScreen('outline')}
                  format={format}
                />
              )
            })()}
          {screen === 'creating' && <CreatingScreen onClose={handleClose} />}
        </div>
      </form>
    </Form>
  )
}
