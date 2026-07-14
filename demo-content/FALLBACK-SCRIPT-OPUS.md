# Demo Fallback Script — Canned Responses

**Use this if the network drops or a live system is unavailable mid-demo.** It
contains the exact prompt for each step and the full response captured during the
2026-06-24 live dry run. Read it aloud, screen-share it, or paste a response so the
story still lands.

> The health/proxy data here is **synthetic demo data**. The assisted-living
> facilities and doctors were **real, live results** at capture time — present them
> as "captured earlier today" if you're offline, and don't claim live vacancy.

---

# PERSONA 1 — THE CAREGIVER

## Step 1 — Connect

**Prompt:**
> Connect to my health records in demo mode.

**Response:**

**Connected — demo mode.** You're signed in as **Demo User**. Both systems are live:

| System | Status |
|--------|--------|
| My Health Records (MHR) | ✅ Connected |
| AHS Connect Care (MyChart) | ✅ Connected |
| Authorized records | 1 |

⚠️ *This is health-record data for information only — not medical advice. Always confirm with your healthcare provider.*

You're ready. Ask me for a health overview, your labs, medications, or to look at a family member's records you're authorized for.

---

## Step 2 — Full health overview

**Prompt:**
> Give me a complete overview of my health — labs, medications, conditions, allergies, and immunizations.

**Response:**

### Demo User — Health Overview

A consolidated snapshot pulled from My Health Records and AHS Connect Care. **Demo User**, DOB 1985-06-15 (39). Four active conditions, four active medications, recent labs largely at target with three items worth watching.

### Active Conditions
| Condition | Code | Diagnosed | By |
|-----------|------|-----------|-----|
| Type 2 Diabetes Mellitus | E11.9 | 2023-09-01 | Dr. Sarah Mitchell |
| Essential Hypertension | I10 | 2022-11-15 | Dr. Sarah Mitchell |
| Hyperlipidemia | E78.5 | 2024-06-20 | Dr. Sarah Mitchell |
| Vitamin D Deficiency | E55.9 | 2024-12-10 | Dr. Sarah Mitchell |

### Current Medications
| Medication | Strength | Frequency |
|-----------|----------|-----------|
| Metformin | 500 mg | Twice daily |
| Lisinopril | 10 mg | Once daily |
| Atorvastatin | 20 mg | Once daily at bedtime |
| Vitamin D3 | 2000 IU | Once daily |

### Recent Labs (Dec 10, 2024)
| Test | Result | Reference |
|------|--------|-----------|
| HbA1c | **6.8 %** | < 6.0 |
| Fasting Glucose | **7.8 mmol/L** | 3.6–6.0 |
| Total Cholesterol | **6.2 mmol/L** | < 5.2 |
| LDL | **4.2 mmol/L** | < 3.4 |
| HDL | 1.4 mmol/L | > 1.0 |
| eGFR | **72** | > 90 |
| Vitamin D | **32 nmol/L** | 75–250 |

### HbA1c Trend (worth noting)
| Date | HbA1c |
|------|-------|
| Jun 2024 | 6.2 % |
| Sep 2024 | 6.5 % |
| Dec 2024 | 6.8 % |

A steady upward drift over six months — a reasonable thing to raise with your doctor.

### Allergies
- **Penicillin** (medication) — rash, hives; moderate.

### Immunizations
- COVID-19 mRNA (Pfizer), 5th dose — Oct 15, 2024
- Influenza 2024–25 — Nov 1, 2024
- Tdap — Mar 20, 2022

⚠️ *Information only, not medical advice.* For any section I can pull full detail — labs, allergies, or imaging.

---

## Step 3 — Switch to Margaret (caregiver / proxy access)

**Prompt:**
> Switch to my mother Margaret's records. Give me a health overview — she's 72 and I help manage her care. What should I be watching for?

**Response:**

### Margaret User — Health Overview (caregiver view)

You're now viewing **Margaret, 72** (your mother). This is a complex, high-acuity picture: **11 active conditions and 15 medications**. As her caregiver, here's what stands out and what to keep an eye on.

### Active Conditions
| System | Condition |
|--------|-----------|
| Endocrine | Type 2 diabetes; hypothyroidism |
| Cardiac | Paroxysmal atrial fibrillation; HFpEF; hypertension; mixed hyperlipidemia |
| Renal | Chronic kidney disease, stage 3a |
| Neuro | Mild Alzheimer-type cognitive disorder |
| MSK | Bilateral knee osteoarthritis; osteoporosis; history of fall |

