export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/get-user';
import { getSettings, getLogs, getCookies } from '@/lib/db';
import { getRunStatus } from '@/lib/tiktok';

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [settings, logs, cookies] = await Promise.all([
    getSettings(user.id),
    getLogs(user.id),
    getCookies(user.id),
  ]);
  const { status, error } = getRunStatus(user.id);
  return NextResponse.json({ sessionOk: !!cookies?.length, settings, logs, status, error });
}
