# Demo Setup

What must be in place before running either persona demo.

## Required MCP servers

| Server | Repo | Role in demos | Auth |
|--------|------|---------------|------|
| `ab-health-mcp` | this repo | Health records (demo mode) + live provider search | Demo mode = none |
| `alberta-assisted-living` | [`JCrossman/alberta-assisted-living`](https://github.com/JCrossman/alberta-assisted-living) | Live assisted-living facility search (Persona 1 only) | None (public data) |

Persona 2 needs only `ab-health-mcp`. Persona 1 needs **both**.

## Install — Claude Desktop (`.mcpb`, recommended for execs)

Both servers ship a one-click `.mcpb` bundle. Install each by double-clicking the downloaded file; Claude Desktop wires it automatically. No Node, no terminal.

## Install — Copilot CLI / local stdio (for builders)

Add both to your MCP config (e.g. `~/.copilot/mcp-config.json`):

```json
{
  "mcpServers": {
    "ab-health-mcp": {
      "type": "local",
      "command": "node",
      "args": ["C:\\code\\ab-health-mcp\\build\\index.js"],
      "timeout": 30000,
      "tools": ["*"]
    },
    "alberta-assisted-living": {
      "type": "local",
      "command": "node",
      "args": ["C:\\code\\alberta-assisted-living\\src\\index.mjs"],
      "tools": ["*"]
    }
  }
}
```

Build `ab-health-mcp` first (`npm install && npm run build`); the assisted-living server runs `src/index.mjs` directly (no build needed).

### ⚠️ The timeout setting matters

`ab-health-mcp`'s provider-search tools chain **live geocoding (Nominatim) + directory search**, which can take several seconds on a cold cache. Set the MCP client `timeout` to **at least 30000 ms (30s)**.

A too-low timeout (e.g. the old default of 1000 ms) causes the **first** provider search to fail with `Request timed out`, then succeed on retry — because the abandoned call still warms DNS/TLS/connection caches server-side. With 30s, cold-start searches pass on the first try. **Restart the MCP client after changing this value** — timeouts load at startup.

## Pre-demo checklist

- [ ] Both servers show as connected in the client.
- [ ] Run one throwaway provider search to warm the geocoder (optional belt-and-suspenders).
- [ ] Start a **fresh** conversation for the actual demo.
- [ ] Confirm demo mode connects: *"Connect to health data in demo mode."*

## The demo family (proxy access)

| Person | Proxy ID | Age/Sex | Profile highlights |
|--------|----------|---------|--------------------|
| Demo User (self) | `self` | 39 M | T2D, hypertension, hyperlipidemia, vitamin D deficiency; worsening HbA1c |
| Margaret User (mother) | `mother` | 72 F | T2D, AFib, HFpEF, dementia, CKD 3a, 12+ meds — caregiver/polypharmacy story |
| Sarah User (spouse) | `spouse` | 41 F | Hashimoto's, GAD, migraine w/ aura, perimenopause — women's health |
| Liam User (child) | `child` | 7 M | Asthma, ADHD, peanut allergy + EpiPen — pediatric story |

Switch with natural language (*"Switch to my mother's chart"*) → calls `mc_switch_context`.