### Medications (15)
| Purpose | Medication |
|---------|-----------|
| Diabetes | Metformin 500 mg BID · Glipizide 5 mg BID |
| AFib (anticoagulant) | Apixaban 5 mg BID |
| Heart rate/failure | Metoprolol SR 50 mg · Spironolactone 12.5 mg · Furosemide 20 mg PRN |
| Blood pressure | Amlodipine 5 mg · Losartan 50 mg |
| Cognition | Donepezil 5 mg qHS |
| Thyroid | Levothyroxine 75 mcg |
| Pain (arthritis) | Acetaminophen 650 mg TID · Diclofenac topical |
| Bone/supplements | Vitamin D3 · Calcium carbonate · Atorvastatin |

### What to watch for (questions, not diagnoses)
- **Bleeding risk:** she's on apixaban — watch for bruising, dark stools; confirm dosing against her kidney function.
- **Kidney + drug load:** CKD 3a with metformin, spironolactone, and a topical NSAID — worth a pharmacist review.
- **Low blood sugar:** glipizide can cause hypoglycemia, more so in seniors with reduced kidney function.
- **Falls:** blood-pressure meds + a fall history + osteoporosis is a high-stakes combination.

I can do a focused medication-interaction review next, or pull her recent labs.

⚠️ *Information only, not medical advice — bring these to her doctor or pharmacist.*

---

## Step 4 — The polypharmacy danger

**Prompt:**
> My mother is on more than a dozen medications. Review them for potential interactions, especially given her kidney function and age. What should I raise with her doctor or pharmacist?

**Response:**

### Margaret's Medications — Safety Review

I reviewed all **15 medications** against her age (72), kidney function (CKD 3a), and conditions. These are **questions to raise with her doctor or pharmacist — not diagnoses or instructions to change anything.**

### Flags worth raising
| Priority | Pattern | Why it matters | Question to ask |
|----------|---------|----------------|-----------------|
| 🔴 High | **Glipizide + reduced kidney function** | Sulfonylureas clear more slowly in CKD, raising hypoglycemia risk in seniors | "Is glipizide still the safest diabetes agent for her kidneys?" |
| 🔴 High | **Topical diclofenac (NSAID) + CKD 3a + apixaban** | Even topical NSAIDs carry some systemic absorption; NSAIDs are generally cautioned in CKD and can add bleeding risk with an anticoagulant | "Is the Voltaren gel safe given her kidneys and Eliquis?" |
| 🟡 Watch | **Apixaban dosing in CKD** | Dose sometimes reduced to 2.5 mg BID based on age/weight/creatinine criteria | "Is 5 mg BID still the right apixaban dose for her?" |
| 🟡 Watch | **Spironolactone + Losartan** | Both can raise potassium; combined in HFpEF needs periodic monitoring | "When were her potassium and kidney levels last checked?" |
| 🟡 Watch | **Metformin + CKD 3a** | Generally allowed above eGFR 30 but needs monitoring | "Should her metformin dose be reviewed at this kidney stage?" |
| 🟢 Note | **Acetaminophen 650 mg TID** | Appropriately the first-line pain choice over NSAIDs — good | Confirm she stays under 3 g/day |

### A positive sign
Her record shows **atorvastatin was already discontinued in 2022** for muscle pain (CK normal, resolved off therapy) — so that's documented and accounted for.

### Bottom line for you as caregiver
Book a **pharmacist medication review** (free in Alberta — a "Standard Medication Management Assessment"). Bring this list. The three to lead with: **glipizide, the topical NSAID, and confirming her apixaban dose.**

⚠️ *These are flags for a professional to confirm — the system did not detect a verified interaction.*

---

## Step 5 — The transition: from health to housing (the headline moment)

**Prompt:**
> Based on my mother's health conditions, mobility needs, and level of care, find assisted living facilities near Edmonton that would suit her. She needs an accessible building and memory care.

**Response:**

### Assisted Living Near Edmonton — Matched to Margaret's Needs

Based on Margaret's profile — **mild Alzheimer-type dementia** (needs secure memory care), **mobility limits from knee arthritis + fall history** (needs an accessible building), and **high medical complexity** (benefits from on-site nursing) — I searched the live Alberta Assisted Living Navigator. Here are the closest strong matches, **nearest first**, all accessible buildings offering memory care.

