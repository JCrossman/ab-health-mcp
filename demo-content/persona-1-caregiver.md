# Persona 1 — The Caregiver

> **Amara… no — meet Dave.** Dave is 39. He manages his own Type 2 diabetes *and* helps care for his 72-year-old mother, Margaret, who has dementia, heart failure, kidney disease, and is on more than a dozen medications. Dave is the "sandwich generation" — Alberta's fastest-growing caregiving demographic.

**The headline:** one natural-language conversation crosses two separate government systems — health records **and** assisted-living placement — work that today means navigating 4–5 portals and a dozen phone calls.

**Servers required:** `ab-health-mcp` (demo mode) **and** `alberta-assisted-living` (live). See [`SETUP.md`](SETUP.md).

**Readiness:** ✅ Verified end-to-end in demo mode. Health/proxy data is fictional; assisted-living facilities returned are **real, live** Alberta Navigator data.

---

## Step 1 — Connect

- **Goal:** Set the stage — real MyHR/MyChart-style access, wrapped in AI, instantly.
- **Suggested prompt:**
  > Connect to my health records in demo mode.
- **Tools exercised:** `connect_account` (demo)
- **What they'll see:** Instant connection confirming Demo User's profile, both MHR and MyChart connected, with the standard not-medical-advice disclaimer.
- **Talking point:** "No login, no setup for this demo — but in real use this is the citizen's own MyAlberta SSO. The AI sees what the citizen sees, when they ask."

## Step 2 — The "one question" health overview

- **Goal:** Replace 6+ portal screens with a single question.
- **Suggested prompt:**
  > Give me a complete overview of my health — labs, medications, conditions, allergies, and immunizations.
- **Tools exercised:** `get_health_overview`
- **What they'll see:** One synthesized summary with tables: active conditions (T2D, hypertension, hyperlipidemia, vitamin D deficiency), current meds (metformin, lisinopril, atorvastatin, vitamin D3), recent labs, allergies (penicillin), immunizations.
- **Talking point:** "This is the before/after moment. One call pulls everything the portal scatters across half a dozen pages."

## Step 3 — Switch to Margaret (caregiver / proxy access)

- **Goal:** Show the caregiver use case — managing a loved one's complex care.
- **Suggested prompt:**
  > Switch to my mother Margaret's records. Give me a health overview — she's 72 and I help manage her care. What should I be watching for?
- **Tools exercised:** `mc_switch_context` (mother) → `get_health_overview`
- **What they'll see:** A privacy notice confirming the context switch, then Margaret's far more complex picture: T2D, paroxysmal AFib, HFpEF, mild dementia, CKD 3a, hypothyroidism, plus her long medication list.
- **Talking point:** "Margaret has dementia, heart failure, kidney disease, and 12+ medications. The AI becomes the caregiver's co-pilot, surfacing complexity that family members struggle to track."

## Step 4 — The polypharmacy danger (the alarming records)

- **Goal:** Surface real, AI-detectable safety risks in an elderly patient.
- **Suggested prompt:**
  > My mother is on more than a dozen medications. Review them for potential interactions, especially given her kidney function and age. What should I raise with her doctor or pharmacist?
- **Tools exercised:** `mc_get_medications` / `get_medications` (Margaret context)
- **What they'll see:** The LLM reviews the full list and flags known risk patterns — e.g. bradycardia risk from rate-control combinations, hypoglycemia risk from sulfonylureas with reduced kidney function, NSAID avoidance in CKD — framed as **questions for the doctor, not diagnoses.**
- **Talking point:** "Polypharmacy in seniors is a patient-safety crisis. This catches risks a quick review might miss — and always routes the decision back to the clinician."
- **⚠️ Honesty note:** Interaction flags are the **LLM's reasoning**, not a validated drug-interaction database. The personas are seeded so clinically real risks surface, but say "questions to confirm with your pharmacist," never "the system detected an interaction."

## Step 5 — The transition: from health to housing (the headline moment)

- **Goal:** Cross two government systems in a single question.
- **Suggested prompt:**
  > Based on my mother's health conditions, mobility needs, and level of care, find assisted living facilities near Edmonton that would suit her. She needs an accessible building and memory care.
