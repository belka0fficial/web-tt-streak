export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/get-user';
import { patchSettings, type Settings } from '@/lib/db';

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json() as Partial<Settings>;
  await patchSettings(user.id, body);
  return NextResponse.json({ ok: true });
}
