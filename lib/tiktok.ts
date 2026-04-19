import { chromium, type BrowserContext, type Page } from 'playwright';
import { getCookies, getSettings, addLog } from './db';
import * as fs from 'fs';

const SEL = {
  messageBtn: [
    '[data-e2e="user-message"]',
    '[data-e2e="message-icon"]',
    'button[data-e2e*="message"]',
    'a[data-e2e*="message"]',
    'button:has-text("Message")',
    'a:has-text("Message")',
    '[aria-label*="Message" i]',
    '[aria-label*="message" i]',
    'button[class*="message" i]',
    'a[class*="message" i]',
  ],
  input: [
    '[data-e2e="message-input"]',
    '[data-e2e="chat-input"]',
    '.DraftEditor-root',
    '[data-contents="true"]',
    '[contenteditable="true"]',
    'div[contenteditable]',
    '[placeholder*="message" i]',
    '[placeholder*="Send" i]',
    '[placeholder*="Type" i]',
    'textarea',
  ],
  sendBtn: [
    '[data-e2e="send-message-btn"]',
    '[data-e2e="send-message"]',
    'button[type="submit"]',
    'button:has-text("Send")',
  ],
  loginCheck: '[data-e2e="login-button"], [href*="/login"]',
};

export type RunStatus = 'idle' | 'running' | 'done' | 'error';
const states = new Map<string, { status: RunStatus; error: string | null }>();

export function getRunStatus(userId: string) {
  return states.get(userId) ?? { status: 'idle' as RunStatus, error: null };
}

