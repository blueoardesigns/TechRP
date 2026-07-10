import React from 'react';
import { render } from '@testing-library/react-native';
import ScoreBadge from '../components/ScoreBadge';
import { colors } from '../lib/theme';

// Badge backgrounds are the semantic score color with an alpha suffix,
// so band changes in badgeColor() fail these tests.
describe('ScoreBadge', () => {
  it('renders the score', () => {
    const { getByText } = render(<ScoreBadge score={85} />);
    expect(getByText('85')).toBeTruthy();
  });

  it('renders green for score >= 80', () => {
    const { getByTestId } = render(<ScoreBadge score={85} />);
    const badge = getByTestId('score-badge');
    expect(badge.props.style).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: colors.scoreGreen + '18' })])
    );
  });

  it('renders yellow for score 60-79', () => {
    const { getByTestId } = render(<ScoreBadge score={65} />);
    const badge = getByTestId('score-badge');
    expect(badge.props.style).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: colors.scoreYellow + '18' })])
    );
  });

  it('renders red for score < 60', () => {
    const { getByTestId } = render(<ScoreBadge score={45} />);
    const badge = getByTestId('score-badge');
    expect(badge.props.style).toMatchObject(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: colors.scoreRed + '18' })])
    );
  });
});
