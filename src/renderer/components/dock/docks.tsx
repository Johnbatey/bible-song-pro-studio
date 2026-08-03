import type { IDockviewPanelProps } from 'dockview-react';
import { TranscriptPanel } from '../TranscriptPanel';
import { SessionHistoryPanel } from '../SessionHistoryPanel';
import { PreviewProgramView } from '../PreviewProgramView';
import { QueuePanel } from '../QueuePanel';
import { BiblePanel } from '../BiblePanel';
import { SongsPanel } from '../SongsPanel';
import { LiveScripturePanel } from '../LiveScripturePanel';
import { MediaPanel } from '../MediaPanel';
import { ScenePanel } from '../ScenePanel';
import { PresentationPanel } from '../PresentationPanel';
import { ThemePanel } from '../ThemePanel';
import { ErrorBoundary } from '../ErrorBoundary';
import { openDock } from './dockController';
import { DockedContext } from './DockedContext';

/**
 * Every dockable window in the app, declared once. The title bar builds its
 * tabs from this, DockHost registers it with dockview, and the default layout
 * references these ids.
 *
 * `nav: true` means the dock gets a tab in the title bar. Scenes is reachable
 * from the Studio toggle instead, and Themes from its own toolbar button, so
 * neither needs to spend a tab.
 */
export interface DockDef {
  id: string;
  title: string;
  nav: boolean;
}

export const DOCKS = [
  { id: 'transcript', title: 'Live transcript', nav: false },
  { id: 'output', title: 'Output', nav: false },
  { id: 'history', title: 'History', nav: false },
  { id: 'queue', title: 'Queue', nav: false },
  { id: 'bible', title: 'Bible', nav: true },
  { id: 'songs', title: 'Songs', nav: true },
  { id: 'presentation', title: 'Pro Slides', nav: true },
  { id: 'live', title: 'Live', nav: true },
  { id: 'media', title: 'Media', nav: true },
  { id: 'scenes', title: 'Scenes', nav: false },
  { id: 'themes', title: 'Themes', nav: false },
] as const satisfies readonly DockDef[];

export type DockId = (typeof DOCKS)[number]['id'];

/** Docks that get a tab in the title bar, in tab order. */
export const NAV_DOCKS = DOCKS.filter((d) => d.nav);

/**
 * Panels are written as standalone components taking no dockview props, so
 * each is wrapped rather than adapted. The ErrorBoundary is per-dock: one
 * panel throwing must not take the whole layout down with it.
 */
function panel(label: string, render: () => React.ReactNode, deferTitle = false) {
  return function DockPanel(_props: IDockviewPanelProps) {
    return (
      <div className="dock-panel">
        <DockedContext.Provider value={deferTitle}>
          <ErrorBoundary label={label}>{render()}</ErrorBoundary>
        </DockedContext.Provider>
      </div>
    );
  };
}

export const DOCK_COMPONENTS: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  transcript: panel('Live transcript', () => (
    <TranscriptPanel onOpenLiveScripture={() => openDock('live')} />
  ), true),
  output: panel('Preview / Program', () => (
    <PreviewProgramView onPanelChange={(id) => openDock(id as DockId)} />
  ), true),
  history: panel('History', () => <SessionHistoryPanel />, true),
  queue: panel('Queue', () => <QueuePanel />, true),
  bible: panel('Bible', () => <BiblePanel />),
  songs: panel('Songs', () => <SongsPanel />),
  presentation: panel('Pro Slides', () => <PresentationPanel />),
  live: panel('Live Scripture', () => <LiveScripturePanel />),
  media: panel('Media', () => <MediaPanel />, true),
  scenes: panel('Scenes', () => <ScenePanel />, true),
  themes: panel('Themes', () => <ThemePanel />, true),
};
