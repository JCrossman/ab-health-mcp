# Run of Show — Demo Timing & Rehearsal Plan

A planning sheet for pacing the live demo. Use it to (a) understand where the
time goes, (b) rehearse with a stopwatch, and (c) keep the room on schedule.

> **Presenting model:** Claude Sonnet 4.6. Generation estimates below assume
> Sonnet 4.6. A slower/larger model (e.g. Opus) runs roughly 1.3–1.6× longer on
> the big synthesis steps; a smaller model is faster but less polished.

---

## How a single response breaks down

Every demo response is three stacked costs:

| Part | Who controls it | Predictable? |
| --- | --- | --- |
| **1. Tool / API latency** | The systems being called | Measured below — small |
| **2. Generation time** | The model + answer length | Estimated below — the main variable |
| **3. Your narration** | You | You control it — budget set below |

The headline finding from measuring the live systems: \*\*network latency is not
your risk.\*\* The variable that actually moves the clock is **generation length**
on the big synthesis steps (health overviews, polypharmacy review, action plan).

---

## Measured live-system latency (real numbers)

Sampled 2026-06-24, 3 calls each. Cold = first call after idle; warm = repeat.

| Live system | Cold | Warm | Used in |
| --- | --- | --- | --- |
| Nominatim geocode | \\~500 ms | \\~150 ms | Both live searches |
| Zippopotam (postal fallback) | \\~320 ms | \\~130 ms | Doctor search |
| Assisted-Living Navigator API | \\~660 ms | \\~205 ms | P1 steps 5–6 |
| Find-a-Provider directory | \\~870 ms | \\~310–725 ms | P2 steps 1, 3–5 |

**Combined per live call:** \~1.2 s cold / \~0.4 s warm (facilities); \~1.4 s cold
/ \~0.5–1 s warm (doctor search). The demo-mode MHR/MyChart steps return synthetic
data and are effectively instant (<1 s). None of this is a bottleneck.

> The old 1-second client timeout that caused the first-call failure is fixed
> (now 30 s in `mcp-config.json`). Cold start no longer errors — it just adds
> the sub-second numbers above.

---

## Persona 1 — The Caregiver (8 steps)

Estimates are response time only (tool + generation). Narration is your spoken
budget over/after the response. Fill **Actual** during the stopwatch pass.

| # | Step | Type | Tool | Gen (Sonnet) | Response est. | Narration | Actual (Opus) | Actual (Sonnet) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Connect (demo) | Instant | \\~1 s | \\~4 s | **\\~5 s** | 20 s | **13 s** | **12 s** |
| 2 | Full health overview | Instant | \\~1 s | \\~15 s | **\\~16 s** | 40 s | **18 s** | **13 s** |
| 3 | Switch to Margaret + overview | Instant | \\~1.5 s | \\~18 s | **\\~20 s** | 45 s | **62 s** ¹ | **14 s** ¹ |
| 4 | Polypharmacy review | Instant | \\~1 s | \\~16 s | **\\~17 s** | 50 s | **21 s** | **11 s** |
| 5 | Find assisted living (LIVE, 1st live call) | Live | \\~2 s cold | \\~12 s | **\\~14 s** | 40 s | **18 s** | **10 s** |
| 6 | Facility deep-dive + photos | Live | \\~3 s | \\~18 s | **\\~21 s** | 45 s | **40 s** ² | **10 s** ² |
| 7 | Explain care options | Instant | <1 s | \\~13 s | **\\~13 s** | 35 s | **34 s** | **10 s** |
| 8 | Caregiver action plan | Instant | 0 s | \\~18 s | **\\~18 s** | 45 s | **40 s** | **14 s** |

**Persona 1 measured:** Opus 248 s ≈ 4 min 8 s | Sonnet 94 s ≈ 1 min 34 s (0.38× Opus). With narration: \~7–8 min (Opus), \~5–6 min (Sonnet).

> ¹ **Step 3 is inflated by the test harness, not the demo.** Margaret's overview
> returned a 26 KB payload that my environment saved to a temp file and I had to
> re-read and parse — plus a first proxy-switch retry. In the real demo the model
> receives that payload in-context and switches directly, so expect **\~25–30 s**,
> not 62 s.
> ² Step 6 includes rendering 3 facility photos — that cost is real and will
> happen live.

---

## Persona 2 — The Newcomer (5 steps)

| # | Step | Type | Tool | Gen (Sonnet) | Response est. | Narration | Actual (Opus) | Actual (Sonnet) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Find Punjabi-speaking doctor (LIVE, 1st live call) | Live | \\~2 s cold | \\~11 s | **\\~13 s** | 30 s | **29 s** | **8 s** |
| 2 | Reply in Punjabi (pure translation) | Instant | 0 s | \\~10 s | **\\~10 s** | 25 s | **44 s** ³ | **11 s** ³ |
| 3 | Filter to female doctor | Live | \\~1 s | \\~7 s | **\\~8 s** | 20 s | **25 s** | **9 s** |
| 4 | Walk-in / after-hours filter | Live | \\~1 s | \\~7 s | **\\~8 s** | 20 s | **27 s** ⁴ | **9 s** ⁴ |
| 5 | Clinic details | Live | \\~1 s | \\~9 s | **\\~10 s** | 20 s | **14 s** | **9 s** |

