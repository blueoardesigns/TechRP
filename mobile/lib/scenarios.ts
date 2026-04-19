import { ScenarioConfig } from './types';

export const VAPI_ASSISTANT_ID = 'a2a54457-a2b0-4046-82b5-c7506ab9a401';
export const GROQ_MODEL = 'llama-3.1-8b-instant';

export const SCENARIOS: ScenarioConfig[] = [
  // Technician
  {
    type: 'homeowner_inbound',
    group: 'technician',
    callType: 'cold_call',
    label: 'Homeowner — Inbound Call',
    description: 'A homeowner found you on Google and is calling for help with water damage.',
    icon: '📞',
    techRole: 'Technician',
  },
  {
    type: 'homeowner_facetime',
    group: 'technician',
    callType: 'cold_call',
    label: 'Homeowner — Face to Face',
    description: 'You knocked on their door. They have water damage and you are there to help.',
    icon: '🚪',
    techRole: 'Technician',
  },
  {
    type: 'plumber_lead',
    group: 'technician',
    callType: 'cold_call',
    label: 'Lead Referred by Plumber',
    description: "A plumber sent this homeowner your way. You're calling or visiting to convert the referral.",
    icon: '🔧',
    techRole: 'Technician',
  },
  // BizDev — Cold Calls
  {
    type: 'property_manager',
    group: 'bizdev',
    callType: 'cold_call',
    label: 'Residential Property Manager',
    description: 'Outbound call to a residential property manager to pitch restoration services.',
    icon: '🏠',
    techRole: 'Business Development Rep',
  },
  {
    type: 'commercial_property_manager',
    group: 'bizdev',
    callType: 'cold_call',
    label: 'Commercial Property Manager',
    description: 'Outbound call to a commercial property manager to pitch restoration services.',
    icon: '🏢',
    techRole: 'Business Development Rep',
  },
  {
    type: 'insurance_broker',
    group: 'bizdev',
    callType: 'cold_call',
    label: 'Insurance Broker',
    description: 'Outbound call to an insurance broker or agent to build a referral relationship.',
    icon: '📋',
    techRole: 'Business Development Rep',
  },
  {
    type: 'plumber_bd',
    group: 'bizdev',
    callType: 'cold_call',
    label: 'Plumber',
    description: 'Outbound call to a plumbing company owner to pitch a referral partnership.',
    icon: '🪠',
    techRole: 'Business Development Rep',
  },
  // BizDev — Discovery Meetings
  {
    type: 'property_manager_discovery',
    group: 'bizdev',
    callType: 'discovery',
    label: 'Residential Property Manager',
    description: 'Scheduled discovery meeting — uncover needs, vendor gaps, and referral volume.',
    icon: '🏠',
    techRole: 'Business Development Rep',
  },
  {
    type: 'commercial_pm_discovery',
    group: 'bizdev',
    callType: 'discovery',
    label: 'Commercial Property Manager',
    description: 'Scheduled discovery meeting — learn their portfolio and decision process.',
    icon: '🏢',
    techRole: 'Business Development Rep',
  },
  {
    type: 'insurance_broker_discovery',
    group: 'bizdev',
    callType: 'discovery',
    label: 'Insurance Broker',
    description: 'Scheduled discovery meeting — uncover their book, referral process, and vendor satisfaction.',
    icon: '📋',
    techRole: 'Business Development Rep',
  },
  {
    type: 'plumber_bd_discovery',
    group: 'bizdev',
    callType: 'discovery',
    label: 'Plumber',
    description: 'Scheduled discovery meeting with a plumbing company.',
    icon: '🪠',
    techRole: 'Business Development Rep',
  },
];

const VOICE_POOLS = {
  male: ['burt', 'drew', 'josh', 'paul'],
  female: ['sarah', 'rachel', 'domi', 'bella'],
};

export function pickVoice(persona: { id: string; gender?: 'male' | 'female' }): string {
  const pool = persona.gender === 'male' ? VOICE_POOLS.male : VOICE_POOLS.female;
  let hash = 0;
  for (let i = 0; i < persona.id.length; i++) {
    hash = (hash * 31 + persona.id.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

export function getScenarioConfig(type: string): ScenarioConfig | undefined {
  return SCENARIOS.find(s => s.type === type);
}

export function getSectionedScenarios(): Array<{ title: string; data: ScenarioConfig[] }> {
  const techScenarios = SCENARIOS.filter(s => s.group === 'technician');
  const coldCalls = SCENARIOS.filter(s => s.group === 'bizdev' && s.callType === 'cold_call');
  const discovery = SCENARIOS.filter(s => s.group === 'bizdev' && s.callType === 'discovery');
  return [
    { title: 'Technician', data: techScenarios },
    { title: 'BizDev — Cold Calls', data: coldCalls },
    { title: 'BizDev — Discovery', data: discovery },
  ];
}
