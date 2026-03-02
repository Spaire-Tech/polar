const CursorIcon = ({ size = 40 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#1C1C1C" />
      {/* Cursor arrow pointer shape */}
      <path
        d="M9 6L9 22.5L13.2 18.3L16.5 25.5L19.2 24.3L15.9 17.1L22.5 17.1L9 6Z"
        fill="white"
      />
    </svg>
  )
}

export default CursorIcon
