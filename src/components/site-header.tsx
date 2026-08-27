import Link from "next/link";

import { auth } from "@/lib/auth";
import { unreadMessageCount } from "@/lib/services/messaging";
import { initials } from "@/lib/format";
import { buttonClass } from "@/components/ui";
import { SignOutButton } from "@/components/auth-buttons";

const NAV_LINKS = [
  { href: "/browse", label: "Browse makers" },
  { href: "/browse?type=MAKERSPACE", label: "Makerspaces" },
  { href: "/how-it-works", label: "How it works" },
];

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const unread = user ? await unreadMessageCount(user.id) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember-500 text-sm font-bold text-white"
          >
            M
          </span>
          <span className="text-[15px]">Maker Network</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/messages"
                className="relative rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                Messages
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1 text-[11px] font-semibold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/dashboard"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink sm:block"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard"
                aria-label="Your account"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blueprint-100 text-sm font-semibold text-blueprint-700"
              >
                {initials(user.name ?? user.email)}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/signin" className={buttonClass("ghost", "sm")}>
                Sign in
              </Link>
              <Link href="/signin?intent=provider" className={buttonClass("primary", "sm")}>
                List your machines
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
