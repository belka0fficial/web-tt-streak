export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/get-user';
import { startLogin, getLoginStatus } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { phase } = getLoginStatus();
  if (phase === 'enter_phone' || phase === 'enter_otp')
    return NextResponse.json({ ok: true, phase });
  await startLogin(user.id);
  return NextResponse.json({ ok: true, phase: 'enter_phone' });
}
