'use server'

import { getServerSideAPI } from '@/utils/client/serverside'
import { getAuthenticatedUser } from '@/utils/user'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { withTracing } from '@posthog/ai'
import {
  convertToModelMessages,
  experimental_generateImage as generateImage,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from 'ai'
import { PostHog } from 'posthog-node'
import { z } from 'zod'
import { renderWorkbookPdf } from './renderPdf'
import { uploadFile, uploadProductMedia } from './uploadImage'

const phClient = process.env.NEXT_PUBLIC_POSTHOG_TOKEN
  ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_TOKEN!, {
      host: 'https://us.i.posthog.com',
    })
  : null

const studioSystemPrompt = `
You are Spaire Studio, an AI product compiler for creators.
Your job is to turn a short brief from the creator into a finished, sellable
digital product on Spaire — with a real Product created in their organization
at the end of the conversation.

# About Spaire
Spaire acts as a Merchant of Record for creators, handling international
sales taxes and compliance so creators can focus on creating. Studio is the
fastest path from "idea" to "a Product I can sell globally, today."

# What you create (Sprint 3 scope)
You create **workbook products**: print-ready, self-paced guides structured
like premium indie books. Think "the 30-day launch playbook", "the founder
morning ritual", "the first 100 customers workbook".

Each workbook ships with:
- A full manuscript in markdown (becomes the Product's storefront description).
- A **cover image** generated with Google Imagen and attached as the Product's
  cover media.
- A **downloadable PDF** of the manuscript, delivered to the customer after
  purchase.
- The raw **.md source** of the manuscript, also downloadable — creators
  asked for this so they can drop the workbook straight into Notion.

# The conversation shape

1. Creator gives you a brief (topic, audience, transformation, maybe a price).
2. If the brief is under-specified (no audience, no transformation), ask
   one short clarifying question. Never more than one question at a time.
3. Draft the complete workbook manuscript inline as markdown, streamed so
   the creator sees it appear. Use this structure:

    # {Title}
    > {One-line promise — 12-18 words}

    ## Introduction
    {2-3 short paragraphs. Why this workbook exists, who it's for, what
    they'll walk away with.}

    ## Chapter 1 — {Chapter Title}
    {2-4 paragraphs of guidance}

    ### Reflect
    - {2-4 journaling / thinking prompts}

    ### Do
    - {2-4 concrete actions or a mini-exercise}

    (Repeat chapters — short=3, standard=6, deep=10 chapters)

    ## Closing
    {1-2 paragraphs of send-off + what to do next}

    ## Appendix
    {Checklists, worksheets, glossary — only if useful}

4. After drafting, propose a price. Use these defaults as a starting point,
   then adjust based on scope:
   - Short workbook (3 chapters, ~8 pages): $19 USD
   - Standard workbook (6 chapters, ~16 pages): $29 USD
   - Deep workbook (10 chapters, ~32 pages): $49 USD
   Say it naturally: "This looks like a standard workbook. I'd suggest $29.
   Want me to publish it, or should we pick a different price?"
5. Once the creator confirms price (and any last edits), call the tools in
   this exact order:
   a. generateCoverImage with a vivid, 1-2 sentence image prompt that
      captures the workbook's visual tone (colors, mood, subject matter,
      art style). No text / typography in the image — Imagen handles text
      poorly. This returns a media_id.
   b. attachDownloadable with the full manuscript markdown and a kebab-case
      slug. This renders the manuscript to PDF, uploads both the PDF and
      the raw .md, and creates a "downloadables" benefit containing both.
      Returns a benefit_id.
   c. createProduct as a one-time purchase (recurring_interval: null,
      price_type: "fixed", price_amount in cents, price_currency "usd").
      Pass the media_id from step (a) as media_ids: [media_id]. The product
      description is the **full workbook markdown** you drafted.
   d. updateProductBenefits with the benefit_id from step (b).
   e. markAsDone with the created productId.

# Cover-image prompt guidance
Think editorial, minimal, and premium — what you'd see on the cover of a
modern indie business book. Strong single subject, painterly or photographic,
calm confident mood. Examples of good prompts:
- "A minimalist flat-lay of a linen notebook, a ceramic mug of black coffee,
  and a sprig of eucalyptus on a warm beige background, soft morning light."
- "An editorial photograph of a single origami paper boat on a deep navy
  textured paper, dramatic side lighting, negative space, magazine-cover feel."
Never include words, logos, or UI screenshots. Never name real people.

# Rules
- Never render IDs in your text response.
- Write in markdown (headings, lists, emphasis are all fine).
- You always generate a cover image AND a downloadable PDF + .md as part of
  publishing — don't ask the creator whether they want them. If they want to
  tweak the visual direction, take their note and regenerate.
- Don't propose usage-based pricing, subscriptions, trials, or seats —
  workbooks are one-time purchases.
- Don't propose multiple products at once. One workbook, one product.
- Don't ask for media uploads, legal pages, terms of service. Out of scope.
- If the creator asks you to generate something that isn't a workbook
  (e.g. a SaaS product, a license-key product, a subscription), redirect:
  "Studio currently specialises in workbooks. For other product types,
  the Products page has a manual creator."
- Keep your non-manuscript replies short and useful — the manuscript itself
  is the long output.
- The creator is the author. Write in their voice (matching the brief).
- Be eager to publish. Don't over-ask. Once you have topic + audience +
  transformation + price, ship it.
`

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const {
    messages,
    organizationId,
    conversationId,
  }: { messages: UIMessage[]; organizationId: string; conversationId: string } =
    await req.json()

  if (!organizationId) {
    return new Response('Organization ID is required', { status: 400 })
  }

  const model = phClient
    ? withTracing(anthropic('claude-sonnet-4-5'), phClient, {
        posthogDistinctId: user.id,
        posthogTraceId: conversationId,
        posthogGroups: { organization: organizationId },
      })
    : anthropic('claude-sonnet-4-5')

  const attachDownloadable = tool({
    description: `Render the workbook manuscript to a PDF, upload it alongside
the raw .md source as product downloads, and create a "downloadables" benefit
bundling both. Call this BEFORE createProduct. Return the benefit_id to pass
into updateProductBenefits.`,
    inputSchema: z.object({
      name: z
        .string()
        .describe(
          'The product / workbook name. Used for the benefit description and file names.',
        ),
      slug: z
        .string()
        .describe(
          'A kebab-case slug for the downloadable filenames (e.g. "morning-routines").',
        ),
      markdown: z
        .string()
        .describe(
          'The full workbook manuscript as markdown. Will be rendered to PDF and also shipped as a .md file.',
        ),
    }),
    execute: async ({ name, slug, markdown }) => {
      try {
        const api = await getServerSideAPI()
        const safeSlug =
          slug.replace(/[^a-z0-9-_]/gi, '-').slice(0, 64) || 'workbook'

        const pdfBytes = await renderWorkbookPdf(markdown)

        const pdfUpload = await uploadFile({
          api,
          organizationId,
          bytes: pdfBytes,
          filename: `${safeSlug}.pdf`,
          mimeType: 'application/pdf',
          service: 'downloadable',
        })
        if (!pdfUpload.success) {
          return { success: false, error: `PDF upload: ${pdfUpload.error}` }
        }

        const mdBytes = new TextEncoder().encode(markdown)
        const mdUpload = await uploadFile({
          api,
          organizationId,
          bytes: mdBytes,
          filename: `${safeSlug}.md`,
          mimeType: 'text/markdown',
          service: 'downloadable',
        })
        if (!mdUpload.success) {
          return { success: false, error: `Markdown upload: ${mdUpload.error}` }
        }

        const { data, error } = await api.POST('/v1/benefits/', {
          body: {
            type: 'downloadables',
            description: `${name} — PDF + Markdown`,
            organization_id: organizationId,
            properties: {
              archived: {},
              files: [pdfUpload.fileId, mdUpload.fileId],
            },
          } as never,
        })

        if (error) {
          return { success: false, error: JSON.stringify(error) }
        }

        return {
          success: true,
          benefit_id: data.id,
          pdf_file_id: pdfUpload.fileId,
          md_file_id: mdUpload.fileId,
        }
      } catch (err) {
        console.error('[studio/chat] attachDownloadable error:', err)
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  })

  const createProduct = tool({
    description:
      'Create the workbook product as a one-time purchase. After creating, call updateProductBenefits to attach the benefit.',
    inputSchema: z.object({
      name: z.string().describe('The product name (e.g. "Morning Routines")'),
      description: z
        .string()
        .describe(
          'The full workbook manuscript as markdown. This becomes the storefront description.',
        ),
      price_amount: z
        .number()
        .describe('Price in cents (e.g. 2900 for $29.00)'),
      price_currency: z
        .string()
        .default('usd')
        .describe('3-letter currency code (default: usd)'),
      media_ids: z
        .array(z.string())
        .optional()
        .describe(
          'List of product_media file IDs to attach as storefront images. Pass the media_id returned by generateCoverImage.',
        ),
    }),
    execute: async ({
      name,
      description,
      price_amount,
      price_currency,
      media_ids,
    }) => {
      const api = await getServerSideAPI()

      const { data, error } = await api.POST('/v1/products/', {
        body: {
          name,
          description,
          visibility: 'public',
          organization_id: organizationId,
          recurring_interval: null,
          prices: [
            {
              amount_type: 'fixed',
              price_currency: price_currency ?? 'usd',
              price_amount,
            },
          ],
          medias: media_ids && media_ids.length > 0 ? media_ids : undefined,
        } as never,
      })

      if (error) {
        return { success: false, error: JSON.stringify(error) }
      }

      return { success: true, product_id: data.id, name: data.name }
    },
  })

  const generateCoverImage = tool({
    description: `Generate a cover image for the workbook using Google Imagen
and upload it as product media. Call this BEFORE createProduct and pass the
returned media_id into createProduct's media_ids. Do not include any text
or typography in the prompt — Imagen handles text poorly.`,
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          'A vivid, 1-2 sentence image prompt. Describe visual style, mood, colors, subject, and art direction. No text / typography / words in the image.',
        ),
      filename: z
        .string()
        .describe(
          'A short kebab-case filename without extension (e.g. "morning-routines-cover"). Saved as PNG.',
        ),
    }),
    execute: async ({ prompt, filename }) => {
      try {
        const { image } = await generateImage({
          model: google.image('imagen-4.0-generate-001'),
          prompt,
          aspectRatio: '16:9',
          n: 1,
          providerOptions: {
            google: { personGeneration: 'allow_adult' },
          },
        })

        const api = await getServerSideAPI()
        const safeName = filename.replace(/[^a-z0-9-_]/gi, '-').slice(0, 64)
        const result = await uploadProductMedia({
          api,
          organizationId,
          bytes: image.uint8Array,
          filename: `${safeName || 'cover'}.png`,
          mimeType: image.mediaType || 'image/png',
        })

        if (!result.success) {
          return { success: false, error: result.error }
        }

        return { success: true, media_id: result.mediaId }
      } catch (err) {
        console.error('[studio/chat] generateCoverImage error:', err)
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  })

  const updateProductBenefits = tool({
    description:
      'Attach the previously created benefit to the workbook product.',
    inputSchema: z.object({
      product_id: z.string().describe('The product ID to update'),
      benefit_ids: z
        .array(z.string())
        .describe('List of benefit IDs to attach'),
    }),
    execute: async ({ product_id, benefit_ids }) => {
      const api = await getServerSideAPI()

      const { data, error } = await api.POST('/v1/products/{id}/benefits', {
        params: { path: { id: product_id } },
        body: { benefits: benefit_ids },
      })

      if (error) {
        return { success: false, error: JSON.stringify(error) }
      }

      return { success: true, product_id: data.id }
    },
  })

  const markAsDone = tool({
    description: `Signal that the workbook product has been published.
Call this once the product and its benefit have been fully created and attached.

You can call this tool only once per conversation. Make sure the product is
fully published before calling it.`,
    inputSchema: z.object({
      productId: z.string().describe('The ID of the created product'),
    }),
  })

  try {
    const result = streamText({
      model,
      tools: {
        generateCoverImage,
        attachDownloadable,
        createProduct,
        updateProductBenefits,
        markAsDone,
      },
      messages: [
        {
          role: 'system',
          content: studioSystemPrompt,
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
        ...convertToModelMessages(messages),
      ],
      stopWhen: stepCountIs(20),
      experimental_transform: smoothStream(),
      onError: (err) => {
        console.error('[studio/chat] stream model error:', err)
      },
      onFinish: () => {
        if (phClient) {
          phClient.flush()
        }
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error('[studio/chat] streamText error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
