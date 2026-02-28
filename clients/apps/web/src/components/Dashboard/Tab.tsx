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
          ? 'dark:bg-spaire-500 dark:text-spaire-100 dark:hover:bg-spaire-400 bg-gray-50/90 text-gray-900 drop-shadow-sm hover:bg-gray-50 hover:text-gray-900 dark:hover:text-white'
          : 'dark:text-spaire-300 dark:hover:bg-spaire-600 dark:hover:text-spaire-200 bg-transparent text-gray-500 hover:bg-gray-50/50 hover:text-gray-900')
      }
    >
      {props.children}
    </div>
  )
}
export default Tab
