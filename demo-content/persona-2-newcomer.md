# Persona 2 — The Newcomer

> **Meet Amara.** Amara recently arrived in Alberta. Her English is still developing, and she needs to find a family doctor she can actually communicate with. Today that means guessing which clinics have a provider who speaks her language, calling around, and reading government pages she can't fully follow.

**The headline:** Amara types in her own language, the AI finds a real, language-matched doctor near her, and answers her back in her language — turning a multi-day, multi-call ordeal into one conversation. **No new code makes this possible: the directory is a real tool; the translation is the model.**

**Servers required:** `ab-health-mcp` only (the provider tools use public data — no login, no demo mode needed). See [`SETUP.md`](SETUP.md).

**Readiness:** ✅ Verified. Provider data is **live** from the real Alberta provider directory. Translation is inherent to the LLM.

---

## How the translation works (architecture note)

The server never translates. It's a passthrough that speaks English in and English out. The LLM does both ends:

```
Amara types (Punjabi) ─▶ LLM understands ─▶ calls find_provider_by_language with English params
                                                      │
                                       server returns English/structured data
                                                      │
                          LLM translates the result into Punjabi ─▶ Amara reads it
```

This keeps the server a "dumb pipe" (the privacy story) while delivering a fully localized experience. Proper nouns, addresses, and phone numbers are sensibly left as-is by the model.

---

## Step 1 — Find a language-matched doctor (in the user's language)

- **Goal:** Show the AI understanding a non-English question and returning real, specific results.
- **Suggested prompt (English, for a mixed audience):**
  > Find me a family doctor near T5H 0E7 who speaks Punjabi and is accepting new patients.
- **Suggested prompt (in-language, for the "wow"):**
  > ਮੈਨੂੰ T5H 0E7 ਦੇ ਨੇੜੇ ਇੱਕ ਪੰਜਾਬੀ ਬੋਲਣ ਵਾਲਾ ਡਾਕਟਰ ਲੱਭ ਕੇ ਦਿਓ।
  > *(“Find me a Punjabi-speaking doctor near T5H 0E7.”)*
- **Tools exercised:** `find_provider_by_language` (language + postal code → geocode → live directory search)
- **What they'll see:** Real clinics, each with the **specific named physician(s)** who speak the language, their gender, clinic address, phone, PCN, and services (e.g. wheelchair access, walk-in). Verified example near T5H: **Dr. Shabana Avesi** (Stadium Medical) and **Dr. Huma Jafri** (Terra Losa) — both Punjabi-speaking.
- **Talking point:** "This is live data from the real Alberta provider directory. The AI didn't just filter a list — it named the doctors who speak her language, near her, today."

## Step 2 — Respond in the user's language

- **Goal:** Close the loop — the answer comes back in the language Amara is comfortable with.
- **Suggested prompt:**
  > Please reply to me in Punjabi.
  > *(Or simply continue the conversation in Punjabi — the model adapts automatically.)*
- **Tools exercised:** none — pure LLM translation of the Step 1 results.
- **What they'll see:** The same clinic/physician results, rendered in Punjabi, with names, addresses, and phone numbers preserved.
- **Talking point:** "No translation service, no extra system — the same AI that found the doctor speaks the citizen's language. This is equitable access, not a bolt-on feature."

## Step 3 (optional) — Refine by need

- **Goal:** Show the search is flexible to real-world constraints.
- **Suggested prompts:**
  > Actually, I'd prefer a female doctor. Are any of these women?
  >
  > Which of these clinics offer walk-in appointments or are open after hours?
  >
  > Show me more details about the first clinic — hours, address, and how to contact them.
- **Tools exercised:** `find_provider_by_language` (with `gender_preference`), `find_provider` (services filter), `get_provider_details`
- **What they'll see:** Filtered results honoring gender preference, service filters (walk-in, after-hours, virtual), and a full clinic detail card.
- **Talking point:** "Newcomers often have specific needs — a female doctor, a walk-in option, a particular language. The AI handles all of it in one thread, in their language."

---

## Variations for different audiences

Swap the language and postal code to match the room or the community you're presenting to:

| Language | Try near (postal) | Notes |
|----------|-------------------|-------|
| Punjabi | `T5H 0E7` (Edmonton) | Verified — returns named physicians |
| Arabic | `T2P 1J9` (Calgary downtown) | Verified — 20 matching clinics |
| Mandarin / Cantonese | `T2P` / `T6G` | Availability varies by FSA |
| Tagalog, Spanish, Vietnamese, Urdu, Hindi | major-city FSAs | Supported in the directory |

> If a search returns zero matches for a given FSA, that's honest live data — widen the radius or try a nearby postal code. Don't present an empty result as a failure; it reflects real provider availability.

---

## Equity & system talking points

- **The equity argument:** "A patient with a university education and time can already navigate this. This gives every Albertan — regardless of language or health literacy — the same capability."
- **The newcomer argument:** "For a new Canadian, finding a doctor who speaks your language is one of the first and hardest healthcare tasks. This removes the language barrier from both finding *and* understanding."
- **The no-new-infrastructure argument:** "We added nothing. The directory already exists; the AI already speaks 100+ languages. We connected them."

## End-to-end prompt list (copy/paste sequence)

1. Find me a family doctor near T5H 0E7 who speaks Punjabi and is accepting new patients.
2. Please reply to me in Punjabi. *(or continue in-language)*
3. I'd prefer a female doctor — are any of these women?
4. Which of these clinics offer walk-in appointments or are open after hours?
5. Show me more details about the first clinic — hours, address, and how to contact them.
