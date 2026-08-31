"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui";

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/requests", label: "Requests" },
  { href: "/dashboard/profile", label: "Public profile" },
  { href: "/dashboard/machines", label: "Machines" },
  { href: "/dashboard/materials", label: "Materials" },
  { href: "/dashboard/reviews", label: "Reviews" },
  { href: "/dashboard/gallery", label: "Gallery" },
  { href: "/dashboard/hours", label: "Hours" },
  { href: "/dashboard/availability", label: "Availability" },
];

export function DashboardNav({ profileSlug }: { profileSlug: string | null }) {
  const pathname = usePathname();

  const secondary: NavItem[] = [
    { href: "/messages", label: "Messages", external: true },
  ];
  if (profileSlug) {
    secondary.push({ href: `/p/${profileSlug}`, label: "View public page", external: true });
  }

  return (
    <nav aria-label="Dashboard" className="space-y-6">
      <ul className="space-y-1">
        {PRIMARY.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-ember-50 text-ember-700"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line pt-4">
        <ul className="space-y-1">
          {secondary.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                {item.label}
                <span aria-hidden className="text-ink-muted/60">
                  ↗
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