async function dismissModals(page: Page) {
  // Close TikTok overlay modals (login prompts, app banners, etc.) that block clicks
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  const closeSelectors = [
    '.TUXModal-overlay',
    '[data-e2e="modal-close-inner-button"]',
    '[aria-label="Close" i]',
    'button[aria-label*="close" i]',
    '[class*="closeButton" i]',
    '[class*="close-button" i]',
  ];
  for (const sel of closeSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
      await el.click({ force: true, timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
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
    // Visit homepage so TikTok JS can run and refresh any expiring cookies
    await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    if (await page.locator(SEL.loginCheck).first().isVisible({ timeout: 2000 }).catch(() => false))
      throw new Error('Session expired — reconnect TikTok');

    const cleanHandle = handle.replace(/^@/, '');

    // Try messages inbox approach first — more reliable than profile page click
    const dmSent = await sendViaMsgInbox(page, cleanHandle, message).catch(() => false);
    if (dmSent) return;

    // Fallback: profile page → Message button
    await page.goto(`https://www.tiktok.com/@${cleanHandle}`, {
      waitUntil: 'domcontentloaded', timeout: 30_000,
    });
    await page.waitForTimeout(3000);
    await dismissModals(page);

    if (await page.locator(SEL.loginCheck).first().isVisible({ timeout: 2000 }).catch(() => false))
      throw new Error('Session expired — reconnect TikTok');

    const btn = await firstVisible(page, SEL.messageBtn, 10_000).catch(() => null);
    if (!btn) {
      const shot = await page.screenshot({ type: 'png' }).catch(() => null);
      if (shot) fs.writeFileSync('/tmp/tiktok-debug.png', shot);
      throw new Error(`Message button not found — page: "${await page.title().catch(() => '?')}" url: ${page.url()}`);
    }
    await btn.click({ force: true });
    await page.waitForTimeout(3000);

    const input = await firstVisible(page, SEL.input, 15_000).catch(() => null);
    if (!input) {
      const shot = await page.screenshot({ type: 'png' }).catch(() => null);
      if (shot) fs.writeFileSync('/tmp/tiktok-debug.png', shot);
      throw new Error(`Message input not found — page: "${await page.title().catch(() => '?')}" url: ${page.url()}`);
    }
    await input.click();
    await input.type(message, { delay: 30 });

    const send = await firstVisible(page, SEL.sendBtn, 3000).catch(() => null);
    if (send) await send.click();
    else await page.keyboard.press('Enter'); // avoid re-evaluating the locator
    await page.waitForTimeout(1500);
  } finally {
    await page.close();
  }
}

async function sendViaMsgInbox(page: Page, handle: string, message: string): Promise<boolean> {
  await page.goto('https://www.tiktok.com/messages', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3000);
  await dismissModals(page);

  // If redirected to login, inbox approach won't work
  if (page.url().includes('/login') || await page.locator(SEL.loginCheck).first().isVisible({ timeout: 2000 }).catch(() => false))
    return false;

  // Look for compose / new message button
  const composeSelectors = [
    '[data-e2e="new-message-btn"]',
    '[data-e2e="compose"]',
    'button[aria-label*="compose" i]',
    'button[aria-label*="new message" i]',
    'button[aria-label*="New" i]',
    'button:has-text("New message")',
    'button:has-text("Compose")',
    '[class*="compose" i]',
    '[class*="newMessage" i]',
    'svg[class*="compose"]',
  ];
  const compose = await firstVisible(page, composeSelectors, 5000).catch(() => null);
  if (!compose) return false;

  await compose.click();
  await page.waitForTimeout(2000);

  // Search for user in the recipient field
  const searchSelectors = [
    '[data-e2e="search-user-input"]',
    'input[placeholder*="Search" i]',
    'input[placeholder*="search" i]',
    'input[type="search"]',
    'input[type="text"]',
  ];
  const searchInput = await firstVisible(page, searchSelectors, 5000).catch(() => null);
  if (!searchInput) return false;

  await searchInput.type(handle, { delay: 50 });
  await page.waitForTimeout(2000);

  // Click first search result
  const resultSelectors = [
    '[data-e2e="search-user-result"]',
    '[class*="userItem" i]',
    '[class*="user-item" i]',
    '[class*="searchResult" i]',
    'li[role="option"]',
    '[role="option"]',
  ];
  const result = await firstVisible(page, resultSelectors, 5000).catch(() => null);
  if (!result) return false;

  await result.click();
  await page.waitForTimeout(2000);

  // Now type message in the chat input
  const input = await firstVisible(page, SEL.input, 10_000).catch(() => null);
  if (!input) return false;

  await input.click();
  await input.type(message, { delay: 30 });

  const send = await firstVisible(page, SEL.sendBtn, 3000).catch(() => null);
  if (send) await send.click();
  else await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  return true;
}

const BROWSER_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage', '--disable-gpu',
  '--no-zygote', '--disable-extensions',
  '--disable-software-rasterizer',
];

async function sendDMFresh(cookies: object[], handle: string, message: string) {
  // Fresh browser per friend — prevents memory accumulation from crashing Chrome
  const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
  try {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.addCookies(cookies as any);
    await sendDM(ctx, handle, message);
  } finally {
    await browser.close();
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

  try {
    if (!cookies?.length) throw new Error('No TikTok session — connect TikTok first');

    const errors: string[] = [];
    for (const friend of active) {
      try {
        await sendDMFresh(cookies, friend.handle, settings.message);
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${friend.handle}: ${msg}`);
        console.error(`[tiktok] failed ${friend.handle}:`, e);
      }
      // Brief pause between friends so Railway memory can settle
      if (active.indexOf(friend) < active.length - 1) await new Promise(r => setTimeout(r, 3000));
    }

    const ok = sent === total;
    const detail = errors.length ? errors.join(' | ') : undefined;
    states.set(userId, { status: ok ? 'done' : 'error', error: ok ? null : detail ?? 'failed' });
    await addLog(userId, { ok, sent, total, detail });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    states.set(userId, { status: 'error', error: msg });
    await addLog(userId, { ok: false, sent, total, detail: msg });
  }

  setTimeout(() => { if (states.get(userId)?.status !== 'running') states.delete(userId); }, 15_000);
}
