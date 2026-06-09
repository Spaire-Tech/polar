'use client'

import { Upload } from '@/components/FileUpload/Upload'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import { schemas } from '@spaire/client'
import Button from '@spaire/ui/components/atoms/Button'
import { useCallback, useRef, useState } from 'react'

export interface FormImageUploadProps {
  organization: schemas['Organization']
  imageUrl: string | null
  onChange: (imageUrl: string | null) => void
}

export const FormImageUpload = ({
  organization,
  imageUrl,
  onChange,
}: FormImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleFile = useCallback(
    (file: File) => {
      setUploading(true)
      setProgress(0)
      const upload = new Upload({
        organization,
        service: 'product_media',
        file,
        onFileProcessing: () => {},
        onFileCreate: () => {},
        onFileUploadProgress: (f, uploaded) => {
          if (f.size > 0) setProgress(Math.round((uploaded / f.size) * 100))
        },
        onFileUploaded: (response) => {
          setUploading(false)
          setProgress(100)
          onChange((response as schemas['ProductMediaFileRead']).public_url)
        },
        onFileError: () => setUploading(false),
      })
      upload.run().catch(() => setUploading(false))
    },
    [organization, onChange],
  )

  return (
    <div className="flex flex-col gap-2">
      {imageUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Cover"
            className="h-40 w-full object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onChange(null)}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-8 text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
        >
          <ImageOutlined />
          <span className="text-sm">
            {uploading ? `Uploading… ${progress}%` : 'Upload a cover image'}
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
