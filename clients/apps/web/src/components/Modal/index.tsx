import CloseOutlined from '@mui/icons-material/CloseOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import React, {
  FunctionComponent,
  MouseEvent,
  useCallback,
  useEffect,
  type JSX,
} from 'react'
import ReactDOM from 'react-dom'
import FocusLock from 'react-focus-lock'
import { twMerge } from 'tailwind-merge'

export interface ModalProps {
  title: string
  isShown: boolean
  hide: () => void
  modalContent: JSX.Element
  className?: string
}

export const Modal: FunctionComponent<ModalProps> = ({
  title,
  isShown,
  hide,
  modalContent,
  className,
}) => {
  const ref = React.useRef<HTMLDivElement>(null)

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const contains = ref.current?.contains(event.target as Node)

      if (event.keyCode === 27 && isShown && contains) {
        hide()
      }
    },
    [hide, isShown],
  )

  useEffect(() => {
    if (isShown) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
  }, [isShown, hide])

  const onInnerClick = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const modal = (
    <React.Fragment>
      <FocusLock>
        <div
          ref={ref}
          className="fixed top-0 right-0 bottom-0 left-0 z-50 overflow-hidden focus-within:outline-none dark:text-white"
          aria-modal
          tabIndex={-1}
          role="dialog"
          onKeyDown={onKeyDown}
        >
          <div
            className="flex h-full flex-col items-center bg-black/70 p-2 md:w-full"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              hide()
            }}
          >
            <div className="block h-20 w-2 lg:max-h-[10%] lg:grow-2"></div>
            <motion.div
              className={twMerge(
                'glass-panel-strong relative z-10 flex max-h-full w-full flex-col gap-y-1 overflow-x-hidden overflow-y-auto rounded-3xl border border-white/[0.08] p-1 shadow-sm lg:w-[800px] lg:max-w-full',
                className,
              )}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.1, ease: 'easeInOut' }}
              onClick={onInnerClick}
            >
              <div className="flex flex-row items-center justify-between pt-1 pr-1 pb-0 pl-4 text-sm">
                <span className="text-polar-500">
                  {title}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 rounded-full text-polar-500 hover:text-polar-400"
                  onClick={hide}
                >
                  <CloseOutlined fontSize="inherit" />
                </Button>
              </div>
              <div className="flex flex-col overflow-y-auto rounded-[20px] bg-white/[0.04]">
                {modalContent}
              </div>
            </motion.div>
          </div>
        </div>
      </FocusLock>
    </React.Fragment>
  )

  return isShown ? ReactDOM.createPortal(modal, document.body) : null
}

export const ModalHeader = (props: {
  children: React.ReactNode
  className?: string
  hide: () => void
}) => {
  return (
    <div
      className={twMerge(
        'flex w-full items-center justify-between border-b border-white/[0.06] bg-white/[0.06] px-5 py-3 text-polar-100',
        props.className,
      )}
    >
      <div>{props.children}</div>
      <CloseButton hide={props.hide} />
    </div>
  )
}

export const CloseButton = (props: {
  className?: string
  hide: () => void
}) => {
  return (
    <Button variant="ghost" size="icon" onClick={() => props.hide()}>
      <XIcon />
    </Button>
  )
}

const XIcon = () => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 18L18 6M6 6L18 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const ModalBox = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return (
    <div
      className={twMerge(
        'z-0 flex h-full w-full flex-col space-y-2 overflow-hidden rounded-2xl bg-white/[0.06] p-5 shadow-2xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
