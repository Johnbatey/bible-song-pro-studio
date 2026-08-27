/* =========================================================================
   WorkspaceBridge — the Workspace menu, wired up
   -------------------------------------------------------------------------
   The native menu is drawn by the main process and the layout trees live in
   the renderer, so something has to sit between them. This is it: it pushes
   the list of saved arrangements out so the menu can be rebuilt, and takes the
   menu's commands back.

   It renders nothing but the name dialog. Mounted once, in App.
   ========================================================================= */
import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { applyLayout, captureLayout } from './dockController';
import { resetDockLayout } from './DockHost';
import { WorkspaceNameDialog, type WorkspacePromptRequest } from './WorkspaceNameDialog';
import { parseWorkspace, serializeWorkspace, uniqueName } from './workspaceFile';
import { t } from '../../../i18n';

type WorkspaceAction =
  | 'activate' | 'save' | 'saveAs' | 'update'
  | 'rename' | 'delete' | 'export' | 'import';

export function WorkspaceBridge() {
  const workspaces = useAppStore((s) => s.workspaces);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const [prompt, setPrompt] = useState<WorkspacePromptRequest | null>(null);

  /* Keep the native menu's copy of the list current. The layout trees are
     deliberately left behind — the menu needs a name and an id and nothing
     more, and shipping a dock tree over IPC on every rename would be waste. */
  useEffect(() => {
    window.BSP?.workspace?.sync?.({
      list: workspaces.map((w) => ({ id: w.id, name: w.name })),
      activeId: activeWorkspaceId,
    });
  }, [workspaces, activeWorkspaceId]);

  const notify = useCallback((text: string, type: 'info' | 'warning' = 'info') => {
    useAppStore.getState().notify({
      id: `ws-${Date.now()}`, text, type, duration: 4, animation: 'slideDown',
    });
  }, []);

  const handle = useCallback(async (action: WorkspaceAction, id: string | null) => {
    const store = useAppStore.getState();
    const list = store.workspaces;
    const active = list.find((w) => w.id === store.activeWorkspaceId) || null;
    const activeName = active ? active.name : 'Default Layout';
    const names = list.map((w) => w.name);

    switch (action) {
      /* ---- Switching ------------------------------------------------- */
      case 'activate': {
        if (id === store.activeWorkspaceId) return;

        /* Switching throws away whatever is on screen. That is correct — it is
           what picking a different layout means — but doing it silently after
           ten minutes of arranging is not. Only ask when there is genuinely
           something to lose: an unsaved difference from the saved tree. */
        if (active) {
          const current = captureLayout();
          const drifted = current && JSON.stringify(current) !== JSON.stringify(active.layout);
          if (drifted && !window.confirm(
            `“${active.name}” has changes you haven’t saved.\n\nSwitching will discard them.`
          )) return;
        }

        if (id === null) {
          resetDockLayout();
          store.setActiveWorkspace(null);
          notify('Switched to the default layout');
          return;
        }

        const target = list.find((w) => w.id === id);
        if (!target) return;
        if (!applyLayout(target.layout)) {
          notify(`“${target.name}” could not be opened — its panels no longer exist in this version.`, 'warning');
          return;
        }
        store.setActiveWorkspace(target.id);
        notify(`Switched to “${target.name}”`);
        return;
      }

      /* ---- Creating --------------------------------------------------- */
      case 'save':
      case 'saveAs': {
        const layout = captureLayout();
        if (!layout) {
          notify(t('workspace.nothingToSave'), 'warning');
          return;
        }
        /* Save As starts from the active name so the fork reads as a fork.
           Plain Save starts blank, because it is a new thing by intent. */
        const suggested = action === 'saveAs' && active
          ? uniqueName(`${active.name} copy`, names)
          : '';
        setPrompt({
          title: action === 'saveAs' ? t('workspace.saveAsTitle') : t('workspace.saveTitle'),
          hint: action === 'saveAs'
            ? t('workspace.saveAsHint', { name: activeName })
            : t('workspace.saveHint'),
          initialValue: suggested,
          confirmLabel: t('workspace.saveConfirm'),
          onConfirm: (name) => {
            const saved = useAppStore.getState().saveWorkspace(uniqueName(name, names), layout);
            notify(t('workspace.saved', { name: saved.name }));
          },
        });
        return;
      }

      /* ---- Overwriting ------------------------------------------------ */
      case 'update': {
        if (!active) return;
        const layout = captureLayout();
        if (!layout) {
          notify(t('workspace.nothingToSave'), 'warning');
          return;
        }
        store.updateWorkspace(active.id, layout);
        notify(t('workspace.updated', { name: active.name }));
        return;
      }

      /* ---- Housekeeping ----------------------------------------------- */
      case 'rename': {
        if (!active) return;
        setPrompt({
          title: t('workspace.renameTitle'),
          initialValue: active.name,
          confirmLabel: t('workspace.renameConfirm'),
          onConfirm: (name) => {
            const others = names.filter((n) => n !== active.name);
            store.renameWorkspace(active.id, uniqueName(name, others));
          },
        });
        return;
      }

      case 'delete': {
        if (!active) return;
        if (!window.confirm(t('workspace.deleteConfirm', { name: active.name }))) return;
        store.deleteWorkspace(active.id);
        resetDockLayout();
        notify(t('workspace.deleted', { name: active.name }));
        return;
      }

      /* ---- Files ------------------------------------------------------ */
      case 'export': {
        const layout = captureLayout();
        if (!layout) {
          notify('There is nothing to export — open a panel first.', 'warning');
          return;
        }
        const result = await window.BSP?.workspace?.exportFile?.({
          name: activeName,
          json: serializeWorkspace(activeName, layout),
        });
        if (!result || result.canceled) return;
        if (!result.ok) {
          notify(result.error || 'The workspace could not be exported.', 'warning');
          return;
        }
        notify(`Exported “${activeName}”`);
        return;
      }

      case 'import': {
        const result = await window.BSP?.workspace?.importFile?.();
        if (!result || result.canceled) return;
        if (!result.ok || !result.json) {
          notify(result?.error || 'The workspace could not be read.', 'warning');
          return;
        }
        const parsed = parseWorkspace(result.json);
        if (!parsed.ok) {
          notify(parsed.error, 'warning');
          return;
        }
        /* Applied before it is stored. A tree this build cannot mount is not
           worth adding to the menu, and applyLayout puts the operator's own
           arrangement back when it rejects one. */
        if (!applyLayout(parsed.layout)) {
          notify('That workspace refers to panels this version does not have.', 'warning');
          return;
        }
        const saved = useAppStore.getState().saveWorkspace(uniqueName(parsed.name, names), parsed.layout);
        notify(`Imported “${saved.name}”`);
        return;
      }
    }
  }, [notify]);

  useEffect(() => {
    const unsub = window.BSP?.workspace?.onCommand?.((payload) => {
      if (!payload?.action) return;
      void handle(payload.action as WorkspaceAction, payload.id ?? null);
    });
    return () => unsub?.();
  }, [handle]);

  return <WorkspaceNameDialog request={prompt} onClose={() => setPrompt(null)} />;
}
