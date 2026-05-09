'use client'

export const FormTab = () => (
  <div className="wg-tab">
    <p className="wg-help">
      Collect anything — emails, requests, RSVPs. Add fields and logic later.
    </p>
    <div className="wg-grid one">
      <div
        className="wg-card create"
        style={{ cursor: 'default', minHeight: 96 }}
      >
        <div
          className="wg-art"
          style={{ background: 'linear-gradient(135deg, #2a2a2a, #555)' }}
        >
          ✎
        </div>
        <div className="wg-meta">
          <div className="wg-card-title">Forms — coming soon</div>
          <div className="wg-card-sub">
            We&apos;re building forms next. Drop a note in feedback if there&apos;s
            a specific use case you need.
          </div>
        </div>
      </div>
    </div>
  </div>
)
