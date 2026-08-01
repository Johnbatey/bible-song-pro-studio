import React from 'react';
import { createRoot } from 'react-dom/client';
import { ProgramSurface } from '../renderer/components/display/ProgramSurface';
import { programSurfaceFixtures } from '../renderer/components/display/programSurfaceFixtures';
import './program-surface-harness.css';

function Harness() {
  return (
    <main className="surface-harness">
      {programSurfaceFixtures.map((fixture) => (
        <section className="surface-case" key={fixture.name}>
          <div className="surface-case-title">{fixture.name}</div>
          <div className="surface-frame">
            <ProgramSurface preview state={fixture.state} />
          </div>
        </section>
      ))}
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Harness root missing');
createRoot(root).render(<Harness />);
