import { serverSupabase } from './supabase';

export async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await serverSupabase().auth.getUser(token);
  if (error) return null;
  return user;
}
