import { chromium, type Page } from 'playwright';
import { setCookies } from './db';

export type LoginStatus = 'idle' | 'waiting' | 'done' | 'error';

let loginStatus: LoginStatus = 'idle';
let loginError: string | null = null;
let activePage: Page | null = null;
let activeUserId: string | null = null;

export function getLoginStatus() { return { status: loginStatus, error: loginError }; }

export async function getLoginScreenshot(): Promise<Buffer | null> {
  if (!activePage) return null;
  try { return await activePage.screenshot({ type: 'png' }); }
  catch { return null; }
}

async function doLogin() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 480, height: 640 },
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await ctx.newPage();
  activePage = page;
  await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });

  for (const sel of ['[data-e2e="qrcode-tab"]', 'p:has-text("Use QR code")', 'div[role="tab"]:has-text("QR")']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) { await el.click(); break; }
  }
  await page.waitForTimeout(2000);

  await new Promise<void>((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        const cookies = await ctx.cookies('https://www.tiktok.com');
        if (cookies.some(c => c.name === 'sessionid' && c.value.length > 10)) {
          clearInterval(poll); clearTimeout(deadline);
          activePage = null;
          if (activeUserId) await setCookies(activeUserId, cookies);
          loginStatus = 'done';
          await browser.close();
          resolve();
        }
      } catch {
        clearInterval(poll); clearTimeout(deadline);
        activePage = null;
        reject(new Error('Browser disconnected'));
      }
    }, 2000);

    const deadline = setTimeout(() => {
      clearInterval(poll); activePage = null;
      loginStatus = 'error'; loginError = 'Timed out (5 minutes)';
      browser.close().catch(() => {});
      reject(new Error('Timeout'));
    }, 5 * 60 * 1000);

    browser.on('disconnected', () => {
      clearInterval(poll); clearTimeout(deadline); activePage = null;
      if (loginStatus === 'waiting') { loginStatus = 'error'; loginError = 'Browser disconnected'; }
      resolve();
    });
  });
}

export function startLoginSession(userId: string) {
  if (loginStatus === 'waiting') return;
  loginStatus = 'waiting'; loginError = null; activeUserId = userId;
  doLogin().catch(e => {
    if (loginStatus === 'waiting') { loginStatus = 'error'; loginError = e instanceof Error ? e.message : 'Login failed'; }
  });
}
