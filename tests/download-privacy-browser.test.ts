import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { expect, it } from 'vitest';

// Opt-in: uses an isolated profile and denies all non-loopback browser requests.
const chrome = process.env.DOWNLOAD_PRIVACY_CHROME;
it.runIf(Boolean(chrome))('keeps direct downloads usable at 320px and desktop with no external calls', async () => {
  const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const work = resolve(root, '.download-privacy-browser');
  await mkdir(work, { recursive: true });
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    if (pathname === '/api/download-latest') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Synthetic installer response; no live download');
      return;
    }
    const relative = pathname === '/' ? 'static/index.html'
      : pathname === '/landing.html' ? 'portal/public/landing.html'
        : `static${pathname}`;
    const path = resolve(root, relative);
    if (!path.startsWith(`${root}/static/`) && path !== resolve(root, 'portal/public/landing.html')) {
      res.writeHead(404).end();
      return;
    }
    try {
      const data = await readFile(path);
      const type = {
        '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp',
      }[extname(path)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Referrer-Policy': 'no-referrer' });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Loopback server failed');
  const origin = `http://127.0.0.1:${address.port}`;
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      userDataDir: resolve(work, 'profile'),
      env: { ...process.env, TMPDIR: work },
      args: [
        '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run',
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      ],
    });
    const page = await browser.newPage();
    const external: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === origin || url.protocol === 'data:') {
        void request.continue();
      } else {
        external.push(url.hostname);
        void request.abort();
      }
    });
    for (const width of [320, 1280]) {
      await page.setViewport({ width, height: 900 });
      for (const path of ['/', '/landing.html', '/terms.html', '/demo.html', '/404.html']) {
        await page.goto(`${origin}${path}`, { waitUntil: 'networkidle0' });
        const state = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          controls: document.querySelectorAll('form, input, textarea').length,
          referrer: document.querySelector('meta[name=referrer]')?.getAttribute('content'),
          directLinks: [...document.querySelectorAll<HTMLAnchorElement>('a[href="/api/download-latest"]')]
            .filter(link => link.getBoundingClientRect().width > 0 && getComputedStyle(link).visibility !== 'hidden').length,
          overflow: [...document.querySelectorAll('main *, footer *')]
            .filter(node => node.getBoundingClientRect().right > innerWidth)
            .map(node => `${node.tagName}.${node.className}`).slice(0, 12),
        }));
        expect(state.controls).toBe(0);
        expect(state.referrer).toBe('no-referrer');
        expect.soft(state.scrollWidth, `${path} at ${width}px: ${state.overflow.join(', ')}`).toBeLessThanOrEqual(state.width);
        if (path === '/' || path === '/landing.html') {
          expect(state.directLinks).toBeGreaterThanOrEqual(2);
          await page.keyboard.press('Tab');
          expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Skip to main content');
          await page.keyboard.press('Enter');
          await page.keyboard.press('Tab');
          const focusedHref = await page.evaluate(() => document.activeElement?.getAttribute('href'));
          expect.soft(focusedHref).toBe('/api/download-latest');
          if (focusedHref !== '/api/download-latest') continue;
          expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe('solid');
          await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
          expect(await page.content()).toContain('Synthetic installer response');
        }
      }
    }
    await page.setJavaScriptEnabled(false);
    await page.goto(origin, { waitUntil: 'networkidle0' });
    expect(await page.$eval('a[href="/api/download-latest"]', link => (link as HTMLAnchorElement).href))
      .toBe(`${origin}/api/download-latest`);
    expect([...new Set(external)].every(host => ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(host))).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await browser?.close();
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
    await rm(work, { recursive: true, force: true });
  }
}, 30_000);
