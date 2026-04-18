export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getScheduledUsers } from '@/lib/db';
import { runAutomation } from '@/lib/tiktok';

// Called by Railway Cron Job every minute: GET /api/cron?secret=<CRON_SECRET>
// Also usable as a manual trigger for debugging.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    if (url.searchParams.get('secret') !== secret)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await getScheduledUsers();
  for (const u of users) runAutomation(u.user_id).catch(console.error);
  return NextResponse.json({ fired: users.length });
}
