import { createRoot } from 'react-dom/client';
import { DockPopoutApp } from './DockPopoutApp';
import 'dockview/dist/styles/dockview.css';
import '../renderer/styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Dock pop-out root missing');
createRoot(root).render(<DockPopoutApp />);
