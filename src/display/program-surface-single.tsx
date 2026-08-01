import React from 'react';
import { createRoot } from 'react-dom/client';
import { ProgramSurface } from '../renderer/components/display/ProgramSurface';
import { programSurfaceFixtures } from '../renderer/components/display/programSurfaceFixtures';
import './single-surface.css';

const fixtureName = new URLSearchParams(window.location.search).get('fixture') || 'Lower Third';
const fixture = programSurfaceFixtures.find((item) => item.name === fixtureName) || programSurfaceFixtures[0];

function SingleSurface() {
  return <ProgramSurface state={fixture.state} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Single ProgramSurface root missing');
createRoot(root).render(<SingleSurface />);
