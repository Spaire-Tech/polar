interface Blob {
  color: string
  top: string
  left: string
  width: string
  height: string
  animation: string
}

interface MeshGradientProps {
  blobs: Blob[]
}

export const MeshGradient = ({ blobs }: MeshGradientProps) => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.13] dark:opacity-[0.06]"
  >
    {blobs.map((blob, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          top: blob.top,
          left: blob.left,
          width: blob.width,
          height: blob.height,
          background: blob.color,
          filter: 'blur(90px)',
          animation: blob.animation,
          willChange: 'transform',
        }}
      />
    ))}
  </div>
)

export const CATALOG_BLOBS: Blob[] = [
  {
    color: '#FBBF24',
    top: '-10%',
    left: '-8%',
    width: '520px',
    height: '520px',
    animation: 'mesh-a 28s 0s infinite alternate ease-in-out',
  },
  {
    color: '#F97316',
    top: '15%',
    left: '45%',
    width: '440px',
    height: '440px',
    animation: 'mesh-b 32s 5s infinite alternate ease-in-out',
  },
  {
    color: '#FDE047',
    top: '50%',
    left: '65%',
    width: '380px',
    height: '380px',
    animation: 'mesh-c 24s 10s infinite alternate ease-in-out',
  },
]
