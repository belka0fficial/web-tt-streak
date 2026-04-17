import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/storage';
import { requireAuth } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const err = requireAuth(req); if (err) return err;
  const cookies = readJson<object[]>('cookies.json', []);
  return NextResponse.json({ hasCookies: cookies.length > 0 });
}

export async function POST(req: Request) {
  const err = requireAuth(req); if (err) return err;
  const { cookies } = await req.json();
  if (!Array.isArray(cookies) || cookies.length === 0)
    return NextResponse.json({ error: 'Invalid cookies array' }, { status: 400 });
  writeJson('cookies.json', cookies);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const err = requireAuth(req); if (err) return err;
  writeJson('cookies.json', []);
  return NextResponse.json({ ok: true });
}
