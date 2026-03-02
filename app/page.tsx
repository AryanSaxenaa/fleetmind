"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { FleetSidebar } from "@/components/fleet/FleetSidebar";
import { ExportButton } from "@/components/export/ExportButton";
import { CommandCenter } from "@/components/dashboard/CommandCenter";
import {
  Bell,
  Menu,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-cream">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <div
        className={`
          fixed lg:static top-0 left-0 bottom-0 z-40
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <FleetSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-cream">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 md:px-10 relative z-10 border-b border-border shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden size-10 rounded-lg border border-border flex items-center justify-center hover:bg-white transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5 text-primary" />
            </button>
            <div className="hidden md:block">
              <h2 className="text-sm font-semibold text-primary">Dashboard</h2>
              <p className="text-[10px] text-muted tracking-wide">AI Fleet Copilot</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExportButton />
            <Link
              href="/alerts"
              className="size-10 rounded-lg border border-border flex items-center justify-center hover:bg-white transition-colors group"
              aria-label="Alerts"
            >
              <Bell className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
            </Link>
            <div className="flex items-center gap-3 pl-3 border-l border-border">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-primary">
                  Fleet Manager
                </p>
                <p className="text-[10px] text-muted font-medium uppercase tracking-widest">
                  FleetMind v2
                </p>
              </div>
              <div className="size-10 rounded-lg bg-primary text-white flex items-center justify-center">
                <span className="text-sm font-bold">FM</span>
              </div>
            </div>
          </div>
        </header>

        {/* Hatched divider accent */}
        <div className="hatch-divider shrink-0" />

        {/* Chat + Command Center */}
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          <CommandCenter />
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
        </div>
      </main>


    </div>
  );
}
