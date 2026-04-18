-- TechRP Demo Seed: Coach Account + 4 Companies
-- Run as TWO separate queries in Supabase SQL Editor:
--   STEP 1: Run lines 1-128  (creates helper function)
--   STEP 2: Run lines 130+   (creates orgs, users, sessions)

-- ===========================================================================
-- STEP 1: Helper function -- run this first, then run STEP 2 separately
-- ===========================================================================

CREATE OR REPLACE FUNCTION _demo_seed_sessions(
  p_user_id     UUID,
  p_org_id      UUID,
  p_base_score  INT,
  p_count       INT,
  p_offset      INT
) RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
  v_score        INT;
  v_scenario     TEXT;
  v_persona      TEXT;
  v_started_at   TIMESTAMPTZ;
  v_ended_at     TIMESTAMPTZ;
  v_strengths    TEXT;
  v_improvements TEXT;
  v_summary      TEXT;
  v_transcript   TEXT;
  v_scenarios    TEXT[] := ARRAY[
    'homeowner_inbound','homeowner_facetime','plumber_lead',
    'property_manager','insurance_broker','plumber_bd',
    'property_manager_discovery','commercial_property_manager',
    'insurance_broker_discovery','plumber_bd_discovery'
  ];
  v_personas TEXT[] := ARRAY[
    'Stressed Homeowner Linda','Skeptical Homeowner Dave',
    'Friendly Plumber Mike','Busy PM Sandra',
    'Detail-Oriented Agent Frank','Tough Plumber Rick',
    'Cautious PM Karen','Commercial PM Steve',
    'Insurance Agent Sarah','Plumbing Owner Pete'
  ];
  i INT;
BEGIN
  FOR i IN 1..p_count LOOP
    v_score := LEAST(10, GREATEST(1,
      p_base_score
      + (RANDOM() * 2 - 1)::INT
      + CASE WHEN i > p_count * 0.7 THEN 1 ELSE 0 END
    ));
    v_scenario := v_scenarios[((i + p_offset - 1) % 10) + 1];
    v_persona  := v_personas[((i + p_offset - 1) % 10) + 1];
    v_started_at := now()
      - ((p_count - i + 1) * (90.0 / p_count) * INTERVAL '1 day')
      + ((RANDOM() * 8 - 4) * INTERVAL '1 hour');
    v_ended_at := v_started_at + ((180 + (RANDOM() * 900)::INT) * INTERVAL '1 second');

    IF v_score >= 9 THEN
      v_strengths    := '["Exceptional rapport and trust-building from the first 30 seconds","Confidently explained drying science without overwhelming","Handled all objections with empathy and data","Strong natural close with clear next steps","Deep knowledge of insurance process"]';
      v_improvements := '["Minor pacing issue near the end","Could offer a brief written follow-up summary"]';
      v_summary      := 'Outstanding call. The technician demonstrated mastery of the full sales process. Homeowner rapport was established immediately and maintained throughout. A model performance worth using for team training.';
    ELSIF v_score >= 7 THEN
      v_strengths    := '["Strong opening that quickly established credibility","Good explanation of the restoration process","Handled price objection by shifting to value","Closed with a clear call to action"]';
      v_improvements := '["Could build more emotional urgency around water damage risks","Missed an opportunity to ask about insurance coverage","Follow-up question after objection felt slightly scripted"]';
      v_summary      := 'Solid performance overall. The technician covered the key sales beats and kept the homeowner engaged. A few missed probing opportunities but the foundation is there.';
    ELSIF v_score >= 5 THEN
      v_strengths    := '["Friendly and approachable tone throughout","Correctly identified the scenario type","Attempted to explain the process"]';
      v_improvements := '["Opening lacked a credibility hook","Failed to create urgency around secondary damage risks","Price objection met with defensiveness instead of value reframe","No clear close -- call ended without a defined next step"]';
      v_summary      := 'Average performance with meaningful gaps. The technician was likable but missed several critical moments to move the sale forward. Recommend reviewing objection handling and close techniques.';
    ELSIF v_score >= 3 THEN
      v_strengths    := '["Showed up and completed the call","Basic scenario awareness demonstrated"]';
      v_improvements := '["Opening was weak and failed to capture attention","Could not explain the drying process clearly","Multiple objections went unaddressed","No attempt to close -- call ended awkwardly","Recommend additional roleplay before live interactions"]';
      v_summary      := 'Struggling performance with significant gaps. Needs focused coaching on sales structure: strong opening, value proposition, objection handling, and closing.';
    ELSE
      v_strengths    := '["Completed the session"]';
      v_improvements := '["Opening creates distrust rather than rapport","Unable to explain what we do or why it matters","All objections led to call breakdown","No understanding of close mechanics","Full foundational training required"]';
      v_summary      := 'Critical performance issues across the board. Not yet ready for customer-facing sales situations. Immediate intensive coaching required starting with the opening script.';
    END IF;

    v_transcript := '[{"role":"assistant","content":"Hi there, I am reaching out about the water damage situation -- how is everything going on your end?"},{"role":"user","content":"Honestly not great, we are pretty stressed about it."},{"role":"assistant","content":"I completely understand. Let me walk you through exactly how we handle this and what you can expect..."},{"role":"user","content":"Okay, but I am also worried about the cost..."},{"role":"assistant","content":"That is a really common concern and I want to address it directly..."}]';

    INSERT INTO training_sessions (
      user_id, organization_id,
      started_at, ended_at,
      transcript, assessment,
      persona_name, persona_scenario_type,
      vapi_call_id
    ) VALUES (
      p_user_id, p_org_id,
      v_started_at, v_ended_at,
      v_transcript::jsonb,
      json_build_object(
        'score',        v_score,
        'strengths',    v_strengths::jsonb,
        'improvements', v_improvements::jsonb,
        'summary',      v_summary
      )::jsonb,
      v_persona, v_scenario,
      'demo-' || encode(gen_random_bytes(8), 'hex')
    );
  END LOOP;
