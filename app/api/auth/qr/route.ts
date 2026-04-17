export const dynamic = 'force-dynamic';
import { getUser } from '@/lib/get-user';
import { getLoginScreenshot } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return new Response(null, { status: 401 });
  const buf = await getLoginScreenshot();
  if (!buf) return new Response(null, { status: 404 });
  return new Response(buf as unknown as BodyInit, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}
