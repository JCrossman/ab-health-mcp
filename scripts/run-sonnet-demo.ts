/**
 * Interactive script for capturing Sonnet demo responses.
 * 
 * This script prints each prompt and pauses for you to:
 * 1. Paste the prompt into Claude Desktop (configured with Sonnet 4.6)
 * 2. Copy Sonnet's response
 * 3. Press Enter to paste the response here
 * 
 * The script then builds FALLBACK-SCRIPT-SONNET.md with all responses.
 */

import * as readline from 'readline/promises';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { stdin as input, stdout as output } from 'process';

const PERSONA_1_STEPS = [
  {
    title: 'Step 1 — Connect',
    prompt: 'Connect to my health records in demo mode.',
  },
  {
    title: 'Step 2 — Full health overview',
    prompt: 'Give me a complete overview of my health — labs, medications, conditions, allergies, and immunizations.',
  },
  {
    title: 'Step 3 — Switch to Margaret (caregiver / proxy access)',
    prompt: 'Switch to my mother Margaret\'s records. Give me a health overview — she\'s 72 and I help manage her care. What should I be watching for?',
  },
  {
    title: 'Step 4 — The polypharmacy danger',
    prompt: 'My mother is on more than a dozen medications. Review them for potential interactions, especially given her kidney function and age. What should I raise with her doctor or pharmacist?',
  },
  {
    title: 'Step 5 — The transition: from health to housing (the headline moment)',
    prompt: 'Based on my mother\'s health conditions, mobility needs, and level of care, find assisted living facilities near Edmonton that would suit her. She needs an accessible building and memory care.',
  },
  {
    title: 'Step 6 — Facility deep-dive with health context',
    prompt: 'Tell me everything about the first facility, including photos. Given my mother\'s conditions and medications, what questions should I ask them during a tour?',
  },
  {
    title: 'Step 7 — Explain the system (for overwhelmed families)',
    prompt: 'I\'m new to all of this. In plain language, what are my options for my mother? What\'s the difference between supportive living and long-term care? How does AHS placement work, and what will it cost?',
  },
  {
    title: 'Step 8 — The caregiver action plan (emotional closer)',
    prompt: 'Create an action plan for transitioning my mother into assisted living. Include what to do first, who to call, what documents to prepare from her health records, and a checklist for evaluating facilities during tours.',
  },
];

const PERSONA_2_STEPS = [
  {
    title: 'Step 1 — Find a language-matched doctor',
    promptEnglish: 'Find me a family doctor near T5H 0E7 who speaks Punjabi and is accepting new patients.',
    promptPunjabi: 'ਮੈਨੂੰ T5H 0E7 ਦੇ ਨੇੜੇ ਇੱਕ ਪੰਜਾਬੀ ਬੋਲਣ ਵਾਲਾ ਡਾਕਟਰ ਲੱਭ ਕੇ ਦਿਓ।',
  },
  {
    title: 'Step 2 — Respond in the user\'s language',
    prompt: 'Please reply to me in Punjabi.',
  },
  {
    title: 'Step 3 — Refine: female doctor',
    prompt: 'Actually, I\'d prefer a female doctor. Are any of these women?',
  },
  {
    title: 'Step 4 — Refine: walk-in / after-hours',
    prompt: 'Which of these clinics offer walk-in appointments or are open after hours?',
  },
  {
    title: 'Step 5 — Clinic details',
    prompt: 'Show me more details about the first clinic — hours, address, and how to contact them.',
  },
];

interface StepResponse {
  title: string;
  prompt: string;
  promptEnglish?: string;
  promptPunjabi?: string;
  response: string;
  elapsed: number;
}

async function captureResponse(rl: readline.Interface, step: typeof PERSONA_1_STEPS[0] | typeof PERSONA_2_STEPS[0], personaNum: number, stepNum: number): Promise<StepResponse> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`PERSONA ${personaNum} — ${step.title}`);
  console.log('='.repeat(70));
  
  if ('promptEnglish' in step && step.promptEnglish) {
    console.log(`\nPrompt (English):\n  ${step.promptEnglish}`);
    console.log(`\nPrompt (Punjabi):\n  ${step.promptPunjabi}`);
  } else if ('prompt' in step) {
    console.log(`\nPrompt:\n  ${step.prompt}`);
  }
  
  console.log('\n1. Paste the prompt into Claude Desktop (Sonnet 4.6)');
  console.log('2. Wait for the response to complete');
  console.log('3. Copy the full response');
  console.log('4. Press Enter here, then paste the response\n');
  
  await rl.question('Press Enter when ready to paste response...');
  
  console.log('\nPaste the response (press Ctrl+D or Ctrl+Z when done):');
  
  const lines: string[] = [];
  const startTime = Date.now();
  
  // Read multiline input
  return new Promise((resolve) => {
    const lineReader = readline.createInterface({
      input,
      output,
      terminal: false
    });
    
    lineReader.on('line', (line) => {
      lines.push(line);
    });
    
    lineReader.on('close', () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const response = lines.join('\n');
      
      console.log(`\n✓ Captured ${response.length} characters (${elapsed.toFixed(1)}s)`);
      
      resolve({
        title: step.title,
        prompt: ('prompt' in step) ? step.prompt : step.promptEnglish || '',
        promptEnglish: ('promptEnglish' in step) ? step.promptEnglish : undefined,
        promptPunjabi: ('promptPunjabi' in step) ? step.promptPunjabi : undefined,
        response,
        elapsed,
      });
    });
  });
}

