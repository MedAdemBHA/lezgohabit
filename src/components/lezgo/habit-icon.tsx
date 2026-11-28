import type { ComponentType } from "react";
import {
  TrainIcon,
  RunIcon,
  LearnIcon,
  SleepIcon,
  SalatIcon,
  QuranIcon,
  DhikrIcon,
  DuaIcon,
  NoSugarIcon,
  WaterIcon,
  ThoughtIcon,
  ProofIcon,
  ChaosIcon,
  BossIcon,
  StreakIcon,
  CrewIcon,
  LanguageIcon,
  type IconProps,
} from "@/components/icons";
import * as H from "@/components/icons/habit-icons";

type Icon = ComponentType<IconProps>;

/** One drawing per habit template key: no two live habits share an icon. */
export const HABIT_ICONS: Record<string, Icon> = {
  // body
  train: TrainIcon,
  steps: H.StepsIcon,
  steps10k: H.Steps10kIcon,
  run: RunIcon,
  water: WaterIcon,
  coffee: H.CoffeeIcon,
  cold_shower: H.ShowerIcon,
  wake_early: H.SunriseIcon,
  sleep_before_midnight: H.MidnightIcon,
  sleep7: SleepIcon,
  pushups: H.PushupIcon,
  plank: H.PlankIcon,
  stretch: H.StretchIcon,
  sunlight: H.SunIcon,
  custom: H.PlusIcon,
  // digital
  no_phone_first_hour: H.PhoneMorningIcon,
  screen_limit: H.ScreenTimeIcon,
  // faith
  salat: SalatIcon,
  quran: QuranIcon,
  dhikr: DhikrIcon,
  dua: DuaIcon,
  tasbih: H.TasbihIcon,
  // fuel
  no_sugar: NoSugarIcon,
  no_fast_food: H.FastFoodIcon,
  fruit_veg: H.AppleIcon,
  protein_meals: H.ProteinIcon,
  // life
  make_bed: H.BedIcon,
  tidy_10: H.BroomIcon,
  budget_day: H.WalletIcon,
  call_friend: H.CallIcon,
  // mind
  read: H.BookIcon,
  detox: H.PhoneOffIcon,
  learn: LearnIcon,
  learn15: H.GradCapIcon,
  journal: H.JournalIcon,
  no_social_noon: H.NoSocialIcon,
  study_blocks: H.FocusIcon,
  language_practice: LanguageIcon,
  meditation: H.LotusIcon,
  gratitude: H.HeartIcon,
  // quit
  energy_drink_free: H.EnergyCanIcon,
  smoke_free: H.SmokeFreeIcon,
  // archived (kept so old habits still render)
  sleep: H.MidnightIcon,
};

/** Legacy template `icon` names, for callers that only know the icon field. */
const BY_ICON: Record<string, Icon> = {
  dumbbell: TrainIcon,
  footprints: H.StepsIcon,
  book: H.BookIcon,
  lightbulb: LearnIcon,
  moon: SleepIcon,
  droplet: WaterIcon,
  "no-sugar": NoSugarIcon,
  "moon-star": SalatIcon,
  "book-open": QuranIcon,
  sparkles: DhikrIcon,
  thought: ThoughtIcon,
  "phone-off": H.PhoneOffIcon,
  plus: H.PlusIcon,
  proof: ProofIcon,
  chaos: ChaosIcon,
  boss: BossIcon,
  streak: StreakIcon,
  crew: CrewIcon,
};

/** Prefer the habit's key (unique drawing); fall back to the template's icon name. */
export function habitIconFor(habitKey?: string | null, name?: string | null): Icon {
  if (habitKey && habitKey in HABIT_ICONS) return HABIT_ICONS[habitKey]!;
  if (name && name in HABIT_ICONS) return HABIT_ICONS[name]!;
  if (name && name in BY_ICON) return BY_ICON[name]!;
  return ThoughtIcon;
}

export function HabitIcon({
  name,
  habitKey,
  className,
}: {
  name?: string | null | undefined;
  habitKey?: string | null | undefined;
  className?: string;
}) {
  const Icon = habitIconFor(habitKey, name);
  return <Icon className={className ?? "size-5"} />;
}
