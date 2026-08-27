import { DOCK_SECTIONS, getDockGroupLabel, getDockTitle, type DockId, type DockGroup } from './docks';
import { openDock } from './dockController';
import { useI18n } from '../../../i18n/useI18n';
import type { MessageKey } from '../../../i18n';
import './DockEmptyState.css';

interface DockEmptyStateProps {
  /** Rebuilds the shipped arrangement. Same action as the title bar's Layout. */
  onRestoreLayout: () => void;
}

/**
 * Shown when the operator has closed every dock.
 *
 * The state is reachable in one click — close the last panel — and until now it
 * left the whole window blank, which reads as a crash rather than as an empty
 * desk. It is also the one moment the app can say plainly what this surface is:
 * not a fixed screen, but an arrangement the operator builds for the service in
 * front of them.
 *
 * The chips are the point. Telling someone to open a panel while giving them
 * nothing to open is worse than saying nothing; the title bar tabs do exist,
 * but they are 60px of chrome at the top of an otherwise empty window and are
 * exactly what a first-time operator has not found yet.
 */
export function DockEmptyState({ onRestoreLayout }: DockEmptyStateProps) {
  const { t } = useI18n();

  return (
    <div className="dock-empty" data-testid="dock-empty">
      <div className="dock-empty__card">
        <div className="dock-empty__mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="dock-empty__title">{t('empty.title')}</div>

        <p className="dock-empty__body">
          {t('empty.body')}
        </p>

        <div className="dock-empty__actions">
          <button
            type="button"
            className="dock-empty__chip dock-empty__chip--primary"
            onClick={onRestoreLayout}
          >
            {t('empty.startDefault')}
          </button>
        </div>

        {/* Every panel, not only the tabbed ones.
            The chips used to be the six that have a tab in the title bar,
            which meant an operator who had just closed Output or Queue could
            not get them back from the one screen offering to open something —
            their only route was rebuilding the whole default layout. This is
            also the one surface with room to say what the groups are, so it
            names them. */}
        <div className="dock-empty__sections">
          {DOCK_SECTIONS.map((section) => (
            <section key={section.id} className="dock-empty__section">
              <div className="dock-empty__section-head">
                <span className="dock-empty__section-label">{getDockGroupLabel(section.id as DockGroup)}</span>
                <span className="dock-empty__section-hint">
                  {t(`dock.group.${section.id}.hint` as MessageKey)}
                </span>
              </div>
              <div className="dock-empty__section-chips">
                {section.docks.map((dock) => {
                  const title = getDockTitle(dock.id);
                  return (
                    <button
                      key={dock.id}
                      type="button"
                      className="dock-empty__chip"
                      onClick={() => openDock(dock.id as DockId)}
                      title={t('empty.openPanel', { name: title })}
                    >
                      {title}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="dock-empty__footnote">{t('empty.footnote')}</div>
      </div>
    </div>
  );
}
