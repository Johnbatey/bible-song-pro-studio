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
import type { ProgramSurfaceState } from '../components/display/ProgramSurface';

/** What the audience is seeing now. */
export function useProgramSurfaceState(): ProgramSurfaceState {
  const scene = useAppStore((s) => s.display.currentScene);
  const outputMode = useAppStore((s) => s.display.outputMode);
  const theme = useAppStore((s) => s.activeTheme);
  const activeAlert = useAppStore((s) => s.activeAlert);
  const transcription = useAppStore((s) => s.transcription.text);

  /* A stable identity, so a zoom or pan tick in whichever pane hosts this does
     not re-render the memoised surface underneath it. */
  return useMemo(
    () => ({ scene, outputMode, theme, activeAlert, transcription }),
    [scene, outputMode, theme, activeAlert, transcription],
  );
}
