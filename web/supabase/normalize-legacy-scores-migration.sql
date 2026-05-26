-- Normalize legacy 1-10 scores to 1-100 scale
-- Legacy assessments have score <= 10; new ones are 1-100.
-- This multiplies legacy scores by 10 and adds letter_grade where missing.

UPDATE training_sessions
SET assessment = jsonb_set(
  jsonb_set(
    assessment::jsonb,
    '{score}',
    to_jsonb(ROUND((assessment::jsonb->>'score')::numeric * 10))
  ),
  '{letter_grade}',
  to_jsonb(
    CASE
      WHEN ROUND((assessment::jsonb->>'score')::numeric * 10) >= 90 THEN 'A'
      WHEN ROUND((assessment::jsonb->>'score')::numeric * 10) >= 80 THEN 'B'
      WHEN ROUND((assessment::jsonb->>'score')::numeric * 10) >= 70 THEN 'C'
      WHEN ROUND((assessment::jsonb->>'score')::numeric * 10) >= 60 THEN 'D'
      ELSE 'F'
    END
  )
)
WHERE assessment IS NOT NULL
  AND (assessment::jsonb->>'score')::numeric <= 10
  AND (assessment::jsonb->>'score')::numeric > 0;
