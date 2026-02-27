'use client'

import ClaudeCodeIcon from '@/components/Icons/frameworks/claude-code'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import Button from '@spaire/ui/components/atoms/Button'
import { useCallback, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface ClaudeMeterSetupModalContentProps {
  hideModal: () => void
}

const SETUP_SNIPPET = `mkdir -p .claude/commands
curl -sL -o .claude/commands/setup-usage-billing.md \\
  https://cdn.spairehq.com/claude/commands/setup-usage-billing.md`

const RUN_SNIPPET = `cd your-project
claude

# Then type:
/setup-usage-billing`

const ClaudeMeterSetupModalContent = ({
  hideModal,
}: ClaudeMeterSetupModalContentProps) => {
  const [setupCopied, setSetupCopied] = useState(false)
  const [commandCopied, setCommandCopied] = useState(false)

  const handleCopySetup = useCallback(() => {
    navigator.clipboard.writeText(SETUP_SNIPPET)
    setSetupCopied(true)
    setTimeout(() => setSetupCopied(false), 2500)
  }, [])

  const handleCopyCommand = useCallback(() => {
    navigator.clipboard.writeText('/setup-usage-billing')
    setCommandCopied(true)
    setTimeout(() => setCommandCopied(false), 2500)
  }, [])

  return (
    <SyntaxHighlighterProvider>
      <div className="flex flex-col gap-y-6 overflow-y-auto px-8 py-10">
        <div className="flex flex-col gap-y-4">
          <div className="flex items-center gap-x-3">
            <ClaudeCodeIcon size={32} />
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
              Usage Billing
            </span>
          </div>
          <h2 className="text-lg">Set up with Claude</h2>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Claude detects your stack, creates meters, writes ingestion code,
            and wires up metered pricing — all interactively in your codebase.
          </p>
        </div>

        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between">
            <h3 className="text-sm font-medium">
              1. Add the command file
            </h3>
            <CopyButton
              copied={setupCopied}
              onCopy={handleCopySetup}
            />
          </div>
          <div className="dark:border-polar-700 dark:bg-polar-800 w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
            <SyntaxHighlighterClient lang="bash" code={SETUP_SNIPPET} />
          </div>
        </div>

        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row items-center justify-between">
            <h3 className="text-sm font-medium">
              2. Run the agent
            </h3>
            <CopyButton
              copied={commandCopied}
              onCopy={handleCopyCommand}
            />
          </div>
          <div className="dark:border-polar-700 dark:bg-polar-800 w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
            <SyntaxHighlighterClient lang="bash" code={RUN_SNIPPET} />
          </div>
          <p className="dark:text-polar-500 text-xs text-gray-400">
            Open Claude Code inside your project directory, then type the
            command. The agent creates meters, writes ingestion code, and sets
            up metered pricing for you.
          </p>
        </div>

        <div className="mt-2 flex flex-row items-center gap-x-4">
          <Button
            variant="ghost"
            className="self-start"
            onClick={hideModal}
          >
            Close
          </Button>
        </div>
      </div>
    </SyntaxHighlighterProvider>
  )
}

const CopyButton = ({
  copied,
  onCopy,
}: {
  copied: boolean
  onCopy: () => void
}) => (
  <button
    onClick={onCopy}
    className={twMerge(
      'flex items-center gap-x-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
      copied
        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
        : 'dark:bg-polar-800 dark:text-polar-200 dark:hover:bg-polar-700 bg-gray-100 text-gray-600 hover:bg-gray-200',
    )}
  >
    {copied ? (
      <>
        <CheckOutlined sx={{ fontSize: 14 }} />
        Copied
      </>
    ) : (
      <>
        <ContentCopyOutlined sx={{ fontSize: 14 }} />
        Copy
      </>
    )}
  </button>
)

export default ClaudeMeterSetupModalContent
