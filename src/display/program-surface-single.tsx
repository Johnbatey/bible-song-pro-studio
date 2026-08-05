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

function SingleSurface() {
  return <ProgramSurface state={fixture.state} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Single ProgramSurface root missing');
createRoot(root).render(<SingleSurface />);
