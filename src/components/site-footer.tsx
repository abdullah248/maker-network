import Link from "next/link";

const COLUMNS = [
  {
    title: "For customers",
    links: [
      { href: "/browse", label: "Browse makers" },
      { href: "/browse?type=MAKERSPACE", label: "Find a makerspace" },
      { href: "/browse?shipping=true", label: "Makers who ship" },
      { href: "/how-it-works", label: "How it works" },
    ],
  },
  {
    title: "For makers",
    links: [
      { href: "/signin?intent=provider", label: "List your machines" },
      { href: "/dashboard", label: "Your dashboard" },
      { href: "/dashboard/availability", label: "Availability calendar" },
      { href: "/messages", label: "Requests inbox" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/how-it-works", label: "About" },
      { href: "/safety", label: "Trust & safety" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-semibold text-ink">
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember-500 text-sm font-bold text-white"
              >
                M
              </span>
              Maker Network
            </div>
            <p className="mt-3 max-w-xs text-sm text-ink-muted">
              The directory for shared fabrication. Find a machine, bring an idea, make the thing.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-semibold text-ink">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 border-t border-line pt-6 text-xs text-ink-muted">
          © {new Date().getFullYear()} Maker Network. Machines listed by their owners; always confirm
          access rules and pricing before travelling.
        </p>
      </div>
    </footer>
  );
}
