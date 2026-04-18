export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/get-user';
import { loginWithCredentials } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { phone, password } = await req.json();
  if (!phone || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  // Fire and forget — client polls /api/auth/status
  loginWithCredentials(user.id, phone, password).catch(() => {});
  return NextResponse.json({ ok: true });
}
