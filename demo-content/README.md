# Demo Content

Executive-ready, tested demo scenarios for the **My AI Health** platform — an AI layer over Alberta's health and continuing-care systems via MCP.

These specs are **verified working** in demo mode against the tools in this repo plus the companion [`alberta-assisted-living`](https://github.com/JCrossman/alberta-assisted-living) MCP. Every step lists the exact suggested prompt and the tool(s) it exercises.

## Contents

| File | Scenario | One-line pitch |
|------|----------|----------------|
| [`persona-1-caregiver.md`](persona-1-caregiver.md) | **The Caregiver** (Dave + mother Margaret) | One question crosses health records *and* assisted-living placement. |
| [`persona-2-newcomer.md`](persona-2-newcomer.md) | **The Newcomer** (Amara) | Find a doctor who speaks your language — and get answers in that language. |
| [`cowork-slide-prompt.md`](cowork-slide-prompt.md) | **Exec preview slide** | A ready-to-paste Copilot Cowork prompt that builds a one-slide demo teaser with persona photos. |
| [`SETUP.md`](SETUP.md) | Prerequisites & wiring | What must be installed for the demos to run. |

## How to read these specs

Each scenario is broken into **steps**. Every step has:

- **Goal** — what the audience should take away.
- **Suggested prompt** — paste this verbatim into the chat client.
- **Tools exercised** — which MCP tool(s) fire (for your reference, not the audience's).
- **What they'll see** — the expected response shape.
- **Talking point** — the "why this matters" to say out loud.

## Ground rules for every demo

- **Always start a fresh conversation** — avoids carry-over context confusion.
- **Demo health data is fictional** — the four-person family (self, mother, spouse, child) is clinically coherent but synthetic. Every health response is tagged `[DEMO MODE — sample data, not a real patient]`.
- **Provider & assisted-living data is LIVE** — `find_provider*` hits the real Alberta provider directory; `alberta-assisted-living` hits the real Assisted Living Navigator. Facilities, physicians, and vacancy snapshots returned are real.
- **The server interprets nothing** — all analysis (trends, interaction flags, plain-language explanations, translation) is the LLM's. The server authenticates, fetches, formats, returns. This is the privacy story, not a limitation: *"the AI is a reader, not a database."*
- **Every health interaction ends with "talk to your doctor."** The disclaimer is injected by the server on every response.
