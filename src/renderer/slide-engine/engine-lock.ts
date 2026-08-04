/* =========================================================================
   Slide engine — serializing access to the shared deck context
   -------------------------------------------------------------------------
   state.ts is a singleton: one zip, one theme, one slide list. Any operation
   that needs a different deck loaded has to swap the whole context out and put
   it back, and two of those interleaving corrupts both.

   The failure is not hypothetical. A deck card's preview captured the context,
   yielded on an await, the editor opened a package in the meantime, and the
   preview's restore then put back the empty state it had captured — leaving
   the editor showing "No slides in this deck" with the package loaded and
   nothing to show for it.

   Everything that captures and restores the context runs through here, so
   those sections cannot overlap. A preview either runs entirely before an
   editor open or entirely after it; either way it restores what was actually
   there.
   ========================================================================= */

let tail: Promise<unknown> = Promise.resolve();

/**
 * Run `fn` with exclusive use of the engine's deck context.
 *
 * Sections run in call order. A rejection does not break the chain: the next
 * caller still gets its turn.
 */
export function withEngineLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  // Swallow only for the chain's own bookkeeping; the caller still sees it.
  tail = run.then(() => undefined, () => undefined);
  return run;
}
