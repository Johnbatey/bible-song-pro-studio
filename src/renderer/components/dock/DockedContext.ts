import { createContext } from 'react';

/**
 * True for the outermost Block of a dock whose title the dock tab already
 * shows. That Block drops its own title so the two bars stop saying the same
 * word twice; it keeps its tools, since the tab has nowhere to put them.
 *
 * A plain boolean on purpose — Block re-provides `false` to its children, so
 * nested blocks (a song list beside its lyrics) keep their own headings, and
 * there is no changing value to churn renders.
 */
export const DockedContext = createContext(false);
