import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBadge } from './ScoreBadge';

describe('ScoreBadge', () => {
  it('renders a rounded score', () => {
    render(<ScoreBadge score={72.6} />);
    expect(screen.getByText('73')).toBeInTheDocument();
  });

  it('uses the strong tone for high scores', () => {
    const { container } = render(<ScoreBadge score={80} />);
    expect(container.querySelector('.score-badge')).toHaveClass('strong');
  });

  it('uses the weak tone for low scores', () => {
    const { container } = render(<ScoreBadge score={20} />);
    expect(container.querySelector('.score-badge')).toHaveClass('weak');
  });
});
