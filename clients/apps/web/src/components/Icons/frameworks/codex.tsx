import Image from 'next/image'

// TODO: download the official OpenAI logo and save as /public/openai-icon.png
// Source: https://openai.com/brand  (use the icon/mark, not the wordmark)
const CodexIcon = ({ size = 40 }: { size?: number }) => {
  return (
    <Image
      src="/openai-icon.png"
      alt="OpenAI Codex"
      width={size}
      height={size}
      className="rounded-sm"
    />
  )
}

export default CodexIcon
