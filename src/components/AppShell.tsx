import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BottomNav } from "./BottomNav";
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
              Offcuts<span className="text-primary">.</span>
            </span>
          </Link>
          {!user && (
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
    </div>
  );
}
