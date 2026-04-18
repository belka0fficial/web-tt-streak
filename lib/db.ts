import { serverSupabase } from './supabase';

export interface Friend { id: string; name: string; handle: string; active: boolean; }
export interface Settings {
  schedule: { enabled: boolean; time: string };
  timezone: string;
  friends: Friend[];
  message: string;
}
export interface LogEntry { id: string; ts: number; ok: boolean; sent: number; total: number; detail?: string; }

export const DEFAULT_SETTINGS: Settings = {
  schedule: { enabled: false, time: '09:00' },
  timezone: 'UTC',
  friends: [],
  message: '🐿️🐿️🐿️',
};

export async function getSettings(userId: string): Promise<Settings> {
  const sb = serverSupabase();
  const [{ data: s, error: sErr }, { data: friends, error: fErr }] = await Promise.all([
    sb.from('settings').select('*').eq('user_id', userId).single(),
    sb.from('friends').select('*').eq('user_id', userId),
  ]);
  if (sErr) console.error('[getSettings] settings error:', sErr.message);
  if (fErr) console.error('[getSettings] friends error:', fErr.message);
  if (!s) return {
    ...DEFAULT_SETTINGS,
    friends: (friends ?? []).map(f => ({ id: f.id, name: f.name, handle: f.handle, active: f.active })),
  };
  return {
    schedule: { enabled: s.schedule_enabled, time: s.schedule_time },
    timezone: s.timezone ?? 'UTC',
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
      timezone:         patch.timezone          ?? cur?.timezone         ?? 'UTC',
      message:          patch.message           ?? cur?.message          ?? '🐿️🐿️🐿️',
      tiktok_cookies:   cur?.tiktok_cookies     ?? null,
    };
    const { error } = await sb.from('settings').upsert(row, { onConflict: 'user_id' });
    if (error) throw new Error(`settings: ${error.message}`);
  }

  if (patch.friends !== undefined) {
    const { error: delErr } = await sb.from('friends').delete().eq('user_id', userId);
    if (delErr) throw new Error(`friends delete: ${delErr.message}`);
    if (patch.friends.length > 0) {
      const { error: insErr } = await sb.from('friends').insert(
        patch.friends.map(({ name, handle, active }) => ({ user_id: userId, name, handle, active }))
      );
      if (insErr) throw new Error(`friends insert: ${insErr.message}`);
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

// Called by cron every minute — returns users whose schedule fires right now (in their timezone)
export async function getScheduledUsers() {
  const { data } = await serverSupabase()
    .from('settings').select('user_id, tiktok_cookies, schedule_time, timezone')
    .eq('schedule_enabled', true);
  if (!data) return [];

  const now = new Date();
  return data.filter(u => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: u.timezone || 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const hour   = parts.find(p => p.type === 'hour')?.value   ?? '00';
      const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
      return `${hour}:${minute}` === u.schedule_time;
    } catch {
      return false;
    }
  });
}
