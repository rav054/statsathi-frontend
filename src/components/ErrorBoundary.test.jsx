import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

let shouldCrash = true;
const Fragile = () => {
  if (shouldCrash) throw new Error('column "yield" is missing');
  return <p>Analysis ready</p>;
};

describe('the crash screen', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows what went wrong and recovers with Try again', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Fragile /></ErrorBoundary>);

    expect(screen.getByRole('alert').textContent).toContain('column "yield" is missing');
    expect(screen.getByText(/are not affected/)).toBeTruthy();

    shouldCrash = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Analysis ready')).toBeTruthy();
  });
});
