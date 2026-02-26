'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import Link from 'next/link'
import { useCallback, useContext, useState } from 'react'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import { FadeUp } from '../Animated/FadeUp'
import ClaudeCodeIcon from '../Icons/frameworks/claude-code'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { ALL_AGENT_COMMANDS, type AgentCommand } from './agentCommands'

export default function ClaudeCodePage() {
  const { organization } = useContext(OrganizationContext)
  const [installCopied, setInstallCopied] = useState(false)
  const handleCopyInstall = useCallback(() => {
    navigator.clipboard.writeText('npm install -g @anthropic-ai/claude-code')
    setInstallCopied(true)
    setTimeout(() => setInstallCopied(false), 2500)
  }, [])

  return (
    <SyntaxHighlighterProvider>
      <DashboardBody title="Claude Code">
        <div className="flex flex-col gap-12">
          {/* Hero */}
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ duration: 1, staggerChildren: 0.15 }}
            className="flex flex-col gap-8"
          >
            <FadeUp className="flex flex-col gap-y-4">
              <div className="flex items-center gap-x-3">
                <ClaudeCodeIcon size={40} />
                <h2 className="text-xl font-medium tracking-tight">
                  Claude Code
                </h2>
              </div>
              <p className="dark:text-polar-400 max-w-lg text-sm leading-relaxed text-gray-500">
                Add Spaire agent commands to your project, then run them inside
                Claude Code. Each command reads your codebase, asks a few
                questions, and writes production code directly into your
                project.
              </p>
            </FadeUp>

            {/* Install */}
            <FadeUp className="flex flex-col gap-y-3">
              <div className="flex flex-row items-center justify-between">
                <span className="dark:text-polar-500 text-xs font-medium uppercase tracking-wider text-gray-400">
                  Install
                </span>
                <button
                  onClick={handleCopyInstall}
                  className={twMerge(
                    'flex items-center gap-x-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                    installCopied
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'dark:bg-polar-800 dark:text-polar-200 dark:hover:bg-polar-700 bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                >
                  {installCopied ? (
                    <>
                      <CheckOutlined sx={{ fontSize: 12 }} />
                      Copied
                    </>
                  ) : (
                    <>
                      <ContentCopyOutlined sx={{ fontSize: 12 }} />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="dark:border-polar-700 dark:bg-polar-800 w-full max-w-lg rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm">
                <SyntaxHighlighterClient
                  lang="bash"
                  code="npm install -g @anthropic-ai/claude-code"
                />
              </div>
            </FadeUp>

          </motion.div>

          {/* Agent command cards */}
          <motion.div
            initial="hidden"
            animate="visible"
            transition={{ duration: 1, staggerChildren: 0.1, delayChildren: 0.3 }}
            className="flex flex-col gap-6"
          >
            <FadeUp>
              <span className="dark:text-polar-500 text-xs font-medium uppercase tracking-wider text-gray-400">
                Agent Commands
              </span>
            </FadeUp>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {ALL_AGENT_COMMANDS.map((cmd) => (
                <FadeUp key={cmd.slug}>
                  <AgentCommandCard
                    command={cmd}
                    orgSlug={organization.slug}
                  />
                </FadeUp>
              ))}
            </div>
          </motion.div>
        </div>
      </DashboardBody>
    </SyntaxHighlighterProvider>
  )
}

function AgentCommandCard({
  command,
  orgSlug,
}: {
  command: AgentCommand
  orgSlug: string
}) {
  return (
    <Link href={`/dashboard/${orgSlug}/claude-code/${command.slug}`}>
      <div className="group dark:border-polar-700 dark:hover:border-polar-600 flex flex-col gap-y-4 rounded-2xl border border-gray-200 p-6 transition-all hover:border-gray-300 hover:shadow-md dark:hover:shadow-none">
        <div className="flex flex-row items-start justify-between">
          <div className="flex flex-col gap-y-1">
            <h3 className="text-base font-medium dark:text-white">
              {command.name}
            </h3>
            <code className="dark:text-polar-400 text-xs text-gray-500">
              {command.command}
            </code>
          </div>
          <ArrowOutwardOutlined className="dark:text-polar-600 dark:group-hover:text-polar-400 h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500" />
        </div>
        <p className="dark:text-polar-400 text-sm leading-relaxed text-gray-500">
          {command.description}
        </p>
        <div className="flex flex-row flex-wrap gap-2">
          {command.howItWorks.map((step, i) => (
            <span
              key={i}
              className="dark:bg-polar-800 dark:text-polar-400 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500"
            >
              {step.title}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
