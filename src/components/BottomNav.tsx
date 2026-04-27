import { Link, useLocation } from "@tanstack/react-router";
import { Home, Plus, User, Compass, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const items = [
    {
      to: "/feed" as const,
      icon: Home,
      label: "Feed",
      match: (p: string) => p === "/feed" || p.startsWith("/post"),
    },
    {
      to: "/discover" as const,
      icon: Compass,
      label: "Discover",
      match: (p: string) => p.startsWith("/discover") || p.startsWith("/u/"),
    },
    {
      to: "/upload" as const,
      icon: Plus,
      label: "Post",
      match: (p: string) => p === "/upload",
      primary: true,
    },
    {
      to: "/messages" as const,
      icon: Inbox,
      label: "Inbox",
      match: (p: string) => p.startsWith("/messages"),
    },
    {
      to: "/profile" as const,
      icon: User,
      label: "You",
      match: (p: string) => p === "/profile" || p.startsWith("/profile"),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto grid max-w-2xl grid-cols-5 items-start px-2 pt-2 pb-[env(safe-area-inset-bottom,0px)]">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.match(path);
          if (item.primary) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-start"
              >
                <span className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95">
                  <Icon size={26} strokeWidth={2.5} />
                </span>
                <span className="label-tape mt-1 text-muted-foreground">{item.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-start gap-1 pt-1 pb-3 transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={22} />
              <span className="label-tape">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
