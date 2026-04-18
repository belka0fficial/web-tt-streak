# TikTok Streak Saver

Automatically sends a daily TikTok DM to your friends list to keep your streaks alive. Self-hosted on Railway, runs on any device via the web.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Railway](https://img.shields.io/badge/Deploy-Railway-blueviolet) ![Playwright](https://img.shields.io/badge/Automation-Playwright-green)

---

## What it does

- Logs in to your TikTok account once (via phone+password or session cookie)
- Sends a DM to every friend on your list every day at your chosen time
- Fully automatic — set it and forget it
- Works from any browser or phone (PWA-ready)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 App Router, Tailwind CSS |
| Backend | Next.js API routes, Playwright (headless Chromium) |
| Database | Supabase (PostgreSQL + Auth) |
| Hosting | Railway (Docker) |

---

## Self-host in 15 minutes

### 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run:

```sql
CREATE TABLE IF NOT EXISTS settings (
  user_id          text PRIMARY KEY,
  schedule_enabled boolean NOT NULL DEFAULT false,
  schedule_time    text    NOT NULL DEFAULT '09:00',
  timezone         text    NOT NULL DEFAULT 'UTC',
  message          text    NOT NULL DEFAULT '🐿️🐿️🐿️',
  tiktok_cookies   jsonb
);

CREATE TABLE IF NOT EXISTS friends (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text    NOT NULL,
  name       text    NOT NULL,
  handle     text    NOT NULL,
  active     boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS logs (
  id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text        NOT NULL,
  ts      timestamptz NOT NULL DEFAULT now(),
  ok      boolean     NOT NULL,
  sent    int         NOT NULL,
  total   int         NOT NULL,
  detail  text
);
```

3. Go to **Authentication → Providers** → enable **Email** (and Google/GitHub if you want OAuth)
4. Go to **Authentication → URL Configuration** and set:
   - **Site URL**: your Railway app URL (e.g. `https://your-app.up.railway.app`)
   - **Redirect URLs**: `https://your-app.up.railway.app/auth/callback`

### 2. Deploy to Railway

1. Fork this repo on GitHub
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
3. Select your fork — Railway detects the Dockerfile automatically
4. Go to **Variables** and add:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role |
| `CRON_SECRET` | Any random string (optional, protects `/api/cron`) |

5. Railway builds and deploys. Your app is live.

### 3. Connect TikTok

Open the app → tap **Not connected** → choose a login method:

- **Phone + password** — logs in silently in the background
- **Paste session ID** — open TikTok in Chrome on a PC → F12 → Application → Cookies → tiktok.com → copy the `sessionid` value

### 4. Add friends and set a schedule

1. Add friends by display name + TikTok handle
2. Set a daily send time — the app auto-detects your timezone
3. Toggle **Auto-send daily** on
4. Hit **Run Now** to test immediately

---

## Optional: Railway Cron Job (extra reliability)

The app has a built-in scheduler. You can add a Railway Cron Job as a belt-and-suspenders backup:

1. In your Railway project → **New → Cron Job**
2. Command: `curl -s "https://your-app.up.railway.app/api/cron?secret=YOUR_CRON_SECRET"`
3. Schedule: `* * * * *`

---

## Install on your phone (no App Store needed)

The site is a PWA — it installs to your home screen and opens full-screen like a native app.

### iPhone (Safari only)

1. Open your Railway URL in **Safari**
2. Tap the **Share** button (bottom center, box with arrow)
3. Scroll down → **Add to Home Screen**
4. Tap **Add**

Done. It appears on your home screen with its own icon.

### Android (Chrome)

1. Open your Railway URL in **Chrome**
2. Tap the **three-dot menu** (top right)
3. Tap **Add to Home screen** or **Install app**
4. Tap **Add**

---

## Wrap as a real native app (optional)

If you want a proper `.apk` or `.ipa` file to distribute:

### Android — Bubblewrap (TWA)

A Trusted Web Activity wraps your web app in a real Android app with zero extra code.

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://your-app.up.railway.app/manifest.json
bubblewrap build
# outputs app-release-signed.apk
```

Upload the `.aab` to the Play Store or sideload the `.apk` directly.
See [Bubblewrap docs](https://github.com/GoogleChromeLabs/bubblewrap) for signing + assetlinks setup.

### iPhone — Capacitor (WKWebView wrapper)

Capacitor wraps your web app in a native iOS shell without rewriting any code.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Streak Saver" "com.yourname.streaksaver" --web-dir out
npx cap add ios
npx cap sync
npx cap open ios   # opens Xcode
```

In Xcode, point the app at your Railway URL, then build and sign with your Apple Developer account.

> Distributing on the App Store requires an Apple Developer account ($99/year).  
> For personal use / friends, use TestFlight (free, up to 10k testers) or AltStore sideloading.

---

## Publish on GitHub

### Create the repo

```bash
# If you haven't already:
git remote set-url origin https://github.com/YOUR_USERNAME/tiktok-streak-saver.git
# Or for a brand new repo:
git remote add origin https://github.com/YOUR_USERNAME/tiktok-streak-saver.git

git push -u origin main
```

### Make it discoverable

On your GitHub repo page, click the gear icon next to **About** and add:
- **Description**: Automatically send daily TikTok DMs to maintain streaks
- **Topics**: `tiktok` `automation` `streak` `nextjs` `playwright` `railway` `self-hosted` `pwa`

### Create a release so people can download a zip

1. GitHub repo → **Releases** → **Create a new release**
2. Tag: `v1.0.0`
3. Title: `v1.0.0 — Initial release`
4. Describe what it does → **Publish release**

GitHub automatically attaches a source zip. Anyone can download it, follow the README, and run their own instance.

### What other users need to do

Fork or download → create their own Supabase project → deploy to Railway with their own env vars → connect their TikTok.

Each user's data (cookies, friends, schedule) is stored under their own Supabase auth ID — completely isolated.

---

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CRON_SECRET=any-random-string   # optional
```

---

## License

MIT
