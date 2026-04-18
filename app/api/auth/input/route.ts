export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/get-user';
import { handleClick, handleKey, handleScroll } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { type, x, y, key, deltaY } = await req.json();
  if (type === 'click')  await handleClick(x, y);
  if (type === 'key')    await handleKey(key);
  if (type === 'scroll') await handleScroll(x, y, deltaY);
  return NextResponse.json({ ok: true });
}
