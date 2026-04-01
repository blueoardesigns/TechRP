// Default playbooks for each training scenario.
// Seeded via /api/seed — run once after the SQL migration.

export const DEFAULT_PLAYBOOKS = [
  {
    scenarioType: 'homeowner_inbound',
    name: 'Homeowner Inbound Call Playbook',
    content: `## Overview
A homeowner found you on Google and is calling because they have active water damage. They're stressed, possibly panicked, and looking for someone they can trust to help them right now. Your job is to calm them down, build instant credibility, and get on-site as fast as possible.

## Key Objectives
- Calm the homeowner and establish trust in the first 60 seconds
- Understand the scope and source of the damage
- Set expectations around the process, timeline, and insurance
- Commit to a same-day or next-available arrival time
- Get verbal approval to come out and begin assessment

## Opening
> "Thank you for calling [Company Name], this is [Your Name]. I understand you're dealing with water damage — you called the right place. We respond 24/7 and our team can typically be out to you within the hour. Before I get a crew headed your way, can I ask you a couple quick questions so we come prepared?"

Tone matters here. Speak slowly, confidently, and with warmth. The homeowner is scared. Your calm is contagious.

## Discovery Questions
1. "Where is the water coming from — do you know the source yet?"
2. "How long has the water been sitting? When did you first notice it?"
3. "What rooms or areas are affected — floors, walls, ceilings?"
4. "Have you been able to shut off the water source?"
5. "Do you have homeowners insurance? Have you contacted them yet?"
6. "Is anyone living in the home right now — family, kids, pets?"
7. "On a scale of 1–10, how bad does it look to you right now?"

## Key Value Points
- **Speed:** We're available 24/7 and respond fast — every hour of standing water increases damage and mold risk.
- **Full-service:** We handle everything — water extraction, structural drying, demo if needed, and we work directly with your insurance company.
- **Insurance expertise:** We've worked with every major carrier. We document everything properly so your claim goes smoothly.
- **Certified professionals:** Our techs are IICRC certified and follow industry drying standards — this isn't guesswork, it's science.
- **No upfront cost:** In most cases, your insurance covers the full restoration. We'll walk you through the process.

## Handling Common Objections

**"How much is this going to cost?"**
> "That's a fair question and I completely understand. In most cases, homeowners insurance covers water damage restoration in full. We'll document everything properly for your claim. If you're uninsured or have a high deductible, we'll walk through pricing transparently before any work begins — no surprises."

**"I'm not sure my insurance will cover it."**
> "Most standard homeowners policies do cover sudden water damage. Our team handles insurance documentation every day — we'll help you file the claim correctly and communicate directly with your adjuster if needed. Let's get eyes on it first."

**"I want to wait and see if it dries on its own."**
> "I hear you, and I understand the instinct to wait. But here's the thing — water moves fast. It wicks into walls, under floors, and into subfloor within hours. After 24–48 hours, mold becomes a real risk. Acting now is almost always cheaper and faster than dealing with secondary damage later."

**"I already called someone else."**
> "Totally fine — you should talk to a couple companies. I'd just encourage you to make sure whoever you choose is IICRC certified and has experience working with insurance carriers."

**"Can I just do it myself?"**
> "You can pull up water with a shop vac and fans, but moisture hides inside walls, under flooring, and in the subfloor. Without moisture meters and commercial drying equipment, you may think it's dry when it's not. That's how mold starts. We can at least come out and do a free assessment so you know exactly what you're dealing with."

**"I need to talk to my spouse first."**
> "Of course, and I respect that. Can I get a time to follow up in the next hour? Water damage is time-sensitive — even a few hours matter."

## Closing
Winning on this call means getting a confirmed arrival time and address before you hang up.

> "Here's what I'd like to do — let me get a crew headed to you now. There's no commitment just for the assessment. We'll come out, document everything, and give you a clear picture of what needs to happen. Does that work for you? What's the best address?"

## What Great Looks Like
- Top reps are on-site within the hour of an inbound call — speed is the close
- They mirror the homeowner's urgency and never make them feel like a transaction
- They set insurance expectations on the phone so there are no surprises on-site
- They confirm arrival via text and show up exactly when they said they would`,
  },
  {
    scenarioType: 'homeowner_facetime',
    name: 'Door Knock / On-Site First Contact Playbook',
    content: `## Overview
You knocked on the door of a homeowner who did NOT call you. They have visible damage or a known issue. Your challenge is going from cold to trusted in under 2 minutes, standing at their front door.

## Key Objectives
- Establish immediate credibility and a reason for being there
- Get invited inside to do a walkthrough/assessment
- Understand the scope of damage and whether insurance is involved
- Build enough trust that they let you start — or at minimum, sign a work authorization
- Never pressure — educate and guide

## Opening
> "Hi, my name is [Name] with [Company Name] — we're actually working on a job a couple doors down. Our crew noticed what looks like [wet driveway / visible damage] and I just wanted to make sure you were aware. Would you mind if I took a quick look? It won't cost you anything."

If they look skeptical: *"I know this feels like it came out of nowhere — totally fair. Here's my card and here's our Google reviews on my phone. I'm not here to sell you anything — I just want to make sure your home is protected."*

## Discovery Questions
1. "When did you first notice the [wet area / damage / smell]?"
2. "Do you know where the water came from — roof, plumbing, appliance?"
3. "Has anyone else looked at this yet — a plumber, your insurance company?"
4. "Are any other rooms affected, or is it isolated to this area?"
5. "What's your gut feeling — does this feel like something that can wait, or does it feel urgent to you?"
6. "Do you have homeowners insurance? Have you ever filed a water damage claim before?"
7. "Is this your primary residence or a rental?"

## Key Value Points
- **No-obligation assessment:** There is zero cost or commitment to letting us take a look and document what's happening.
- **Documentation matters:** Insurance companies want professional documentation with moisture readings. A written report from us today protects you if you file a claim later.
- **We move fast:** Water damage gets exponentially worse with time. Mold can begin in 48 hours under the right conditions.
- **We handle insurance:** We guide you through every step — from claim filing to final drying report.

## Handling Common Objections

**"I didn't call anyone — I'm not interested."**
> "I completely respect that. The only reason I knocked is because [specific observation]. I'm not asking you to hire us — I'm just asking for 5 minutes to show you what I saw and make sure you know the full picture. If there's nothing to worry about, I'll tell you that and be on my way."

**"I need to think about it / talk to my husband."**
> "Absolutely — is he home right now? I'd love to walk both of you through it together so you're on the same page."

**"I'll just dry it myself."**
> "I respect that — and for minor surface water, you can get far with fans and a dehumidifier. Can I show you something quick though? [Pull out moisture meter] See this reading on the drywall? Anything over 16% means moisture is already inside the wall. Fans won't touch that."

**"I don't have insurance."**
> "Okay, that changes things a little bit but doesn't change what needs to happen. We can work with you on pricing and phasing — let me document what's here and we'll build a plan together that works for your budget."

## Closing
A win on a door knock is either a signed work authorization or a locked-in appointment within 24 hours.

> "Here's what I'd recommend — let me get your name on a work authorization so if you decide tonight to move forward, we can mobilize the crew first thing in the morning. You're not committing to anything financial — just giving us permission to begin when you're ready."

## What Great Looks Like
- Top techs get invited inside within the first 90 seconds by being genuinely curious, not salesy
- They use the moisture meter as a teaching tool — showing, not just telling
- They never push; they create urgency through education about what water damage does over time
- They always leave behind a written moisture report — it creates a paper trail and a reason to call back`,
  },
  {
    scenarioType: 'plumber_lead',
    name: 'Plumber Referral Lead Playbook',
    content: `## Overview
A plumber fixed the source of a water damage problem and referred the homeowner to your company. The trust level is higher than a cold call because a trusted trade already vouched for you — but the homeowner may still be guarded, overwhelmed, or unaware of the extent of the damage.

## Key Objectives
- Acknowledge and honor the plumber relationship — that's your credibility bridge
- Quickly get a picture of what the plumber found and what work was done
- Transition from "the plumber fixed the pipe" to "now let's fix the damage the water caused"
- Educate the homeowner on what happens if the water damage is ignored
- Secure on-site access within the same day if possible

## Opening
**If calling by phone:**
> "Hi, is this [Homeowner Name]? This is [Your Name] with [Company Name]. [Plumber Name] just gave me a call — he mentioned he was out at your place today and there's some water damage from the [pipe burst / leak]. He asked us to reach out because he wanted to make sure you got taken care of. Is now an okay time for a couple quick questions?"

**If showing up on-site with the plumber:**
> "Hi [Name], I'm [Your Name] with [Company Name] — [Plumber Name] gave me a call while he was finishing up. He wanted me to come take a look at the damage so you have a complete picture of what you're dealing with."

## Discovery Questions
1. "Did [Plumber Name] explain what he found and what he repaired?"
2. "How long do you think the water was running before it was caught?"
3. "What areas of the home did the water reach — did it stay in one room or spread?"
4. "Has anyone pulled up flooring or checked inside the walls yet?"
5. "Do you have homeowners insurance — and have you called them yet?"
6. "Is there any visible staining, warping, or smell that you've noticed?"
7. "Has anyone else come out to look at the damage, or are we the first restoration company?"

## Key Value Points
- **Plumber-trusted:** [Plumber Name] refers work to us specifically because we communicate well and treat their customers right.
- **Source is fixed, but damage remains:** The plumber stopped the water — but what the water did while it was running still needs to be addressed. Wet materials inside walls and under floors don't dry on their own.
- **Mold window:** Most building materials become mold-friendly within 48–72 hours of sustained moisture.
- **Insurance coordination:** We work directly with your insurance carrier from documentation to final drying report.
- **One call, full solution:** The plumber handled the source. We handle everything after — it's a seamless handoff.

## Handling Common Objections

**"I thought since the plumber fixed it, I was done."**
> "That's a really common assumption — and the plumber did the critical part. But when water runs inside a home, it gets into places you can't see — behind drywall, under subfloor, inside insulation. That moisture doesn't dry out on its own. That's the part we handle."

**"Can I just put fans on it?"**
> "You can — and it'll feel drier on the surface. But fans don't have the airflow or dehumidification power to remove moisture from inside walls and under floors. If that moisture stays, you're looking at mold, warped floors, and possibly drywall replacement down the road."

**"My insurance has a high deductible and I'd rather just handle it myself."**
> "Totally fair — let us do the assessment first, at no charge. We'll tell you exactly what's wet, how deep it goes, and what it would cost to address it properly. Then you can decide what makes sense."

**"I don't want to make an insurance claim over something small."**
> "I hear you — some homeowners prefer to keep smaller claims off their record. Can we at least do the assessment so you know whether this is truly minor or larger than it looks?"

## Closing
A win here is getting inside the home to do a full moisture assessment and leaving with a signed work authorization.

> "Here's where I'd like to start — let me walk through the affected areas with my moisture meter. It takes about 15 minutes and gives both of us a real picture of what's actually wet. From there I can give you a scope of work and we can talk through your options. There's no obligation just for the walkthrough. Can we do that right now?"

## What Great Looks Like
- Top techs honor the plumber referral explicitly — it's their credibility, and recognizing it builds immediate rapport
- They bridge the gap between "source fixed" and "damage remains" without making the homeowner feel like they missed something
- They show up same-day whenever possible — urgency is built into the referral
- They close the loop with the plumber after the job — keeping the referral pipeline open`,
  },
  {
    scenarioType: 'property_manager',
    name: 'Residential Property Manager BD Outbound Playbook',
    content: `## Overview
You're a business development rep calling a property manager who oversees residential or commercial rental properties. They deal with maintenance emergencies regularly and need a fast, reliable restoration vendor they can call at any hour. Your goal is to become their go-to vendor before the emergency happens.

## Key Objectives
- Identify who actually makes vendor decisions at the property management company
- Understand their current vendor situation and any pain points
- Communicate your speed, reliability, and property management experience
- Secure a face-to-face meeting or a spot on their approved vendor list
- Leave a clear next step — never end the call without a follow-up scheduled

## Opening
> "Hi, is this [Name]? My name is [Your Name] with [Company Name] — we're a local water and fire damage restoration company. I'm calling because we work with a number of property management companies in the area, and I wanted to introduce ourselves before you needed us. Do you have about 2 minutes?"

If they seem rushed: *"I totally understand — can I ask just one quick question? When you have a water emergency at one of your properties at 2 AM, who are you calling right now?"* (This question almost always starts a real conversation.)

## Discovery Questions
1. "How many units or properties are you currently managing?"
2. "Do you have a restoration vendor you're using now, or is it more of a case-by-case situation?"
3. "When you get a water damage call from a tenant, what does that process look like for you right now?"
4. "What's been the biggest challenge with your current vendor — or with water damage situations in general?"
5. "Do you work primarily with residential or commercial properties, or a mix?"
6. "Who else is involved in vendor decisions — is it just you, or do you work with an owner or asset manager?"
7. "Have you had any situations where a restoration vendor let you down or caused you headaches with a tenant?"

## Key Value Points
- **24/7 emergency response:** We answer every call, every night. Our average response time is under 60 minutes.
- **Property management experience:** We understand how PMs work. We communicate directly with tenants and minimize disruption to your operations.
- **Tenant relations:** We treat every tenant like a client — they're your customer too.
- **Insurance documentation:** We handle insurance claims documentation end-to-end, reducing administrative burden on your team.
- **One point of contact:** When you call, you get a real person who knows your account — not a call center.

## Handling Common Objections

**"We already have a vendor we use."**
> "That's great — and I'm not asking you to fire them. I'd just love to be your backup. Vendors get busy, they miss calls, or they don't have capacity during a big storm event. Would it hurt to have one more reliable number in your phone?"

**"I don't have time to talk right now."**
> "Completely understand — when's a better time? I can work around your schedule. Would Tuesday morning or Wednesday afternoon work?"

**"We let owners handle their own vendors."**
> "That makes sense. Are there any owners in your portfolio who don't have a solid restoration vendor lined up? We'd be happy to reach out to them directly."

**"I haven't had a water damage issue recently."**
> "That's actually the best time to find a vendor — before you need one. The worst moment to be searching is at midnight when a pipe burst is flooding a unit and a tenant is calling you every 5 minutes."

**"I'm concerned about you dealing with my tenants directly."**
> "That's a legitimate concern. Every interaction we have with a tenant is with your reputation in mind. We copy you on all communication and follow your lead on access and scheduling. You're always in the loop."

## Closing
A win on this call is a booked meeting — either in-person or a 20-minute call.

> "Can we set up a 20-minute call or in-person meeting? I'll bring our vendor packet and references from other property managers in the area, and you can see exactly how we handle PM accounts. Would [date/time] or [date/time] work?"

## What Great Looks Like
- Top BD reps ask the "2 AM" question early — it reframes the conversation from sales to problem-solving
- They research the PM company beforehand — number of units, residential vs. commercial
- They follow up consistently without being annoying — once a month is appropriate for a warm prospect
- They treat the relationship like a long game; most PM partnerships take 2–4 touchpoints before they convert`,
  },
  {
    scenarioType: 'commercial_property_manager',
    name: 'Commercial Property Manager BD Outbound Playbook',
    content: `## Overview
You're calling a commercial property manager, facilities director, or asset manager who oversees office buildings, retail centers, industrial properties, or mixed-use portfolios. Commercial losses are larger, more complex, and involve multiple stakeholders — tenants, owners, insurance adjusters, and sometimes legal teams. Your goal is to establish a preferred vendor relationship before the emergency happens, positioning yourself as a commercial-grade partner, not just a residential restoration company.

## Key Objectives
- Establish credibility specifically in the commercial space (not just residential)
- Understand their property type, portfolio size, and current vendor setup
- Address commercial-specific pain points: tenant disruption, business interruption, procurement processes
- Navigate multi-stakeholder decision-making (board approvals, owner consent, RFP processes)
- Secure a formal meeting, site walk, or vendor pre-qualification step

## Opening
> "Hi, is this [Name]? My name is [Your Name] with [Company Name] — we're a commercial and residential restoration company that works with property managers in the area. I'm calling because we're building our commercial account relationships and wanted to introduce ourselves before you needed us. Do you have about 2 minutes?"

If they mention they already have a vendor: *"I completely understand — I'm not asking you to switch. I'm asking if there's room to be your backup for overflow or large-loss events when your primary vendor is at capacity."*

If they're in a procurement environment: *"I understand — we're happy to submit a vendor pre-qualification package. Can you tell me what that process looks like and who I should address it to?"*

## Discovery Questions
1. "What types of commercial properties do you manage — office, retail, industrial, or a mix?"
2. "What's the total square footage or number of properties in your portfolio?"
3. "Do you have a restoration vendor currently, and are they dedicated to commercial work or primarily residential?"
4. "When you have a water or fire event at a property, what does your response process look like?"
5. "What's your biggest concern when a restoration situation happens — tenant relations, speed, documentation, cost?"
6. "Do you have authority to approve vendors directly, or does it go through an owner or board?"
7. "Have you had a situation where your restoration vendor's response created a problem with a tenant?"

## Key Value Points
- **Commercial experience:** We have experience on office buildings, retail centers, and industrial properties — we understand tenant considerations, CAM implications, and commercial insurance documentation.
- **24/7 large-loss response:** We can mobilize commercial-scale crews, not just residential teams. We have the equipment capacity for large square footage events.
- **Tenant communication protocol:** We coordinate with you and communicate with tenants on your behalf — professionally and on your terms.
- **Business interruption documentation:** We produce detailed drying logs, moisture mapping, and scope documentation that supports BI claims and minimizes dispute with adjusters.
- **Multi-stakeholder coordination:** We're used to working alongside adjusters, building engineers, and legal teams on complex commercial claims.
- **Dedicated account management:** Commercial accounts get a single point of contact — not a call center.

## Handling Common Objections

**"We have an approved vendor list / procurement process."**
> "I respect that — most well-run commercial operations do. What does your pre-qualification process look like? We're happy to submit a COI, IICRC certifications, and commercial references. If it makes sense after that, we'd love to be considered for your list."

**"We use insurance-assigned vendors."**
> "That's common — and it works for some situations. But as a policyholder you typically have the right to choose your own vendor, and a pre-vetted relationship usually means faster mobilization than waiting on an insurance assignment. It's worth at least knowing you have an option."

**"Our current vendor handles it fine."**
> "Good — and I wouldn't ask you to replace a vendor relationship that's working. But commercial restoration can have capacity issues during storm events or multiple simultaneous losses. Would it make sense to have one qualified backup in your phone before you need it?"

**"I can't make vendor decisions on my own."**
> "I understand — who else is involved? I'm happy to put together a formal vendor package your ownership group or board could review. Can you tell me who that decision goes through and what they'd want to see?"

**"We don't have water damage events very often."**
> "The best time to establish a relationship is before you have one. When a pipe bursts at 2 AM on a Friday and you have tenants trying to operate on Monday, you don't want to be auditioning vendors. Can we set up a site walk so you have us locked in before it happens?"

## Closing
A win on this call is a formal next step: a site walk, a vendor packet submission, or a meeting with the decision-maker.

> "Here's what I'd suggest — let me come walk your properties so I know them before I ever need to respond to them. I'll bring our commercial vendor packet, and we can talk through how we'd handle a loss at each location. It takes about an hour and gives you something concrete to take to your ownership group. Would [date/time] or [date/time] work?"

## What Great Looks Like
- Top BD reps speak commercial — they understand CAM charges, tenant BI, procurement processes, and owner-manager relationships
- They come prepared: they research the property portfolio before the call and mention specific properties by name
- They never pitch residential talking points — commercial managers tune out the moment you sound like you're used to dealing with homeowners
- They treat the first job as an audition — over-communicate, deliver ahead of schedule, and personally debrief the manager afterward
- They understand that commercial PM relationships are long-game — most convert after 2–4 touchpoints over 6–12 months`,
  },
  {
    scenarioType: 'insurance_broker',
    name: 'Insurance Agent / Broker BD Outbound Playbook',
    content: `## Overview
You're calling an independent insurance agent or broker who writes homeowners and commercial property policies. When their clients have a water or fire damage loss, they get the call — and they often recommend a restoration company. Your goal is to become the company they recommend every time.

## Key Objectives
- Establish yourself as a professional peer, not a vendor pitching a product
- Understand how the agent currently handles vendor referrals for their clients
- Communicate your value in terms of what matters to an insurance professional: documentation, claim integrity, and client experience
- Position yourself as someone who makes the agent look good to their clients
- Secure a meeting, lunch, or agency visit

## Opening
> "Hi [Name], my name is [Your Name] with [Company Name] — we're a local water and fire damage restoration company. I wanted to reach out because we work closely with independent agents in the area. A lot of agents find it helpful to have a restoration company they trust to send their clients to when a claim comes in. Do you have a couple of minutes?"

## Discovery Questions
1. "What does your book of business look like — mostly homeowners, commercial, or a mix?"
2. "When a client calls you after a loss, what's your current process for recommending a contractor?"
3. "Do you have a go-to restoration company you typically refer, or does it depend on the situation?"
4. "Have you ever had a restoration contractor create problems with a client's claim — poor documentation, over-billing?"
5. "How important is the claims experience to your retention?"
6. "Are there certain types of losses that come up more often in your portfolio?"
7. "Would you be open to meeting for coffee or lunch to learn more about how we work with agents?"

## Key Value Points
- **We protect the claim, not just the property:** Our documentation follows IICRC standards — every moisture reading and drying log is organized in a format insurance adjusters accept.
- **We don't inflate scopes:** We write accurate, defensible scopes — which means fewer disputes between your client and their carrier.
- **Client experience is your reputation:** When your client goes through a loss, the restoration company reflects on you. We treat every policyholder like they were referred by their most trusted advisor.
- **We keep you informed:** We'll cc you on major milestones so you're never caught off guard when a client calls.
- **We understand the agent relationship:** We never discuss coverage questions, policy language, or claim strategy with homeowners. That's your lane.

## Handling Common Objections

**"I already have a company I refer."**
> "That's great — and I'm not trying to displace a good relationship. But if there's ever a situation where they're unavailable or at capacity, it'd be good to have a backup. Would you be open to a brief introduction meeting?"

**"I don't really make referrals — I let my clients choose their own vendor."**
> "I respect that approach. But when your clients call you at 10 PM saying there's water pouring into their home, they're asking for guidance, not a Google search. Even having one or two names to offer in that moment is a service to them."

**"I'm worried about the appearance of a referral relationship."**
> "Completely understandable — we're not asking for any financial arrangement. Just the opportunity to be a company you can confidently recommend based on our work."

**"I've had bad experiences with restoration contractors padding claims."**
> "I hear that a lot — and it's a real problem in our industry. Our approach is the opposite: accurate scopes, transparent documentation, and we'll walk an adjuster through every line item if needed."

## Closing
A win is a face-to-face meeting — a lunch, an office visit, or an agency presentation.

> "I'd love to take you to lunch or coffee — 30 minutes, my treat. I'll share how we work with agents, bring a couple of case studies, and you can decide if it makes sense to add us to your network. No pitch, no pressure. What does your calendar look like in the next couple of weeks?"

## What Great Looks Like
- Top BD reps speak the language of insurance — they understand documentation, claims integrity, and carrier relationships
- They position themselves as a resource for the agent's clients, not a vendor looking for leads
- They follow up with a handwritten note or personalized email after every meeting
- They track when an agent sends their first referral and call to thank them personally`,
  },
  {
    scenarioType: 'plumber_bd',
    name: 'Plumber Partnership BD Outbound Playbook',
    content: `## Overview
You're calling a plumbing company to start a referral partnership. Plumbers fix the source of water damage every day — burst pipes, failed water heaters, supply line failures — and then leave the customer with a soaking wet home and no one to call. You're the missing piece. Done right, this partnership builds a million-dollar book of water jobs over time.

But not every plumber is the right fit. The goal of this call is to **qualify first, pitch second.** Lead with curiosity. Never lead with money.

## Who to Target — Qualifying Before You Call
The best plumber partners are **residential service plumbers** — the ones responding to emergency calls, not building new construction. Look for:
- Plumbers who advertise (Google Ads, Yelp, Home Advisor) — they're volume-oriented and care about customer experience
- "Shadow plumbers" — they're not on page 1 of Google but have strong word-of-mouth in specific neighborhoods; they're often more relationship-oriented
- Residential repair/service focus: supply lines, water heaters, toilet overflows, slab leaks, drain backups
- Multi-tech operations with a dispatcher (the referral process needs infrastructure)

**Wrong targets:** Primarily commercial new construction plumbers — they rarely encounter residential water damage. If a plumber tells you 80%+ of their work is new construction, wrap up quickly and move on.

## Two Types of Plumbers You'll Meet
Understanding which type you're talking to changes your approach entirely:

**Relationship-type:** Values reputation, long-term trust, and customer experience above all. Money matters but isn't the hook. Lead with: how you protect their customers, how fast you respond, how you communicate back to their team. Build the relationship first — the referrals will follow.

**Transaction-type:** Immediately wants to know what's in it for them financially. Will ask about payout before anything else. They'll work with you for money, but don't expect loyalty. These partnerships can produce volume but require consistent incentivization and monitoring.

Most plumbers fall somewhere between these two. Your job is to figure out which side they lean toward in the first 3 minutes of the call — and adjust.

## Opening — Qualify Before You Pitch
**Step 1: Confirm they do service/repair work (not just new construction)**
> "Hey, is this [Name]? I'm [Your Name] with [Company]. Quick question before anything else — do you guys do emergency service work? Like supply line breaks, water heater failures, that type of thing?"

If yes → continue. If they say it's mostly new construction → "Got it — we're looking for partners in the service/repair space specifically. Probably not the right fit, but I appreciate your time." Hang up. Move on.

**Step 2: Soft pitch and ask to meet**
> "The reason I'm calling is we're a local water damage restoration company and we're building partnerships with service plumbers in [Area]. Your guys are already on-site when water damage happens — and most of the time, the customer is left with wet walls and no idea who to call next. We fix that. Would you be open to grabbing coffee and talking through how it might work?"

If they ask "what's in it for me?" — don't answer with money yet. Say:
> "That's exactly what I want to talk through — but it's going to depend on your situation and what's most valuable to you. Some guys want leads back, some want help with warranty jobs, some want something else. I'd rather hear what you actually need before I start talking about what we offer."

## Triangulating Questions — Read the Relationship
Use these to uncover whether they already have a restoration partner, why that relationship started or stopped, and what they really want:

1. "Who do you refer customers to right now when there's water damage?"
2. "How did you end up working with them?" *(Was it organic, or did someone pitch them?)*
3. "If you had to give them a score — 1 to 5 — how would you rate how that's going?"
4. "Has there ever been a time you stopped referring someone? What happened?"
5. "Do you get anything from them in return — leads back, warranty help, anything?"
6. "What's the one thing that would make a restoration partner actually useful to your business?"
7. "Are there types of calls where water damage is almost guaranteed — slab leaks, water heater failures, drain backups?"

## Key Value Points — Fit to Their Type
For **relationship-type plumbers:**
- "You fix the source — we fix the damage. Together, your customer walks away with the whole problem solved. That's a referral they'll remember."
- "When you recommend us, you're attaching your name to us. We're going to make you look good — speed, communication, and no surprises."
- "We send plumbing referrals back. When we're on a job and see a plumbing issue, you're the first call."

For **transaction-type plumbers:**
- Lead with the referral payout structure — they'll shut down if you don't
- Be specific: amount, timing, tracking method
- Add: "And for your techs specifically, we have a way to recognize them too — separately from you." (Techs and owners should be incentivized differently — see below)

## Incentivizing Techs vs. Owners
Never assume the owner's incentive reaches the technician who actually makes the referral call on-site. They are separate relationships:

- **Owners** respond to: leads back (plumbing referrals from your jobs), warranty job assistance, marketing support, exclusivity in your referral network, relationship/trust
- **Technicians** respond to: fast, small, tangible rewards — gift cards, recognition, simple cash per referral signed. The faster the reward cycle, the better the behavior reinforcement.

Ask: *"Do your guys in the field make the call on referrals, or does it go through you?"* — then calibrate your pitch accordingly.

## Handling Common Objections — LACE Framework

**"I already have a restoration company I use."**
Listen & Acknowledge: "That's great — sounds like you've already got something in place."
Clarify: "How long have you been with them? And on that 1–5 scale, how's that relationship going?"
Educate: "We're not asking you to leave them. We'd love to be your backup — so if they're ever at capacity or a customer has a bad experience, you've already got someone else you trust. Just let us earn one job."

**"What do I get out of it?" / "What do you pay?"**
Listen & Acknowledge: "Fair question — I want to answer it."
Clarify: "Before I do, can I ask what matters more to you — getting leads back, straight payout per job, or something else?"
Educate: "The reason I ask is that different plumbers want different things. Some guys want leads back from our jobs. Some want warranty job assists. Some want straight payout. We try to structure it around what's actually valuable to you, not just hand you a one-size-fits-all number."

**"My guys don't have time to make calls."**
Listen & Acknowledge: "I hear you — they're already running job to job."
Clarify: "Is the issue the time, or is it that they don't know what to say when they're standing there?"
Educate: "Here's how it works: one text. Address and your company name. That's it. No phone calls, no scheduling, no follow-up from your side. We take it from there and your tech gets a confirmation back in 15 minutes."

**"I've had bad experiences with restoration companies before."**
Listen & Acknowledge: "That doesn't surprise me — and I'm sorry that happened."
Clarify: "What went wrong? Was it the customer experience, the payout, something else?"
Educate: "Everything you just described is exactly what we built our process to prevent. The only way I can prove that is with one job. Let us take one call and show you — if you don't see it, we're done."

**"I'm not sure this is worth my time."**
Listen & Acknowledge: "That's fair — you've probably heard pitches like this before."
Clarify: "What would make it worth your time? What would the ideal version of this look like for your business?"
Educate: "I'm not asking for a commitment — I'm asking for a coffee and 20 minutes. If it's not a fit, you walk away with nothing lost. If it is a fit, you've got a restoration partner your customers will thank you for."

## Closing — Get the Meeting, Not the Deal
On a cold call, the win is a meeting — not a signed agreement. Never try to close the partnership on the first call.

> "Here's what I'd suggest — let's grab coffee and I'll show you exactly how it works. If it makes sense for your business, great. If not, no hard feelings. Can we find 20 minutes next week?"

If they want to know more before committing to a meeting:
> "Let me text you a one-pager right now. Take a look and I'll follow up in a couple days. What's the best number to reach you?"

## Execution Milestones — What Success Looks Like Over Time
1. **Qualify the fit** — service plumber, residential, some volume of water damage calls
2. **Get the meeting** — coffee, their office, anywhere they're comfortable
3. **Get the first job** — this is the proof of concept; over-deliver on it
4. **Debrief why they gave it** — call after the first job and ask: "What made you decide to send that one to us?" The answer tells you exactly how to lock in the relationship
5. **Lock in and expand** — incentivize the tech who made the call; ask for the next three

## What Great Looks Like
- Great BD reps qualify before pitching — they end wrong-fit calls early and don't waste anyone's time
- They figure out which type of plumber they're talking to in the first 3 minutes and adjust accordingly
- They never lead with money — they ask what the plumber wants first
- They make the referral process invisible for the tech — one text, no friction
- They treat the first referral like an audition — they personally debrief with the plumber after every first job
- They build separate relationships with the owner and the techs — same company, different motivations`,
  },

  // ── DISCOVERY MEETING PLAYBOOKS ───────────────────────────────────────────

  {
    scenarioType: 'property_manager_discovery',
    name: 'Residential PM — Discovery Meeting Playbook',
    content: `## Overview
A discovery meeting (also called a "probe meeting") is a scheduled, in-person meeting with a residential property manager — a condo association manager, HOA manager, or property management company rep. You earned this meeting from a prior cold call or introduction. The goal is NOT to pitch your company. The goal is to ask excellent questions, understand their world, and position yourself as the obvious choice when they're ready to make a change.

A great discovery meeting uncovers: who they currently use, how satisfied they are, how many events they have per year, who makes decisions, and what it would take to earn a trial job.

## Pre-Meeting Preparation
- Research the property: building age, number of units, property management company
- Review your probe question sheet and organize by category (Contact, Property, Insurance, Decision Process, Current Vendor, Maintenance, Loss History, Org Structure)
- Bring a one-page company overview and a business card — no hard-sell materials
- Confirm the meeting 24 hours in advance by text

## Opening — Set the Agenda
Start the meeting by giving them a brief agenda so they feel in control:

> "Thanks for making time for me today — I really appreciate it. I want to make the most of the time you've given me. My goal for this meeting is simple: I want to understand your property, how you handle water or fire events, and what your relationship with your current restoration vendor looks like. I'm not here to pitch you today — I just want to ask some questions. Does that work?"

Then build rapport briefly before diving into questions (weather, something about their office, a property detail you researched). Keep it 2–3 minutes.

## Probe Questions — Organized by Category

### Contact Background
- How long have you been in this role?
- What properties did you manage before this one?

### Property
- How many buildings and units are in your portfolio?
- How many square feet total?
- What year was the building built? What's the construction type?
- What are your biggest maintenance challenges right now?

### Insurance
- Who is your insurance carrier for the building?
- What does the master policy cover vs. what falls on individual unit owners?
- What's the building's deductible?
- Does your HOA or condo bylaws specify who's responsible for what in a loss?

### Decision Process
- Walk me through what happens when there's a water loss in one of your units — step by step.
- At what point do you call a restoration vendor?
- Is there a regional manager or portfolio manager who gets involved?
- Do you have an after-hours protocol? Who do residents call at 2am?
- What happens on a weekend?

### Current Vendor
- Who is your current restoration company?
- On a scale of 1 to 5, how would you rate them?
- What do they do well?
- What could they improve?
- Is your current arrangement exclusive, or could you add a second vendor?

### Maintenance Team
- How many maintenance engineers or staff do you have on-site?
- Have they had any training on water damage response — shutoffs, containment?
- What equipment do you have on-site (fans, dehumidifiers, wet/dry vac)?

### Loss History
- How many water, fire, or mold events would you say you have in a typical year?
- What types of events are most common — supply lines, roof leaks, HVAC?
- Tell me about the last event — what happened, how was it handled?
- On a scale of 1 to 10, how often do you outsource vs. handle in-house?

### Organizational Structure
- Besides you, who else is involved in vendor decisions?
- Is there a portfolio manager or regional director above you?
- Is there a board of directors? How often do they meet?
- Who would we also want to get in front of?

## Objection Handling — LACE Framework

**LACE:** Listen → Acknowledge → Clarify → Educate/Reframe

**"We like who we're using."**
Listen: Let them finish.
Acknowledge: "That's great — a reliable vendor relationship is really valuable."
Clarify: "Can I ask what you like most about them? And on that 1–5 scale, where would you put them?"
Educate: "Most PMs I talk to have a good vendor — they just want to know there's a backup. We're not asking you to replace anyone. We'd love the chance to earn a trial job and let our work speak for itself."

**"We have 3 vendors we rotate through."**
Acknowledge: "That's actually a smart setup — redundancy matters in this business."
Clarify: "How did you choose those three? What's the rotation based on?"
Educate: "We'd love to be considered for a fourth slot. If you ever have a situation where your current vendors are at capacity, we'd like you to know us well enough to call."

**"Our company has a signed MSA with another vendor."**
Acknowledge: "I understand — having a formal agreement gives you structure."
Clarify: "Is that agreement exclusive, or does it just establish terms for when you do use them?"
Educate: "Most vendor MSAs in this industry are non-binding and non-exclusive — they set pricing and terms but don't prevent you from using other vendors. We could set up a similar non-binding arrangement so we're ready when you need a backup."

**"You don't have an office near our properties."**
Acknowledge: "I understand location matters for response time."
Clarify: "What response time would you need for an emergency?"
Educate: "Our crews are dispersed throughout the area — our guys take trucks home. For most of your properties, our response time is comparable to or faster than vendors with a central office across town."

## Closing for a Next Step
Every discovery meeting should end with a specific, committed next step — not "I'll follow up."

> "I really appreciate the time today — this has been helpful. Based on what you've shared, I think we could be a great backup vendor for you. Here's what I'd like to suggest: can we set up a time for me to meet your portfolio manager [or: come back and do a quick property walk, or: get in front of the board at the next meeting]? What would be the most useful next step from your perspective?"

Options for next step:
- Lunch with the portfolio manager
- Property walk to get familiar with shutoffs and access points
- Follow-up meeting after the next BOD vote on vendors
- Trial job on the next eligible event

## Assessment Rubric — How Claude Scores This Session
The following 8 criteria are used to evaluate the BD rep's performance in a discovery meeting:

1. **Set agenda and established purpose of the meeting** (0–2 pts): Did the rep open the meeting by explaining what they wanted to accomplish? Did they frame it as discovery, not a sales pitch?
2. **Uncovered current restoration vendor and got a rating** (0–2 pts): Did the rep ask who the current vendor is AND ask for a rating (1–5 stars)?
3. **Asked what the current vendor could improve** (0–1 pt): Did the rep follow up the vendor rating with "what could they improve?" or similar?
4. **Determined referral volume and frequency** (0–1 pt): Did the rep find out how many events per year this property has? How often they outsource?
5. **Understood the decision-making process and chain of events** (0–1 pt): Did the rep ask who's involved in authorizing a vendor, what happens step by step when a loss occurs?
6. **Asked about organizational structure and who else to meet** (0–1 pt): Did the rep ask about the portfolio manager, regional director, or board of directors?
7. **Handled objections using LACE** (0–1 pt): If an objection was raised, did the rep acknowledge it, clarify, and reframe — without being defensive or knocking the competition?
8. **Set a clear, specific next step before ending** (0–1 pt): Did the meeting end with a concrete, agreed-upon next action (not just "I'll follow up")?

**Total: 10 points**`,
  },
  {
    scenarioType: 'commercial_pm_discovery',
    name: 'Commercial Property Manager — Discovery Meeting Playbook',
    content: `## Overview
A discovery meeting with a commercial property manager is a scheduled, in-person meeting with the person who manages office buildings, industrial parks, retail centers, medical offices, or mixed-use properties. Commercial PMs manage larger dollar events, more complex insurance situations, and often have more organizational layers than residential PMs.

The goal is to ask thorough probe questions, uncover their current vendor relationship and pain points, understand their loss history and volume, and identify who else in their organization you need to meet.

## Pre-Meeting Preparation
- Research the property management company and portfolio if possible (building type, square footage, number of tenants)
- Know your company's commercial capabilities: large loss experience, 24/7 response, tenant communication protocols, documentation for commercial insurance
- Bring a company capabilities one-pager and reference list of similar commercial jobs
- Confirm the meeting 24 hours in advance

## Opening — Set the Agenda
> "Thank you for making time today. My goal is to understand your portfolio, what your current vendor relationship looks like, and what it would take for a restoration company to earn a spot on your preferred list. I'm not here to give you a pitch — I want to ask questions. Does that work?"

## Probe Questions — Organized by Category

### Contact Background
- How long have you been in this role?
- What's your background — did you come up through property management, facilities, or another path?

### Property and Portfolio
- What type of properties do you manage — office, industrial, medical, retail, or a mix?
- How many buildings and how much total square footage?
- What's the age and construction type of your main properties?
- What are the biggest maintenance challenges you're dealing with right now?

### Insurance
- Who is your commercial property insurer?
- What's the deductible on your primary policy?
- Do you carry separate policies per building or a blanket portfolio policy?
- Who handles the insurance claims process on your end — do you have a risk manager?

### Decision Process
- Walk me through what happens when there's a water or fire loss at one of your properties. Who calls who?
- At what point do you bring in a restoration vendor?
- Who authorizes the vendor dispatch — is that you, or does it go to ownership?
- What's your after-hours protocol? Who does maintenance call at 2am?
- Is there a property owner or asset manager above you in the decision chain?

### Current Vendor
- Who is your current restoration company?
- On a scale of 1 to 5, how would you rate them?
- What do they do well?
- What would you want them to do better?
- Is that an exclusive relationship, or could you add another vendor?

### Maintenance Team
- How many maintenance engineers or facilities staff do you have on-site?
- Have they had any training on emergency response — water shutoffs, initial containment?
- What restoration equipment do you have on-site?

### Loss History
- How many water, fire, or mold events do you have across your portfolio in a typical year?
- What types of events are most common — HVAC, roof, plumbing, sprinkler?
- Tell me about the last significant event — what happened and how was it handled?
- On a scale of 1 to 10, how much of a loss do you outsource to a vendor vs. handle in-house?

### Organizational Structure
- Besides you, who else is involved in authorizing or evaluating a restoration vendor?
- Is there an owner group, asset manager, or corporate facilities team above you?
- Do you manage these properties independently or are you part of a management company with other PMs?
- Who else in your organization should we get in front of?

## Objection Handling — LACE Framework

**"We handle small losses in-house."**
Acknowledge: "That's a smart approach — keeping your team capable saves you money on small events."
Clarify: "What's the threshold where you'd bring in an outside vendor? Is it square footage, category of damage, or something else?"
Educate: "That makes sense. We'd want to understand your threshold so we can be the first call when it crosses that line — and frankly, even on the jobs you handle, a quick moisture check from us at no charge can protect you from a mold issue down the road."

**"You don't have an office in the city."**
Acknowledge: "Response time is critical — I completely understand that concern."
Clarify: "What response time do you need for a major event?"
Educate: "Our crews are distributed — our project managers and technicians work out of their service areas and take trucks home. For [property location], our response time is [X minutes] on average. We can show you our response time data if that's helpful."

**"We have a signed MSA with our current vendor."**
Acknowledge: "Having a formal vendor agreement in place is good practice."
Clarify: "Is that agreement exclusive, or does it set terms for when you do use them?"
Educate: "Most commercial restoration MSAs establish pricing and SLAs but don't prohibit you from using other vendors. We can offer you a similar non-binding agreement with SLA commitments — response time, completion timeline, documentation — so you have the same level of structure with us."

**"Can you handle a building this size?"**
Acknowledge: "That's a fair question — size and complexity matter."
Educate: "We've handled losses as large as [$X million, X square feet, X-building events]. I'd be happy to share some commercial references similar in scale to your portfolio."

## Closing for a Next Step
> "I appreciate the time today — this has been incredibly helpful. Based on what you've shared about [specific pain point or event they mentioned], I think there's a real opportunity for us to be a resource for you. Here's what I'd like to suggest: would you be open to a property walk? I'd like to walk your buildings with your maintenance supervisor, document shutoffs and access points, and have a reference sheet ready before you ever need us. That's at no cost to you. And if it makes sense, I'd also love to meet [asset manager/ownership group]. What would be the most useful next step?"

## Assessment Rubric — How Claude Scores This Session
The following 8 criteria are used to evaluate the BD rep's performance in a discovery meeting:

1. **Set agenda and established purpose of the meeting** (0–2 pts): Did the rep open the meeting by explaining what they wanted to accomplish? Did they frame it as discovery, not a sales pitch?
2. **Uncovered current restoration vendor and got a rating** (0–2 pts): Did the rep ask who the current vendor is AND ask for a rating (1–5 stars)?
3. **Asked what the current vendor could improve** (0–1 pt): Did the rep follow up the vendor rating with "what could they improve?" or similar?
4. **Determined referral volume and frequency** (0–1 pt): Did the rep find out how many events per year this property has? How often they outsource?
5. **Understood the decision-making process and chain of events** (0–1 pt): Did the rep ask who's involved in authorizing a vendor, what happens step by step when a loss occurs?
6. **Asked about organizational structure and who else to meet** (0–1 pt): Did the rep ask about ownership, the asset manager, or other decision-makers above the PM?
7. **Handled objections using LACE** (0–1 pt): If an objection was raised, did the rep acknowledge it, clarify, and reframe — without being defensive or knocking the competition?
8. **Set a clear, specific next step before ending** (0–1 pt): Did the meeting end with a concrete, agreed-upon next action (property walk, meeting with ownership, etc.)?

**Total: 10 points**`,
  },
  {
    scenarioType: 'insurance_broker_discovery',
    name: 'Insurance Broker — Discovery Meeting Playbook',
    content: `## Overview
A discovery meeting with an insurance agent or broker is a scheduled sit-down to understand their book of business, how they handle claims, their current restoration vendor relationship, and what a referral partnership would look like. Insurance agents and brokers are high-value referral sources — a single agent with 200+ property policies can generate 10–20 referrals per year.

The goal is to understand their world deeply — their book mix, FNOL process, current vendor satisfaction, and how you can make their clients' experience better. The best outcome is an agreement to share the next eligible referral.

## Pre-Meeting Preparation
- Research the agency: independent vs. captive, carriers they write for, specialty if known
- Be ready to explain your communication process during a claim — this is the #1 thing agents care about
- Bring a simple one-page overview of your referral process and contact information
- Know your company's client communication protocol (how and when you contact the agent during a job)

## Opening — Set the Agenda
> "Thank you for making time — I know you're busy. I want to be straightforward about what I'm hoping to accomplish today: I want to understand your book of business, how you handle referrals when clients have a property loss, and what your experience has been with restoration vendors. I'm not here to pitch you — I'm here to figure out if there's a fit. Does that work?"

## Probe Questions — Organized by Category

### Contact Background
- How long have you been in this role?
- How many agents or staff work in your agency?
- Are you independent, or are you captive to a specific carrier?

### Book of Business
- How many property policies do you have in your book — roughly?
- What's the mix between residential and commercial?
- Which insurance carriers do you write for most frequently?
- Do you have any specialty areas — high-value homes, commercial real estate, HOAs?

### Claims and Referral Decision Process
- When one of your clients has a property loss, what does that process look like for you?
- Do you auto-refer them to the carrier's 800# for vendor assignment, or do you make the referral yourself?
- For your VIP clients — your top 10 or 20 accounts — do you handle those differently?
- Who else at your agency can make a restoration referral, besides you?
- What does your FNOL (first notice of loss) process look like?
- Do you have an after-hours referral process? What do clients do at 11pm?

### Current Vendor
- Do you currently have a restoration company you refer your clients to?
- If so, who is it and how did you choose them?
- On a scale of 1 to 5, how would you rate your experience with them?
- What do they do well for your clients?
- What would you want them to do better?
- Is there a formal vendor approval process, or can you add a vendor whenever you choose?

### Claims History
- Roughly how many restoration-type events do your clients have in a typical year?
- When was the last time you made a restoration referral?
- Have you ever had a situation where a restoration company made your client unhappy — and it reflected on you?

## Objection Handling — LACE Framework

**"I auto-send clients to the carrier 800# — it's just easier."**
Acknowledge: "That's a completely understandable approach — it keeps things simple."
Clarify: "When your clients go through the carrier list, do you stay in the loop on how the job goes? Does the restoration company keep you informed?"
Educate: "The challenge with carrier-assigned vendors is they work for the carrier's efficiency, not always your client's experience. When you're the one making the referral, you control who shows up at your client's house — and how that reflects on you."

**"We like who we're using."**
Acknowledge: "That's great — a trusted vendor relationship is valuable."
Clarify: "On that 1–5 scale, where do they land? Is there anything you'd want them to do differently?"
Educate: "Most agents I work with have a solid vendor — they just want a backup they trust equally. We're not asking you to replace anyone. We'd love the chance to earn your trust on one job and go from there."

**"I had a bad experience with a restoration company referring a client — it came back on me."**
Listen carefully and let them explain fully.
Acknowledge: "That's a serious situation — I can understand why you'd be cautious after that."
Clarify: "What specifically went wrong? Was it the work quality, the billing, the communication?"
Educate: "That's exactly why I want to walk you through our process specifically. [Explain: Xactimate-based billing, change order authorization process, your personal contact during the job, how you communicate with the agent.] The goal is that if something ever came up, you would know about it before your client called you about it."

**"We don't want to be seen as steering clients."**
Acknowledge: "That's a real concern in the industry — I respect it."
Clarify: "What does your current referral process look like when you do make a recommendation?"
Educate: "Making a referral from a list of vetted vendors you trust is not steering — it's a service. The courts and insurance regulations define steering as directing clients to a vendor with undisclosed financial incentives. Saying 'I've worked with these guys and my clients have been happy' is just good advice."

## Closing for a Next Step
> "This has been really helpful — thank you. Based on what you've shared about [specific pain point], I think we can genuinely add value for your clients. Here's what I'd like to suggest: can we agree to a trial? The next eligible property loss where you'd normally make a referral — send it to us. I'll personally make sure you're kept in the loop from the minute we get on-site to the day the job is complete. If it's not a great experience for your client, you owe me nothing and we go our separate ways. Does that seem fair?"

## Assessment Rubric — How Claude Scores This Session
The following 8 criteria are used to evaluate the BD rep's performance in a discovery meeting:

1. **Set agenda and established purpose of the meeting** (0–2 pts): Did the rep open the meeting by explaining what they wanted to accomplish? Did they frame it as discovery, not a sales pitch?
2. **Uncovered current restoration vendor and got a rating** (0–2 pts): Did the rep ask who the current vendor is AND ask for a rating (1–5 stars)? (If no current vendor, did they probe why not?)
3. **Asked what the current vendor could improve** (0–1 pt): Did the rep follow up the vendor rating with "what could they improve?" or similar?
4. **Determined referral volume and frequency** (0–1 pt): Did the rep find out how many events per year? When was the last referral?
5. **Understood the decision-making process and chain of events** (0–1 pt): Did the rep ask about FNOL process, who makes referral decisions, how VIP clients are handled?
6. **Asked about organizational structure and who else to meet** (0–1 pt): Did the rep ask about other staff who can make referrals, or ask about the agent's book mix and carriers?
7. **Handled objections using LACE** (0–1 pt): If an objection was raised, did the rep acknowledge it, clarify, and reframe — without being defensive or knocking the competition?
8. **Set a clear, specific next step before ending** (0–1 pt): Did the meeting end with a concrete, agreed-upon next action (trial referral, follow-up meeting, etc.)?

**Total: 10 points**`,
  },
  {
    scenarioType: 'plumber_bd_discovery',
    name: 'Plumber — Discovery Meeting Playbook',
    content: `## Overview
A discovery meeting with a plumbing company owner is a scheduled sit-down to deeply understand their business, figure out what type of plumber they are, and build the foundation for a long-term referral partnership. You earned this meeting from a prior cold call or warm introduction. Come in as a learner, not a pitcher.

The goal is to: identify their plumber type (relationship vs. transactional), understand their current vendor situation, map their referral volume and process, uncover what they actually want from a partner, and close for a trial referral. This meeting is the beginning of a relationship that can generate hundreds of thousands of dollars in water jobs over years — treat it accordingly.

## Pre-Meeting Preparation — Know Who You're Walking Into
Before the meeting, do your homework to identify which type of plumber you're meeting:
- **Relationship-type:** Small to mid-size, word-of-mouth driven, not heavy on advertising, values customer experience above all. They want trust first, everything else second.
- **Transaction-type:** Often larger, advertising-driven (Google, Yelp), focused on volume. They'll ask about payout immediately. They'll work with you for money but won't give you loyalty for free.

Look them up: Are they on Google Ads? Yelp? Do they have 200+ reviews or 18? Are they in a niche neighborhood network or a broad service area? This tells you how to open.

Also prepare:
- Know your referral payout structure and be ready to state it specifically
- Know your response time commitment (residential and commercial, day and night)
- Know your tech incentive program — how individual plumbing techs can be recognized separately from the owner
- Bring a simple one-pager and your direct cell number — no hard-sell materials

## Opening — Set the Agenda
Start by framing the meeting as a conversation, not a pitch:

> "Thanks for making the time — I know you're busy and I want to make this worth it. Here's what I'd like to do: I want to understand your business — how water damage situations come up for your guys, who you're working with now, and what you'd actually want from a restoration partner. I'm not here to pitch you on anything today. I just want to ask good questions and see if there's a natural fit. Does that work?"

Build brief rapport (2–3 minutes max) — ask about the business, the building, how long they've been at this location. Then move into probe questions.

## Probe Questions — Organized by Category

### Contact and Business Background
- How long have you been in business?
- Did you start this yourself, or did you buy into it?
- What was your background before owning the company — did you come up as a technician?

### Business Structure
- How many plumbers do you have running service calls?
- How many vehicles in the fleet?
- What's your split between residential and commercial?
- What percentage of your work is service/repair vs. new construction?
  *(If majority is new construction → note this; may not be the right fit for high-volume referrals)*
- What's your service territory?
- Do you run an after-hours line? How does that work?

### Referral Process and Decision Chain
- When one of your guys gets on-site and finds water damage beyond the source — what happens? Walk me through it.
- Does the technician handle the referral in the field, or does it go back through your office?
- Is there a dispatcher or office manager who fields those calls?
- Do you have a protocol for after-hours water damage situations?

### Current Vendor Relationship
- Do you currently have a restoration company you're working with?
- If yes: Who is it, and how did you end up with them?
- How would you rate that relationship on a scale of 1 to 5?
- What do they do well?
- What would you want them to do differently?
- How does the referral process work practically — what does your tech do when there's a job?
- What does the financial arrangement look like — do they pay per referral? How is it tracked?
- Could you work with an additional vendor, or is it exclusive?

### What They Actually Want
*(This is the most important section — don't skip it)*
- "If a restoration company were the perfect fit for your business, what would that look like?"
- "Some plumbers want leads back — plumbing referrals from our jobs. Some want help with warranty or callback situations. Some just want fast response and good communication. What would actually be valuable to you?"
- "What about for your technicians specifically? What kind of recognition or incentive would make them want to make that referral call every time?"

### Referral Volume Assessment
- About how many jobs per month does your team see where water damage is clearly present beyond the repair?
- What are the most common types — supply line failures, water heaters, slab leaks, toilet overflows, drain backups?
- When was the last time one of your guys was on a water damage job? What happened?
- Has there ever been a situation where a restoration company let your customer down — and it came back to you?

## Understanding Value Exchange — The 4:1 Principle
For relationship-type plumbers especially, the partnership needs to feel balanced over time, not transactional. A useful mental model is the **4:1 ratio**: for every 4 paid jobs we receive through them, we look for a way to give something back — a plumbing referral from a job we're on, a free dryout assist on a warranty callback, a marketing mention, something. The goal is that they feel like they have a genuine partner, not just someone who's taking their referrals.

When appropriate, bring this up:
> "The way we think about this — we want it to feel like a two-way street over time. We keep track of what you send us, and we actively look for ways to send things back. Plumbing referrals from our jobs, helping on warranty situations where it makes sense — we want you to feel like working with us is worth it beyond the payout."

## Incentivizing Owners vs. Techs — Different Conversations
The owner and the technicians have completely different motivations. If you only build the relationship with the owner but the tech in the field doesn't know or care about the partnership, the referrals won't happen.

**For the owner:** Leads back, warranty job support, exclusivity, relationship, trust, marketing value
**For the technicians:** Fast, tangible, small rewards — gift cards, recognition texts, cash per signed referral. The faster the reward after the referral, the more reliably the behavior repeats.

Ask directly:
> "Do your guys in the field make the referral call themselves, or does it go through you? Because I want to make sure we're thinking about what makes sense for them, too."

Then describe your tech incentive program specifically and concretely.

## Objection Handling — LACE Framework

**"What's the payout?"**
This is not an objection — answer it directly and confidently. Vague answers here destroy credibility.
> "We pay $[X] per signed job, paid on [specific date/schedule]. You'll get a text confirmation within 24 hours of every job that comes from you, and a summary on [date]. No spreadsheets on your end — we track everything and you can verify through [portal/text]. Your techs also get [specific tech incentive] separately."

**"We already have a company we use."**
Acknowledge: "That's great — sounds like you've got something in place already."
Clarify: "How long have you been with them? On a 1–5 scale, how is that going?"
Educate: "We're not asking you to end anything. The best situation for you is probably to have two companies you trust — so if your primary is ever at capacity or a customer has a bad experience, you've already got a backup you've already vetted. Let us earn one job first."

**"We had a bad experience — slow payer / unreliable / let our customer down."**
Acknowledge: "That's a real problem and I understand why it would make you cautious about anyone new."
Clarify: "What happened exactly? Was it response time, the payout, the customer experience?"
Educate: "Everything you just described is exactly what we designed our process to prevent. The only way I can prove that is one job — not a conversation, not a brochure. If we don't deliver on that first one, we don't deserve the next."

**"What happens if my customer complains about your crew?"**
Acknowledge: "That's a completely fair concern — when you refer us, your name is on it too."
Clarify: "Has that happened with a restoration company before? What was the issue?"
Educate: "If a customer ever has a complaint, I want to be the first call — before it gets to you. Here's my direct number. Our PM on every job knows to copy you on any communication. We'd rather over-communicate than let something sit."

**"I don't have time to manage another relationship."**
Acknowledge: "I hear you — I know you're running a business and your time is worth something."
Clarify: "What specifically feels like work? Is it the referral process itself, or the follow-up?"
Educate: "Here's what we make your guys do: one text. Address and your company name. We take it from there. You get a confirmation back in 15 minutes. I follow up with you after every first job personally. After that it runs itself."

## Closing for the Trial Referral
The win is a cell number exchange and a verbal commitment on the next eligible job:

> "Here's what I want to leave you with — no commitments, no contracts. The next time one of your guys leaves a job with standing water, text me directly. I'll get a crew out fast, your customer will have a great experience, and I'll call you personally to debrief how it went. First job is the tryout. If you like what you see, we build from there. If not, no hard feelings. Does that work?"

Then exchange **direct cell numbers** before you leave — not main office numbers. This is non-negotiable. The relationship is between people, not phone trees.

## Post-Meeting: The Debrief Call
After the first referral, call the owner and ask:
> "What made you decide to send that job to us?"

The answer tells you exactly what's working and how to lock in the relationship long-term. Build on whatever they say.

## Assessment Rubric — How Claude Scores This Session
The following 8 criteria are used to evaluate the BD rep's performance in a discovery meeting:

1. **Set agenda and established purpose of the meeting** (0–2 pts): Did the rep open the meeting by explaining what they wanted to accomplish? Did they frame it as discovery, not a sales pitch?
2. **Uncovered current restoration vendor and got a rating** (0–2 pts): Did the rep ask who the current vendor is AND ask for a rating (1–5 stars)? (If no current vendor, did they probe why not?)
3. **Asked what the current vendor could improve** (0–1 pt): Did the rep follow up the vendor rating with "what could they improve?" or similar?
4. **Determined referral volume and frequency** (0–1 pt): Did the rep find out how many jobs per month result in a restoration referral?
5. **Understood the decision-making process and chain of events** (0–1 pt): Did the rep ask how referrals are made, who calls who, what the after-hours process is?
6. **Asked what the plumber actually wants from a partner** (0–1 pt): Did the rep ask what would be valuable to them specifically — leads back, tech incentives, warranty help — rather than just pitching their own program?
7. **Handled objections using LACE** (0–1 pt): If an objection was raised, did the rep acknowledge it, clarify, and reframe — without being defensive or knocking the competition?
8. **Set a clear, specific next step before ending** (0–1 pt): Did the meeting end with a concrete, agreed-upon next action (trial referral, cell number exchange, etc.)?

**Total: 10 points**`,
  },
];
