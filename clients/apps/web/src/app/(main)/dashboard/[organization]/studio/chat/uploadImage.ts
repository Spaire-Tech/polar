import type { Client } from '@spaire/client'

type UploadResult =
  | { success: true; fileId: string }
  | { success: false; error: string }

type FileService = 'product_media' | 'downloadable'

/**
 * Upload raw bytes to Polar as a file. Service determines how the file is
 * treated: `product_media` for storefront cover images, `downloadable` for
 * assets attached to a downloadables benefit.
 *
 * Studio files are small (single PNG cover, short workbook PDF, short .md),
 * well under the 10MB single-part limit, so we don't chunk.
 */
export async function uploadFile({
  api,
  organizationId,
  bytes,
  filename,
  mimeType,
  service,
}: {
  api: Client
  organizationId: string
  bytes: Uint8Array
  filename: string
  mimeType: string
  service: FileService
}): Promise<UploadResult> {
  // Copy into a fresh ArrayBuffer. The Uint8Array returned by the AI SDK or
  // produced by pdfkit is typed as ArrayBufferLike (may back onto a
  // SharedArrayBuffer), which is not assignable to BlobPart / BufferSource.
  // Copying guarantees a plain ArrayBuffer that works with both crypto.subtle
  // and Blob / fetch.
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], { type: mimeType })

  // Whole-file + single-chunk SHA-256 (base64). They're the same value in a
  // single-part upload but the API schema requires both fields.
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const sha256base64 = Buffer.from(digest).toString('base64')

  const { data: created, error: createError } = await api.POST('/v1/files/', {
    body: {
      organization_id: organizationId,
      service,
      name: filename,
      size: bytes.length,
      mime_type: mimeType,
      checksum_sha256_base64: sha256base64,
      upload: {
        parts: [
          {
            number: 1,
            chunk_start: 0,
            chunk_end: bytes.length,
            checksum_sha256_base64: sha256base64,
          },
        ],
      },
    } as never,
  })

  if (createError) {
    return { success: false, error: JSON.stringify(createError) }
  }

  const part = created.upload.parts[0]
  const putResp = await fetch(part.url, {
    method: 'PUT',
    body: blob,
    headers: part.headers ?? {},
  })

  if (!putResp.ok) {
    return {
      success: false,
      error: `S3 upload failed: ${putResp.status} ${putResp.statusText}`,
    }
  }

  const etag = putResp.headers.get('ETag')
  if (!etag) {
    return { success: false, error: 'S3 did not return ETag' }
  }

  const { data: completed, error: completeError } = await api.POST(
    '/v1/files/{id}/uploaded',
    {
      params: { path: { id: created.id } },
      body: {
        id: created.upload.id,
        path: created.upload.path,
        parts: [
          {
            number: 1,
            checksum_etag: etag,
            checksum_sha256_base64: sha256base64,
          },
        ],
      },
    },
  )

  if (completeError) {
    return { success: false, error: JSON.stringify(completeError) }
  }

  return { success: true, fileId: completed.id }
}

/**
 * Convenience wrapper for uploading a product_media file (cover image).
 * Returns the legacy `mediaId` field expected by callers that pass the id
 * back into `ProductCreate.medias`.
 */
export async function uploadProductMedia(args: {
  api: Client
  organizationId: string
  bytes: Uint8Array
  filename: string
  mimeType: string
}): Promise<
  { success: true; mediaId: string } | { success: false; error: string }
> {
  const result = await uploadFile({ ...args, service: 'product_media' })
  if (!result.success) return result
  return { success: true, mediaId: result.fileId }
}
