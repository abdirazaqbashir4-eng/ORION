import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  MessagesSquare,
  Sunrise,
  LineChart,
  Mail,
  ListChecks,
  Activity,
  Settings,
} from "lucide-react";

export const siteConfig = {
  name: "ORION",
  fullName: "ORION AI OS",
  tagline: "Your Intelligent Operating System.",
  description:
    "A personal AI operating system for work, business, learning, automation, and daily life.",
};

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const navItems: NavItem[] = [
  {
    title: "Command Center",
    href: "/",
    icon: LayoutDashboard,
    description: "Unified overview of every ORION module.",
  },
  {
    title: "AI Chat",
    href: "/chat",
    icon: MessagesSquare,
    description: "Real-time conversation with ORION.",
  },
  {
    title: "Daily Briefing",
    href: "/briefing",
    icon: Sunrise,
    description: "Emails, revenue, calendar, news, and priorities.",
  },
  {
    title: "Business",
    href: "/business",
    icon: LineChart,
    description: "Revenue, expenses, profit, and growth metrics.",
  },
  {
    title: "Email Center",
    href: "/email",
    icon: Mail,
    description: "Inbox summary and suggested replies.",
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ListChecks,
    description: "Tasks, automations, and agent activity.",
  },
  {
    title: "System",
    href: "/system",
    icon: Activity,
    description: "Agent health, API status, and logs.",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Integrations, preferences, and security.",
  },
];
