import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('react-native-confetti-cannon', () => () => null);

import ScoreReveal from '../components/ScoreReveal';

// Reduce-motion path renders final values synchronously, letting us assert the
// business logic (comparison + streak lines) without driving Animated timers.
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

const stats = (previousBest: number, average: number, count: number) => ({ previousBest, average, count });

describe('ScoreReveal', () => {
  it('renders the final score and letter grade', async () => {
    const { getByText } = render(
      <ScoreReveal score={87} letter="B" stats={stats(90, 80, 4)} streakDays={null} />,
    );
    await waitFor(() => getByText('87'));
    getByText('B');
  });

  it('celebrates a new personal best', async () => {
    const { getByText } = render(
      <ScoreReveal score={92} letter="A" stats={stats(88, 80, 4)} streakDays={null} />,
    );
    await waitFor(() => getByText('🏆 New personal best!'));
  });

  it('shows positive delta vs average', async () => {
    const { getByText } = render(
      <ScoreReveal score={85} letter="B" stats={stats(90, 78, 4)} streakDays={null} />,
    );
    await waitFor(() => getByText('+7 vs your average'));
  });

  it('shows negative delta vs average', async () => {
    const { getByText } = render(
      <ScoreReveal score={70} letter="C" stats={stats(90, 78, 4)} streakDays={null} />,
    );
    await waitFor(() => getByText('-8 vs your average'));
  });

  it('greets the first-ever graded session', async () => {
    const { getByText } = render(
      <ScoreReveal score={75} letter="C" stats={stats(0, 0, 0)} streakDays={null} />,
    );
    await waitFor(() => getByText('First session on the board!'));
  });

  it('omits the comparison line when stats are unavailable', async () => {
    const { getByText, queryByText } = render(
      <ScoreReveal score={75} letter="C" stats={null} streakDays={null} />,
    );
    await waitFor(() => getByText('75'));
    expect(queryByText(/vs your average/)).toBeNull();
    expect(queryByText(/personal best/i)).toBeNull();
  });

  it('shows streak started on day 1 and extended after', async () => {
    const first = render(
      <ScoreReveal score={75} letter="C" stats={null} streakDays={1} />,
    );
    await waitFor(() => first.getByText('🔥 Day 1 — streak started!'));

    const later = render(
      <ScoreReveal score={75} letter="C" stats={null} streakDays={4} />,
    );
    await waitFor(() => later.getByText('🔥 Day 4 — streak extended!'));
  });
});
