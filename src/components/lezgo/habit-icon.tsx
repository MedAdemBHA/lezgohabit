import { TrainIcon, RunIcon, LearnIcon, SleepIcon, SalatIcon, QuranIcon, DhikrIcon, DuaIcon, NoSugarIcon, WaterIcon, ThoughtIcon } from '@/components/icons';
const MAP = { dumbbell: TrainIcon, train: TrainIcon, footprints: RunIcon, run: RunIcon, book: LearnIcon, learn: LearnIcon, lightbulb: LearnIcon, moon: SleepIcon, sleep: SleepIcon, droplet: WaterIcon, water: WaterIcon, coffee: NoSugarIcon, 'no-sugar': NoSugarIcon, 'moon-star': SalatIcon, salat: SalatIcon, 'book-open': QuranIcon, quran: QuranIcon, sparkles: DhikrIcon, dhikr: DhikrIcon, dua: DuaIcon, thought: ThoughtIcon, 'phone-off': ThoughtIcon, plus: ThoughtIcon };
export function HabitIcon({ name, className }: { name?: string | null; className?: string }) {
 const Icon = name && name in MAP ? MAP[name as keyof typeof MAP] : ThoughtIcon;
 return <Icon className={className ?? 'size-5'} />;
}
