import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import AutoFixHighOutlined from '@mui/icons-material/AutoFixHighOutlined'
import { schemas } from '@spaire/client'
import { ReactNode, useCallback, useState } from 'react'
import { FileRejection } from 'react-dropzone'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../../FileUpload'
import { toast } from '../../Toast/use-toast'
import { FileList } from './FileList'
import { ProductMockupGenerator } from './ProductMockupGenerator'

const DropzoneView = ({
  isDragActive,
  children,
}: {
  isDragActive: boolean
  children: ReactNode
}) => {
  return (
    <>
      <div
        className={twMerge(
          'flex aspect-video w-full cursor-pointer items-center justify-center rounded-2xl border border-transparent px-4',
          isDragActive
            ? 'dark:border-spaire-700 dark:bg-spaire-950 border-blue-100 bg-blue-50'
            : 'dark:border-spaire-700 bg-gray-100 dark:bg-transparent',
        )}
      >
        <div className="dark:text-spaire-500 text-center text-gray-500">
          <div className="mb-4">
            <AddPhotoAlternateOutlined fontSize="medium" />
          </div>
          <p className="dark:text-spaire-200 text-xs font-medium text-gray-700">
            {isDragActive ? "Drop it like it's hot" : 'Add product media'}
          </p>
          <p className="mt-2 text-xs">
            Up to 10MB each. 16:9 ratio recommended for optimal display.
          </p>
        </div>
        {children}
      </div>
    </>
  )
}

interface ProductMediasFieldProps {
  organization: schemas['Organization']
  value: schemas['ProductMediaFileRead'][] | undefined
  onChange: (value: schemas['ProductMediaFileRead'][]) => void
}

const ProductMediasField = ({
  organization,
  value,
  onChange,
}: ProductMediasFieldProps) => {
  const [mockupOpen, setMockupOpen] = useState(false)

  const onFilesUpdated = useCallback(
    (files: FileObject<schemas['ProductMediaFileRead']>[]) => {
      onChange(files.filter((file) => file.is_uploaded).map((file) => file))
    },
    [onChange],
  )

  const [filesRejected, setFilesRejected] = useState<FileRejection[]>([])

  const {
    files,
    setFiles,
    removeFile,
    uploadFile,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useFileUpload({
    organization: organization,
    service: 'product_media',
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'image/webp': [],
      'image/svg+xml': [],
    },
    maxSize: 10 * 1024 * 1024,
    onFilesUpdated,
    onFilesRejected: setFilesRejected,
    onFileError: (_, error) => {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file. Please try again.',
      })
    },
    initialFiles: value || [],
  })

  return (
    <>
      <div className="grid grid-cols-2 gap-3 [&>div>*]:aspect-video">
        <FileList files={files} setFiles={setFiles} removeFile={removeFile} />
        <div {...getRootProps()}>
          <DropzoneView isDragActive={isDragActive}>
            <input {...getInputProps()} />
          </DropzoneView>
        </div>
      </div>

      {/* Generate Mockup button */}
      <button
        type="button"
        onClick={() => setMockupOpen(true)}
        className="dark:border-spaire-700 dark:text-spaire-300 dark:hover:border-spaire-600 dark:hover:bg-spaire-800 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-2.5 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700"
      >
        <AutoFixHighOutlined fontSize="small" />
        Generate Mockup
      </button>

      {filesRejected.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-100 p-4 text-red-800 dark:border-red-800 dark:bg-red-900 dark:text-red-200">
          {filesRejected.map((file) => (
            <p key={file.file.name}>
              {file.file.name} is not a valid image or is too large.
            </p>
          ))}
        </div>
      )}

      <ProductMockupGenerator
        open={mockupOpen}
        onClose={() => setMockupOpen(false)}
        onUploadFile={uploadFile}
      />
    </>
  )
}

export default ProductMediasField