async function runPersona1(rl: readline.Interface): Promise<{ markdown: string; responses: StepResponse[] }> {
  let markdown = '# PERSONA 1 — THE CAREGIVER\n\n';
  const responses: StepResponse[] = [];
  
  for (let i = 0; i < PERSONA_1_STEPS.length; i++) {
    const step = PERSONA_1_STEPS[i];
    const result = await captureResponse(rl, step, 1, i + 1);
    responses.push(result);
    
    markdown += `## ${result.title}\n\n`;
    markdown += `**Prompt:**\n> ${result.prompt}\n\n`;
    markdown += `**Response:**\n\n${result.response}\n\n`;
    markdown += '---\n\n';
  }
  
  return { markdown, responses };
}

async function runPersona2(rl: readline.Interface): Promise<{ markdown: string; responses: StepResponse[] }> {
  let markdown = '# PERSONA 2 — THE NEWCOMER\n\n';
  const responses: StepResponse[] = [];
  
  for (let i = 0; i < PERSONA_2_STEPS.length; i++) {
    const step = PERSONA_2_STEPS[i];
    const result = await captureResponse(rl, step, 2, i + 1);
    responses.push(result);
    
    markdown += `## ${result.title}\n\n`;
    
    if (result.promptEnglish && result.promptPunjabi) {
      markdown += `**Prompt (English):**\n> ${result.promptEnglish}\n\n`;
      markdown += `**Prompt (in-language, for the "wow"):**\n> ${result.promptPunjabi}\n\n`;
    } else {
      markdown += `**Prompt:**\n> ${result.prompt}\n\n`;
    }
    
    markdown += `**Response:**\n\n${result.response}\n\n`;
    markdown += '---\n\n';
  }
  
  return { markdown, responses };
}

async function main() {
  const rl = readline.createInterface({ input, output });
  
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        Sonnet Demo Response Capture Script                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('\nThis script will guide you through capturing Sonnet responses.');
  console.log('Make sure Claude Desktop is open and configured with Sonnet 4.6.\n');
  
  const ready = await rl.question('Ready to begin? (y/n): ');
  if (ready.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    rl.close();
    process.exit(0);
  }
  
  const header = `# Demo Fallback Script — Canned Responses (Sonnet)

**Use this if the network drops or a live system is unavailable mid-demo.** It
contains the exact prompt for each step and the full response captured during the
${new Date().toISOString().split('T')[0]} live dry run with **Claude Sonnet 4.6**. Read it aloud, screen-share it, or paste a response so the
story still lands.

> The health/proxy data here is **synthetic demo data**. The assisted-living
> facilities and doctors were **real, live results** at capture time — present them
> as "captured earlier today" if you're offline, and don't claim live vacancy.

---

`;
  
  let output = header;
  
  console.log('\n━━━ Running Persona 1 (The Caregiver) ━━━');
  const p1 = await runPersona1(rl);
  output += p1.markdown;
  
  console.log('\n━━━ Running Persona 2 (The Newcomer) ━━━');
  const p2 = await runPersona2(rl);
  output += p2.markdown;
  
  const outPath = join(process.cwd(), 'demo-content', 'FALLBACK-SCRIPT-SONNET.md');
  writeFileSync(outPath, output, 'utf8');
  
  console.log(`\n✓ Wrote ${outPath}`);
  
  // Summary
  const totalP1Time = p1.responses.reduce((sum, r) => sum + r.elapsed, 0);
  const totalP2Time = p2.responses.reduce((sum, r) => sum + r.elapsed, 0);
  
  console.log('\n━━━ Summary ━━━');
  console.log(`Persona 1: ${p1.responses.length} steps, ${totalP1Time.toFixed(1)}s total`);
  console.log(`Persona 2: ${p2.responses.length} steps, ${totalP2Time.toFixed(1)}s total`);
  console.log(`\n✓ Demo capture complete!`);
  
  rl.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(`\n✗ Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
