export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/get-user';
import { startLoginSession, getLoginStatus } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (getLoginStatus().status === 'waiting')
    return NextResponse.json({ ok: true, alreadyWaiting: true });
  startLoginSession(user.id);
  return NextResponse.json({ ok: true });
}
