# Creating the Sonnet Fallback Script

## Overview

This document explains how to create `FALLBACK-SCRIPT-SONNET.md` by capturing live responses from Claude Sonnet 4.6 during a full demo run.

## Why Manual Capture?

The fallback script needs actual LLM-generated natural language responses, not raw MCP tool outputs. The most authentic way to create it is to run the full demo in Claude Desktop (configured with Sonnet 4.6) and capture the responses exactly as they would appear to an audience during a live demo.

## Files Prepared

- **`FALLBACK-SCRIPT-OPUS.md`** — Renamed from the original `FALLBACK-SCRIPT.md`, contains Opus 4.x responses captured on 2026-06-24
- **`scripts/run-sonnet-demo.ts`** — Interactive script that guides you through capturing Sonnet responses step-by-step

## Method 1: Using the Interactive Capture Script

The recommended way to create the Sonnet fallback script:

```bash
npx tsx scripts/run-sonnet-demo.ts
```

The script will:
1. Print each prompt from both personas
2. Pause for you to:
   - Paste the prompt into Claude Desktop (Sonnet 4.6)
   - Wait for the response
   - Copy the full response text
   - Paste it back into the capture script
3. Build `FALLBACK-SCRIPT-SONNET.md` with all captured responses

## Method 2: Manual Capture

If you prefer to capture responses manually:

1. Open Claude Desktop and ensure it's configured with **Claude Sonnet 4.6**
2. Start a new conversation
3. Run through both personas step-by-step:
   - **Persona 1 (The Caregiver)**: 8 steps from `demo-content/persona-1-caregiver.md`
   - **Persona 2 (The Newcomer)**: 5 steps from `demo-content/persona-2-newcomer.md`
4. Copy each response and format it following the structure in `FALLBACK-SCRIPT-OPUS.md`

## Prompts

### Persona 1 — The Caregiver (8 steps)

1. Connect to my health records in demo mode.
2. Give me a complete overview of my health — labs, medications, conditions, allergies, and immunizations.
3. Switch to my mother Margaret's records. Give me a health overview — she's 72 and I help manage her care. What should I be watching for?
4. My mother is on more than a dozen medications. Review them for potential interactions, especially given her kidney function and age. What should I raise with her doctor or pharmacist?
5. Based on my mother's health conditions, mobility needs, and level of care, find assisted living facilities near Edmonton that would suit her. She needs an accessible building and memory care.
6. Tell me everything about the first facility, including photos. Given my mother's conditions and medications, what questions should I ask them during a tour?
7. I'm new to all of this. In plain language, what are my options for my mother? What's the difference between supportive living and long-term care? How does AHS placement work, and what will it cost?
8. Create an action plan for transitioning my mother into assisted living. Include what to do first, who to call, what documents to prepare from her health records, and a checklist for evaluating facilities during tours.

### Persona 2 — The Newcomer (5 steps)

1. Find me a family doctor near T5H 0E7 who speaks Punjabi and is accepting new patients.  
   *(OR in Punjabi: ਮੈਨੂੰ T5H 0E7 ਦੇ ਨੇੜੇ ਇੱਕ ਪੰਜਾਬੀ ਬੋਲਣ ਵਾਲਾ ਡਾਕਟਰ ਲੱਭ ਕੇ ਦਿਓ।)*
2. Please reply to me in Punjabi.
3. Actually, I'd prefer a female doctor. Are any of these women?
4. Which of these clinics offer walk-in appointments or are open after hours?
5. Show me more details about the first clinic — hours, address, and how to contact them.

## Expected Timing

Based on the `RUN-OF-SHOW.md` measurements:

- **Persona 1**: ~1 min 34 s pure response time (Sonnet) vs. ~4 min 8 s (Opus)
- **Persona 2**: ~46 s pure response time (Sonnet) vs. ~2 min 19 s (Opus)
- **Total**: ~2.5 min response time (Sonnet) vs. ~6.5 min (Opus)

Sonnet runs **~40% faster** than Opus while maintaining quality. The capture session should take ~15-20 minutes total including narration and transition time.

## MCP Configuration

Make sure your Claude Desktop `mcp-config.json` includes:

```json
{
  "mcpServers": {
    "ab-health-mcp": {
      "command": "npx",
      "args": ["tsx", "C:\\code\\ab-health-mcp\\src\\index.ts"]
    },
    "alberta-assisted-living": {
      "command": "npx",
      "args": ["-y", "@jcrossman/alberta-assisted-living@latest"]
    }
  }
}
```

## Output Format

The generated `FALLBACK-SCRIPT-SONNET.md` should follow the same structure as `FALLBACK-SCRIPT-OPUS.md`:

- Header with date and disclaimer
- Persona 1 section with 8 steps
- Persona 2 section with 5 steps
- Each step includes:
  - Section title
  - The prompt
  - The full Sonnet response (natural language, not raw JSON)
  - Separator (`---`)

## Next Steps

1. Run the capture script: `npx tsx scripts/run-sonnet-demo.ts`
2. Follow the prompts to capture all responses
3. Review the generated `FALLBACK-SCRIPT-SONNET.md`
4. Compare timing with the Run of Show document
5. Commit the new fallback script

## Notes

- The health/proxy data is **synthetic demo data**
- The assisted-living facilities and doctors are **real, live results** at capture time
- Never claim live vacancy or present synthesized data as real patient information
- The Punjabi response (P2 Step 2) will be slower than English due to token cost of non-Latin script
