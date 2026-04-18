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

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver',  { get: () => undefined });
    Object.defineProperty(navigator, 'plugins',    { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages',  { get: () => ['en-US', 'en'] });
    // @ts-ignore
    delete window.__playwright;
    // @ts-ignore
    delete window.__pw_manual;
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

  // Parse country code + local number from e.g. "+972 052 659 8196"
  const cleaned = phone.replace(/[\s\-()]/g, '');
  let countryCode = '';
  let localNumber = cleaned;
  if (cleaned.startsWith('+')) {
    const m = cleaned.match(/^\+(\d{1,3})(.+)$/);
    if (m) { countryCode = m[1]; localNumber = m[2]; }
  }

  // Try to open country code dropdown and select the right country
  if (countryCode) {
    const countryBtn = page.locator([
      '[data-e2e="phoneNumber-enter"] button',
      'button[class*="CountryCode" i]',
      'button[class*="country" i]',
      '[class*="PhoneNumber"] button',
    ].join(', ')).first();

    if (await countryBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await countryBtn.click();
      await page.waitForTimeout(600);

      // Type country code in search box
      const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="country" i]').first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill(countryCode);
        await page.waitForTimeout(500);
      }

      // Click matching option
      const option = page.locator(`[data-value="${countryCode}"], li:has-text("+${countryCode}")`).first();
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click();
      } else {
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(500);
    }
  }

  // Fill local phone number
  const phoneInput = page.locator([
    'input[name="mobile"]',
    'input[type="tel"]',
    'input[placeholder*="phone" i]',
    'input[placeholder*="number" i]',
  ].join(', ')).first();
  await phoneInput.waitFor({ timeout: 10_000 });
  await phoneInput.click();
  await phoneInput.pressSequentially(localNumber, { delay: 80 });

  // Wait up to 5s for button to become enabled
  await page.waitForFunction(() => {
    const btn = document.querySelector('[data-e2e="send-code-button"]');
    return btn && !btn.hasAttribute('disabled');
  }, undefined, { timeout: 5000 }).catch(() => {});

  // Click send code (force in case still technically "disabled" but visually ok)
  const sendBtn = page.locator('[data-e2e="send-code-button"]').first();
  await sendBtn.click({ force: true, timeout: 5000 }).catch(async () => {
    await phoneInput.press('Enter');
  });

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

export async function getLoginScreenshot(): Promise<Buffer | null> {
  if (!activePage) return null;
  try { return await activePage.screenshot({ type: 'png' }); }
  catch { return null; }
}

export async function handleClick(x: number, y: number): Promise<void> {
  if (!activePage) return;
  await activePage.mouse.click(x, y);
}

export async function handleKey(key: string): Promise<void> {
  if (!activePage) return;
  if (key.length === 1) await activePage.keyboard.type(key);
  else await activePage.keyboard.press(key);
}

export async function handleScroll(x: number, y: number, deltaY: number): Promise<void> {
  if (!activePage) return;
  await activePage.mouse.move(x, y);
  await activePage.mouse.wheel(0, deltaY);
}
