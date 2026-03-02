import Image from 'next/image'

// TODO: download the official Cursor logo and save as /public/cursor-icon.png
// Source: https://cursor.com/brand
const CursorIcon = ({ size = 40 }: { size?: number }) => {
  return (
    <Image
      src="/cursor-icon.png"
      alt="Cursor"
      width={size}
      height={size}
      className="rounded-sm"
    />
  )
}

export default CursorIcon
