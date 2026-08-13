/* =========================================================================
   The .bspworkspace file
   -------------------------------------------------------------------------
   One arrangement, as text. Small enough to email, diff or drop in a repo,
   which is the whole reason exporting a layout is worth having: a church with
   three machines in the booth sets one up and copies it to the others.

   Everything about the format lives here. The main process writes and reads
   the bytes and never looks inside them.
   ========================================================================= */
import type { WorkspaceFile } from '../../types';

const FORMAT = 'bsp.workspace';
const VERSION = 1;

export function serializeWorkspace(name: string, layout: unknown): string {
  const file: WorkspaceFile = {
    format: FORMAT,
    version: VERSION,
    name,
    layout,
    exportedAt: Date.now(),
    app: 'Bible Song Pro Studio',
  };
  // Indented: a workspace is something people open in an editor and read.
  return JSON.stringify(file, null, 2);
}

export type ParseResult =
  | { ok: true; name: string; layout: unknown }
  | { ok: false; error: string };

/**
 * Reads a workspace file, refusing anything that is not one.
 *
 * The checks are deliberately shallow: `layout` is dockview's tree and this
 * has no business validating its shape. What it can establish is that the file
 * claims to be a workspace, is a version this build understands, and carries
 * an object where the tree should be. A tree that is well-formed JSON but not
 * a valid dock layout is caught by applyLayout(), which can roll back — the
 * one place that failure is recoverable.
 */
export function parseWorkspace(json: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'That file is empty or malformed.' };
  }

  const file = data as Partial<WorkspaceFile>;

  if (file.format !== FORMAT) {
    return { ok: false, error: 'That is not a Bible Song Pro workspace file.' };
  }

  if (typeof file.version !== 'number' || file.version > VERSION) {
    return {
      ok: false,
      error: 'That workspace was saved by a newer version of Bible Song Pro. Update the app to open it.',
    };
  }

  if (!file.layout || typeof file.layout !== 'object') {
    return { ok: false, error: 'That workspace file has no layout in it.' };
  }

  const name = typeof file.name === 'string' && file.name.trim() ? file.name.trim() : 'Imported layout';
  return { ok: true, name, layout: file.layout };
}

/**
 * A name that is not already taken, by appending a counter.
 *
 * Importing the same file twice is normal — a second machine, or a colleague
 * re-sending it — and two identical entries in the Workspace menu leave the
 * operator picking blind.
 */
export function uniqueName(desired: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  const base = desired.trim() || 'Untitled layout';
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}`;
}
