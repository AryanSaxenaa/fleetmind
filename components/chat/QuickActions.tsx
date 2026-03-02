"use client";

import { Sunrise, Shield, Fuel, Wrench, Dna } from "lucide-react";

const actions = [
  {
    icon: Sunrise,
    label: "Morning Briefing",
    prompt: "Give me a morning briefing for today",
  },
  {
    icon: Shield,
    label: "Safety",
    prompt: "Show me driver safety rankings this week",
  },
  {
    icon: Fuel,
    label: "Fuel Waste",
    prompt: "Any fuel waste or idle anomalies this week?",
  },
  {
    icon: Wrench,
    label: "Maintenance",
    prompt: "What maintenance is overdue or upcoming?",
  },
  {
    icon: Dna,
    label: "Driver DNA",
    prompt: "Show me Driver DNA profiles for my top 5 drivers",
  },
];

export function QuickActions({
  onAction,
}: {
  onAction: (prompt: string) => void;
}) {
  return (
    <nav
      aria-label="Quick actions"
      className="px-6 md:px-10 py-2 flex gap-2 overflow-x-auto border-t border-border"
    >
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => onAction(a.prompt)}
          aria-label={`Ask: ${a.prompt}`}
          className="whitespace-nowrap text-xs gap-1.5 shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg border border-border bg-white text-primary/70 hover:bg-cream hover:text-primary transition-all font-medium"
        >
          <a.icon className="h-3.5 w-3.5" aria-hidden="true" />
          {a.label}
        </button>
      ))}
    </nav>
  );
}
