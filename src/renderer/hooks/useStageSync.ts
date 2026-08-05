/* =========================================================================
   useStageSync — what the operator's app tells the stage
   -------------------------------------------------------------------------
   The stage has always been able to draw a "next item", a song cue, a timer
   and broadcast messages. Nothing ever sent them: the only producer in the app
   published the current scene, so four of the six zone types rendered an empty
   box for anyone who put them on a layout. This is the missing half.

   Each producer publishes a bare value object rather than a {kind:'content'}
   envelope, because that envelope also asserts what `next` is — so a content
   update from here would silently blank the queue's contribution. Bare
   messages let the producers stay independent of each other.
   ========================================================================= */
import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { publishStage } from '../services/stage-bus';
import type { Scene } from '../types';

/** Song scenes are named "<title> - <section>"; the credit carries the title
    on its own when the song has one. Anything else has no cue. */
function songCue(scene: Scene | null): { songTitle: string; songSubtitle: string } {
  if (!scene || scene.type !== 'song') return { songTitle: '', songSubtitle: '' };
  const separator = scene.name.lastIndexOf(' - ');
  return {
    songTitle: scene.content?.songCredit?.title
      || (separator > 0 ? scene.name.slice(0, separator) : scene.name),
    songSubtitle: separator > 0 ? scene.name.slice(separator + 3) : '',
  };
}

export function useStageSync(): void {
  const currentScene = useAppStore((s) => s.display.currentScene);
  const queue = useAppStore((s) => s.queue);
  const activeAlert = useAppStore((s) => s.activeAlert);

  // What is on the screen now, and which song it belongs to.
  useEffect(() => {
    const { songTitle, songSubtitle } = songCue(currentScene);
    publishStage({
      current: currentScene
        ? {
            title: currentScene.content?.reference || currentScene.name,
            body: currentScene.content?.text || '',
            bodyHtml: currentScene.content?.html || '',
          }
        : null,
      songTitle,
      songSubtitle,
    });
  }, [currentScene]);

  /* What is queued to go next. Keyed on the item's identity rather than the
     array's, so re-ordering further down the queue does not repaint the stage. */
  const next = queue[0];
  useEffect(() => {
    publishStage({
      next: next ? { title: next.reference, body: next.text } : null,
    });
  }, [next?.id, next?.reference, next?.text]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Alerts double as the stage's broadcast messages — an operator telling the
     band something is telling the room the same thing. Cleared by id when the
     alert goes, so a message never outlives the alert that raised it. */
  const postedAlertId = useRef<string | null>(null);
  useEffect(() => {
    const previous = postedAlertId.current;
    if (previous && previous !== activeAlert?.id) {
      publishStage({ kind: 'message', id: previous, clear: true });
      postedAlertId.current = null;
    }
    if (activeAlert) {
      publishStage({ kind: 'message', id: activeAlert.id, text: activeAlert.text });
      postedAlertId.current = activeAlert.id;
    }
  }, [activeAlert]);
}
