const ClaudeCodeIcon = ({ size = 40 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#D97757" />
      <path
        d="M18.2 8.4L11.6 23.6H14.1L15.8 19.4H20.6L22.3 23.6H24.8L18.2 8.4ZM16.6 17.2L18.2 13.1L19.8 17.2H16.6Z"
        fill="white"
      />
      <path
        d="M8.8 17.8C9.4 17.8 9.9 17.3 9.9 16.7C9.9 16.1 9.4 15.6 8.8 15.6C8.2 15.6 7.7 16.1 7.7 16.7C7.7 17.3 8.2 17.8 8.8 17.8Z"
        fill="white"
      />
    </svg>
  )
}

export default ClaudeCodeIcon
