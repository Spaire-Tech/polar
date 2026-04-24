'use client'

import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined'

export function PaywallRow({ onEditSettings }: { onEditSettings?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-indigo-50/60 px-4 py-3 text-sm">
      <DragIndicatorOutlined className="text-indigo-400" fontSize="small" />
      <span className="font-semibold text-indigo-700">Paywall</span>
      <span className="text-gray-400">•</span>
      <span className="text-gray-600">
        Members with the limited access product can only view content above
        paywall
      </span>
      <span className="text-gray-400">•</span>
      <button
        onClick={onEditSettings}
        className="font-medium text-gray-900 underline hover:text-gray-700"
      >
        Edit Settings
      </button>
    </div>
  )
}
