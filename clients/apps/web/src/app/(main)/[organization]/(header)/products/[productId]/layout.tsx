import React from 'react'

export default function ProductDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          [data-profile-card] { display: none !important; }
        }
      `}</style>
      {children}
    </>
  )
}
