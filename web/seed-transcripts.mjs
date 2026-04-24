/**
 * seed-transcripts.mjs
 * Seeds realistic transcripts + assessments into demo training sessions
 * that have source = 'demo' AND transcript IS NULL.
 *
 * Usage: node seed-transcripts.mjs
 * Reads Supabase config from web/.env.local
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

const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY'];
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase env vars not found in .env.local');

// ── Supabase helper ──────────────────────────────────────────────────────────
async function sbQuery(path, method = 'GET', body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'GET' ? 'return=representation' : 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path} failed (${res.status}): ${err}`);
  }
  return method === 'DELETE' ? null : res.json();
}

// ── Transcript templates ─────────────────────────────────────────────────────
// 6 scenario archetypes × 3 outcome variants (won ≥80, stalled 60-79, lost <60)
// Each transcript is an array of { role: 'user' | 'assistant', content: string }
// role 'user' = the rep/tech, role 'assistant' = the AI persona

const TRANSCRIPT_TEMPLATES = {

  // ── Homeowner Inbound — pipe burst, rep attempts to sign ────────────────────
  homeowner_inbound_won: [
    { role: 'assistant', content: "Hi, I have a burst pipe under my kitchen sink and there's water everywhere. I don't know what to do." },
    { role: 'user', content: "You called the right people. My name's Jake and I'm with Caliber Restoration. First thing — is the water still running or did you get the shutoff valve closed?" },
    { role: 'assistant', content: "My husband turned it off. There's already water on the floor and it's soaked through under the cabinet." },
    { role: 'user', content: "Good. That stops the damage from getting worse, but the moisture that's already there needs to come out fast — otherwise we're talking mold in 24 to 48 hours. I can have a crew there in about 45 minutes to assess the extent of it. Do you have homeowners insurance?" },
    { role: 'assistant', content: "Yes, we have State Farm. Should I call them first?" },
    { role: 'user', content: "You can, but you don't have to before we start. In fact, most of our customers let us do the initial assessment first so we can give the adjuster a detailed damage report — it actually helps your claim. We work directly with State Farm all the time." },
    { role: 'assistant', content: "Oh, that makes sense. What does it cost though? I'm worried this is going to be really expensive." },
    { role: 'user', content: "Here's the honest answer — we can't give you a final number until we assess the full extent of the damage. But if you have insurance, your out-of-pocket is typically just your deductible. Our job is to document everything so the insurance company pays for what they should. Does that help?" },
    { role: 'assistant', content: "Yes, that does actually. Okay, when can you be here?" },
    { role: 'user', content: "I can have someone at your door within the hour. Can I get your address? And while I have you — is there anyone else in the home, kids or pets we should know about for the crew?" },
    { role: 'assistant', content: "Just me and my husband. We're at 4422 Birchwood Drive." },
    { role: 'user', content: "Perfect. I'm sending our project manager, Tony. He'll assess everything, walk you through the process, and get your authorization before any equipment goes in. You won't be surprised by anything. We'll see you within the hour." },
    { role: 'assistant', content: "Thank you so much. I really appreciate it." },
  ],

  homeowner_inbound_stalled: [
    { role: 'assistant', content: "Hello, yes I'm calling because my washing machine flooded my laundry room. It's pretty wet." },
    { role: 'user', content: "I'm sorry to hear that. I'm with Caliber Restoration — I can get a crew out today to extract the water and set up drying equipment. Can I get your address?" },
    { role: 'assistant', content: "Wait, what does that cost? My neighbor used someone after her basement flood and the bill was $6,000." },
    { role: 'user', content: "It depends on the size of the damage. But if you have insurance, most of this is covered. Do you have homeowners?" },
    { role: 'assistant', content: "Yes but I have a $2,500 deductible. I'm not sure I want to make a claim for this." },
    { role: 'user', content: "That's fair — it might make sense to get the assessment first, see what we're dealing with, and then you can decide. There's no charge just to come look." },
    { role: 'assistant', content: "I guess. But can I think about it first? I want to talk to my husband tonight." },
    { role: 'user', content: "Absolutely, just keep in mind that the longer moisture sits, the more expensive it gets. Even 24 hours can mean the difference between dry walls and mold remediation." },
    { role: 'assistant', content: "Okay, you have a point. Can I call you back in an hour?" },
    { role: 'user', content: "Sure, here's my direct number. I'll keep a crew available." },
    { role: 'assistant', content: "Thank you. I'll call back soon." },
  ],

  homeowner_inbound_lost: [
    { role: 'assistant', content: "Hi, I had a pipe burst. My brother-in-law says he can fix the drywall himself but I'm not sure about the water damage part." },
    { role: 'user', content: "Yeah we can come take a look. It's probably not a big deal." },
    { role: 'assistant', content: "How much does it cost?" },
    { role: 'user', content: "We charge by the day for equipment. It's usually around $150 to $200 per dehumidifier." },
    { role: 'assistant', content: "Per day? For how many days?" },
    { role: 'user', content: "Depends. Could be 3 to 5 days, could be longer." },
    { role: 'assistant', content: "So that could be $1,000 just for equipment? That seems like a lot. My brother-in-law said fans would probably be enough." },
    { role: 'user', content: "Regular fans won't get the moisture out of the walls. You'd need professional equipment." },
    { role: 'assistant', content: "I think I'm going to try the fans first and see what happens. If it gets worse I'll call back." },
    { role: 'user', content: "Okay, that's up to you." },
    { role: 'assistant', content: "Thanks for the info." },
  ],

  // ── Homeowner FaceTime — on-site walkthrough ────────────────────────────────
  homeowner_facetime_won: [
    { role: 'assistant', content: "Okay I'm going to flip the camera so you can see. Is this bad? The plumber said it was from a slow leak behind the wall." },
    { role: 'user', content: "Yeah, I can see why he was concerned. That dark staining at the baseboard — that's moisture wicking up. Can you push on that drywall for me?" },
    { role: 'assistant', content: "It feels... kind of soft." },
    { role: 'user', content: "That's saturated drywall. The good news is we caught it before it started to smell, but that moisture's been sitting a while. This isn't something a fan is going to fix. We need to get equipment in here, measure the moisture content, and monitor drying for the next few days." },
    { role: 'assistant', content: "Are you sure I can't just open a window and point a fan at it?" },
    { role: 'user', content: "A fan moves air but it doesn't pull moisture from the wall cavity. You've got wet insulation and subfloor under there. Without professional drying, mold sets in fast — and at that point the job triples in cost. Can I show you what the moisture meter would tell us?" },
    { role: 'assistant', content: "Sure." },
    { role: 'user', content: "So a dry wall reads around 12 to 14 percent moisture. That wall you just touched? I'd bet it's at 40 or higher. My crew can be here this afternoon. We set up equipment, check back daily, and don't touch anything until readings are in safe range. Your insurance covers this — all you'd owe is your deductible. Should I get that scheduled?" },
    { role: 'assistant', content: "How long will the equipment be here?" },
    { role: 'user', content: "Typically 3 to 5 days for something like this. We monitor remotely with sensors so we only keep equipment as long as needed — not a day longer. That actually saves on your claim too." },
    { role: 'assistant', content: "Okay. Let's do it. What time this afternoon?" },
    { role: 'user', content: "I can have our project manager there between 2 and 3. He'll get your authorization and get equipment set up same day. I'll text you his name and number." },
  ],

  homeowner_facetime_stalled: [
    { role: 'assistant', content: "Here's the area. The toilet overflowed and there's water in the bathroom and into the hallway." },
    { role: 'user', content: "Okay, I can see it. The grout lines are holding water. How long ago did this happen?" },
    { role: 'assistant', content: "About two hours ago. I soaked up most of it with towels." },
    { role: 'user', content: "Good that you acted fast. The thing is, once water gets under tile it sits in the subfloor and doesn't dry on its own. We'd need to set up extraction and drying equipment." },
    { role: 'assistant', content: "My husband is a contractor. He said tile floors don't absorb water." },
    { role: 'user', content: "Tile itself doesn't, but the grout and subfloor underneath do. Especially with two hours of contact." },
    { role: 'assistant', content: "He's really confident we don't need this. Can I have him call you?" },
    { role: 'user', content: "Sure, I'm happy to talk to him. And if he's right, no harm done. But if we're wrong and there's moisture in that subfloor, we'd be looking at mold in a week." },
    { role: 'assistant', content: "Okay, let me have him call you tonight." },
    { role: 'user', content: "Sounds good. Here's my direct number. I'd rather be overcautious than leave you with a bigger problem." },
    { role: 'assistant', content: "Thank you." },
  ],

  homeowner_facetime_lost: [
    { role: 'assistant', content: "Okay here's the area. It was the dishwasher. It leaked overnight." },
    { role: 'user', content: "How big is the wet area?" },
    { role: 'assistant', content: "Maybe four or five feet? I already dried most of it." },
    { role: 'user', content: "Yeah we should come look at it." },
    { role: 'assistant', content: "Is there water under the floor though? How would you know?" },
    { role: 'user', content: "We have moisture meters." },
    { role: 'assistant', content: "What if the readings are normal? Would there be any charge?" },
    { role: 'user', content: "There's a trip charge of $150 if we come out and there's nothing to do." },
    { role: 'assistant', content: "Hmm. I don't really want to pay $150 just to hear it's fine." },
    { role: 'user', content: "That's just standard." },
    { role: 'assistant', content: "I'll just keep an eye on it. Thanks." },
  ],

  // ── Plumber BD — cold call ──────────────────────────────────────────────────
  plumber_bd_won: [
    { role: 'assistant', content: "Varela Plumbing." },
    { role: 'user', content: "Hey, is this Tony? This is Marcus with Caliber Restoration. I know you get a hundred of these calls — I'll be quick. We work with a few plumbers in the area and we pay $500 per signed job, same week, no tracking forms. I wanted to see if there's ever a fit." },
    { role: 'assistant', content: "What company are you with?" },
    { role: 'user', content: "Caliber Restoration. We've been in the market about 4 years. I can send you our Google reviews if that helps — 4.8 with over 300 reviews." },
    { role: 'assistant', content: "What happens if my customer complains about your crew? That comes back on me." },
    { role: 'user', content: "Fair concern. When you send us a job, here's what happens: you get a text from me within 15 minutes confirming we received it, and I personally call you after the job's done to debrief. If your customer ever has an issue, I want to know before they call you. That's a promise I make to every plumber I work with." },
    { role: 'assistant', content: "Who are you working with now in this area?" },
    { role: 'user', content: "I work with Rodriguez Plumbing over in Westfield and Premier Plumbing in Oakdale. I don't want to be in competition with them so I'm looking for a partner in this part of town. You came up as the highest-rated independent in the area." },
    { role: 'assistant', content: "You pay $500 per signed job? We're getting $400 right now." },
    { role: 'user', content: "Yep, $500 per signed job, paid the same week by Venmo or check — your choice. No spreadsheets, no monthly tally. Every job gets its own text confirmation with the job address and amount." },
    { role: 'assistant', content: "Alright. Let me try you on one job and we'll see how it goes." },
    { role: 'user', content: "That's all I'm asking. Can I get your cell so I can text you my info right now? That way when a job comes up, you're not looking for a business card." },
    { role: 'assistant', content: "Sure. It's 555-0142." },
    { role: 'user', content: "Sending you my info right now. I really appreciate the shot, Tony. I won't let you down." },
  ],

  plumber_bd_stalled: [
    { role: 'assistant', content: "Yeah, this is Mike." },
    { role: 'user', content: "Mike, this is Sarah with Caliber Restoration. Quick call — we pay plumbers $500 per signed restoration job and we cover this part of town. Are you the right person to talk to about referrals?" },
    { role: 'assistant', content: "We already have a company we use." },
    { role: 'user', content: "Got it. Are you pretty happy with them, or is there something they could be doing better?" },
    { role: 'assistant', content: "They're fine. They pay on time, that's mainly what I care about." },
    { role: 'user', content: "That's fair. If you ever have a situation where they're backed up or unavailable, would it be worth having a backup you've already vetted?" },
    { role: 'assistant', content: "I guess. We don't get that many water damage calls honestly." },
    { role: 'user', content: "What's your main work — residential service?" },
    { role: 'assistant', content: "Yeah, mostly drain cleaning and water heater replacements. We see maybe 2-3 legit water damage situations a month." },
    { role: 'user', content: "At $500 per job that's $1,000 to $1,500 a month on the table. Worth at least knowing who to call as a backup. Can I text you my info?" },
    { role: 'assistant', content: "You can. I'm not promising anything though." },
    { role: 'user', content: "No expectations. Here's my number — if you ever need a backup, I'll have a crew there within the hour." },
  ],

  plumber_bd_lost: [
    { role: 'assistant', content: "Mike's Plumbing." },
    { role: 'user', content: "Hi, is Mike available? I'm calling about a restoration referral partnership." },
    { role: 'assistant', content: "That's me. We get these calls all the time." },
    { role: 'user', content: "Yeah I know. We pay $500 per job." },
    { role: 'assistant', content: "We already have someone. We're not looking to switch." },
    { role: 'user', content: "Fair enough. What company are you using?" },
    { role: 'assistant', content: "I'd rather not say. We're loyal to our vendors." },
    { role: 'user', content: "I respect that. Can I leave my info in case anything changes?" },
    { role: 'assistant', content: "You can, but honestly we won't use it. We're good." },
    { role: 'user', content: "Okay, well if anything changes, I'm Marcus at Caliber. 555-0199." },
    { role: 'assistant', content: "I'll keep it in mind. Thanks." },
  ],

  // ── Insurance Broker — cold call / warm visit ─────────────────────────────
  insurance_broker_won: [
    { role: 'assistant', content: "Nancy Goldstein speaking." },
    { role: 'user', content: "Nancy, this is Derek with Caliber Restoration. I'll be quick — I work with independent agents building a preferred vendor relationship for water damage claims. Do you have a restoration company you trust right now, or is that ad hoc?" },
    { role: 'assistant', content: "Mostly ad hoc. I give out the carrier 800 number which honestly doesn't always work out great." },
    { role: 'user', content: "What typically goes wrong?" },
    { role: 'assistant', content: "My clients don't hear from the company until days later. Then I get the complaint call. It's frustrating." },
    { role: 'user', content: "That's exactly the problem we solve. When you refer us, you get a text within 30 minutes confirming we're on it. I personally send you an update when the job starts and when it closes. Your name never gets called in a complaint because you're never out of the loop." },
    { role: 'assistant', content: "That would actually be huge. The communication piece is everything." },
    { role: 'user', content: "How many property claims do you see in a typical month where you might refer a restoration company?" },
    { role: 'assistant', content: "Maybe 4 or 5 where I could make a personal recommendation." },
    { role: 'user', content: "Could we do this — I'll buy you a coffee this week, walk you through our process for exactly 20 minutes, and you can decide if it's worth a trial referral. No commitments." },
    { role: 'assistant', content: "You know what, yes. Thursday morning works. Can you come to my office at 9?" },
    { role: 'user', content: "Thursday at 9 works perfectly. I'll send you a calendar invite and my background info so you can look us up in advance. See you then, Nancy." },
  ],

  insurance_broker_stalled: [
    { role: 'assistant', content: "Agency, how can I help you?" },
    { role: 'user', content: "Hi, can I speak with the agent of record? My name is Derek, I'm with Caliber Restoration." },
    { role: 'assistant', content: "He's not available. Can I take a message?" },
    { role: 'user', content: "Sure. I'm calling to introduce ourselves — we're a water damage restoration company that builds referral relationships with independent agents. Can I ask, does your office currently have a preferred restoration vendor you recommend to clients?" },
    { role: 'assistant', content: "I'm not sure. I'll let him know you called." },
    { role: 'user', content: "I appreciate it. One quick question — what's the best way to actually reach him? Is email better than phone?" },
    { role: 'assistant', content: "Email is better. I can give you the general inbox." },
    { role: 'user', content: "Perfect. And your name?" },
    { role: 'assistant', content: "Karen." },
    { role: 'user', content: "Karen, really appreciate the help. I'll send a brief intro email. If he has a few minutes this week for a quick call, that's all I need." },
    { role: 'assistant', content: "I'll let him know." },
  ],

  insurance_broker_lost: [
    { role: 'assistant', content: "Bob Harris." },
    { role: 'user', content: "Bob, Derek from Caliber Restoration. I know you probably get these calls all the time, but I wanted to reach out about — " },
    { role: 'assistant', content: "We have a policy here. We send all clients directly to the carrier. We don't make restoration referrals." },
    { role: 'user', content: "I understand. Is that a compliance decision or just a preference?" },
    { role: 'assistant', content: "It's our policy. We don't want any appearance of steering." },
    { role: 'user', content: "That's smart. The agents I work with typically just maintain a vendor list for clients who ask directly — not a formal recommendation." },
    { role: 'assistant', content: "We just tell them to call their carrier. I'm sorry, we're not the right fit for this." },
    { role: 'user', content: "I completely respect that. Can I send you something brief in case your policy ever changes?" },
    { role: 'assistant', content: "You're welcome to try, but I don't think it'll change. Thanks for calling." },
  ],

  // ── Property Manager — cold call ────────────────────────────────────────────
  property_manager_won: [
    { role: 'assistant', content: "Blue Ridge Property Management, this is Jennifer." },
    { role: 'user', content: "Jennifer, my name is Maria with Caliber Restoration. I'll be brief. We specialize in working with property managers on water damage mitigation — fast response, detailed documentation for insurance, and we make your life easy when a tenant's unit floods. Are you the right person to talk to about vendor relationships?" },
    { role: 'assistant', content: "That's me. We actually had a nightmare situation last month. Our vendor took three days to respond." },
    { role: 'user', content: "That's costly on multiple levels — damage gets worse, the tenant relationship suffers, and your liability exposure goes up with every day of delay. What's your portfolio look like — how many units?" },
    { role: 'assistant', content: "About 180 units across three properties. We probably have one or two water events a month." },
    { role: 'user', content: "For a portfolio your size, here's what we offer: dedicated account manager, 2-hour response guarantee, and after every job you get a full written report with moisture readings and photos — insurance-ready documentation. That makes the claim process smooth on your end." },
    { role: 'assistant', content: "The documentation piece is huge for us. Our insurance adjusters always ask for more than we can provide." },
    { role: 'user', content: "That's exactly why we built it in. Can I come out and do a 20-minute walk through one of your properties this week? I'll bring a sample damage report so you can see exactly what the adjuster gets." },
    { role: 'assistant', content: "Sure, Tuesday morning would work." },
    { role: 'user', content: "Tuesday works perfectly. I'll text you my info and confirm the address. Thank you Jennifer — this is exactly the kind of partnership that saves property managers time and money." },
  ],

  property_manager_stalled: [
    { role: 'assistant', content: "Hello?" },
    { role: 'user', content: "Hi, is this the property manager for Riverside Commons? This is Maria from Caliber Restoration." },
    { role: 'assistant', content: "Yes. We already have a company we use." },
    { role: 'user', content: "Totally understand. How are they working out for you on response time?" },
    { role: 'assistant', content: "They're fine. There was a situation last year that wasn't great but generally okay." },
    { role: 'user', content: "What happened last year if you don't mind me asking?" },
    { role: 'assistant', content: "They were slow and the tenant complained a lot. Took longer than it should have." },
    { role: 'user', content: "That's the kind of thing that creates liability for you. I'd love to be a backup option — just so you have someone you've already vetted if your primary is ever unavailable or over capacity." },
    { role: 'assistant', content: "That's not a bad idea. You can send me some info." },
    { role: 'user', content: "Will do. What's the best email?" },
    { role: 'assistant', content: "It's jennifer@blueridgepm.com" },
    { role: 'user', content: "Perfect. I'll keep it brief — one page with our response time commitment and what documentation you'll get on every job." },
  ],

  property_manager_lost: [
    { role: 'assistant', content: "Property management, Dave speaking." },
    { role: 'user', content: "Hi Dave, Maria from Caliber Restoration. I help property managers with water damage — fast response, insurance documentation. Is water damage something that comes up for your properties?" },
    { role: 'assistant', content: "Sometimes. But we're a small operation, like 30 units." },
    { role: 'user', content: "30 units is a perfect size for a direct vendor relationship. When something does happen, you want someone you already trust." },
    { role: 'assistant', content: "Honestly, when it comes up I just Google it or the tenant handles it themselves." },
    { role: 'user', content: "That can work for minor stuff, but if the damage involves shared walls or insurance, you want a vendor who documents everything properly." },
    { role: 'assistant', content: "I get it, but it's not really a priority right now. Can you email me something?" },
    { role: 'user', content: "Sure. What's your email?" },
    { role: 'assistant', content: "dave@smallplex.com" },
    { role: 'user', content: "I'll keep it short. If anything comes up, don't hesitate to call directly." },
    { role: 'assistant', content: "Okay, thanks." },
  ],
};

// ── Assessment templates (matched to outcome) ─────────────────────────────────
function buildAssessment(outcome, scenarioType) {
  const isWon = outcome === 'won';
  const isStalled = outcome === 'stalled';

  if (isWon) {
    return {
      score: 82 + Math.floor(Math.random() * 15), // 82–96
      letter_grade: 'A',
      strengths: [
        'Established trust and urgency early without being pushy',
        'Handled the cost/insurance objection with clarity and confidence',
        'Moved toward a concrete next step before ending the call',
        'Active listening — followed the customer\'s concern and addressed it directly',
      ],
      improvements: [
        'Could have asked about timeline/availability earlier to lock in the close',
        'Brief moment where the rep talked over the customer — watch for that',
      ],
      summary: 'Strong performance overall. The rep handled objections well and moved the conversation toward a clear commitment. A few small tweaks to close timing would push this from a B+ to an A.',
      actions_to_take: [],
    };
  } else if (isStalled) {
    return {
      score: 62 + Math.floor(Math.random() * 14), // 62–75
      letter_grade: 'C',
      strengths: [
        'Polite and professional throughout',
        'Did not push too hard when the customer wanted time',
      ],
      improvements: [
        'Left the door open but didn\'t create urgency — a "call me back" ending rarely converts',
        'Missed an opportunity to get a specific callback time commitment',
        'Could have planted a stronger urgency anchor before letting them go',
      ],
      summary: 'Decent conversation but ended without a commitment. The customer is still undecided and there\'s no scheduled follow-up. In this business, every hour of delay costs — the rep should have closed harder before releasing the call.',
      actions_to_take: [
        {
          ai_said: "Can I call you back in an hour?",
          suggested_response: "I can hold a crew for an hour, but after that I can't guarantee availability today. Can we set a specific time — say 4pm — so I know to keep the slot open for you?",
          technique: "Trial close with urgency",
        },
      ],
    };
  } else {
    return {
      score: 35 + Math.floor(Math.random() * 22), // 35–56
      letter_grade: 'F',
      strengths: [
        'Was polite and didn\'t argue with the customer',
      ],
      improvements: [
        'Never established value before mentioning cost — price became the only frame',
        'Failed to counter the "I\'ll try fans first" objection with any urgency',
        'No attempt to understand the customer\'s insurance situation',
        'Gave up too quickly when the customer hesitated',
      ],
      summary: 'The rep lost control of this call early by leading with cost. Once the customer mentioned their brother-in-law and DIY, the rep needed to educate — instead they accepted the objection and let the customer walk. This job was loseable; it shouldn\'t have been lost this fast.',
      actions_to_take: [
        {
          ai_said: "I think I'm going to try the fans first and see what happens.",
          suggested_response: "I totally get that instinct — I would want to save money too. But here's the problem: fans move air, they don't pull moisture from wall cavities. In 48 hours, if that moisture is still in your walls, we're now talking about mold remediation instead of drying — and that's 3 to 4 times the cost. The $300 you're trying to save today could turn into $4,000 next week. Can I at least come do a free moisture reading so we know what we're actually dealing with?",
          technique: "Reframe cost of inaction",
        },
      ],
    };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Fetch demo sessions that need transcripts
  const sessions = await sbQuery(
    `/training_sessions?source=eq.demo&transcript=is.null&select=id,persona_scenario_type,persona_name`,
    'GET'
  );

  if (!sessions || sessions.length === 0) {
    console.log('No demo sessions found without transcripts.');
    return;
  }

  console.log(`Found ${sessions.length} demo sessions needing transcripts`);

  const scenarioToTemplate = {
    homeowner_inbound: ['homeowner_inbound_won', 'homeowner_inbound_stalled', 'homeowner_inbound_lost'],
    homeowner_facetime: ['homeowner_facetime_won', 'homeowner_facetime_stalled', 'homeowner_facetime_lost'],
    plumber_bd: ['plumber_bd_won', 'plumber_bd_stalled', 'plumber_bd_lost'],
    plumber_bd_discovery: ['plumber_bd_won', 'plumber_bd_stalled', 'plumber_bd_lost'],
    insurance_broker: ['insurance_broker_won', 'insurance_broker_stalled', 'insurance_broker_lost'],
    insurance_broker_discovery: ['insurance_broker_won', 'insurance_broker_stalled', 'insurance_broker_lost'],
    property_manager: ['property_manager_won', 'property_manager_stalled', 'property_manager_lost'],
    property_manager_discovery: ['property_manager_won', 'property_manager_stalled', 'property_manager_lost'],
    commercial_property_manager: ['property_manager_won', 'property_manager_stalled', 'property_manager_lost'],
    commercial_pm_discovery: ['property_manager_won', 'property_manager_stalled', 'property_manager_lost'],
    plumber_lead: ['homeowner_inbound_won', 'homeowner_inbound_stalled', 'homeowner_inbound_lost'],
  };

  let updated = 0;
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const type = session.persona_scenario_type;
    const templates = scenarioToTemplate[type] || scenarioToTemplate['homeowner_inbound'];

    // Rotate through won/stalled/lost
    const variant = templates[i % 3];
    const outcome = variant.endsWith('_won') ? 'won' : variant.endsWith('_stalled') ? 'stalled' : 'lost';
    const transcript = TRANSCRIPT_TEMPLATES[variant];
    const assessment = buildAssessment(outcome, type);

    await sbQuery(
      `/training_sessions?id=eq.${session.id}`,
      'PATCH',
      {
        transcript: JSON.stringify(transcript),
        assessment: JSON.stringify(assessment),
      }
    );

    updated++;
    process.stdout.write(`  Updated ${updated}/${sessions.length}: ${session.id} (${variant})\n`);
  }

  console.log(`\n✅ Seeded ${updated} demo sessions with transcripts and assessments.`);
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
