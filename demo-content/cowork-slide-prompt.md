# Copilot Cowork Prompt — Executive Demo Preview Slide

Paste the prompt below into **Copilot Cowork** to generate a single, executive-level slide that previews the two demo personas and their workflows, including illustrative photos of the fictitious users.

Share the resulting slide with executives **ahead of the live demo** so they know what they'll see.

---

## The prompt

> Create a **single executive-level slide** (16:9, landscape) titled **"My AI Health — Demonstration Overview"** previewing two demonstration scenarios for senior Alberta Health and AHS leadership. The aesthetic should be restrained, precise, and analytical, in the style of a top-tier management consulting firm (McKinsey, BCG, Bain). Favour structure and typography over decoration. No rounded corners, no drop shadows, no gradients, no pill shapes, no coloured status dots, no emoji.
>
> **Palette:**
> - Deep navy **#0a2540** for primary text, structural rules, and the footer bar.
> - A single restrained accent **#0277b5**, used sparingly for small labels and the "Why it matters" rule.
> - Greys for body and secondary text (#1c2733 body, #5b6b7c secondary, #8a98a6 muted).
> - White background; very light wash **#f6f8fa** for callout blocks; hairline rules in #d9e0e6 / #eef2f5.
>
> **Typography:**
> - Clean sans-serif (Helvetica Neue, Arial, or Inter).
> - A small uppercase letter-spaced **eyebrow** label above the title.
> - Title in navy with a lighter-weight grey qualifier, sitting on a 2px navy underline rule.
> - Right-aligned meta block beside the title (audience and framing).
> - Use small uppercase kicker labels (e.g. "Persona 01 · The Caregiver") and tabular numerals (01, 02, 03) for steps.
>
> **Structure (top to bottom):**
>
> 1. **Header** — eyebrow ("Live Demonstration · Preview for Leadership"), title, right-aligned meta ("Alberta Health & AHS Leadership / Two citizen journeys, one conversational interface").
>
> 2. **Systems band** — a thin ruled row labelled "Systems Connected" with four equal cells, each a small monochrome line icon plus a name and a short descriptor. Mark the two live sources with the word "Live" in the accent colour (not a coloured dot):
>    - My Health Records — Labs · Meds · Imaging
>    - AHS Connect Care — Visits · Referrals
>    - Find a Doctor — **Live** · Provider Directory
>    - Assisted Living Navigator — **Live** · Facilities
>
> 3. **Two persona columns**, divided by a hairline rule. Each column has a **small square portrait** (left) beside a kicker label, name, and one-line subhead, then a numbered list of plain, factual one-line steps separated by hairline rules, and a "Why it matters" callout (light wash background, left accent rule).
>
>    **Persona 01 · The Caregiver — Dave, 39**
>    Subhead: *Manages his own diabetes and helps care for his mother Margaret.*
>    1. Opens his own health record and reviews labs, medications, and conditions.
>    2. Switches to his mother Margaret's record through proxy access.
>    3. Reviews her medications and conditions, with questions to raise with her clinician.
>    4. Searches for assisted living near Edmonton that fits her needs.
>    5. Builds a tour checklist and a transition plan.
>    Why it matters: *One conversation spans health records and continuing care placement.*
>
>    **Persona 02 · The Newcomer — Amara, 32**
>    Subhead: *Newly arrived in Alberta, looking for care in her own language.*
>    1. Asks for a family doctor in her first language, such as Punjabi.
>    2. Receives named physicians near her who speak her language and accept new patients.
>    3. Reads the results back in her own language.
>    4. Narrows by preference, such as a female physician or walk-in hours.
>    Why it matters: *Language is no longer a barrier to finding and understanding care.*
>
> 4. **Footer thesis bar** — full-width solid navy band with a single plain-language sentence in white, and "myaihealth.ca" set off at the right by a thin vertical divider:
>    *"An intelligence layer over the systems Alberta already operates, making them understandable, connected, and accessible to every citizen."*
>
> 5. **Fine-print line** below the bar in muted grey: *"Demonstration personas are fictional and clinically synthetic. Provider and assisted-living data shown in the live demonstration are drawn from public Alberta sources. Not medical advice."*
>
> **Portraits:** Use a **square** portrait per persona, treated as a single-tone duotone in navy for visual consistency. Dave is a 39-year-old man; Amara is a 32-year-old woman. Both must read as clearly fictional, dignified, neutral expression, plain background. No real-person likeness.
>
> **Writing style:** plain, factual, one line per step. No marketing language, no superlatives, no em-dashes. Represent the platform's capabilities as the four named systems in the "Systems Connected" band (these are the data sources the AI connects to); do not list raw software function or API names anywhere on the slide. Output the slide ready to drop into a PowerPoint deck.

---

## Tips for using this prompt

- **Photos:** If Cowork's image generation needs a separate step, ask it to *"generate the two persona portraits first as square navy duotone headshots, then place them in the slide."* Reinforce that they must be clearly fictional, with no real-person likeness.
- **Persona names:** Dave (caregiver) and Amara (newcomer) match the [`demo-content`](README.md) specs. Keep them consistent so the preview slide and the live demo line up.
- **If you want a builder version:** add *"also produce a speaker-notes section under the slide summarizing the two flows in 3 bullet points each"* to get talking points for whoever presents the preview.
- **Tone reminder:** executives respond to outcomes, not software. Keep the language plain and factual, avoid em-dashes and superlatives, and present capabilities as the four named systems in the band rather than as raw function or API names.
- **Reference build:** a hand-built HTML version of this exact layout lives at [`demo-preview-slide.html`](demo-preview-slide.html). Open it in a browser to see the target look; use it as the visual reference if Cowork's output drifts.
- **Source of truth:** the detailed step-by-step prompts and talking points live in [`persona-1-caregiver.md`](persona-1-caregiver.md) and [`persona-2-newcomer.md`](persona-2-newcomer.md). This slide is the teaser; those are the scripts.
