import { chromium, type Page, type BrowserContext } from 'playwright';
import { setCookies } from './db';

export type LoginPhase = 'idle' | 'starting' | 'enter_phone' | 'enter_otp' | 'done' | 'error';

let phase: LoginPhase = 'idle';
let loginError: string | null = null;
let activeUserId: string | null = null;
let activePage: Page | null = null;
let activeCtx: BrowserContext | null = null;

export function getLoginStatus() { return { phase, error: loginError }; }

function closeBrowser() {
  activeCtx?.browser()?.close().catch(() => {});
  activeCtx = null;
  activePage = null;
}

function pollForSession(userId: string) {
  const ctx = activeCtx!;
  const poll = setInterval(async () => {
    try {
      const cookies = await ctx.cookies('https://www.tiktok.com');
      if (cookies.some(c => c.name === 'sessionid' && c.value.length > 10)) {
        clearInterval(poll);
        await setCookies(userId, cookies);
        phase = 'done';
        closeBrowser();
      }
    } catch {
      clearInterval(poll);
      if (phase !== 'done') { phase = 'error'; loginError = 'Browser disconnected'; }
      closeBrowser();
    }
  }, 2000);

  setTimeout(() => {
    clearInterval(poll);
    if (phase !== 'done') { phase = 'error'; loginError = 'Timed out (5 min)'; }
    closeBrowser();
  }, 5 * 60_000);
}

export async function startLogin(userId: string): Promise<void> {
  closeBrowser();
  phase = 'starting'; loginError = null; activeUserId = userId;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 480, height: 800 },
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await ctx.newPage();
  activePage = page;
  activeCtx = ctx;

  await page.goto('https://www.tiktok.com/login/phone-or-email', {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  await page.waitForTimeout(2000);
  phase = 'enter_phone';
}

export async function submitPhone(phone: string): Promise<void> {
  if (!activePage || phase !== 'enter_phone') throw new Error('No active login session');
  const page = activePage;

  // Fill phone number input
  const phoneInput = page.locator([
    'input[name="mobile"]',
    'input[type="tel"]',
    'input[placeholder*="phone" i]',
    'input[placeholder*="number" i]',
  ].join(', ')).first();
  await phoneInput.waitFor({ timeout: 10_000 });
  await phoneInput.fill(phone);

  // Click "Send code" button
  const sendBtn = page.locator([
    '[data-e2e="send-code-button"]',
    'button:has-text("Send code")',
    'button:has-text("Get code")',
    'button:has-text("Send")',
  ].join(', ')).first();
  await sendBtn.click({ timeout: 10_000 });

  await page.waitForTimeout(1500);
  phase = 'enter_otp';
}

export async function submitOtp(otp: string): Promise<void> {
  if (!activePage || phase !== 'enter_otp') throw new Error('No active login session');
  const page = activePage;
  const userId = activeUserId!;

  // Fill OTP
  const otpInput = page.locator([
    '[data-e2e="verification-code-input"]',
    'input[name="code"]',
    'input[placeholder*="code" i]',
    'input[type="number"][maxlength="6"]',
    'input[inputmode="numeric"]',
  ].join(', ')).first();
  await otpInput.waitFor({ timeout: 10_000 });
  await otpInput.fill(otp);

  // Click login / confirm button
  const loginBtn = page.locator([
    '[data-e2e="login-button"]',
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Verify")',
    'button:has-text("Confirm")',
  ].join(', ')).first();
  await loginBtn.click({ timeout: 10_000 });

  await page.waitForTimeout(2000);
  pollForSession(userId);
}

// Legacy QR screenshot support
export async function getLoginScreenshot(): Promise<Buffer | null> {
  if (!activePage) return null;
  try { return await activePage.screenshot({ type: 'png' }); }
  catch { return null; }
}
