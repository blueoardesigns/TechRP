import { SCENARIOS, pickVoice, getScenarioConfig, getSectionedScenarios } from '../lib/scenarios';

describe('SCENARIOS', () => {
  it('has 11 scenario types', () => {
    expect(SCENARIOS).toHaveLength(11);
  });

  it('each scenario has required fields', () => {
    SCENARIOS.forEach(s => {
      expect(s.type).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.icon).toBeTruthy();
      expect(['technician', 'bizdev']).toContain(s.group);
    });
  });
});

describe('pickVoice', () => {
  it('returns a female voice for female persona', () => {
    const voice = pickVoice({ id: 'abc123', gender: 'female' });
    expect(['sarah', 'rachel', 'domi', 'bella']).toContain(voice);
  });

  it('returns a male voice for male persona', () => {
    const voice = pickVoice({ id: 'abc123', gender: 'male' });
    expect(['burt', 'drew', 'josh', 'paul']).toContain(voice);
  });

  it('is deterministic — same id always returns same voice', () => {
    const a = pickVoice({ id: 'persona_123' });
    const b = pickVoice({ id: 'persona_123' });
    expect(a).toBe(b);
  });

  it('defaults to female voice when gender is undefined', () => {
    const voice = pickVoice({ id: 'no-gender' });
    expect(['sarah', 'rachel', 'domi', 'bella']).toContain(voice);
  });
});

describe('getScenarioConfig', () => {
  it('returns config for known type', () => {
    const config = getScenarioConfig('homeowner_inbound');
    expect(config?.label).toBe('Homeowner — Inbound Call');
  });

  it('returns undefined for unknown type', () => {
    expect(getScenarioConfig('unknown_type')).toBeUndefined();
  });
});

describe('getSectionedScenarios', () => {
  it('returns 3 sections', () => {
    expect(getSectionedScenarios()).toHaveLength(3);
  });

  it('technician section has 3 scenarios', () => {
    const sections = getSectionedScenarios();
    expect(sections[0].data).toHaveLength(3);
  });
});
