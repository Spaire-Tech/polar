const CursorIcon = ({ size = 40 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#0D0D0D" />
      {/* Classic cursor pointer arrow — Cursor's signature mark */}
      <path
        d="M 10 5 L 10 22 L 13.5 19 L 17 26.5 L 19.5 25 L 16 18.5 L 22 18.5 Z"
        fill="white"
      />
    </svg>
  )
}

export default CursorIcon
