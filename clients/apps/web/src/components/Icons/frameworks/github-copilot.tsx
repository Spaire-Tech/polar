const GitHubCopilotIcon = ({ size = 40 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="6" fill="#1B2332" />
      {/* Copilot helmet / visor silhouette */}
      <path
        d="M16 5C11.582 5 8 8.582 8 13C8 15.5 9.12 17.74 10.9 19.25C10.96 19.3 11 19.37 11 19.45V22C11 22.552 11.448 23 12 23H14V25C14 25.552 14.448 26 15 26H17C17.552 26 18 25.552 18 25V23H20C20.552 23 21 22.552 21 22V19.45C21 19.37 21.04 19.3 21.1 19.25C22.88 17.74 24 15.5 24 13C24 8.582 20.418 5 16 5Z"
        fill="white"
        opacity="0.15"
      />
      {/* Visor / eyes */}
      <path
        d="M12 13C12 11.343 13.343 10 15 10H17C18.657 10 20 11.343 20 13V14C20 15.105 19.105 16 18 16H14C12.895 16 12 15.105 12 14V13Z"
        fill="white"
      />
      {/* Left eye glint */}
      <circle cx="14" cy="13" r="1" fill="#1B2332" />
      {/* Right eye glint */}
      <circle cx="18" cy="13" r="1" fill="#1B2332" />
      {/* Body / neck area */}
      <path
        d="M13 17H19V21C19 22.105 18.105 23 17 23H15C13.895 23 13 22.105 13 21V17Z"
        fill="white"
        opacity="0.6"
      />
    </svg>
  )
}

export default GitHubCopilotIcon
