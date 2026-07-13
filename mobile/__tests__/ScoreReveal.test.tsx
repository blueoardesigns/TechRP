import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

// ScoreReveal → lib/mastery → lib/supabase; stub the client so Jest doesn't
// need native AsyncStorage or env vars
jest.mock('../lib/supabase', () => ({ supabase: {} }));
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

  it('shows a gold medal unlock line', async () => {
    const { getByText } = render(
      <ScoreReveal
        score={90} letter="A" stats={null} streakDays={null}
        medal={{ type: 'unlock', tier: 'gold', scenarioLabel: 'Price Objections' }}
      />,
    );
    await waitFor(() => getByText('🥇 Gold medal — Price Objections mastered!'));
  });

  it('shows a bronze medal unlock line', async () => {
    const { getByText } = render(
      <ScoreReveal
        score={72} letter="C" stats={null} streakDays={null}
        medal={{ type: 'unlock', tier: 'bronze', scenarioLabel: 'Upsell' }}
      />,
    );
    await waitFor(() => getByText('🥉 Bronze medal — Upsell!'));
  });

  it('shows a progress line toward the next tier', async () => {
    const { getByText } = render(
      <ScoreReveal
        score={86} letter="B" stats={null} streakDays={null}
        medal={{ type: 'progress', tier: 'silver', scenarioLabel: 'Upsell', have: 1, need: 2 }}
      />,
    );
    await waitFor(() => getByText('🥈 1/2 toward silver — Upsell'));
  });

  it('omits medal line when medal is null', async () => {
    const { getByText, queryByText } = render(
      <ScoreReveal score={75} letter="C" stats={null} streakDays={null} medal={null} />,
    );
    await waitFor(() => getByText('75'));
    expect(queryByText(/medal/i)).toBeNull();
    expect(queryByText(/toward/)).toBeNull();
  });

  it('shows the XP gained line', async () => {
    const { getByText } = render(
      <ScoreReveal score={85} letter="B" stats={null} streakDays={null} xpGained={115} />,
    );
    await waitFor(() => getByText('+115 XP'));
  });

  it('shows a level-up line', async () => {
    const { getByText } = render(
      <ScoreReveal
        score={85} letter="B" stats={null} streakDays={null}
        levelUp={{ level: 8, rank: 'Journeyman', rankChanged: false }}
      />,
    );
    await waitFor(() => getByText('⬆️ Level 8 — Journeyman!'));
  });

  it('uses rank-up wording when the rank band changes', async () => {
    const { getByText } = render(
      <ScoreReveal
        score={85} letter="B" stats={null} streakDays={null}
        levelUp={{ level: 10, rank: 'Pro', rankChanged: true }}
      />,
    );
    await waitFor(() => getByText('⬆️ Rank up! Level 10 — Pro'));
  });

  it('omits XP and level lines when data is unavailable', async () => {
    const { getByText, queryByText } = render(
      <ScoreReveal score={75} letter="C" stats={null} streakDays={null} xpGained={null} levelUp={null} />,
    );
    await waitFor(() => getByText('75'));
    expect(queryByText(/XP/)).toBeNull();
    expect(queryByText(/Level/)).toBeNull();
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
