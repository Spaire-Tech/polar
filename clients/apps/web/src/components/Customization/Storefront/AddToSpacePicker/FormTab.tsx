'use client'

import EditOutlined from '@mui/icons-material/EditOutlined'

// Form blocks aren't shipping yet. The user wants the tab visible so
// the design intent is preserved, but it's a stub.

export const FormTab = () => (
  <div className="atsp-tab-panel">
    <p className="atsp-help">
      Collect emails, requests, or feedback. Add fields and logic later.
    </p>
    <div className="atsp-pill-card create static">
      <div
        className="atsp-art"
        style={{ background: 'linear-gradient(135deg, #2a2a2a, #555)' }}
      >
        <EditOutlined style={{ fontSize: 18 }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="atsp-tile-title">Forms — coming soon</div>
        <div className="atsp-tile-sub">
          We&apos;re building forms next. Drop a note in feedback if there&apos;s
          a specific use case you need.
        </div>
      </div>
    </div>
  </div>
)
