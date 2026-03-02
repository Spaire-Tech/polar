import Image from 'next/image'

// TODO: download the official GitHub Copilot logo and save as /public/github-copilot-icon.png
// Source: https://github.com/logos  (look for the Copilot icon specifically)
const GitHubCopilotIcon = ({ size = 40 }: { size?: number }) => {
  return (
    <Image
      src="/github-copilot-icon.png"
      alt="GitHub Copilot"
      width={size}
      height={size}
      className="rounded-sm"
    />
  )
}

export default GitHubCopilotIcon
