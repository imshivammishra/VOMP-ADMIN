import {
  Activity,
  BookOpen,
  Building2,
  FileText,
  Handshake,
  ImageIcon,
  Inbox,
  LayoutDashboard,
  MapPin,
  MessageSquareText,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavigationBadge = "enquiries" | "messages" | "partners";

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: NavigationBadge;
  description: string;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

/**
 * Single source of truth for the sidebar, topbar breadcrumbs and command menu.
 * Add a route here once and every navigation surface stays in sync.
 */
export const NAVIGATION: NavigationGroup[] = [
  {
    label: "Analytics",
    items: [
      {
        href: "/",
        label: "Overview",
        icon: LayoutDashboard,
        description: "Workspace pulse and performance",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/enquiries",
        label: "Enquiries",
        icon: MessageSquareText,
        badge: "enquiries",
        description: "Leads, pipeline and follow-ups",
      },
      {
        href: "/inbox",
        label: "Inbox",
        icon: Inbox,
        badge: "messages",
        description: "Live conversations",
      },
      {
        href: "/partners",
        label: "Partners",
        icon: Handshake,
        badge: "partners",
        description: "Venue owner applications",
      },
    ],
  },
  {
    label: "Website",
    items: [
      {
        href: "/website",
        label: "Page content",
        icon: FileText,
        description: "Homepage sections and copy",
      },
      {
        href: "/reviews",
        label: "Reviews",
        icon: Star,
        description: "Client stories and moderation",
      },
      {
        href: "/venues",
        label: "Venues",
        icon: Building2,
        description: "The public venue catalogue",
      },
      {
        href: "/destinations",
        label: "Destinations",
        icon: MapPin,
        description: "City guides and coverage",
      },
      {
        href: "/journal",
        label: "Journal",
        icon: BookOpen,
        description: "Editorial stories",
      },
      {
        href: "/media",
        label: "Media",
        icon: ImageIcon,
        description: "Images and films",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "/activity",
        label: "Activity",
        icon: Activity,
        description: "The workspace audit trail",
      },
      {
        href: "/team",
        label: "Team & access",
        icon: Users,
        description: "Roles and permissions",
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        description: "Identity, security and connections",
      },
    ],
  },
];

export const NAVIGATION_ITEMS = NAVIGATION.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label }))
);

export function routeMeta(pathname: string) {
  const item =
    NAVIGATION_ITEMS.find((entry) => entry.href === "/" ? pathname === "/" : pathname.startsWith(entry.href)) ||
    NAVIGATION_ITEMS[0];

  return {
    title: item.label,
    group: item.group,
    description: item.description,
    href: item.href,
  };
}
