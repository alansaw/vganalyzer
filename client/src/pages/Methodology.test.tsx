import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { MethodologyPage } from './Methodology';

describe('MethodologyPage', () => {
  it('documents all five metrics and the key constants', () => {
    renderWithProviders(<MethodologyPage />);

    expect(screen.getByRole('heading', { name: 'Methodology', level: 1 })).toBeInTheDocument();

    // The five requested metrics appear (some names recur across tables).
    for (const metric of ['Intrinsic Value', 'PEG', 'Forward P/E', 'Score', 'Grade']) {
      expect(screen.getAllByText(metric).length).toBeGreaterThan(0);
    }

    // Score weights match scoring.ts.
    expect(screen.getByText('0.52·PEG + 0.28·FwdP/E + 0.10·momentum + 0.10·IV discount')).toBeInTheDocument();
    expect(screen.getByText('52%')).toBeInTheDocument();

    // The above-IV exclusion rule is documented.
    expect(screen.getByText(/overvalued names never/i)).toBeInTheDocument();

    // Grade boundaries.
    expect(screen.getByText('95 and over')).toBeInTheDocument();
    expect(screen.getByText('below 70')).toBeInTheDocument();
  });
});
