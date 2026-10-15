import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const pages = ['static', 'portal/public'].flatMap(dir =>
  readdirSync(new URL(`${dir}/`, root)).filter(file => file.endsWith('.html')).map(file => `${dir}/${file}`),
);
type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
function elements(node: Node): Element[] {
  return [
    ...('tagName' in node ? [node] : []),
    ...('childNodes' in node ? node.childNodes.flatMap(elements) : []),
  ];
}
const attr = (node: Element, name: string) => node.attrs.find(item => item.name === name)?.value;

describe('privacy-minimizing public pages', () => {
  it.each(pages)('%s has no collection controls or analytics and suppresses referrers', path => {
    const source = read(path);
    const nodes = elements(parse(source));
    expect(nodes.filter(node => ['form', 'input', 'textarea'].includes(node.tagName))).toEqual([]);
    expect(nodes.filter(node => node.tagName === 'script' && attr(node, 'src'))).toEqual([]);
    expect(source).not.toMatch(/turnstile|appInsights|applicationinsights|trackPageView|handleSubmit|fetch\(['"]\/api\/request-access/i);
    expect(nodes.some(node => node.tagName === 'meta' && attr(node, 'name') === 'referrer' && attr(node, 'content') === 'no-referrer')).toBe(true);
    expect(source).toContain(':focus-visible');
    expect(source).not.toMatch(/up to 30 days|everything stays in Canada|HIA\/POPA compliant|Nothing stored by us/i);
  });

  it.each(['static/index.html', 'portal/public/landing.html'])('%s offers direct and alternative downloads without JS', path => {
    const source = read(path);
    const nodes = elements(parse(source));
    const links = nodes.filter(node => node.tagName === 'a').map(node => attr(node, 'href'));
    expect(links.filter(href => href === '/api/download-latest').length).toBeGreaterThanOrEqual(3);
    expect(links).toContain('https://github.com/JCrossman/ab-health-mcp/releases/latest');
    expect(links).not.toContain('/chat');
    expect(links.some(href => href?.includes('token=') || href?.includes('invite='))).toBe(false);
    expect(nodes.some(node => attr(node, 'id') === 'request-access' && attr(node, 'aria-labelledby') === 'download-heading')).toBe(true);
    expect(source).toContain('Install the new file over the existing extension');
    expect(source).toContain('Central US');
    expect(source).toContain('IP addresses');
    expect(source).toContain('separately approved cleanup');
    expect(source).toContain('Claude Desktop\'s conversation history');
    expect(source).not.toMatch(/opacity:\s*0;/);
  });

  it.each(['terms.html', 'demo.html', '404.html', 'index.html'])('keeps the %s mirror aligned except route aliases', file => {
    const normalize = (source: string) => source.replaceAll('href="/terms"', 'href="/terms.html"').replaceAll('href="/demo"', 'href="/demo.html"');
    expect(normalize(read(`portal/public/${file === 'index.html' ? 'landing.html' : file}`))).toBe(normalize(read(`static/${file}`)));
  });

  it.each(['staticwebapp.config.json', 'static/staticwebapp.config.json'])('%s no longer permits CAPTCHA or analytics hosts', path => {
    const config = JSON.parse(read(path));
    expect(config.platform.apiRuntime).toBe('node:22');
    expect(config.globalHeaders['Referrer-Policy']).toBe('no-referrer');
    expect(config.globalHeaders['Content-Security-Policy']).not.toMatch(/cloudflare|monitor\.azure|applicationinsights/);
    expect(config.globalHeaders['Content-Security-Policy']).toContain("form-action 'none'");
  });

  it('removes unused Table and mail dependencies', () => {
    const manifest = JSON.parse(read('api/package.json'));
    expect(Object.keys(manifest.dependencies)).toEqual(['@azure/storage-blob']);
    expect(read('api/package-lock.json')).not.toMatch(/@azure\/(?:communication-email|data-tables)/);
  });

  it('fails closed in old invitation automation without parsing or echoing arguments', () => {
    const process = { exitCode: 0 };
    const console = { error: vi.fn() };
    runInNewContext(read('scripts/send-beta-invite.ts'), { process, console });
    expect(process.exitCode).toBe(1);
    expect(console.error.mock.calls).toEqual([[
      'Portal invitations are retired. Use https://www.myaihealth.ca/api/download-latest for the desktop extension.',
    ]]);
  });
});
