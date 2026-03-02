const GitHubCopilotIcon = ({ size = 40 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#1B1F27" />
      {/*
        GitHub Copilot face — circular head with paired circular eyes
        and a gentle arc forming the helmet/visor.
      */}
      {/* Outer head circle */}
      <circle cx="16" cy="15.5" r="9" fill="#6E57CC" />
      {/* Visor bar */}
      <rect x="9" y="12" width="14" height="5.5" rx="2.75" fill="#1B1F27" />
      {/* Left eye */}
      <circle cx="12.5" cy="14.75" r="2" fill="white" />
      {/* Right eye */}
      <circle cx="19.5" cy="14.75" r="2" fill="white" />
      {/* Chin / lower face */}
      <path
        d="M 10.5 18 Q 10 22 13 24 L 19 24 Q 22 22 21.5 18 Z"
        fill="#6E57CC"
      />
    </svg>
  )
}

export default GitHubCopilotIcon
