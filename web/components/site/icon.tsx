import {
  Activity, Baby, Bone, Brain, Building2, CalendarCheck, Car, ConciergeBell, Droplet, Ear, Eye, FileSearch, Flower2, Footprints, Hand, HeartPulse, Hotel, Pill, Wind,
  Languages, Lock, MessageCircle, Plane, Receipt, Repeat, Ribbon, Route, Scale, ScanLine, Scissors, ShieldCheck, Smile,
  Sparkles, Stamp, Stethoscope, UserRound, UserRoundCheck, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  activity: Activity, baby: Baby, bone: Bone, brain: Brain, "building-2": Building2, "calendar-check": CalendarCheck,
  car: Car, "concierge-bell": ConciergeBell, "file-search": FileSearch, "flower-2": Flower2, "heart-pulse": HeartPulse,
  hotel: Hotel, languages: Languages, lock: Lock, "message-circle": MessageCircle, plane: Plane, receipt: Receipt,
  repeat: Repeat, ribbon: Ribbon, route: Route, scale: Scale, "scan-line": ScanLine, scissors: Scissors,
  "shield-check": ShieldCheck, smile: Smile, sparkles: Sparkles, stamp: Stamp, stethoscope: Stethoscope,
  "user-round": UserRound, "user-round-check": UserRoundCheck, droplet: Droplet, ear: Ear, eye: Eye, footprints: Footprints,
  hand: Hand, pill: Pill, wind: Wind,
};

export function Icon({ name, className }: { name?: string | null; className?: string }) {
  const C = (name && MAP[name]) || Stethoscope;
  return <C className={className} aria-hidden />;
}
