'use client'

import LockOutlined from '@mui/icons-material/LockOutlined'

export function PaywallRow({ onEditSettings }: { onEditSettings?: () => void }) {
  return (
    <div className="my-4 flex items-center gap-2.5 px-0.5">
      <div className="h-px flex-1 bg-gray-200" />
      <button
        onClick={onEditSettings}
        className="flex items-center gap-1 rounded-full border border-blue-900/15 bg-blue-50 px-2.5 py-1 text-[11px] font-medium tracking-tight text-[#0066cc] transition-colors hover:bg-blue-100"
      >
        <LockOutlined sx={{ fontSize: 12 }} />
        Paywall · Edit
      </button>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  )
}
