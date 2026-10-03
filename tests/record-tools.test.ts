import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieJar } from 'tough-cookie';
import { MHRClient } from '../src/api/mhr-client.js';
import { getDiagnosticImagingTool } from '../src/tools/get-diagnostic-imaging.js';
import { getLabResultsTool } from '../src/tools/get-lab-results.js';
import { labResult } from './fixtures.js';

const ensureSession = vi.hoisted(() => vi.fn());
vi.mock('../src/helpers/session-helpers.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/helpers/session-helpers.js')>(),
  ensureSession,
}));

let client: MHRClient;
beforeEach(() => {
  vi.restoreAllMocks();
  client = new MHRClient(new CookieJar());
  ensureSession.mockResolvedValue(client);
});

function dataOf(result: { content: Array<{ type: string; text: string }> }) {
  const block = result.content.find(value => value.text.startsWith('{'));
  if (!block) throw new Error('Missing structured result');
  return JSON.parse(block.text);
}

describe('record formatting and pagination', () => {
  it('keeps the lab test-name filter and offset behavior', async () => {
    vi.spyOn(client, 'getLabResults').mockResolvedValue([
      labResult('Example A'), labResult('Example B'), labResult('Example A'),
    ]);
    const output = dataOf(await getLabResultsTool.handler({ test_name: 'Example A', max_results: 1, offset: 1 }));
    expect(output.totalResults).toBe(2);
    expect(output.results).toHaveLength(1);
    expect(output.results[0].groups[0].tests[0].name).toBe('Example A');
  });

  it('honors imaging pagination without changing the full result count', async () => {
    vi.spyOn(client, 'getDiagnosticImaging').mockResolvedValue([labResult(), labResult(), labResult()]);
    const output = dataOf(await getDiagnosticImagingTool.handler({ max_results: 1, offset: 1 }));
    expect(output.totalResults).toBe(3);
    expect(output.results).toHaveLength(1);
    expect(output.nextOffset).toBe(2);
  });

  it('preserves a pending test whose result value is not yet provided', async () => {
    const record = labResult();
    const pending = {
      ...record,
      group: [{
        ...record.group[0],
        labOrderStatus: 'Pending',
        results: [{ ...record.group[0].results[0], values: null, labOrderStatus: 'Pending' }],
      }],
    };
    vi.spyOn(client, 'getLabResults').mockResolvedValue([pending]);
    const output = dataOf(await getLabResultsTool.handler({}));
    expect(output.totalResults).toBe(1);
    expect(output.results[0].groups[0].status).toBe('Pending');
    expect(output.results[0].groups[0].tests[0].value).toBe('');
  });

  it('preserves attachment-only imaging records', async () => {
    const record = labResult();
    vi.spyOn(client, 'getDiagnosticImaging').mockResolvedValue([{
      ...record,
      group: [{
        ...record.group[0],
        results: null,
        attachment: [{ name: 'example.pdf', contentType: 'application/pdf', viewUrl: '', downloadUrl: '' }],
      }],
    }]);
    const output = dataOf(await getDiagnosticImagingTool.handler({}));
    expect(output.totalResults).toBe(1);
    expect(output.results[0].groups[0].attachments[0].name).toBe('example.pdf');
  });
});
