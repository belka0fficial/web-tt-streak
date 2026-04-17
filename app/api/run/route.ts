export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/get-user';
import { getRunStatus, runAutomation } from '@/lib/tiktok';

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getRunStatus(user.id).status === 'running')
    return NextResponse.json({ error: 'Already running' }, { status: 409 });
  runAutomation(user.id).catch(console.error);
  return NextResponse.json({ ok: true });
}
