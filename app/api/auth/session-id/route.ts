export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/get-user';
import { setSessionId } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { sessionId } = await req.json();
  if (!sessionId || sessionId.trim().length < 10)
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  await setSessionId(user.id, sessionId);
  return NextResponse.json({ ok: true });
}
