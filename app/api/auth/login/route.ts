import { NextResponse } from 'next/server';
import { login } from '@/lib/auth-server';

export async function POST(req: Request) {
  const { password } = await req.json();
  const token = login(password);
  if (!token) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  return NextResponse.json({ token });
}