| Facility | Distance | Care types | Phone |
|----------|----------|-----------|-------|
| **Grand Manor** | 0.8 km | Type B secure (memory care) + supportive living | 780-441-7979 |
| **Our Parents' Home** | 2.4 km | Type B secure (memory care) + supportive living | 780-988-5504 |
| **Glenora Park** | 3.2 km | Type B secure (memory care) | 780-670-6957 |
| **Saint Thomas Health Centre** | 3.3 km | Type B secure (memory care) | 780-450-2987 |
| **Shepherd's Care Vanguard** | 3.4 km | Type B secure (memory care) | 780-474-1798 |
| **Balwin Villa** | 5.3 km | Type B secure (memory care, dedicated) | 780-757-5550 |
| **Shepherd's Care Kensington** | 6.4 km | Type A long-term **+** secure memory care | 780-447-3840 |

**Why these:** Margaret's dementia means she needs a **Type B secure** building (safe for wandering), and her medical load means **Shepherd's Care Kensington** is worth a close look — it offers *both* secure memory care **and** Type A long-term care on one site, so she wouldn't have to move again if her needs increase.

*The list shows "no open spaces reported" — that's a live vacancy snapshot, not a closed door. Vacancy moves constantly; you confirm directly with the facility.*

Want me to pull full details and photos on **Grand Manor** (the nearest), with tour questions tailored to her conditions?

---

## Step 6 — Facility deep-dive with health context

**Prompt:**
> Tell me everything about the first facility, including photos. Given my mother's conditions and medications, what questions should I ask them during a tour?

**Response:**

### Grand Manor — Full Profile & Tour Questions

**10766 97 St NW, Edmonton · 780-441-7979 · 0.8 km from your search.** Run by **Excel Resources Society** (non-profit), accredited by Accreditation Canada. The photos show a secured low-rise building, wide handrailed corridors, and a memory-care lounge with a garden mural — purpose-built for residents like Margaret.

*(In the live demo, 3 facility photos render here.)*

### Match to Margaret's needs
| Her need | What Grand Manor offers |
|----------|------------------------|
| Secure dementia care | **Type B secure (memory care)** |
| Mobility / fall risk | Wheelchair-accessible building **+ accessible bathroom** |
| Medical complexity | 102 funded spaces, emergency call system, on-site care |
| Comfort / dignity | Private room or 1-bedroom suite, gardens, café, library, hairdresser |

### Cost notes
Funded spaces are arranged through an **AHS case manager** (call **Health Link 811** to start) — not booked directly. Optional add-ons: TV $30/mo, phone $16.40/mo, laundry $3.75/use, foot care $10/visit.

### Questions to ask on the tour (built from her record)
1. **Medication management** — "She's on 15 medications including a blood thinner (apixaban) and insulin-affecting drugs. How is medication administered and monitored here?"
2. **Memory care programming** — "What's the staff-to-resident ratio on the secure unit, and what cognitive/recreation programming do you run for early-stage dementia?"
3. **Fall prevention** — "She has osteoporosis and a fall history. What fall-prevention measures and accessible-bathroom features are in each room?"
4. **Cardiac monitoring** — "She has AFib and heart failure. Is there on-site nursing that can monitor weight, swelling, and heart rate daily?"
5. **Continuity** — "If her needs increase, can she stay, or would she need to transfer?"
6. **Anticoagulation safety** — "How do you handle injury/bleeding risk for residents on blood thinners?"

📄 Official licensing & standards record (standardsandlicensing.alberta.ca) · operator: excelsociety.org

Want me to turn this into a printable tour checklist, or compare Grand Manor side-by-side with Our Parents' Home?

---

## Step 7 — Explain the system (for overwhelmed families)

**Prompt:**
> I'm new to all of this. In plain language, what are my options for my mother? What's the difference between supportive living and long-term care? How does AHS placement work, and what will it cost?

**Response:**

### Continuing Care in Alberta — Plain-Language Guide

You're not behind — this system confuses almost everyone the first time. Here's the whole map in plain terms.

### The care types (least to most support)
| Level | What it is | Right for Margaret? |
|-------|-----------|---------------------|
| **Seniors lodge** | Independent living + meals, housekeeping, social. Income-tested. | No — too independent |
| **Supportive living** | Your own space + some personal care | No — not enough for dementia |
| **Type C** | Lodge-style with more services | No |
| **Type B (designated supportive living)** | Publicly funded, care staff on site | Partly |
| **Type B secure (memory care)** | **Secure, enclosed setting for dementia** | ✅ **Her main fit** |
| **Type A (long-term care)** | **24-hour nursing for complex needs** | ✅ If her medical needs grow |

