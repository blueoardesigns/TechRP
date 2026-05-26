export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

const LETTER_BANDS = [
  { min: 90, letter: 'A' as LetterGrade },
  { min: 80, letter: 'B' as LetterGrade },
  { min: 70, letter: 'C' as LetterGrade },
  { min: 60, letter: 'D' as LetterGrade },
  { min: 0,  letter: 'F' as LetterGrade },
];

function computeLetter(score: number): LetterGrade {
  return LETTER_BANDS.find(b => score >= b.min)!.letter;
}

export function getDisplayScore(assessment: { score?: number; letter_grade?: string } | null | undefined): {
  score: number;
  letter: LetterGrade;
} {
  const raw = Number(assessment?.score ?? 0);
  const score = raw <= 10 ? Math.round(raw * 10) : Math.round(raw);
  const letter = (assessment?.letter_grade as LetterGrade | undefined) ?? computeLetter(score);
  return { score, letter };
}
