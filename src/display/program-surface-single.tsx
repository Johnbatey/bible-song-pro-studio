import React from 'react';
import { createRoot } from 'react-dom/client';
import { ProgramSurface } from '../renderer/components/display/ProgramSurface';
import { programSurfaceFixtures } from '../renderer/components/display/programSurfaceFixtures';
import { installFontFaces } from '../shared/display-fonts';
import './single-surface.css';

/* The audience page under test installs these, so this side has to as well or
   the parity run measures the two pages' font loading rather than the renderer:
   every face would resolve here to whatever the host happens to substitute
   while the audience window drew the real one. */
installFontFaces(window.location.origin);

const fixtureName = new URLSearchParams(window.location.search).get('fixture') || 'Lower Third';
const fixture = programSurfaceFixtures.find((item) => item.name === fixtureName) || programSurfaceFixtures[0];

/**
 * The audience window lays the surface out at a fixed 1920x1080 and scales the
 * whole box to fit (see src/display/main.tsx). This page used to lay out
 * natively at whatever size the capture window happened to be, so the parity
 * run was comparing two different rasterisations of the same markup — text hit
 * a different sub-pixel grid on each side and every fixture drifted, worst on
 * the text-heavy ones. That is a property of the harness, not of the renderer
 * it exists to check.
 *
 * Same geometry both sides now, so a difference the run reports is a real one.
 */
function SingleSurface() {
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 1920,
        height: 1080,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <ProgramSurface className="audience-program-surface" state={fixture.state} />
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Single ProgramSurface root missing');
createRoot(root).render(<SingleSurface />);
