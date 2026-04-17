import { chromium, type BrowserContext, type Page } from 'playwright';
import { getCookies, getSettings, addLog } from './db';

const SEL = {
  messageBtn: ['[data-e2e="message-icon"]', '[data-e2e="user-message"]', 'button:has-text("Message")', '[aria-label="Message"]'],
  input:      ['[data-e2e="message-input"]', 'div[contenteditable="true"]', '[placeholder*="message" i]'],
  sendBtn:    ['[data-e2e="send-message"]', '[data-e2e="send-message-btn"]', 'button[type="submit"]'],
  loginCheck: '[data-e2e="login-button"], [href*="/login"]',
};

export type RunStatus = 'idle' | 'running' | 'done' | 'error';
const states = new Map<string, { status: RunStatus; error: string | null }>();

export function getRunStatus(userId: string) {
  return states.get(userId) ?? { status: 'idle' as RunStatus, error: null };
}

async function firstVisible(page: Page, selectors: string[], timeout = 8000) {
  for (const sel of selectors) {
    const ok = await page.locator(sel).first().isVisible({ timeout: 1500 }).catch(() => false);
    if (ok) return page.locator(sel).first();
  }
  return page.locator(selectors.join(', ')).first().waitFor({ timeout }).then(
    () => page.locator(selectors.join(', ')).first()
  );
}

async function sendDM(ctx: BrowserContext, handle: string, message: string) {
  const page = await ctx.newPage();
  try {
    await page.goto(`https://www.tiktok.com/@${handle.replace(/^@/, '')}`, {
      waitUntil: 'domcontentloaded', timeout: 30_000,
    });
    await page.waitForTimeout(2000);

    if (await page.locator(SEL.loginCheck).first().isVisible({ timeout: 2000 }).catch(() => false))
      throw new Error('Session expired — reconnect TikTok');

    const btn = await firstVisible(page, SEL.messageBtn, 10_000).catch(() => null);
    if (!btn) throw new Error(`Message button not found for ${handle}`);
    await btn.click();
    await page.waitForTimeout(2000);

    const input = await firstVisible(page, SEL.input, 12_000).catch(() => null);
    if (!input) throw new Error(`Message input not found for ${handle}`);
    await input.click();
    await input.type(message, { delay: 30 });

    const send = await firstVisible(page, SEL.sendBtn, 3000).catch(() => null);
    if (send) await send.click();
    else await input.press('Enter');
    await page.waitForTimeout(1500);
  } finally {
    await page.close();
  }
}

export async function runAutomation(userId: string) {
  if (getRunStatus(userId).status === 'running') return;
  states.set(userId, { status: 'running', error: null });

  const cookies = await getCookies(userId);
  const settings = await getSettings(userId);
  const active = settings.friends.filter(f => f.active);
  const total = active.length;
  let sent = 0;

  let browser;
  try {
    if (!cookies?.length) throw new Error('No TikTok session — connect TikTok first');

    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.addCookies(cookies as any);

    for (const friend of active) {
      try { await sendDM(ctx, friend.handle, settings.message); sent++; }
      catch (e) { console.error(`[tiktok] failed ${friend.handle}:`, e); }
    }

    const ok = sent === total;
    states.set(userId, { status: ok ? 'done' : 'error', error: ok ? null : `${total - sent} failed` });
    await addLog(userId, { ok, sent, total, detail: ok ? undefined : `${total - sent} failed` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    states.set(userId, { status: 'error', error: msg });
    await addLog(userId, { ok: false, sent, total, detail: msg });
  } finally {
    await browser?.close();
  }

  setTimeout(() => { if (states.get(userId)?.status !== 'running') states.delete(userId); }, 15_000);
}
