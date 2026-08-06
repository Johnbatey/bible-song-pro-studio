/* =========================================================================
   Stage Layout Designer — window entry
   -------------------------------------------------------------------------
   Boots the same way the stage window does, and deliberately so: it mounts the
   same <StageSurface>, listens to the same two IPC feeds, and resolves media
   against the same origin. The designer being a faithful stage is the whole
   premise of the tool, and that starts here.
   ========================================================================= */
import { createRoot } from 'react-dom/client';
import { StageDesigner } from './StageDesigner';
import './designer-page.css';

const root = document.getElementById('root');
if (!root) throw new Error('Designer root missing');
createRoot(root).render(<StageDesigner />);
