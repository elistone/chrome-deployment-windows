import { useState, type CSSProperties } from 'react'

import { Methods } from '../../../app/components/Methods'
import { TextFormatter } from '../../../app/components/TextFormatter'
import type { SiteConfig } from '../../../app/config/types'
import ConfirmDelete from '../common/ConfirmDelete'
import { PencilIcon } from '../common/Icons'
import {
  faviconUrl,
  siteHost,
  siteHue,
  siteInitials,
} from './siteBranding'

/**
 * How an insert location reads back.
 *
 * A bare class name is shown with the leading dot it was entered without, so it
 * looks like the CSS it is - but a selector already carries its own `#`, `.` or
 * `[`, and prefixing that gave `.#repository-container-header`.
 */
function anchorLabel(value: string): string {
  const anchor = TextFormatter.toPlainText(value)
  return Methods.isSelector(anchor) ? anchor : `.${anchor}`
}

interface SiteCardProps {
  configKey: string
  patterns: string[]
  site: SiteConfig | undefined
  /** How many deployments reference this site, shown so deleting is informed. */
  usedBy: number
  editing: boolean
  onEdit: () => void
  onDelete: () => void
}

/**
 * The site's own favicon, from Chrome's cache.
 *
 * Falls back to initials in the site's accent colour whenever there is no icon
 * to show - outside an extension page, or for a site the browser has never
 * visited - so the card never has a hole in it.
 */
function SiteFavicon({ host, name }: { host: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  const url = faviconUrl(host)

  if (!url || failed) {
    // Initials come from the site key rather than the host: it is what the
    // card is titled with, and it is the name the user chose.
    return (
      <span className="dw-site-avatar" aria-hidden="true">
        {siteInitials(name)}
      </span>
    )
  }

  return (
    <img
      className="dw-site-avatar dw-site-avatar-image"
      src={url}
      alt=""
      width={20}
      height={20}
      onError={() => setFailed(true)}
    />
  )
}

export function SiteCard({
  configKey,
  patterns,
  site,
  usedBy,
  editing,
  onEdit,
  onDelete,
}: SiteCardProps) {
  const host = siteHost(patterns)
  const style = site?.style
  const spacing: [string, string | undefined][] = [
    ['l10nMargin', style?.margin],
    ['l10nPadding', style?.padding],
    ['l10nMaxWidth', style?.maxWidth],
  ]
  const hasSpacing = spacing.some(([, value]) => value)

  return (
    <article
      className="dw-card dw-site-card"
      // Only the hue is set here; the stylesheet turns it into a pair of
      // colours that stay legible in both themes.
      style={{ '--dw-site-hue': siteHue(configKey, host) } as CSSProperties}
    >
      <header className="dw-card-head">
        <div className="dw-site-identity">
          <SiteFavicon host={host} name={configKey} />
          <div className="dw-card-heading">
            <h3 className="dw-card-title">
              {TextFormatter.toPlainText(configKey)}
            </h3>
            <span className="dw-card-key">
              {host ?? Methods.i18n('l10nAnyHost')}
            </span>
          </div>
        </div>
        <span className="dw-site-count">
          {usedBy}{' '}
          {Methods.i18n(
            usedBy === 1 ? 'l10nDeploymentOne' : 'l10nDeploymentMany',
          )}
        </span>
      </header>

      {!site ? (
        <p className="dw-card-warning">
          {Methods.i18n('l10nNoDomainInformationSet')}
        </p>
      ) : (
        <>
          <section className="dw-card-section">
            <h4 className="dw-card-section-title">
              {Methods.i18n('l10nUrlPatterns')}
            </h4>
            <ul className="dw-list">
              {patterns.map((pattern, index) => (
                <li key={index} className="dw-mono">
                  {TextFormatter.toPlainText(pattern)}
                </li>
              ))}
            </ul>
          </section>

          <section className="dw-card-section">
            <h4 className="dw-card-section-title">
              {Methods.i18n('l10nInsertElements')}
            </h4>
            {/* A two column grid rather than inline pills, so the class names
                line up down the card instead of starting wherever the label
                before them happened to end. */}
            <dl className="dw-defs">
              {(site.insert ?? []).map((entry, index) => (
                <div className="dw-def" key={index}>
                  <dt>
                    {Methods.i18n(
                      entry.position === 'before'
                        ? 'l10nPositionBefore'
                        : 'l10nPositionAfter',
                    )}
                  </dt>
                  <dd className="dw-mono">
                    {anchorLabel(entry.class)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Only worth a section when something was actually overridden -
              most sites take the notice's own spacing. */}
          {hasSpacing && (
            <section className="dw-card-section">
              <h4 className="dw-card-section-title">
                {Methods.i18n('l10nSpacing')}
              </h4>
              <dl className="dw-defs">
                {spacing.map(([labelKey, value]) =>
                  value ? (
                    <div className="dw-def" key={labelKey}>
                      <dt>{Methods.i18n(labelKey)}</dt>
                      <dd className="dw-mono">
                        {TextFormatter.toPlainText(value)}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </section>
          )}
        </>
      )}

      {editing && (
        <footer className="dw-card-actions">
          <button
            type="button"
            className="dw-button dw-button-ghost"
            onClick={onEdit}
          >
            <PencilIcon size={14} />
            {Methods.i18n('l10nEdit')}
          </button>
          <ConfirmDelete onConfirm={onDelete} label={configKey} />
        </footer>
      )}
    </article>
  )
}

export default SiteCard
