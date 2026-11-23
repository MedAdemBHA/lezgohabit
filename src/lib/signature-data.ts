import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MOODS } from "./signature-rules";
export type Capsule = {
  sealed: boolean;
  locked?: boolean;
  opens_on?: string;
  body?: string;
  audio_url?: string | null;
};
export type Signature = {
  today: string;
  hour: number;
  day: number;
  length: number;
  closed: boolean;
  tomorrow: string | null;
  capsule: Capsule;
  seen: string[];
  previous_streak: number;
  missed: number;
  days_done: number;
  trophy: boolean;
  reminder_due: boolean;
  closes: { day: string; mood: (typeof MOODS)[number]; tomorrow: string }[];
  crew: { id: string; handle: string; name: string; avatar_url: string | null; day: number }[];
};
export const signatureQuery = (uid: string, sid: string) =>
  queryOptions({
    queryKey: ["signature", uid, sid],
    queryFn: async () => {
      const r = await supabase.rpc("signature_overview", { _season_id: sid });
      if (r.error) throw r.error;
      return r.data as unknown as Signature;
    },
    refetchInterval: 30000,
  });
