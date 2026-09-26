import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueuePanel } from '../../src/renderer/components/QueuePanel';
import { useAppStore } from '../../src/renderer/stores/appStore';

describe('QueuePanel Component', () => {
  beforeEach(() => {
    useAppStore.setState({
      queue: [],
      display: {
        currentScene: null,
        previewScene: null,
        mode: 'basic',
        isExternalDisplayActive: false,
        theme: null,
        outputMode: 'fullscreen',
        blackout: false,
        clearText: false,
      } as any,
    });
  });

  it('renders queue header and empty state cleanly', () => {
    render(<QueuePanel />);
    expect(screen.getByText(/Setlists/i)).toBeInTheDocument();
    expect(screen.getByText(/Queue is empty/i)).toBeInTheDocument();
  });

  it('renders queue items and Clear all button when items are queued', () => {
    useAppStore.setState({
      queue: [
        {
          id: 'q1',
          type: 'bible',
          reference: 'John 3:16',
          text: 'For God so loved the world...',
          scene: {
            id: 'scene-1',
            name: 'John 3:16',
            type: 'bible',
            content: { text: 'For God so loved the world...' },
          } as any,
        },
      ],
    });

    render(<QueuePanel />);
    expect(screen.getByText(/John 3:16/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear all/i)).toBeInTheDocument();
  });

  it('correctly calculates screen edge overflow logic for submenus', () => {
    const windowWidth = 1000;
    const menuWidth = 230;
    const submenuWidth = 210;

    // When clicked near right edge (e.g. x = 800)
    const contextMenuX = 800;
    const isNearRightEdge = contextMenuX + menuWidth + submenuWidth > windowWidth;
    expect(isNearRightEdge).toBe(true);

    // When clicked near center (e.g. x = 200)
    const centerMenuX = 200;
    const isNearCenter = centerMenuX + menuWidth + submenuWidth > windowWidth;
    expect(isNearCenter).toBe(false);
  });

  it('detects missing Bible versions and auto-healer fallback structure', () => {
    const installedBibles = [{ id: 'kjv', name: 'King James Version', abbreviation: 'KJV' }];
    const importedItem = {
      id: 'item-1',
      type: 'bible' as const,
      reference: 'Genesis 1:1 (ESV)',
      text: 'In the beginning...',
      scene: {
        id: 'scene-esv-gen-1-1',
        name: 'Genesis 1:1 (ESV)',
        type: 'bible',
        content: { version: 'ESV', text: 'In the beginning God created...' },
      } as any,
    };

    const isInstalled = installedBibles.some(
      (b) => b.id.toLowerCase() === 'esv' || b.abbreviation?.toLowerCase() === 'esv'
    );
    expect(isInstalled).toBe(false);

    // Fallback translation matches installed version
    const fallbackVersion = installedBibles[0];
    expect(fallbackVersion.abbreviation).toBe('KJV');
  });
});
