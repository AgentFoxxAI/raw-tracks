import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { AISearchWidget } from "./AISearchWidget";
import { useAuth } from "@/lib/auth-context";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/feed" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-black">
              ✂
            </span>
            <span className="text-lg font-bold tracking-tight">
              Offcuts<sup className="text-primary text-[0.55rem] font-bold ml-0.5">™</sup>
            </span>
          </Link>
          {user ? (
            <Link
              to="/messages"
              className="relative rounded-md border border-border bg-surface p-2 text-foreground hover:border-primary/50"
              aria-label="Messages"
            >
              <Inbox size={16} />
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
      {user && <BottomNav />}
      {user && <AISearchWidget />}
    </div>
  );
}