**Persona 2 measured:** Opus 139 s ≈ 2 min 19 s | Sonnet 46 s ≈ 46 s (0.33× Opus). With narration: \~3–4 min (Opus), \~2.5–3 min (Sonnet).

> ³ **Replying in Punjabi is genuinely the slowest step** — non-Latin script
> (Gurmukhi) costs far more tokens to generate, so it runs \~2× a comparable
> English answer. This *will* happen live; it's a good "watch it think in your
> language" beat, but don't rush it.
> ⁴ Step 4 returned a 174 KB result that my harness saved to a temp file and
> re-parsed; in-context the model skips that, so expect closer to \~12–15 s live.

---

## Whole-session budget

| Segment | Time (Opus) | Time (Sonnet) |
| --- | --- | --- |
| Intro + exec slide | 2–3 min | 2–3 min |
| Persona 1 (Caregiver) | 7–8 min | 5–6 min |
| Transition / platform talking points | 1–2 min | 1–2 min |
| Persona 2 (Newcomer) | 3–4 min | 2.5–3 min |
| Close + Q&A | 3–5 min | 3–5 min |
| **Total** | **\\~16–22 min** | **\\~14–19 min** |

**Sonnet is your production model** — it runs \~40% faster than Opus while maintaining
quality. Aim to **present in \~15 min** so there's room for questions and the inevitable
"can it do X?" tangent.

---

## What the live passes taught us

Full end-to-end timed runs on **2026-06-24**:

### Claude Opus (upper bound)
- **Pure response time:** Persona 1 ≈ **4 min**, Persona 2 ≈ **2.3 min**. The rest
  of the segment budget is your narration, not the model.
- **Network was never the bottleneck.** Every live API call returned in \~1–2 s,
  cold or warm. The clock is dominated by **how much the model writes.**
- **The big synthesis steps run long** (health overviews, action plan: 30–60 s on
  Opus). Plan to **talk over them** — they're your narration windows, not dead air.
- **Replying in Punjabi is the single slowest step** (\~44 s on Opus) because
  non-Latin script is token-expensive. Treat it as a feature: let it render while
  you explain what's happening.

### Claude Sonnet 4.5 (production demo model)
- **Pure response time:** Persona 1 ≈ **1.5 min** (0.38× Opus), Persona 2 ≈ **46 s** (0.33× Opus).
- **Dramatic speedup on synthesis:** The long-form steps (overviews, action plans)
  dropped from 30–60 s to 10–14 s. Sonnet generates faster and tighter.
- **Punjabi reply dropped to 11 s** (was 44 s on Opus) — still slower than English
  but no longer a noticeable pause.
- **Live API calls still instant** — network remains a non-factor.
- **Total demo response time \~2.5 min** (Opus was 6.5 min). You now have more
  narration budget and can afford tangents or repeat a search if the audience asks.

---

## Rehearsal method (the stopwatch pass)

Do at least one full timed run before the real thing:

1. **Warm the live systems first.** Right before presenting, run one throwaway
   facilities search and one doctor search. This removes the cold-start penalty
   so the audience sees warm (\~0.5 s) responses.
2. **Start a stopwatch** and paste each prompt in order. Record the response time
   in the **Actual** column the moment generation stops.
3. **Note your narration separately** — most of the clock is you talking, not the
   model. If a step's response runs long, talk *over* it (point at the screen,
   set up the next beat) so dead air never happens.
4. **Total it.** If you're over budget, the cut candidates are P1 step 7 (explain
   options) and P2 steps 3–4 (refinements) — they're valuable but optional.
5. **Re-run once more** with your trimmed script to lock the pacing.

### Pacing tips

- **Talk while it generates.** The 15–20 s synthesis steps are your moment to
  narrate the "why," not to stand in silence. Pre-load a sentence for each.
- **The two hero beats** (P1 step 5 health→housing crossover, P2 step 2 reply in
  Punjabi) deserve a deliberate pause — let the result land before you speak.
- **Session keep-alive:** real-data MHR/MyChart sessions time out after \~10 min.
  Demo mode is more forgiving, but if you idle on a Q&A tangent mid-demo, fire a
  quick harmless prompt afterward to confirm the session is still live before the
  next step.
- **Have a fallback FSA.** If a live search returns zero (honest live data),
  widen the radius or switch to a verified postal code: Punjabi `T5H 0E7`,
  Arabic `T2P 1J9`.

---

## Quick-reference prompt order

**Persona 1:** see [`persona-1-caregiver.md`](persona-1-caregiver.md) → "End-to-end prompt list."
**Persona 2:** see [`persona-2-newcomer.md`](persona-2-newcomer.md) → "End-to-end prompt list."

> All response/generation figures are planning estimates, not measured Sonnet
> runs. Replace them with your **Actual** column after the first rehearsal — that
> becomes your real run of show.
