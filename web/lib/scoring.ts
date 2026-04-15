// web/lib/scoring.ts
export const LETTER_BANDS = [
  { min: 90, letter: 'A' },
  { min: 80, letter: 'B' },
  { min: 70, letter: 'C' },
  { min: 60, letter: 'D' },
  { min: 0,  letter: 'F' },
] as const;

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export function computeLetter(score: number): LetterGrade {
  return LETTER_BANDS.find((b) => score >= b.min)!.letter as LetterGrade;
}

export interface ActionToTake {
  ai_said: string;
  suggested_response: string;
  technique?: string;
}

export interface Assessment {
  score: number;
  letter_grade?: LetterGrade;
  strengths: string[];
  improvements: string[];
  summary: string;
  actions_to_take?: ActionToTake[];
}

/**
 * Normalize any assessment (legacy 1–10 or new 1–100) to a 1–100 display score + letter.
 * Legacy scores (<= 10) are scaled by 10.
 */
export function getDisplayScore(assessment: Pick<Assessment, 'score' | 'letter_grade'> | null | undefined): {
  score: number;
  letter: LetterGrade;
} {
  const raw = Number(assessment?.score ?? 0);
  const score = raw <= 10 ? Math.round(raw * 10) : Math.round(raw);
  const letter = (assessment?.letter_grade as LetterGrade | undefined) ?? computeLetter(score);
  return { score, letter };
}

export function gradeColor(letter: LetterGrade): { text: string; ring: string; bg: string } {
  switch (letter) {
    case 'A': return { text: 'text-emerald-400', ring: 'border-emerald-500/40', bg: 'bg-emerald-500/10' };
    case 'B': return { text: 'text-lime-400',    ring: 'border-lime-500/40',    bg: 'bg-lime-500/10'    };
    case 'C': return { text: 'text-yellow-400',  ring: 'border-yellow-500/40',  bg: 'bg-yellow-500/10'  };
    case 'D': return { text: 'text-orange-400',  ring: 'border-orange-500/40',  bg: 'bg-orange-500/10'  };
    case 'F': return { text: 'text-red-400',     ring: 'border-red-500/40',     bg: 'bg-red-500/10'     };
  }
}
