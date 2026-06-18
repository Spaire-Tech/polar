'use client'

import { schemas } from '@spaire/client'
import { usePortalTheme } from '../usePortalTheme'
import './portal-auth.css'

const MoonIcon = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
)

const SunIcon = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2v2.6M12 19.4V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.6M19.4 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
  </svg>
)

/**
 * The persistent shell for the customer portal sign-in flow.
 *
 * Left: the creator's photo (org-level `customer_portal_sign_in_image_url`,
 * which the API already resolves to the most recent course thumbnail when the
 * creator hasn't uploaded one). It stays put across every step. Right: the
 * active step (email / code / success), passed as `children`.
 */
export const PortalAuthScene = ({
  organization,
  children,
}: {
  organization: schemas['CustomerOrganization']
  children: React.ReactNode
}) => {
  // No session token on the sign-in screens — the toggle still reads the
  // creator's cached/derived theme and stays in sync with the shell.
  const { dark, toggle } = usePortalTheme(organization.slug, '')
  const imageUrl = organization.customer_portal_sign_in_image_url
  const imagePosition =
    organization.customer_portal_sign_in_image_position ?? undefined

  return (
    <div className="spauth">
      <div
        className="spauth-visual"
        {...(imageUrl ? { 'data-filled': '' } : {})}
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="spauth-visual-img"
            src={imageUrl}
            alt=""
            aria-hidden="true"
            style={
              imagePosition ? { objectPosition: imagePosition } : undefined
            }
          />
        )}
        <div className="spauth-scrim" />
        <div className="spauth-foot">
          <div className="spauth-mark">{organization.name}</div>
          <div className="spauth-line">Welcome back.</div>
        </div>
      </div>

      <div className="spauth-panel">
        <div className="spauth-topbar">
          <button
            type="button"
            className="spauth-toggle"
            onClick={toggle}
            aria-label="Toggle appearance"
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <div className="spauth-stage">
          <div className="spauth-inner">{children}</div>
        </div>
      </div>
    </div>
  )
}
