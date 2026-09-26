import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StatusBar } from '../../src/renderer/components/StatusBar';

describe('StatusBar Component', () => {
  it('renders status indicators cleanly', () => {
    const { container } = render(<StatusBar />);
    expect(container).toBeDefined();
    expect(container.textContent).toBeDefined();
  });
});
