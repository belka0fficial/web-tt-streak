import { getScheduledUsers } from './db';
import { runAutomation } from './tiktok';

let started = false;

export function initScheduler() {
  if (started) return;
  started = true;

  // Fire once per minute, aligned to the top of the minute
  const tick = async () => {
    try {
      const users = await getScheduledUsers();
      for (const u of users) runAutomation(u.user_id).catch(console.error);
    } catch (e) {
      console.error('[scheduler]', e);
    }
  };

  // Wait until the next full minute, then tick every 60s
  const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
  setTimeout(() => {
    tick();
    setInterval(tick, 60_000);
  }, msUntilNextMinute);

  console.log('[scheduler] running');
}
