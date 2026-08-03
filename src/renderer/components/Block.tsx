import { useContext } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DockedContext } from './dock/DockedContext';

/**
 * The window block — the one shape every panel in the app is built from.
 *
 *   ┌──────────────────────────────┐
 *   │ Title                 tools  │  chrome bar
 *   ├──────────────────────────────┤  1px Black Beauty rule
 *   │ body                         │
 *   └──────────────────────────────┘  1px Black Beauty border, matt black fill
 *
 * Blocks sit beside one another with --block-gap between them. The gap stays
 * empty — each block draws its own border, so no rule is needed between them.
 */
interface BlockProps {
  /** Label shown at the left of the chrome bar. Omit for a tools-only chrome. */
  title?: ReactNode;
  /** Muted text next to the title. */
  subtitle?: ReactNode;
  /** Controls at the right of the chrome bar. */
  tools?: ReactNode;
  /** Replaces title/tools entirely — for chrome bars that are one long toolbar. */
  chrome?: ReactNode;
  /** Bottom bar below the body, separated by its own rule. */
  footer?: ReactNode;
  /** Drop the body's default padding (lists that draw their own). */
  flush?: boolean;
  /** Centre the body's content both ways. */
  centered?: boolean;
  className?: string;
  style?: CSSProperties;
  bodyClassName?: string;
  bodyStyle?: CSSProperties;
  children?: ReactNode;
}

export function Block({
  title,
  subtitle,
  tools,
  chrome,
  footer,
  flush,
  centered,
  className = '',
  style,
  bodyClassName = '',
  bodyStyle,
  children,
}: BlockProps) {
  // The dock tab above this block is already showing its title.
  const titleShownByDock = useContext(DockedContext);
  const showTitle = Boolean(title) && !titleShownByDock;
  const showSubtitle = Boolean(subtitle) && !titleShownByDock;
  const hasChrome = Boolean(chrome || showTitle || tools);

  const section = (
    <section className={`blk blk--fill ${className}`.trim()} style={style}>
      {hasChrome && (
        chrome ? (
          <div className="blk__chrome blk__chrome--tools">{chrome}</div>
        ) : (
          <div className="blk__chrome">
            <div className="blk__titlegroup">
              {showTitle && <span className="blk__title">{title}</span>}
              {showSubtitle && <span className="blk__subtitle">{subtitle}</span>}
            </div>
            {tools && <div className="blk__tools">{tools}</div>}
          </div>
        )
      )}
      <div
        className={[
          'blk__body',
          flush ? 'blk__body--flush' : '',
          centered ? 'blk__body--center' : '',
          bodyClassName,
        ].filter(Boolean).join(' ')}
        style={bodyStyle}
      >
        {children}
      </div>
      {footer && <div className="blk__footer">{footer}</div>}
    </section>
  );

  return <DockedContext.Provider value={false}>{section}</DockedContext.Provider>;
}

interface BlockButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: boolean;
}

/** A chrome-bar control. Active/hover states use Black Chestnut Oak. */
export function BlockButton({ active, icon, className = '', ...rest }: BlockButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={[
        'blk-btn',
        icon ? 'blk-btn--icon' : '',
        active ? 'is-active' : '',
        className,
      ].filter(Boolean).join(' ')}
    />
  );
}

/** Wrapper for a group of mutually exclusive chrome buttons. */
export function BlockSegment({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`blk-seg ${className}`.trim()}>{children}</div>;
}
