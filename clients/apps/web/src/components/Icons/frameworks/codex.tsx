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
      {/*
        OpenAI Blossom — 6 overlapping ellipses at 60° intervals around center.
        Each petal rotates around (16, 16). Where petals overlap the opacity
        adds up to ~1.0, leaving the outer petals at ~0.75.
      */}
      <ellipse
        cx="16" cy="9.5" rx="2.8" ry="6.5"
        fill="white" opacity="0.75"
        transform="rotate(0 16 16)"
      />
      <ellipse
        cx="16" cy="9.5" rx="2.8" ry="6.5"
        fill="white" opacity="0.75"
        transform="rotate(60 16 16)"
      />
      <ellipse
        cx="16" cy="9.5" rx="2.8" ry="6.5"
        fill="white" opacity="0.75"
        transform="rotate(120 16 16)"
      />
      <ellipse
        cx="16" cy="9.5" rx="2.8" ry="6.5"
        fill="white" opacity="0.75"
        transform="rotate(180 16 16)"
      />
      <ellipse
        cx="16" cy="9.5" rx="2.8" ry="6.5"
        fill="white" opacity="0.75"
        transform="rotate(240 16 16)"
      />
      <ellipse
        cx="16" cy="9.5" rx="2.8" ry="6.5"
        fill="white" opacity="0.75"
        transform="rotate(300 16 16)"
      />
    </svg>
  )
}

export default CodexIcon
