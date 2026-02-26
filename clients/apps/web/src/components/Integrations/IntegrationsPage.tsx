'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Link from 'next/link'
import { useContext } from 'react'
import BetterAuthIcon from '../Icons/frameworks/better-auth'
import BoltIcon from '../Icons/frameworks/bolt'
import ExpressIcon from '../Icons/frameworks/express'
import LovableIcon from '../Icons/frameworks/lovable'
import NextJsIcon from '../Icons/frameworks/nextjs'
import PhpIcon from '../Icons/frameworks/php'
import PythonIcon from '../Icons/frameworks/python'
import ReplitIcon from '../Icons/frameworks/replit'
import SupabaseIcon from '../Icons/frameworks/supabase'
import V0Icon from '../Icons/frameworks/v0'
import { ALL_INTEGRATIONS, type Integration } from './integrations'

const INTEGRATION_ICONS: Record<string, React.ReactNode> = {
  nextjs: <NextJsIcon size={36} />,
  lovable: <LovableIcon size={36} />,
  supabase: <SupabaseIcon size={36} />,
  v0: <V0Icon size={36} />,
  replit: <ReplitIcon size={36} />,
  bolt: <BoltIcon size={36} />,
  'better-auth': <BetterAuthIcon size={36} />,
  express: <ExpressIcon size={36} />,
  'python-sdk': <PythonIcon size={36} />,
  'php-sdk': <PhpIcon />,
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'ai-builder': {
    bg: 'bg-violet-50 dark:bg-violet-500/10',
    text: 'text-violet-600 dark:text-violet-400',
  },
  backend: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  framework: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
  },
  auth: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
  },
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const { organization } = useContext(OrganizationContext)
  const icon = INTEGRATION_ICONS[integration.slug]
  const colors = CATEGORY_COLORS[integration.category] ?? {
    bg: 'bg-gray-50 dark:bg-polar-800',
    text: 'text-gray-600 dark:text-polar-400',
  }
  const isComingSoon = integration.comingSoon

  const content = (
    <div
      className={`group dark:border-polar-700 flex flex-col gap-y-5 rounded-2xl border border-gray-200 p-6 transition-all ${
        isComingSoon
          ? 'cursor-default opacity-60'
          : 'dark:hover:border-polar-600 hover:border-gray-300 hover:shadow-md dark:hover:shadow-none'
      }`}
    >
      <div className="flex flex-row items-start justify-between">
        <div className="flex items-center gap-x-3">
          <div className={isComingSoon ? 'grayscale' : ''}>{icon}</div>
          <div className="flex flex-col gap-y-0.5">
            <h3 className="text-base font-medium dark:text-white">
              {integration.name}
            </h3>
            <span className={`text-[11px] font-medium ${isComingSoon ? 'dark:text-polar-500 text-gray-400' : colors.text}`}>
              {integration.categoryLabel}
            </span>
          </div>
        </div>
        {isComingSoon ? (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:bg-polar-800 dark:text-polar-400">
            Coming Soon
          </span>
        ) : (
          <ArrowOutwardOutlined className="h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500 dark:text-polar-600 dark:group-hover:text-polar-400" />
        )}
      </div>

      <p className="dark:text-polar-400 text-sm leading-relaxed text-gray-500">
        {integration.description}
      </p>

      <div className="flex flex-row items-center gap-x-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            isComingSoon
              ? 'bg-gray-50 text-gray-400 dark:bg-polar-800 dark:text-polar-500'
              : `${colors.bg} ${colors.text}`
          }`}
        >
          {integration.categoryLabel}
        </span>
      </div>
    </div>
  )

  if (isComingSoon) {
    return content
  }

  return (
    <Link
      href={`/dashboard/${organization.slug}/integrations/${integration.slug}`}
    >
      {content}
    </Link>
  )
}

export default function IntegrationsPage() {
  return (
    <DashboardBody title="Integrations">
      <div className="flex flex-col gap-y-2">
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Connect Spaire to your favorite tools. Copy a prompt, paste it into
          your AI builder, or integrate with our SDK — and start accepting
          payments in minutes.
        </p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ALL_INTEGRATIONS.map((integration) => (
          <IntegrationCard key={integration.slug} integration={integration} />
        ))}
      </div>
    </DashboardBody>
  )
}
