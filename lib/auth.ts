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

async function makeContext() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--disable-extensions',
      '--disable-software-rasterizer',
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
  return ctx;
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

// ── Silent credentials login ───────────────────────────────────────────────────
// Runs Playwright fully in the background — no screenshot streaming needed.
export async function loginWithCredentials(userId: string, phone: string, password: string): Promise<void> {
  closeBrowser();
  phase = 'starting'; loginError = null; activeUserId = userId;

  const ctx = await makeContext();
  const page = await ctx.newPage();
  activePage = page;
  activeCtx = ctx;

  try {
    // Small delay to let the browser fully initialize before navigating
    await new Promise(r => setTimeout(r, 500));
    await page.goto('https://www.tiktok.com/login/phone-or-email/password', {
      waitUntil: 'domcontentloaded', timeout: 30_000,
    });
    await page.waitForTimeout(2000);

    // Parse country code + local number
    const cleaned = phone.replace(/[\s\-()]/g, '');
    let countryCode = '';
    let localNumber = cleaned;
    if (cleaned.startsWith('+')) {
      const m = cleaned.match(/^\+(\d{1,3})(.+)$/);
      if (m) { countryCode = m[1]; localNumber = m[2]; }
    }

    // Handle country code dropdown if present
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
        const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="country" i]').first();
        if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await searchInput.fill(countryCode);
          await page.waitForTimeout(500);
        }
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

    // Fill phone number
    const phoneInput = page.locator([
      'input[name="mobile"]',
      'input[type="tel"]',
      'input[placeholder*="phone" i]',
      'input[placeholder*="number" i]',
    ].join(', ')).first();
    await phoneInput.waitFor({ timeout: 10_000 });
    await phoneInput.click();
    await phoneInput.pressSequentially(localNumber, { delay: 80 });

    // Fill password
    const passInput = page.locator([
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="password" i]',
    ].join(', ')).first();
    await passInput.waitFor({ timeout: 5_000 });
    await passInput.click();
    await passInput.pressSequentially(password, { delay: 60 });

    // Submit
    const loginBtn = page.locator([
      '[data-e2e="login-button"]',
      'button[type="submit"]',
      'button:has-text("Log in")',
    ].join(', ')).first();
    await loginBtn.click({ force: true, timeout: 8_000 });

    await page.waitForTimeout(2000);
    phase = 'enter_otp'; // may need OTP — poll will catch 'done' if not
    pollForSession(userId);
  } catch (err: any) {
    phase = 'error';
    loginError = err?.message ?? 'Login failed';
    closeBrowser();
  }
}

// ── OTP (used after credentials login if TikTok requires one) ─────────────────
export async function submitOtp(otp: string): Promise<void> {
  if (!activePage) throw new Error('No active login session');
  const page = activePage;
  const userId = activeUserId!;

  const otpInput = page.locator([
    '[data-e2e="verification-code-input"]',
    'input[name="code"]',
    'input[placeholder*="code" i]',
    'input[type="number"][maxlength="6"]',
    'input[inputmode="numeric"]',
  ].join(', ')).first();
  await otpInput.waitFor({ timeout: 10_000 });
  await otpInput.fill(otp);

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

// ── QR code login ──────────────────────────────────────────────────────────────
// Playwright opens TikTok QR login, we stream the screenshot back to the client.
// User scans with TikTok app — no password needed.
export async function startQRLogin(userId: string): Promise<void> {
  closeBrowser();
  phase = 'starting'; loginError = null; activeUserId = userId;

  const ctx = await makeContext();
  const page = await ctx.newPage();
  activePage = page;
  activeCtx = ctx;

  await page.goto('https://www.tiktok.com/login', {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  await page.waitForTimeout(2000);

  // Click QR code tab if present
  const qrBtn = page.locator([
    '[data-e2e="qrcode-btn"]',
    'a[href*="qrcode"]',
    'div[class*="qr" i]',
    'span:has-text("QR")',
  ].join(', ')).first();
  if (await qrBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await qrBtn.click();
    await page.waitForTimeout(1000);
  }

  phase = 'enter_phone'; // signals "ready" to the status poller
  pollForSession(userId);
}

// ── Cookie paste ──────────────────────────────────────────────────────────────
// User copies the full Cookie header from any TikTok network request.
// This gives us ALL cookies (sessionid + ttwid + tt_csrf_token + msToken etc.)
// which TikTok requires for DM access — sessionid alone is not enough.
export async function setSessionId(userId: string, input: string): Promise<void> {
  const trimmed = input.trim();
  const cookies = trimmed.includes(';') ? parseCookieHeader(trimmed) : [seedCookie(trimmed)];
  await setCookies(userId, cookies);
}

function seedCookie(sessionId: string) {
  return {
    name: 'sessionid',
    value: sessionId,
    domain: '.tiktok.com',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'None' as const,
    expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60,
  };
}

function parseCookieHeader(header: string) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60;
  return header.split(';')
    .map(part => {
      const eq = part.indexOf('=');
      if (eq === -1) return null;
      const name  = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (!name || !value) return null;
      return { name, value, domain: '.tiktok.com', path: '/', secure: true, sameSite: 'None' as const, expires: exp };
    })
    .filter(Boolean) as object[];
}

// ── Interactive popup (fallback) ───────────────────────────────────────────────
export async function startLogin(userId: string): Promise<void> {
  closeBrowser();
  phase = 'starting'; loginError = null; activeUserId = userId;

  const ctx = await makeContext();
  const page = await ctx.newPage();
  activePage = page;
  activeCtx = ctx;

  await page.goto('https://www.tiktok.com/login/phone-or-email', {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  await page.waitForTimeout(2000);
  phase = 'enter_phone';
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
