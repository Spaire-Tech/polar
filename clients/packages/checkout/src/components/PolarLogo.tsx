const PolarLogo = ({
  className,
  width,
  height,
}: {
  className?: string
  width?: number
  height?: number
}) => {
  return (
    <img
      src="https://spaire-production-files-public.s3.us-east-1.amazonaws.com/logotype-spaire.png"
      alt="Spaire"
      className={className}
      width={width}
      height={height}
    />
  )
}

export default PolarLogo