END;
$func$;

-- ===========================================================================
-- STEP 2: Run this block separately after STEP 1 succeeds
-- ===========================================================================

DO $$
DECLARE
  v_tim_id            UUID;
  v_coach_instance_id UUID;
  v_abc_org_id        UUID;
  v_sttbr_org_id      UUID;
  v_grace_org_id      UUID;
  v_effie_org_id      UUID;
  v_joe_id    UUID; v_sue_id    UUID; v_mike_id   UUID; v_sarah_id  UUID;
  v_david_id  UUID; v_rachel_id UUID; v_james_id  UUID;
  v_s1 UUID; v_s2 UUID; v_s3 UUID; v_s4 UUID; v_s5 UUID; v_s6 UUID; v_s7 UUID;
  v_g1 UUID; v_g2 UUID; v_g3 UUID; v_g4 UUID; v_g5 UUID; v_g6 UUID;
  v_e1 UUID; v_e2 UUID; v_e3 UUID; v_e4 UUID; v_e5 UUID; v_e6 UUID; v_e7 UUID;
BEGIN

  -- Find Tim
  SELECT id INTO v_tim_id FROM users WHERE email = 'tim@blueoardesigns.com' LIMIT 1;
  IF v_tim_id IS NULL THEN
    RAISE EXCEPTION 'tim@blueoardesigns.com not found -- create the account first';
  END IF;

  -- Create coach instance (Tim stays superuser -- superuser can access coach views)
  v_coach_instance_id := gen_random_uuid();
  INSERT INTO coach_instances (
    id, coach_user_id, name, invite_token,
    global_playbooks_enabled, global_personas_enabled, auto_approve_users
  ) VALUES (
    v_coach_instance_id, v_tim_id,
    'Tim Bauer Restoration Coaching',
    encode(gen_random_bytes(16), 'hex'),
    true, true, true
  );

  -- Attach coach instance to Tim without changing his superuser role
  UPDATE users SET
    coach_instance_id = v_coach_instance_id,
    status            = 'approved',
    full_name         = COALESCE(full_name, 'Tim Bauer')
  WHERE id = v_tim_id;

  RAISE NOTICE 'Coach instance attached to Tim (superuser). Instance: %', v_coach_instance_id;

  -- ---------------------------------------------------------------------------
  -- ABC RESTORATION CO.  (7 techs x 20 sessions)
  -- ---------------------------------------------------------------------------

  v_abc_org_id := gen_random_uuid();
  INSERT INTO organizations (id, name, coach_instance_id, invite_token)
  VALUES (v_abc_org_id, 'ABC Restoration Co.', v_coach_instance_id, encode(gen_random_bytes(16), 'hex'));

  INSERT INTO users (id, role, name, full_name, email, app_role, status, organization_id, coach_instance_id, referral_code)
  VALUES (gen_random_uuid(), 'manager', 'Alex Admin', 'Alex Admin', 'demo.admin@abcrestoration.demo', 'company_admin', 'approved', v_abc_org_id, v_coach_instance_id, 'ABCADM01');

  v_joe_id := gen_random_uuid(); v_sue_id := gen_random_uuid(); v_mike_id  := gen_random_uuid();
  v_sarah_id := gen_random_uuid(); v_david_id := gen_random_uuid(); v_rachel_id := gen_random_uuid();
  v_james_id := gen_random_uuid();

  INSERT INTO users (id, role, name, full_name, email, app_role, status, organization_id, coach_instance_id, referral_code) VALUES
    (v_joe_id,    'technician', 'Below Average Joe', 'Below Average Joe', 'joe.smith@abcrestoration.demo',  'individual', 'approved', v_abc_org_id, v_coach_instance_id, 'JOESM001'),
    (v_sue_id,    'technician', 'Below Average Sue', 'Below Average Sue', 'sue.davis@abcrestoration.demo',  'individual', 'approved', v_abc_org_id, v_coach_instance_id, 'SUEDV001'),
    (v_mike_id,   'technician', 'Mike Torres',       'Mike Torres',       'mike.t@abcrestoration.demo',     'individual', 'approved', v_abc_org_id, v_coach_instance_id, 'MIKETO01'),
    (v_sarah_id,  'technician', 'Sarah Chen',        'Sarah Chen',        'sarah.c@abcrestoration.demo',    'individual', 'approved', v_abc_org_id, v_coach_instance_id, 'SARACH01'),
    (v_david_id,  'technician', 'David Kim',         'David Kim',         'david.k@abcrestoration.demo',    'individual', 'approved', v_abc_org_id, v_coach_instance_id, 'DAVIDK01'),
    (v_rachel_id, 'technician', 'Rachel Martinez',   'Rachel Martinez',   'rachel.m@abcrestoration.demo',   'individual', 'approved', v_abc_org_id, v_coach_instance_id, 'RACHM001'),
    (v_james_id,  'technician', 'James Wilson',      'James Wilson',      'james.w@abcrestoration.demo',    'individual', 'approved', v_abc_org_id, v_coach_instance_id, 'JAMESWI1');

  PERFORM _demo_seed_sessions(v_joe_id,    v_abc_org_id, 2, 20, 0);
  PERFORM _demo_seed_sessions(v_sue_id,    v_abc_org_id, 2, 20, 3);
  PERFORM _demo_seed_sessions(v_mike_id,   v_abc_org_id, 5, 20, 1);
  PERFORM _demo_seed_sessions(v_sarah_id,  v_abc_org_id, 6, 20, 4);
  PERFORM _demo_seed_sessions(v_david_id,  v_abc_org_id, 7, 20, 2);
  PERFORM _demo_seed_sessions(v_rachel_id, v_abc_org_id, 8, 20, 6);
  PERFORM _demo_seed_sessions(v_james_id,  v_abc_org_id, 7, 20, 8);
  RAISE NOTICE 'ABC Restoration Co. seeded.';

  -- ---------------------------------------------------------------------------
  -- SOON TO BE THE BEST RESTORATION  (7 techs x 10 sessions)
  -- ---------------------------------------------------------------------------

  v_sttbr_org_id := gen_random_uuid();
  INSERT INTO organizations (id, name, coach_instance_id, invite_token)
  VALUES (v_sttbr_org_id, 'Soon to be the Best Restoration', v_coach_instance_id, encode(gen_random_bytes(16), 'hex'));

  INSERT INTO users (id, role, name, full_name, email, app_role, status, organization_id, coach_instance_id, referral_code)
  VALUES (gen_random_uuid(), 'manager', 'Jordan Manager', 'Jordan Manager', 'admin@sttbr.demo', 'company_admin', 'approved', v_sttbr_org_id, v_coach_instance_id, 'STTBADM1');

  v_s1 := gen_random_uuid(); v_s2 := gen_random_uuid(); v_s3 := gen_random_uuid(); v_s4 := gen_random_uuid();
  v_s5 := gen_random_uuid(); v_s6 := gen_random_uuid(); v_s7 := gen_random_uuid();

  INSERT INTO users (id, role, name, full_name, email, app_role, status, organization_id, coach_instance_id, referral_code) VALUES
    (v_s1, 'technician', 'Star Performer Sam', 'Star Performer Sam', 'sam.p@sttbr.demo',    'individual', 'approved', v_sttbr_org_id, v_coach_instance_id, 'SAMSP001'),
    (v_s2, 'technician', 'Rising Star Alex',   'Rising Star Alex',   'alex.r@sttbr.demo',   'individual', 'approved', v_sttbr_org_id, v_coach_instance_id, 'ALEXRS01'),
    (v_s3, 'technician', 'Solid Chris',        'Solid Chris',        'chris.s@sttbr.demo',  'individual', 'approved', v_sttbr_org_id, v_coach_instance_id, 'CHRISS01'),
    (v_s4, 'technician', 'Average Andy',       'Average Andy',       'andy.a@sttbr.demo',   'individual', 'approved', v_sttbr_org_id, v_coach_instance_id, 'ANDYAV01'),
    (v_s5, 'technician', 'Needs Work Nate',    'Needs Work Nate',    'nate.n@sttbr.demo',   'individual', 'approved', v_sttbr_org_id, v_coach_instance_id, 'NATENW01'),
    (v_s6, 'technician', 'Struggling Steve',   'Struggling Steve',   'steve.s@sttbr.demo',  'individual', 'approved', v_sttbr_org_id, v_coach_instance_id, 'STEVSS01'),
    (v_s7, 'technician', 'Learning Lauren',    'Learning Lauren',    'lauren.l@sttbr.demo', 'individual', 'approved', v_sttbr_org_id, v_coach_instance_id, 'LAURLL01');

  PERFORM _demo_seed_sessions(v_s1, v_sttbr_org_id, 9, 10, 0);
  PERFORM _demo_seed_sessions(v_s2, v_sttbr_org_id, 8, 10, 2);
  PERFORM _demo_seed_sessions(v_s3, v_sttbr_org_id, 7, 10, 4);
  PERFORM _demo_seed_sessions(v_s4, v_sttbr_org_id, 5, 10, 6);
  PERFORM _demo_seed_sessions(v_s5, v_sttbr_org_id, 4, 10, 1);
  PERFORM _demo_seed_sessions(v_s6, v_sttbr_org_id, 2, 10, 3);
  PERFORM _demo_seed_sessions(v_s7, v_sttbr_org_id, 3, 10, 5);
  RAISE NOTICE 'Soon to be the Best Restoration seeded.';

  -- ---------------------------------------------------------------------------
  -- GRACE RESTORATION  (6 techs x 10 sessions)
  -- ---------------------------------------------------------------------------

  v_grace_org_id := gen_random_uuid();
  INSERT INTO organizations (id, name, coach_instance_id, invite_token)
  VALUES (v_grace_org_id, 'Grace Restoration', v_coach_instance_id, encode(gen_random_bytes(16), 'hex'));

  INSERT INTO users (id, role, name, full_name, email, app_role, status, organization_id, coach_instance_id, referral_code)
  VALUES (gen_random_uuid(), 'manager', 'Grace Manager', 'Grace Manager', 'admin@gracerestoration.demo', 'company_admin', 'approved', v_grace_org_id, v_coach_instance_id, 'GRACEADM');

  v_g1 := gen_random_uuid(); v_g2 := gen_random_uuid(); v_g3 := gen_random_uuid();
  v_g4 := gen_random_uuid(); v_g5 := gen_random_uuid(); v_g6 := gen_random_uuid();

  INSERT INTO users (id, role, name, full_name, email, app_role, status, organization_id, coach_instance_id, referral_code) VALUES
    (v_g1, 'technician', 'Top Gun Tara',       'Top Gun Tara',       'tara.t@gracerestoration.demo',   'individual', 'approved', v_grace_org_id, v_coach_instance_id, 'TARATG01'),
    (v_g2, 'technician', 'Competent Carol',    'Competent Carol',    'carol.c@gracerestoration.demo',  'individual', 'approved', v_grace_org_id, v_coach_instance_id, 'CAROLC01'),
    (v_g3, 'technician', 'Middle Ground Mike', 'Middle Ground Mike', 'mike.m@gracerestoration.demo',   'individual', 'approved', v_grace_org_id, v_coach_instance_id, 'MIKEMG01'),
    (v_g4, 'technician', 'Developing Dana',    'Developing Dana',    'dana.d@gracerestoration.demo',   'individual', 'approved', v_grace_org_id, v_coach_instance_id, 'DANAD001'),
    (v_g5, 'technician', 'Lagging Luis',       'Lagging Luis',       'luis.l@gracerestoration.demo',   'individual', 'approved', v_grace_org_id, v_coach_instance_id, 'LUISLL01'),
    (v_g6, 'technician', 'Awful Arnold',       'Awful Arnold',       'arnold.a@gracerestoration.demo', 'individual', 'approved', v_grace_org_id, v_coach_instance_id, 'ARNOLA01');

  PERFORM _demo_seed_sessions(v_g1, v_grace_org_id, 9, 10, 0);
  PERFORM _demo_seed_sessions(v_g2, v_grace_org_id, 7, 10, 3);
  PERFORM _demo_seed_sessions(v_g3, v_grace_org_id, 6, 10, 6);
  PERFORM _demo_seed_sessions(v_g4, v_grace_org_id, 5, 10, 1);
  PERFORM _demo_seed_sessions(v_g5, v_grace_org_id, 3, 10, 4);
  PERFORM _demo_seed_sessions(v_g6, v_grace_org_id, 2, 10, 7);
  RAISE NOTICE 'Grace Restoration seeded.';

  -- ---------------------------------------------------------------------------
  -- EFFIE RESTORATION  (7 techs x 10 sessions)
  -- ---------------------------------------------------------------------------

  v_effie_org_id := gen_random_uuid();
  INSERT INTO organizations (id, name, coach_instance_id, invite_token)
  VALUES (v_effie_org_id, 'Effie Restoration', v_coach_instance_id, encode(gen_random_bytes(16), 'hex'));

  INSERT INTO users (id, role, name, full_name, email, app_role, status, organization_id, coach_instance_id, referral_code)
  VALUES (gen_random_uuid(), 'manager', 'Effie Manager', 'Effie Manager', 'admin@effierestoration.demo', 'company_admin', 'approved', v_effie_org_id, v_coach_instance_id, 'EFFIEADM');

  v_e1 := gen_random_uuid(); v_e2 := gen_random_uuid(); v_e3 := gen_random_uuid(); v_e4 := gen_random_uuid();
  v_e5 := gen_random_uuid(); v_e6 := gen_random_uuid(); v_e7 := gen_random_uuid();

  INSERT INTO users (id, role, name, full_name, email, app_role, status, organization_id, coach_instance_id, referral_code) VALUES
    (v_e1, 'technician', 'Elite Eddie',    'Elite Eddie',    'eddie.e@effierestoration.demo',  'individual', 'approved', v_effie_org_id, v_coach_instance_id, 'EDDYEE01'),
    (v_e2, 'technician', 'Great Glen',     'Great Glen',     'glen.g@effierestoration.demo',   'individual', 'approved', v_effie_org_id, v_coach_instance_id, 'GLENGG01'),
    (v_e3, 'technician', 'Good Greg',      'Good Greg',      'greg.g@effierestoration.demo',   'individual', 'approved', v_effie_org_id, v_coach_instance_id, 'GREGG001'),
    (v_e4, 'technician', 'Decent Diana',   'Decent Diana',   'diana.d@effierestoration.demo',  'individual', 'approved', v_effie_org_id, v_coach_instance_id, 'DIANADD1'),
    (v_e5, 'technician', 'Average Anna',   'Average Anna',   'anna.a@effierestoration.demo',   'individual', 'approved', v_effie_org_id, v_coach_instance_id, 'ANNAAA01'),
    (v_e6, 'technician', 'Below Par Bob',  'Below Par Bob',  'bob.b@effierestoration.demo',    'individual', 'approved', v_effie_org_id, v_coach_instance_id, 'BOBBB001'),
    (v_e7, 'technician', 'Terrible Terri', 'Terrible Terri', 'terri.t@effierestoration.demo',  'individual', 'approved', v_effie_org_id, v_coach_instance_id, 'TERRTT01');

  PERFORM _demo_seed_sessions(v_e1, v_effie_org_id, 10, 10, 0);
  PERFORM _demo_seed_sessions(v_e2, v_effie_org_id,  8, 10, 2);
  PERFORM _demo_seed_sessions(v_e3, v_effie_org_id,  7, 10, 5);
  PERFORM _demo_seed_sessions(v_e4, v_effie_org_id,  6, 10, 7);
  PERFORM _demo_seed_sessions(v_e5, v_effie_org_id,  5, 10, 1);
  PERFORM _demo_seed_sessions(v_e6, v_effie_org_id,  3, 10, 4);
  PERFORM _demo_seed_sessions(v_e7, v_effie_org_id,  2, 10, 6);
  RAISE NOTICE 'Effie Restoration seeded.';

  RAISE NOTICE 'Demo seed complete.';
END $$;

-- Cleanup
DROP FUNCTION IF EXISTS _demo_seed_sessions(UUID, UUID, INT, INT, INT);
