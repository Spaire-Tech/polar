import { twMerge } from 'tailwind-merge'

const LogoType70 = ({ className }: { className?: string }) => {
  return (
    <img
      src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/logotype-spaire.png"
      alt="Spaire"
      width={198}
      height={70}
      className={twMerge(className ? className : '')}
    />
  )
}

export default LogoType70
