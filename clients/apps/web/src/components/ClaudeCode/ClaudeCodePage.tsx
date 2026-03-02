'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Link from 'next/link'
import { useContext } from 'react'
import ClaudeCodeIcon from '../Icons/frameworks/claude-code'
import CursorIcon from '../Icons/frameworks/cursor'
import CodexIcon from '../Icons/frameworks/codex'
import GitHubCopilotIcon from '../Icons/frameworks/github-copilot'
import { ALL_AGENT_PLATFORMS, type AgentPlatform } from './agentPlatforms'

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  'claude-code': <ClaudeCodeIcon size={36} />,
  cursor: <CursorIcon size={36} />,
  codex: <CodexIcon size={36} />,
  'github-copilot': <GitHubCopilotIcon size={36} />,
}

function AgentPlatformCard({ platform }: { platform: AgentPlatform }) {
  const { organization } = useContext(OrganizationContext)
  const icon = PLATFORM_ICONS[platform.slug]

  return (
    <Link href={`/dashboard/${organization.slug}/integrations/${platform.slug}`}>
      <div className="group dark:border-spaire-700 dark:hover:border-spaire-600 flex flex-col gap-y-5 rounded-2xl border border-gray-200 p-6 transition-all hover:border-gray-300 hover:shadow-md dark:hover:shadow-none">
        <div className="flex flex-row items-start justify-between">
          <div className="flex items-center gap-x-3">
            <div>{icon}</div>
            <div className="flex flex-col gap-y-0.5">
              <h3 className="text-base font-medium dark:text-white">
                {platform.name}
              </h3>
              <span className={`text-[11px] font-medium ${platform.categoryColor}`}>
                {platform.categoryLabel}
              </span>
            </div>
          </div>
          <ArrowOutwardOutlined className="dark:text-spaire-600 dark:group-hover:text-spaire-400 h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500" />
        </div>

        <p className="dark:text-spaire-400 text-sm leading-relaxed text-gray-500">
          {platform.description}
        </p>

        <div className="flex flex-row items-center gap-x-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${platform.categoryBg} ${platform.categoryColor}`}
          >
            {platform.categoryLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ClaudeCodePage() {
  return (
    <DashboardBody title="Agent Install">
      <div className="flex flex-col gap-y-2">
        <p className="dark:text-spaire-500 text-sm text-gray-500">
          Choose your AI coding agent. Each one can read your codebase and wire
          up Spaire checkout or usage billing directly in your project.
        </p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {ALL_AGENT_PLATFORMS.map((platform) => (
          <AgentPlatformCard key={platform.slug} platform={platform} />
        ))}
      </div>
    </DashboardBody>
  )
}
