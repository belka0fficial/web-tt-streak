import { serverSupabase } from './supabase';

export interface Friend { id: string; name: string; handle: string; active: boolean; }
export interface Settings {
  schedule: { enabled: boolean; time: string };
  friends: Friend[];
  message: string;
}
export interface LogEntry { id: string; ts: number; ok: boolean; sent: number; total: number; detail?: string; }

export const DEFAULT_SETTINGS: Settings = {
  schedule: { enabled: false, time: '09:00' },
  friends: [],
  message: '🐿️🐿️🐿️',
};

export async function getSettings(userId: string): Promise<Settings> {
  const sb = serverSupabase();
  const [{ data: s }, { data: friends }] = await Promise.all([
    sb.from('settings').select('*').eq('user_id', userId).single(),
    sb.from('friends').select('*').eq('user_id', userId),
  ]);
  if (!s) return { ...DEFAULT_SETTINGS };
  return {
    schedule: { enabled: s.schedule_enabled, time: s.schedule_time },
    friends: (friends ?? []).map(f => ({ id: f.id, name: f.name, handle: f.handle, active: f.active })),
    message: s.message,
  };
}

export async function patchSettings(userId: string, patch: Partial<Settings>) {
  const sb = serverSupabase();

  if (patch.schedule !== undefined || patch.message !== undefined) {
    // Read current row so we can merge — prevents clobbering other columns
    const { data: cur } = await sb.from('settings').select('*').eq('user_id', userId).single();
    const row = {
      user_id:          userId,
      schedule_enabled: patch.schedule?.enabled ?? cur?.schedule_enabled ?? false,
      schedule_time:    patch.schedule?.time    ?? cur?.schedule_time    ?? '09:00',
      message:          patch.message           ?? cur?.message          ?? '🐿️🐿️🐿️',
      tiktok_cookies:   cur?.tiktok_cookies     ?? null,
    };
    const { error } = await sb.from('settings').upsert(row, { onConflict: 'user_id' });
    if (error) throw new Error(`settings: ${error.message}`);
    // Read back to confirm what was actually stored
    const { data: check } = await sb.from('settings').select('schedule_enabled,schedule_time,message').eq('user_id', userId).single();
    console.log('[patchSettings] confirmed in DB:', JSON.stringify(check));
  }

  if (patch.friends !== undefined) {
    const { error: delErr } = await sb.from('friends').delete().eq('user_id', userId);
    if (delErr) throw new Error(`friends delete: ${delErr.message}`);
    if (patch.friends.length > 0) {
      const { error: insErr } = await sb.from('friends').insert(
        patch.friends.map(({ name, handle, active }) => ({ user_id: userId, name, handle, active }))
      );
      if (insErr) throw new Error(`friends insert: ${insErr.message}`);
    const { data: fcheck } = await sb.from('friends').select('name,handle').eq('user_id', userId);
    console.log('[patchSettings] friends in DB:', JSON.stringify(fcheck));
    }
  }
}

export async function getCookies(userId: string): Promise<object[] | null> {
  const { data } = await serverSupabase().from('settings').select('tiktok_cookies').eq('user_id', userId).single();
  return data?.tiktok_cookies ?? null;
}

export async function setCookies(userId: string, cookies: object[]) {
  const sb = serverSupabase();
  // Update if row exists, otherwise insert with safe defaults
  const { data: existing } = await sb.from('settings').select('user_id').eq('user_id', userId).single();
  if (existing) {
    await sb.from('settings').update({ tiktok_cookies: cookies }).eq('user_id', userId);
  } else {
    await sb.from('settings').insert({
      user_id: userId,
      tiktok_cookies: cookies,
      schedule_enabled: false,
      schedule_time: '09:00',
      message: '🐿️🐿️🐿️',
    });
  }
}

export async function getLogs(userId: string): Promise<LogEntry[]> {
  const { data } = await serverSupabase()
    .from('logs').select('*').eq('user_id', userId)
    .order('ts', { ascending: false }).limit(50);
  return (data ?? []).map(r => ({
    id: r.id, ts: new Date(r.ts).getTime(),
    ok: r.ok, sent: r.sent, total: r.total, detail: r.detail ?? undefined,
  }));
}

export async function addLog(userId: string, entry: Omit<LogEntry, 'id' | 'ts'>) {
  await serverSupabase().from('logs').insert({ user_id: userId, ts: new Date().toISOString(), ...entry });
}

// Called by cron every minute — returns users whose schedule fires right now
export async function getScheduledUsers() {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const { data } = await serverSupabase()
    .from('settings').select('user_id, tiktok_cookies')
    .eq('schedule_enabled', true).eq('schedule_time', time);
  return data ?? [];
}
