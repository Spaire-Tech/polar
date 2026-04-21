import { ForceLightMode } from '@/components/Profile/ForceLightMode'
import React from 'react'

export default async function Layout(props: {
  children: React.ReactNode
}) {
  const { children } = props

  return (
    <>
      <ForceLightMode />
      {children}
    </>
  )
}
