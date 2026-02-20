import { MouseEventHandler } from 'react'

const Tab = (props: {
  active: boolean
  children: React.ReactNode
  onClick?: MouseEventHandler
}) => {
  return (
    <div
      onClick={props.onClick}
      className={
        'w-full flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-sm transition-all duration-100 ' +
        (props.active
          ? 'bg-white/[0.08] text-white drop-shadow-sm hover:bg-white/[0.1]'
          : 'bg-transparent text-polar-400 hover:bg-white/[0.04] hover:text-polar-200')
      }
    >
      {props.children}
    </div>
  )
}
export default Tab
