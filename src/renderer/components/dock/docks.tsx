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
import { StagePanel } from '../StagePanel';
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
 *
 * `group` is the four questions an operator is ever asking of this window:
 * what am I sending, where does it go, what is the service doing, and what
 * does it look like. Every panel answers exactly one of them, and the order
 * below is the order of the work — you pick something, it goes to a screen,
 * the service runs, and the look is the thing you set once and leave alone.
 *
 * Listed flat, the twelve panels were twelve equal choices with no shape; the
 * only grouping anywhere was a single separator in the native menu splitting
 * "has a tab" from "does not", which is a fact about the chrome rather than
 * about the work.
 */
export type DockGroup = 'sources' | 'displays' | 'service' | 'looks';

export const DOCK_GROUPS = [
  { id: 'sources', label: 'Sources', hint: 'What goes on the screen.' },
  { id: 'displays', label: 'Displays', hint: 'The screens it goes to.' },
  { id: 'service', label: 'Service', hint: 'What is running right now.' },
  { id: 'looks', label: 'Looks', hint: 'How all of it is dressed.' },
] as const satisfies readonly { id: DockGroup; label: string; hint: string }[];

export interface DockDef {
  id: string;
  title: string;
  nav: boolean;
  group: DockGroup;
}

/* In group order, so this list reads as the taxonomy rather than as the order
   the panels happened to be written in. */
export const DOCKS = [
  /* Bible, matching the id.
     The app is called Bible Song Pro, so its own name already teaches the
     operator that the two libraries here are Bible and Songs. A panel titled
     Scripture would make the product name the only place that word appears.

     Scripture is not retired — the two words split by job. Bible is the source
     you open and browse: this panel, the Bible settings tab, Bible version,
     Bible book. Scripture is the text once it is detected or on screen: Live
     Scripture, the Scripture accordion in the theme designer. */
  { id: 'bible', title: 'Bible', nav: true, group: 'sources' },
  { id: 'songs', title: 'Songs', nav: true, group: 'sources' },
  { id: 'presentation', title: 'Pro Slides', nav: true, group: 'sources' },
  { id: 'media', title: 'Media', nav: true, group: 'sources' },

  { id: 'output', title: 'Output', nav: false, group: 'displays' },
  { id: 'stage', title: 'Stage', nav: true, group: 'displays' },

  { id: 'live', title: 'Live', nav: true, group: 'service' },
  { id: 'transcript', title: 'Live transcript', nav: false, group: 'service' },
  { id: 'queue', title: 'Queue', nav: false, group: 'service' },
  { id: 'history', title: 'History', nav: false, group: 'service' },

  { id: 'scenes', title: 'Scenes', nav: false, group: 'looks' },
  { id: 'themes', title: 'Themes', nav: false, group: 'looks' },
] as const satisfies readonly DockDef[];

export type DockId = (typeof DOCKS)[number]['id'];

/** Docks that get a tab in the title bar, in tab order. */
export const NAV_DOCKS = DOCKS.filter((d) => d.nav);

/**
 * The same panels, sectioned. Empty groups drop out rather than drawing a
 * heading over nothing — which is what a `nav`-only view of this would leave
 * behind for any group whose panels all live in the menu.
 */
function sectioned<T extends DockDef>(docks: readonly T[]) {
  return DOCK_GROUPS
    .map((group) => ({ ...group, docks: docks.filter((dock) => dock.group === group.id) }))
    .filter((group) => group.docks.length > 0);
}

/** Every panel, in sections — for surfaces with room to name them. */
export const DOCK_SECTIONS = sectioned(DOCKS);

/** Just the tabbed ones, in sections — for the title bar, which has room for
    a divider between groups and none at all for a heading. */
export const NAV_DOCK_SECTIONS = sectioned(NAV_DOCKS);

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
  stage: panel('Stage Display', () => <StagePanel />, true),
  scenes: panel('Scenes', () => <ScenePanel />, true),
  themes: panel('Themes', () => <ThemePanel />, true),
};