- **Tools exercised:** `alberta-assisted-living` → `find_facilities_near` (care types: memory care + long-term care; `accessible_building: true`; near Edmonton)
- **What they'll see:** A ranked list of **real** Edmonton facilities, nearest first, with addresses, phone numbers, care types (Type A long-term care, Type B secure / memory care), and live vacancy snapshots. Verified examples include Grand Manor and Our Parents' Home (both Type B secure / memory care).
- **Talking point:** "**This is the moment.** The citizen asked ONE question and the AI crossed two systems — pulling clinical data from health records and matching it to the Assisted Living Navigator. No human had to learn care-type terminology or figure out which filters to apply. The AI translated 'my mother's conditions' into the right search automatically."
- **Note:** Facilities often show "no open spaces reported" — that's a real-time snapshot, not a bug. To show more results live, drop the vacancy filter or note that vacancy must be confirmed with the operator.

## Step 6 — Facility deep-dive with health context

- **Goal:** Show health-informed decision support no other system offers.
- **Suggested prompt:**
  > Tell me everything about the first facility, including photos. Given my mother's conditions and medications, what questions should I ask them during a tour?
- **Tools exercised:** `alberta-assisted-living` → `get_facility_details` (`include_photos: true`)
- **What they'll see:** Full facility detail (accessibility, room types, pricing, amenities, accreditation, licensing link) plus a tour-question list informed by Margaret's actual record — medication management for 12+ drugs, fall prevention, memory-care programming for her dementia stage, AFib monitoring.
- **Talking point:** "Facility details AND tour questions generated from her real health picture. No other system in Canada connects these."

## Step 7 — Explain the system (for overwhelmed families)

- **Goal:** Replace hours of reading AHS PDFs with one conversational answer.
- **Suggested prompt:**
  > I'm new to all of this. In plain language, what are my options for my mother? What's the difference between supportive living and long-term care? How does AHS placement work, and what will it cost?
- **Tools exercised:** `alberta-assisted-living` → `explain_care_options` (no network call — instant)
- **What they'll see:** A plain-language guide to care types (seniors lodge → supportive living → Type B/B-secure → Type A long-term care) and funding routes (AHS case manager via Health Link 811 vs. private pay).
- **Talking point:** "Families navigating continuing care for the first time are overwhelmed. This is health literacy and system literacy, on demand."

## Step 8 — The caregiver action plan (emotional closer)

- **Goal:** Turn data into guidance for one of the hardest moments in a family's life.
- **Suggested prompt:**
  > Create an action plan for transitioning my mother into assisted living. Include what to do first, who to call, what documents to prepare from her health records, and a checklist for evaluating facilities during tours.
- **Tools exercised:** synthesis across prior steps (no new tool call required)
- **What they'll see:** A step-by-step plan — call Health Link 811 for AHS case management, prepare her medication list, ask about fall-prevention and memory-care protocols — grounded in her actual records.
- **Talking point:** "It's not just data — it's guidance. This collapses weeks of piecing together information into a single conversation."

---

## Platform talking points (say between steps 5 and 8)

- **The platform argument:** "Two independent MCPs, two separate government APIs. The AI connects them because they share a protocol — not because we built a monolith. Any government service (Home Care, AISH, seniors' benefits) can be added the same way."
- **The cost argument:** "This isn't a new system — it's an AI layer on systems Alberta already paid for. No new databases, no migration."
- **The caregiver argument:** "Alberta has 800,000+ unpaid family caregivers. This turns them from overwhelmed to informed."
- **The data-sovereignty argument:** "Both MCPs run locally. Health data passes to the AI for that conversation only — nothing stored, nothing shared between systems. The assisted-living MCP doesn't even require a login."

## End-to-end prompt list (copy/paste sequence)

1. Connect to my health records in demo mode.
2. Give me a complete overview of my health — labs, medications, conditions, allergies, and immunizations.
3. Switch to my mother Margaret's records. Give me a health overview — she's 72 and I help manage her care. What should I be watching for?
4. My mother is on more than a dozen medications. Review them for potential interactions, especially given her kidney function and age.
5. Based on my mother's health conditions, mobility needs, and level of care, find assisted living facilities near Edmonton that would suit her. She needs an accessible building and memory care.
6. Tell me everything about the first facility, including photos. Given my mother's conditions and medications, what questions should I ask during a tour?
7. I'm new to all of this. In plain language, what are my options? What's the difference between supportive living and long-term care? How does AHS placement work, and what will it cost?
8. Create an action plan for transitioning my mother into assisted living, including documents to prepare from her health records and a tour checklist.
