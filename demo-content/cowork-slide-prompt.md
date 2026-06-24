# Copilot Cowork Prompt — Executive Demo Preview Slide

Paste the prompt below into **Copilot Cowork** to generate a single, executive-level slide that previews the two demo personas and their workflows, including illustrative photos of the fictitious users.

Share the resulting slide with executives **ahead of the live demo** so they know what they'll see.

---

## The prompt

> Create a **single executive-level slide** (16:9, landscape) titled **"My AI Health — Live Demo Preview"** that previews two demonstration scenarios for senior Alberta Health and AHS leadership. The slide must be clean, modern, and boardroom-ready — generous white space, a clear visual hierarchy, and a professional healthcare-tech aesthetic.
>
> **Brand styling:**
> - Primary colour **#0277b5** (blue) for headers, accents, and the title bar.
> - Secondary slate/grey (#546279) for body text; white background.
> - Font: a clean sans-serif (Inter, Segoe UI, or similar).
> - A small footer disclaimer in grey: *"Demo personas are fictional. Health data is synthetic; provider and assisted-living data are live Alberta public sources."*
>
> **Layout:** two equal columns, one per persona, each with an **illustrative photo of the fictitious person at the top**, then their story and the demo workflow as a short numbered flow.
>
> **Left column — Persona 1: "The Caregiver"**
> - Photo: a warm, approachable **39-year-old man** (Dave), professional but everyday — the "sandwich generation" caregiver. Photorealistic, friendly, neutral background.
> - Heading: **Dave — The Caregiver**
> - Subhead: *Managing his own diabetes and his mother Margaret's complex care.*
> - Workflow (numbered, concise):
>   1. Connects to his health records and gets a full overview in one question.
>   2. Switches to his 72-year-old mother Margaret's records (proxy access).
>   3. AI surfaces her complex picture — dementia, heart failure, kidney disease, 12+ medications — and flags polypharmacy questions for her doctor.
>   4. **In one question, crosses into assisted-living search** — finds real Edmonton memory-care facilities matched to her conditions.
>   5. Gets a health-informed tour-question list and a step-by-step transition plan.
> - Callout badge: **"One question. Two government systems."**
>
> **Right column — Persona 2: "The Newcomer"**
> - Photo: a hopeful, dignified **woman in her early 30s** (Amara), a recent newcomer to Alberta. Photorealistic, friendly, neutral background.
> - Heading: **Amara — The Newcomer**
> - Subhead: *New to Alberta, finding care in her own language.*
> - Workflow (numbered, concise):
>   1. Types her request in her first language (e.g. Punjabi).
>   2. AI finds real, named family doctors near her who speak her language and are accepting patients.
>   3. AI replies in her language — turning a multi-day, multi-call search into one conversation.
>   4. Refines by need — female doctor, walk-in hours — all in-language.
> - Callout badge: **"Equitable access, no language barrier."**
>
> **Bottom banner (full width, light blue tint):** a one-line thesis —
> **"An AI layer over the health systems Alberta already has — making them understandable, connected, and accessible to every citizen."**
>
> Keep all text crisp and scannable — this is a preview, not a script. Avoid clinical jargon. Output the slide ready to drop into a PowerPoint deck.

---

## Tips for using this prompt

- **Photos:** If Cowork's image generation needs a separate step, ask it to *"generate the two persona portraits first, then place them in the slide."* Reinforce that they must be clearly **illustrative/fictional** — no real-person likenesses.
- **Persona names:** Dave (caregiver) and Amara (newcomer) match the [`demo-content`](README.md) specs. Keep them consistent so the preview slide and the live demo line up.
- **If you want a builder version:** add *"also produce a speaker-notes section under the slide summarizing the two flows in 3 bullet points each"* to get talking points for whoever presents the preview.
- **Tone reminder:** executives respond to *outcomes*, not tools. The slide deliberately names zero MCP tools — keep it that way.
- **Source of truth:** the detailed step-by-step prompts and talking points live in [`persona-1-caregiver.md`](persona-1-caregiver.md) and [`persona-2-newcomer.md`](persona-2-newcomer.md). This slide is the teaser; those are the scripts.