Margaret sits right at the **Type B secure** level today, with **Type A** as the likely next step given her heart, kidney, and diabetes complexity. That's why a site offering *both* (like Shepherd's Care Kensington) is worth prioritizing.

### How you pay — two routes
- **Publicly funded ("Accessed Through AHS Case Manager"):** you don't apply directly. An **AHS case manager assesses her and arranges placement.** Start by calling **Health Link 811**, or ask her doctor for a referral. This is the route for most families.
- **Private pay ("Accessed Through Site Directly"):** you arrange and pay the operator yourself. Faster, but you carry the full cost.

### What it costs
For publicly funded continuing care, residents pay a **standard accommodation charge** (set by the province, roughly **$2,000–$2,900/month** depending on room type), which covers room and meals — **care itself is funded.** Optional extras (TV, phone, foot care) are billed on top, as you saw at Grand Manor.

### Your first move
**Call Health Link 811** and ask for a **continuing care assessment** for Margaret. That one call starts the AHS case-management process that unlocks publicly funded placement.

Want me to build a step-by-step action plan you can follow from here?

---

## Step 8 — The caregiver action plan (emotional closer)

**Prompt:**
> Create an action plan for transitioning my mother into assisted living. Include what to do first, who to call, what documents to prepare from her health records, and a checklist for evaluating facilities during tours.

**Response:**

### Action Plan — Transitioning Margaret into Assisted Living

A clear, ordered plan grounded in her actual health record. Work it top to bottom.

### Week 1 — Start the official process
1. **Call Health Link 811** and request a **continuing care assessment** for Margaret. This assigns an **AHS case manager** — the person who unlocks publicly funded placement. *(Her dementia + heart failure + CKD make her a clear candidate.)*
2. **Tell her family doctor (Dr. Mitchell)** you've started this, and ask them to send supporting notes to the case manager.

