export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/get-user';
import * as fs from 'fs';

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const buf = fs.readFileSync('/tmp/tiktok-debug.png');
    return new NextResponse(buf, { headers: { 'Content-Type': 'image/png' } });
  } catch {
    return NextResponse.json({ error: 'No screenshot yet' }, { status: 404 });
  }
}
