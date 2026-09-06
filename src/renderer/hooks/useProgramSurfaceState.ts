/* =========================================================================
   useProgramSurfaceState — what is live, in ProgramSurface's shape
   -------------------------------------------------------------------------
   The operator's Program pane and the stage display's program pane must show
   the same thing, because they are both claims about what the congregation is
   currently seeing. Deriving that twice is how they drift, so it is derived
   here once.
   ========================================================================= */
import { useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { resolveBgVideoLoop } from '../utils/background';
import { ensureTheme } from '../utils/defaultTheme';
import type { ProgramSurfaceState } from '../components/display/ProgramSurface';

/** What the audience is seeing now. */
export function useProgramSurfaceState(): ProgramSurfaceState {
  const scene = useAppStore((s) => s.display.currentScene);
  const outputMode = useAppStore((s) => s.display.outputMode);
  const rawTheme = useAppStore((s) => s.activeTheme);
  const theme = useMemo(() => ensureTheme(rawTheme), [rawTheme]);
  const activeAlert = useAppStore((s) => s.activeAlert);
  const transcription = useAppStore((s) => s.transcription.text);
  /* The operator's Program pane is a claim about what the room is seeing, so
     it has to go black when the room does — otherwise the one person who needs
     to know blackout is on is the only one who cannot see it. */
  const blackout = useAppStore((s) => s.display.blackout);
  const showStandbyBrand = useAppStore((s) => s.showStandbyBrand);
  const standbyMedia = useAppStore((s) => s.standbyMedia);
  /* Only when the transport is pointed here — a surface handed someone else's
     transport would answer play and seek meant for a different clip. */
  const videoTransport = useAppStore((s) =>
    s.display.videoTransport.target === 'program' ? s.display.videoTransport : null);

  /* A stable identity, so a zoom or pan tick in whichever pane hosts this does
     not re-render the memoised surface underneath it. */
  return useMemo(
    () => ({
      scene, outputMode, theme, activeAlert, transcription, videoTransport,
      blackout, showStandbyBrand, standbyMedia,
      /* Read here as well as in App's sendState, or the operator's own panes
         loop a clip the audience window has stopped looping. */
      bgVideoLoop: resolveBgVideoLoop(scene?.background, theme),
    }),
    [scene, outputMode, theme, activeAlert, transcription, videoTransport, blackout, showStandbyBrand, standbyMedia],
  );
}
