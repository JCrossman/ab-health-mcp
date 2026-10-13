import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve('scripts/run-sonnet-demo.ts');

function capture(input: string) {
  const directory = resolve(`.sonnet-capture-test-${randomUUID()}`);
  const fallback = join(directory, 'demo-content', 'FALLBACK-SCRIPT-SONNET.md');
  mkdirSync(join(directory, 'demo-content'), { recursive: true });
  writeFileSync(fallback, 'Existing fallback', 'utf8');
  try {
    const result = spawnSync(process.execPath, ['--import', 'tsx', script], {
      cwd: directory,
      input,
      encoding: 'utf8',
      timeout: 10_000,
    });
    return { ...result, markdown: readFileSync(fallback, 'utf8') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('Sonnet demo response capture (synthetic stdin only)', () => {
  it('captures all 13 multiline responses from buffered input', () => {
    const responses = Array.from(
      { length: 13 },
      (_, index) => `Synthetic response ${index + 1}\n\nSecond line ਪੰਜਾਬੀ`,
    );
    const result = capture(`y\n${responses.map(response => `\n${response}\n/done\n`).join('')}`);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.markdown.match(/^## Step /gm)).toHaveLength(13);
    for (const response of responses) {
      expect(result.markdown).toContain(response);
    }
    expect(result.markdown).not.toContain('/done');
    expect(result.stdout).toContain('Persona 1: 8 steps');
    expect(result.stdout).toContain('Persona 2: 5 steps');
  });

  it('leaves the existing fallback untouched when cancelled', () => {
    const result = capture('n\n');
    expect(result.status).toBe(0);
    expect(result.markdown).toBe('Existing fallback');
  });

  it('reports premature EOF without overwriting the fallback', () => {
    const result = capture('y\n\nSynthetic incomplete response\n');
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Input ended before capture was complete');
    expect(result.markdown).toBe('Existing fallback');
  });

  it('rejects an empty response instead of silently advancing', () => {
    const result = capture('y\n\n/done\n');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Response is empty');
    expect(result.markdown).toBe('Existing fallback');
  });
});
