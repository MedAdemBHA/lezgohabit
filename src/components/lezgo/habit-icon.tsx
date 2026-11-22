import { BookOpen, Book, Coffee, Droplet, Dumbbell, Footprints, Lightbulb, Moon, MoonStar, PhoneOff, Plus, Sparkles, Star, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  dumbbell: Dumbbell, footprints: Footprints, book: Book, moon: Moon, droplet: Droplet, coffee: Coffee,
  "phone-off": PhoneOff, lightbulb: Lightbulb, "moon-star": MoonStar, "book-open": BookOpen, sparkles: Sparkles, plus: Plus,
};
export function HabitIcon({ name, className }: { name?: string | null; className?: string }) {
  const I = (name && MAP[name]) || Star;
  return <I strokeWidth={2.5} className={className ?? "size-5"} aria-hidden />;
}
