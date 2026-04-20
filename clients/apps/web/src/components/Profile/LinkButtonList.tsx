'use client'

import { getServerURL } from '@/utils/api'
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import EmailOutlined from '@mui/icons-material/EmailOutlined'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import PlayCircleOutlined from '@mui/icons-material/PlayCircleOutlined'
import ShoppingBagOutlined from '@mui/icons-material/ShoppingBagOutlined'
import { useQuery } from '@tanstack/react-query'

interface PublicLink {
  id: string
  label: string
  url: string
  icon: string | null
}

const getLinkIcon = (icon: string | null) => {
  const cls = 'h-5 w-5 shrink-0'
  switch (icon) {
    case 'calendar':
      return <CalendarTodayOutlined className={cls} />
    case 'email':
      return <EmailOutlined className={cls} />
    case 'document':
      return <DescriptionOutlined className={cls} />
    case 'video':
      return <PlayCircleOutlined className={cls} />
    case 'shop':
      return <ShoppingBagOutlined className={cls} />
    default:
      return <LinkOutlined className={cls} />
  }
}

export const LinkButtonList = ({ slug }: { slug: string }) => {
  const { data: links } = useQuery({
    queryKey: ['public_organization_links', slug],
    queryFn: async () => {
      const res = await fetch(
        getServerURL(`/v1/organization-links/public/${slug}`),
        { credentials: 'include' },
      )
      if (!res.ok) return [] as PublicLink[]
      return (await res.json()) as PublicLink[]
    },
    retry: false,
  })

  if (!links || links.length === 0) return null

  return (
    <div className="mt-4 flex flex-col gap-2">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-row items-center gap-x-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] font-medium text-gray-900 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          {getLinkIcon(link.icon)}
          <span className="flex-1 truncate">{link.label}</span>
        </a>
      ))}
    </div>
  )
}
