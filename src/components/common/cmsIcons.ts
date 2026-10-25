import {
  Award,
  Building,
  Building2,
  Clock,
  Handshake,
  KeyRound,
  Lightbulb,
  MessagesSquare,
  MousePointerClick,
  Search,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

/**
 * Lucide glyphs an admin can pick for a service, a process step, or a value.
 * The CMS stores the icon as a free-form string, so this is the allow-list and
 * the fallback in one place.
 */
export const CMS_ICONS: Record<string, LucideIcon> = {
  Award,
  Building,
  Building2,
  Clock,
  Handshake,
  KeyRound,
  Lightbulb,
  MessagesSquare,
  MousePointerClick,
  Search,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
  Warehouse,
};

const FALLBACK_ICON: LucideIcon = Building2;

/** Resolves an admin-authored icon name, never returning undefined. */
export function resolveCmsIcon(name: string | undefined, fallback: LucideIcon = FALLBACK_ICON): LucideIcon {
  if (!name) return fallback;
  return CMS_ICONS[name] ?? fallback;
}
