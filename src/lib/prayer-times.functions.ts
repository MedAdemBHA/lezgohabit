import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { PRAYERS } from './habits';
const responseSchema = z.object({ code: z.number(), data: z.object({ timings: z.record(z.string(), z.string()) }) });
export const getPrayerTimes = createServerFn({ method: 'GET' })
 .middleware([requireSupabaseAuth])
 .inputValidator((input: unknown) => z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input))
 .handler(async ({ data, context }) => {
  const { data: profile, error } = await context.supabase.from('profiles').select('city,country_code,timezone').eq('id', context.userId).single();
  if (error || !profile?.city?.trim()) return { times: null, status: 'missing_city' as const };
  const [year, month, day] = data.day.split('-');
  const url = new URL(`https://api.aladhan.com/v1/timingsByCity/${day}-${month}-${year}`);
  url.searchParams.set('city', profile.city); url.searchParams.set('country', profile.country_code);
  // Aladhan derives the city's local timezone; forcing it shifts timings incorrectly.
  if (profile.country_code === 'TN') url.searchParams.set('method','18');
  try {
   const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
   if (!response.ok) return { times: null, status: 'unavailable' as const };
   const body = responseSchema.parse(await response.json());
   if (body.code !== 200) return { times: null, status: 'unavailable' as const };
   const times: Record<string, string> = {};
   for (const name of PRAYERS) { const key = name.charAt(0).toUpperCase() + name.slice(1); const time = body.data.timings[key]?.match(/^\d{2}:\d{2}/)?.[0]; if (time) times[name] = time; }
   return { times, status: 'ready' as const };
  } catch { return { times: null, status: 'unavailable' as const }; }
 });
