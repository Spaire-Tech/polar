'use client'

import EditOutlined from '@mui/icons-material/EditOutlined'

// Form blocks aren't shipping yet. The user wants the tab visible so
// the design intent is preserved, but it's a stub.

export const FormTab = () => (
  <div className="flex flex-col gap-5 px-1 pt-2">
    <p className="text-sm text-gray-500">
      Collect emails, requests, or feedback. Add fields and logic later.
    </p>
    <div className="atsp-pill-card create" style={{ minHeight: 96, cursor: 'default' }}>
      <div
        className="atsp-art"
        style={{ background: 'linear-gradient(135deg, #2a2a2a, #555)' }}
      >
        <EditOutlined className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900">
          Forms — coming soon
        </div>
        <div className="truncate text-[12.5px] text-gray-500">
          We&apos;re building forms next. Drop a note in feedback if there&apos;s
          a specific use case you need.
        </div>
      </div>
    </div>
  </div>
)
