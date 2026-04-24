/**
 * generate-personas.mjs
 * Generates new personas using Claude API and appends them to all-personas.ts
 * Writes each batch immediately (resumable if interrupted).
 *
 * Usage: node generate-personas.mjs
 *
 * Reads ANTHROPIC_API_KEY from web/.env.local
 * Appends TypeScript persona objects to web/lib/all-personas.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load env ────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}
const ANTHROPIC_API_KEY = envVars['ANTHROPIC_API_KEY'];
if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not found in .env.local');

// ── Config ──────────────────────────────────────────────────────────────────
const PERSONAS_FILE = path.join(__dirname, 'lib', 'all-personas.ts');
const BATCH_SIZE = 5;
const SLEEP_MS = 800;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Count existing personas in file ──────────────────────────────────────────
function countExistingByType(content) {
  const counts = {};
  const matches = content.matchAll(/scenarioType:\s*"([^"]+)"\s+as\s+ScenarioType/g);
  for (const m of matches) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  return counts;
}

// ── Type definitions ─────────────────────────────────────────────────────────
const TARGET = 50;

const TYPE_CONFIG = {
  homeowner_inbound: {
    speakerLabel: 'Homeowner',
    context: 'A homeowner calling in after discovering water damage (pipe burst, toilet overflow, appliance leak, flooding, etc.). They are calling a restoration company for help.',
    promptHints: `Vary personality types widely. Do NOT use these types already covered: Panicking First-Timer, Calm & Analytical, Resistant to Signing, Insurance-Skeptical, Budget-Focused, Angry Renter, Previous Bad Experience, Elderly & Confused, ESL, Vacation Home Remote, HOA-Worried, Landlord with Tenants.

New angles to use (pick any 5 from this list or invent new ones):
Denial about severity, wants second opinion first, comparing quotes, overly chatty/derails conversation, conspiracy theorist about restoration industry, already started cleanup herself, husband is a DIYer who thinks they don't need mitigation, in middle of selling the house, just bought the house last week, flooding during a family event/party, called insurance first and now confused about who does what, worried about mold because of news story, has a relative who works in construction, wants everything documented for a lawsuit.

Each persona MUST have:
- A UNIQUE personality type not matching any others
- Their specific water damage scenario (what happened, where, how bad)
- Their insurance carrier
- 2-3 specific objection phrases they'll say verbatim
- Clear behavior triggers: what makes them cooperate vs. dig in
- How they get closed (what does the tech need to say/do)
systemPrompt length: 250-400 words.`,
  },
  homeowner_facetime: {
    speakerLabel: 'Homeowner',
    context: 'A technician is doing an on-site or video walkthrough (FaceTime/Zoom) of water damage with a homeowner. The tech needs to assess and sign the job.',
    promptHints: `Do NOT repeat personality types already used. Invent fresh angles:
Mother who wants to call her husband before signing, person who already started tearing out wet drywall, investment property owner not on-site, camera shy/uncomfortable with video, has gotten 3 quotes already, wants to understand every line item, just had a major renovation last year and is devastated, renter who's not sure if they should call landlord, elderly homeowner who can't operate phone camera well, refuses to believe the damage is as bad as tech says, overprotective dog owner worried about pets during work, homeowner who keeps getting interrupted by phone calls during walkthrough.

systemPrompt: 250-400 words covering character, situation (specific rooms affected), what tech sees on video, objections, behavior triggers, close triggers.`,
  },
  insurance_broker: {
    speakerLabel: 'Insurance Agent',
    context: 'A BD rep making a cold call or brief warm visit to an insurance agent or broker, pitching restoration referrals.',
    promptHints: `Do NOT repeat: Open Independent Agent, Captive State Farm Agent, etc. New angles:
Retiring agent who doesn't want to build new vendor relationships, commercial-lines specialist who handles very few personal property claims, brand new agent (first 6 months) who is overwhelmed, agent who was burned by a restoration company that scammed his client, agent whose agency has a corporate-mandated preferred vendor list she can't deviate from, agent who is skeptical about steering laws, agent who has a "we send everyone to the carrier 800 number" policy, wholesaler/surplus lines broker who doesn't have retail clients, office manager who screens all vendor calls for the principal agent, bilingual agent with a Spanish-speaking book who values vendors who speak Spanish.

systemPrompt: 250-400 words. Include: agent character, book size, current vendor situation (rate 1-5 if applicable), FNOL process, what they actually care about, specific objections they'll raise, close trigger.`,
  },
  insurance_broker_discovery: {
    speakerLabel: 'Insurance Agent',
    context: 'A BD rep in a scheduled sit-down discovery meeting with an insurance agent or agency owner.',
    promptHints: `Each discovery persona needs a FULL structured profile. Vary agent types completely:
Large independent agency owner (500+ policies), small captive agent (State Farm/Allstate/Farmers), commercial specialist (E&O + property heavy), agricultural/rural property book, condo association specialist, high-net-worth personal lines, hard-market-frustrated agent, agency with full-time FNOL coordinator, multi-location agency, Spanish-speaking community agency, recently acquired/merged agency, agency owner who also does financial planning.

The systemPrompt MUST be 450-600 words with ALL of these labeled sections:
YOUR CHARACTER:
BOOK OF BUSINESS (share when asked):
DECISION PROCESS (share when asked):
CURRENT VENDOR (share when asked):
REFERRAL VOLUME (share when asked):
WHAT YOU WANT TO KNOW (3 questions they'll ask):
BEHAVIOR NOTES:`,
  },
  plumber_bd: {
    speakerLabel: 'Plumber',
    context: 'A BD rep making a cold call or warm visit to a plumbing company owner or manager, pitching a restoration referral partnership.',
    promptHints: `Do NOT repeat types already covered. New angles:
Drain and sewer specialist (rarely sees WD), commercial-only plumber with no residential, franchise plumber with rigid corporate rules, plumber who gets zero restoration referral calls (service/repair only), family business (father and son), plumber who pays referrals internally to his techs already, plumber who sends all WD referrals to a handyman friend, union shop with dispatch constraints, plumber who wants leads back more than payout, high-volume Google/Yelp advertising shop, plumber who is also a licensed contractor and wants to do the remediation himself, new plumbing company (under 2 years) still building processes.

systemPrompt: 250-400 words. Include: plumber character, headcount + vehicles, current WD referral process, current vendor + rating (1-5), what they want, 2-3 objections, close trigger.`,
  },
  plumber_bd_discovery: {
    speakerLabel: 'Plumber',
    context: 'A BD rep in a scheduled sit-down discovery meeting with a plumbing company owner.',
    promptHints: `Each discovery persona needs a FULL structured profile. Vary plumber types:
15-plumber regional franchise, 3-plumber family operation, commercial-only shop, high-advertising residential shop, drain specialist, plumber with prior bad payout experience, exclusive territory deal with another restoration company, owner who never formalized referrals but sends jobs ad hoc, plumber who sends 10+ jobs/month already, plumber interested in leads-back arrangement, plumber with office manager who handles all referrals, owner who sends everything to his brother-in-law in construction.

The systemPrompt MUST be 450-600 words with ALL of these labeled sections:
YOUR CHARACTER:
BUSINESS DETAILS (share when asked):
REFERRAL VOLUME (share when asked):
DECISION PROCESS (share when asked):
CURRENT PARTNER (share when asked):
WHAT THEY'RE LOOKING FOR:
OBJECTIONS:
BEHAVIOR NOTES:`,
  },
  plumber_lead: {
    speakerLabel: 'Homeowner',
    context: 'A plumber just referred this homeowner to the restoration company. The homeowner is calling in based on that referral.',
    promptHints: `Vary widely. New angles:
Homeowner who fully trusts the plumber but doesn't know what restoration means, homeowner who only agreed to call because plumber was standing right there, rental property owner whose tenant had the damage, homeowner who thinks the plumber is going to fix the water damage too, homeowner who is already upset because plumber was expensive, homeowner who called insurance before calling restoration, elderly homeowner who barely understood the plumber, homeowner who speaks limited English, homeowner in denial (thinks a fan will fix it), homeowner who asks the restoration company "are you sure this is necessary?", business owner whose commercial property plumber made the referral, tenant calling on behalf of a landlord who isn't picking up.

systemPrompt: 250-400 words covering character, what the plumber told them, their emotional state, insurance situation, specific objections, close triggers.`,
  },
  property_manager: {
    speakerLabel: 'Property Manager',
    context: 'A BD rep cold calling or visiting a residential property manager to earn restoration referrals.',
    promptHints: `Do NOT repeat types already covered. New angles:
Section 8/affordable housing coordinator, vacation rental PM (Airbnb/VRBO portfolio), student housing director, HOA property manager, new to the PM role (overwhelmed), senior PM who's heard every pitch and is jaded, PM at a property management company with a strict approved vendor list, self-managing landlord (treats it as a side job), PM whose last restoration vendor caused a mold claim, PM obsessed with documentation and paperwork, PM who manages rural properties with long drive times, PM for senior/assisted living properties, PM for new construction warranty claims.

systemPrompt: 250-400 words. Include: PM character, portfolio size + type, current vendor + rating (1-5), FNOL process, what they care about, objections, close trigger.`,
  },
  property_manager_discovery: {
    speakerLabel: 'Property Manager',
    context: 'A BD rep in a scheduled discovery meeting with a residential property manager or PM company owner.',
    promptHints: `Each discovery persona needs a FULL structured profile. Vary PM types:
Small landlord growing fast (from 20 to 100 doors), mid-size PM company (150 units managed), corporate PM (1,000+ units with formal vendor approval), student housing director, HOA portfolio manager, vacation rental manager, Section 8 coordinator, new PM company just forming preferred vendor list, PM whose prior restoration vendor caused a mold claim.

The systemPrompt MUST be 450-600 words with ALL of these labeled sections:
YOUR CHARACTER:
PORTFOLIO DETAILS (share when asked):
DECISION PROCESS (share when asked):
CURRENT VENDOR (share when asked):
REFERRAL VOLUME (share when asked):
WHAT THEY CARE ABOUT:
BEHAVIOR NOTES:`,
  },
  commercial_property_manager: {
    speakerLabel: 'Property Manager',
    context: 'A BD rep cold calling or visiting a commercial property manager (office, retail, warehouse, mixed-use) to earn restoration referrals.',
    promptHints: `Vary commercial PM types completely. Avoid repeating:
Office park facilities director, retail strip mall manager, industrial/warehouse PM, mixed-use development manager, healthcare facility manager, hotel/hospitality facilities manager, government building facilities director, church/nonprofit facilities coordinator, school district facilities director, restaurant chain facilities manager, data center facilities manager, municipal airport facilities, senior living facilities director, self-storage facilities manager, co-working space operations manager, sports/entertainment venue facilities, car dealership group facilities.

systemPrompt: 250-400 words. Include: PM character, portfolio type + square footage, current vendor situation + rating, how WD emergencies are handled after hours, main concerns (speed, documentation, business interruption, insurance), key objections, close trigger.`,
  },
  commercial_pm_discovery: {
    speakerLabel: 'Property Manager',
    context: 'A BD rep in a scheduled discovery meeting with a commercial property manager or facilities director.',
    promptHints: `Each discovery persona needs a FULL structured profile. Vary commercial types:
Office park facilities director, retail property developer, industrial REIT portfolio manager, hotel facilities engineer, school district maintenance director, healthcare real estate manager, government facilities supervisor, airport concessions PM, warehouse logistics facility manager, senior living campus director.

The systemPrompt MUST be 450-600 words with ALL of these labeled sections:
YOUR CHARACTER:
PORTFOLIO DETAILS (share when asked):
DECISION PROCESS (share when asked):
CURRENT VENDOR (share when asked):
REFERRAL VOLUME (share when asked):
COMPLIANCE CONCERNS (COI, OSHA, BCP, insurance requirements):
BEHAVIOR NOTES:`,
  },
};

// ── Claude API call ───────────────────────────────────────────────────────────
async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ── Generate personas for one batch ──────────────────────────────────────────
async function generateBatch(scenarioType, startIndex, count, config) {
  const ids = Array.from({ length: count }, (_, i) => `${scenarioType}_${startIndex + i}`);

  const prompt = `You are generating training personas for a water damage restoration sales training app.

SCENARIO TYPE: ${scenarioType}
CONTEXT: ${config.context}

Generate exactly ${count} distinct personas. Each persona is a person the sales rep will practice talking to.

VARIATION GUIDANCE:
${config.promptHints}

REQUIRED OUTPUT FORMAT — return a valid JSON array with exactly ${count} objects. Use these IDs in order: ${JSON.stringify(ids)}

Each object must have ALL of these fields:
{
  "id": "...",
  "name": "Full Name",
  "scenarioType": "${scenarioType}",
  "gender": "male" or "female",
  "personalityType": "2-5 word label (e.g., 'Budget-Focused Skeptic')",
  "briefDescription": "2-3 sentences describing this person and what makes them a unique training scenario. Include their main objection or emotional state.",
  "speakerLabel": "${config.speakerLabel}",
  "firstMessage": "Their opening line when the call/meeting starts. Written IN CHARACTER as this person speaking. 1-3 natural sentences.",
  "systemPrompt": "Full character instructions for the AI playing this role. See length requirements in variation guidance."
}

RULES:
- firstMessage must be spoken IN CHARACTER — not a description
- systemPrompt: written as AI character instructions ("You are playing the role of...")
- Use diverse real-sounding names (mix Anglo, Hispanic, Asian, Eastern European, African-American, Middle Eastern, South Asian)
- No two personas may share the same personalityType
- Return ONLY the raw JSON array — no markdown fences, no explanation`;

  let raw = await callClaude(prompt);
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  let personas;
  try {
    personas = JSON.parse(raw);
  } catch (e) {
    // Try to find JSON array in response
    const match = raw.match(/\[[\s\S]+\]/);
    if (match) {
      try {
        personas = JSON.parse(match[0]);
      } catch {}
    }
    if (!personas) {
      console.error('JSON parse failed. Snippet:', raw.slice(0, 300));
      throw e;
    }
  }

  return personas;
}

// ── Format a persona as TypeScript ───────────────────────────────────────────
function formatPersona(p) {
  const hasNewlines = p.systemPrompt.includes('\n');
  const systemPromptFormatted = hasNewlines
    ? '`' + p.systemPrompt.replace(/`/g, "'").replace(/\$\{/g, '\\${') + '`'
    : JSON.stringify(p.systemPrompt);

  return `  {
    id: ${JSON.stringify(p.id)},
    name: ${JSON.stringify(p.name)},
    scenarioType: ${JSON.stringify(p.scenarioType)} as ScenarioType,
    gender: ${JSON.stringify(p.gender || 'male')},
    personalityType: ${JSON.stringify(p.personalityType)},
    briefDescription: ${JSON.stringify(p.briefDescription)},
    speakerLabel: ${JSON.stringify(p.speakerLabel)},
    firstMessage: ${JSON.stringify(p.firstMessage)},
    systemPrompt: ${systemPromptFormatted},
  },`;
}

// ── Write a batch of personas to the file (insert before closing ];) ──────────
function appendPersonasToFile(personas) {
  let content = fs.readFileSync(PERSONAS_FILE, 'utf-8');
  const closingIdx = content.lastIndexOf('];');
  if (closingIdx === -1) throw new Error('Could not find closing ]; in all-personas.ts');

  const newBlock = personas.map(formatPersona).join('\n');
  const newContent =
    content.slice(0, closingIdx) +
    '\n' + newBlock + '\n' +
    content.slice(closingIdx);

  fs.writeFileSync(PERSONAS_FILE, newContent, 'utf-8');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const content = fs.readFileSync(PERSONAS_FILE, 'utf-8');
  const existing = countExistingByType(content);

  console.log('Current counts:');
  for (const [type, count] of Object.entries(existing)) {
    console.log(`  ${type}: ${count}`);
  }

  let totalGenerated = 0;

  for (const [scenarioType, config] of Object.entries(TYPE_CONFIG)) {
    // Re-read counts each iteration since we write incrementally
    const currentContent = fs.readFileSync(PERSONAS_FILE, 'utf-8');
    const currentCounts = countExistingByType(currentContent);
    const have = currentCounts[scenarioType] || 0;
    const need = Math.max(0, TARGET - have);

    if (need === 0) {
      console.log(`\n✓ ${scenarioType}: already at ${have}, skipping`);
      continue;
    }

    console.log(`\n→ ${scenarioType}: have ${have}, generating ${need} more`);

    let startIndex = have + 1;
    let remaining = need;

    while (remaining > 0) {
      const batchCount = Math.min(BATCH_SIZE, remaining);
      process.stdout.write(`  Batch ${startIndex}-${startIndex + batchCount - 1}... `);

      let personas;
      let retries = 3;
      while (retries > 0) {
        try {
          personas = await generateBatch(scenarioType, startIndex, batchCount, config);
          break;
        } catch (e) {
          retries--;
          if (retries === 0) throw e;
          console.log(`\n  Error: ${e.message.slice(0, 80)}. Retrying (${3 - retries}/3)...`);
          await sleep(5000);
        }
      }

      // Write immediately
      appendPersonasToFile(personas);
      totalGenerated += personas.length;
      console.log(`done (${personas.length} written, total new: ${totalGenerated})`);

      startIndex += batchCount;
      remaining -= batchCount;

      if (remaining > 0) await sleep(SLEEP_MS);
    }

    console.log(`  ✓ ${scenarioType} complete`);
  }

  // Final count
  const finalContent = fs.readFileSync(PERSONAS_FILE, 'utf-8');
  const finalCounts = countExistingByType(finalContent);
  console.log('\nFinal counts:');
  let total = 0;
  for (const [type, count] of Object.entries(finalCounts)) {
    console.log(`  ${type}: ${count}`);
    total += count;
  }
  console.log(`  TOTAL: ${total}`);
  console.log(`\n✅ Done! Generated ${totalGenerated} new personas.`);
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
