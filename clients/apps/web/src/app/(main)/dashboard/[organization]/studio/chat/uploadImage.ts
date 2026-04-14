import type { Client } from '@spaire/client'

type UploadResult =
  | { success: true; mediaId: string }
  | { success: false; error: string }

/**
 * Upload raw image bytes to Polar as a product_media file.
 *
 * Studio-generated cover images are small (single 1024x1024 PNG, well under
 * the 10MB chunk size used for large uploads), so we use a single-part
 * upload to keep the flow simple.
 */
export async function uploadProductMedia({
  api,
  organizationId,
  bytes,
  filename,
  mimeType,
}: {
  api: Client
  organizationId: string
  bytes: Uint8Array
  filename: string
  mimeType: string
}): Promise<UploadResult> {
  // Copy into a fresh ArrayBuffer. The Uint8Array returned by the AI SDK
  // is typed as ArrayBufferLike (may back onto a SharedArrayBuffer), which
  // is not assignable to BlobPart / BufferSource. Copying guarantees a plain
  // ArrayBuffer that works with both crypto.subtle and Blob / fetch.
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
      service: 'product_media',
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

  return { success: true, mediaId: completed.id }
}
