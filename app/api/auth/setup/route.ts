import { NextResponse } from 'next/server';
import { isSetupDone, setup } from '@/lib/auth-server';

export async function GET() {
  return NextResponse.json({ done: isSetupDone() });
}

export async function POST(req: Request) {
  if (isSetupDone()) return NextResponse.json({ error: 'Already set up' }, { status: 400 });
  const { password } = await req.json();
  if (!password || password.length < 4)
    return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
  const token = setup(password);
  return NextResponse.json({ token });
}
