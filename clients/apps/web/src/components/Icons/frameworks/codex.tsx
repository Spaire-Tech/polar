const CodexIcon = ({ size = 40 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#000000" />
      {/* OpenAI-style geometric mark — simplified rotating polygon */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 5.5C10.201 5.5 5.5 10.201 5.5 16C5.5 21.799 10.201 26.5 16 26.5C21.799 26.5 26.5 21.799 26.5 16C26.5 10.201 21.799 5.5 16 5.5ZM16 8C11.582 8 8 11.582 8 16C8 20.418 11.582 24 16 24C20.418 24 24 20.418 24 16C24 11.582 20.418 8 16 8Z"
        fill="white"
        opacity="0.3"
      />
      <path
        d="M20.485 10.101L16 7.5L11.515 10.101V15.303L16 12.701L20.485 15.303V10.101Z"
        fill="white"
      />
      <path
        d="M22 13.25L17.515 15.852L22 18.454V13.25Z"
        fill="white"
        opacity="0.6"
      />
      <path
        d="M10 13.25V18.454L14.485 15.852L10 13.25Z"
        fill="white"
        opacity="0.6"
      />
      <path
        d="M20.485 21.899V16.697L16 19.299L11.515 16.697V21.899L16 24.5L20.485 21.899Z"
        fill="white"
      />
    </svg>
  )
}

export default CodexIcon