### Week 1–2 — Prepare her documents
From her health records, assemble a one-page summary:
- **Medication list** — all 15, with the blood thinner (apixaban) and glipizide flagged.
- **Conditions list** — dementia, AFib, HFpEF, CKD 3a, diabetes, osteoporosis + fall history.
- **Allergies** and recent labs (kidney function, HbA1c).
- **Her doctors** — Mitchell (family), Chen (cardiology), Watson (neuro/cognition).
- Personal/legal: Alberta Health card, ID, **Personal Directive and Enduring Power of Attorney** (essential — locate these now if you haven't).

### Week 2–4 — Evaluate facilities
3. **Shortlist** the secure memory-care sites near her: **Grand Manor, Our Parents' Home, Shepherd's Care Kensington** (prioritize Kensington — it also has Type A, so no second move later).
4. **Book tours.** Take the **6 tour questions** I built from her record (medication management, memory-care ratio, fall prevention, cardiac monitoring, continuity, bleeding safety).
5. **Confirm vacancy directly** — the Navigator snapshot isn't live booking. Ask each site about their waitlist and whether they take AHS-funded placements.

### Tour-day checklist
- [ ] Is the unit genuinely **secure** (safe for wandering)?
- [ ] Staff-to-resident ratio, day and night
- [ ] How are **15 medications** administered and reconciled?
- [ ] Accessible bathroom in her actual room
- [ ] Fall-prevention features
- [ ] On-site nursing for AFib/heart-failure monitoring
- [ ] Can she **stay if her needs increase**?
- [ ] Total monthly cost: accommodation charge + optional extras

### Who to call (keep this list handy)
| Need | Contact |
|------|---------|
| Start placement | **Health Link 811** → AHS case manager |
| Medical records / referral | Dr. Mitchell (family) |
| Medication review | Any pharmacy — free Standard Medication Management Assessment |
| Funding/standards questions | Your assigned AHS case manager |

**The single most important first step:** make the **811 call** this week. Everything else follows from getting her into the AHS case-management stream.

⚠️ *Guidance only, not medical or legal advice. Your AHS case manager and her doctors confirm the specifics.*

That's the full caregiver journey — health records to a concrete plan, in one conversation.

---

# PERSONA 2 — THE NEWCOMER

## Step 1 — Find a language-matched doctor

**Prompt (English):**
> Find me a family doctor near T5H 0E7 who speaks Punjabi and is accepting new patients.

**Prompt (in-language, for the "wow"):**
> ਮੈਨੂੰ T5H 0E7 ਦੇ ਨੇੜੇ ਇੱਕ ਪੰਜਾਬੀ ਬੋਲਣ ਵਾਲਾ ਡਾਕਟਰ ਲੱਭ ਕੇ ਦਿਓ।

**Response:**

### Punjabi-Speaking Family Doctors Near You (T5H 0E7)

I found **2 clinics** in central Edmonton with a Punjabi-speaking family doctor. Here they are.

### Dr. Shabana Avesi — Stadium Medical Clinic
| | |
|--|--|
| **Address** | 15, 9117 111 Ave NW, Edmonton T5H 4N8 |
| **Phone** | 780-244-8333 |
| **Languages** | Punjabi, Urdu, Arabic, Sindhi |
| **Services** | Wheelchair access · Walk-in available |
| **Network** | Edmonton O-day'min PCN |

### Dr. Huma Jafri — Terra Losa Medical Clinic
| | |
|--|--|
| **Address** | 9760 170 Street NW, Edmonton T5T 5L4 |
| **Phone** | 780-486-3660 |
| **Languages** | Punjabi, Hindi, Urdu |
| **Services** | Wheelchair access |
| **Network** | Edmonton West PCN |

Both are women. **Stadium Medical is closest to you and offers walk-in appointments**, which is the easiest way to be seen quickly.

📞 **Call the clinic first** to confirm they're taking new patients and that the Punjabi-speaking doctor is available on your day.

Would you like me to reply in Punjabi, show only female doctors, or find walk-in options?

---

## Step 2 — Respond in the user's language

**Prompt:**
> Please reply to me in Punjabi.

**Response:**

### T5H 0E7 ਦੇ ਨੇੜੇ ਪੰਜਾਬੀ ਬੋਲਣ ਵਾਲੇ ਫੈਮਿਲੀ ਡਾਕਟਰ

ਮੈਨੂੰ ਐਡਮੰਟਨ ਦੇ ਕੇਂਦਰ ਵਿੱਚ **2 ਕਲੀਨਿਕ** ਮਿਲੇ ਹਨ ਜਿੱਥੇ ਪੰਜਾਬੀ ਬੋਲਣ ਵਾਲੀ ਫੈਮਿਲੀ ਡਾਕਟਰ ਹੈ।

### ਡਾ. ਸ਼ਬਾਨਾ ਆਵੇਸੀ — Stadium Medical Clinic
| | |
|--|--|
| **ਪਤਾ** | 15, 9117 111 Ave NW, Edmonton T5H 4N8 |
| **ਫ਼ੋਨ** | 780-244-8333 |
| **ਭਾਸ਼ਾਵਾਂ** | ਪੰਜਾਬੀ, ਉਰਦੂ, ਅਰਬੀ, ਸਿੰਧੀ |
| **ਸੇਵਾਵਾਂ** | ਵ੍ਹੀਲਚੇਅਰ ਪਹੁੰਚ · ਵਾਕ-ਇਨ ਉਪਲਬਧ |

### ਡਾ. ਹੁਮਾ ਜਾਫ਼ਰੀ — Terra Losa Medical Clinic
| | |
|--|--|
| **ਪਤਾ** | 9760 170 Street NW, Edmonton T5T 5L4 |
| **ਫ਼ੋਨ** | 780-486-3660 |
| **ਭਾਸ਼ਾਵਾਂ** | ਪੰਜਾਬੀ, ਹਿੰਦੀ, ਉਰਦੂ |
| **ਸੇਵਾਵਾਂ** | ਵ੍ਹੀਲਚੇਅਰ ਪਹੁੰਚ |

ਦੋਵੇਂ ਡਾਕਟਰ ਔਰਤਾਂ ਹਨ। **Stadium Medical ਤੁਹਾਡੇ ਸਭ ਤੋਂ ਨੇੜੇ ਹੈ ਅਤੇ ਵਾਕ-ਇਨ ਮੁਲਾਕਾਤਾਂ ਦਿੰਦੀ ਹੈ**, ਜੋ ਜਲਦੀ ਮਿਲਣ ਦਾ ਸਭ ਤੋਂ ਆਸਾਨ ਤਰੀਕਾ ਹੈ।

📞 **ਪਹਿਲਾਂ ਕਲੀਨਿਕ ਨੂੰ ਫ਼ੋਨ ਕਰੋ** ਤਾਂ ਜੋ ਪੁਸ਼ਟੀ ਹੋ ਸਕੇ ਕਿ ਉਹ ਨਵੇਂ ਮਰੀਜ਼ ਲੈ ਰਹੇ ਹਨ ਅਤੇ ਪੰਜਾਬੀ ਬੋਲਣ ਵਾਲੀ ਡਾਕਟਰ ਉਸ ਦਿਨ ਉਪਲਬਧ ਹੈ।

ਕੀ ਤੁਸੀਂ ਚਾਹੁੰਦੇ ਹੋ ਕਿ ਮੈਂ ਵਾਕ-ਇਨ ਸਮੇਂ ਜਾਂ ਹੋਰ ਵੇਰਵੇ ਲੱਭਾਂ?

---

## Step 3 — Refine: female doctor

**Prompt:**
> Actually, I'd prefer a female doctor. Are any of these women?

**Response:**

Good news — **both** Punjabi-speaking doctors near you are women.

| Doctor | Clinic | Phone | Notes |
|--------|--------|-------|-------|
| **Dr. Shabana Avesi** | Stadium Medical | 780-244-8333 | Closest · walk-in available |
| **Dr. Huma Jafri** | Terra Losa Medical | 780-486-3660 | Wheelchair accessible |

So you don't have to compromise — you can have a **female, Punjabi-speaking family doctor** either way. Dr. Avesi at Stadium Medical is the easiest to reach quickly because the clinic takes walk-ins.

Want me to check walk-in hours, or pull full contact details for one of them?

---

## Step 4 — Refine: walk-in / after-hours

**Prompt:**
> Which of these clinics offer walk-in appointments or are open after hours?

**Response:**

### Walk-In & After-Hours Clinics Near You (T5H 0E7)

There are **31 clinics** within 10 km offering walk-in or after-hours care. Here are the closest options for being seen without an appointment.

| Clinic | Address | Phone |
|--------|---------|-------|
| **Hys Centre Medical Clinic** | 11010 101 Street NW | 780-705-6744 |
| **Downtown Medicentres** | 11807 Jasper Avenue | 780-488-1222 |
| **Alberta Avenue Medical Clinic** | 9448 118 Ave | 780-705-4104 |
| **Health Square Medical Clinic** | 11045 124 Street | 587-521-9643 |
| **Atlas Medical Clinic** | 8514 109 St NW | 780-244-5231 |
| **Delta Medical Clinic** | 12143 97 Street | 780-244-3320 |

**If you want both walk-in *and* a Punjabi-speaking doctor**, go back to **Stadium Medical (Dr. Avesi)** — it offers walk-in service *and* the language match in one place, which is your best combination.

📞 Call ahead to confirm today's walk-in hours — they change daily, and after-hours slots fill quickly.

Want the full hours and contact card for any of these?

---

## Step 5 — Clinic details

**Prompt:**
> Show me more details about the first clinic — hours, address, and how to contact them.

**Response:**

### Stadium Medical Clinic — Full Details

Here's everything you need to make contact.

**Clinic**
- **Name:** Stadium Medical Clinic
- **Address:** 15, 9117 111 Ave NW, Edmonton, AB T5H 4N8
- **Phone:** 780-244-8333
- **Website:** stadiumhealthcenter.ca

**Your doctor there**
- **Dr. Shabana Avesi** (female family physician)
- **Languages:** Punjabi, Urdu, Arabic, Sindhi

**Services**
- ✅ Walk-in appointments
- ✅ Wheelchair accessible

**Network:** Edmonton O-day'min Primary Care Network (EOPCN)

**How to get seen**
1. **Call 780-244-8333** and ask if Dr. Avesi is accepting new patients, or if you can walk in.
2. Mention you'd like a **Punjabi-speaking** doctor so they book you with her.
3. Bring your **Alberta Health card** and a list of any medications.

This one clinic checks every box you asked for: **close to you, walk-in, female doctor, and Punjabi-speaking.** It's your strongest first call.

📋 *Public directory data — always confirm availability with the clinic directly.*

That completes the newcomer journey: from a question in Punjabi to a specific doctor, in their language, in one conversation.
