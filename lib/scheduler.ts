import cron from 'node-cron';
import { getScheduledUsers } from './db';
import { runAutomation } from './tiktok';

export function initScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const users = await getScheduledUsers();
      for (const u of users) runAutomation(u.user_id).catch(console.error);
    } catch (e) {
      console.error('[scheduler]', e);
    }
  });
  console.log('[scheduler] running');
}
