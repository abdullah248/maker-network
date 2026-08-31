import type { Metadata } from "next";
import Link from "next/link";

import { buttonClass, Card, SectionHeading } from "@/components/ui";
import { ProfileCard } from "@/components/public/profile-card";
import {
  ArrowIcon,
  BoxIcon,
  PrinterIcon,
  SearchIcon,
  SparkIcon,
  TruckIcon,
} from "@/components/public/icons";
import {
  MACHINE_CATEGORIES,
  MACHINE_CATEGORY_LABELS,
  type MachineCategory,
} from "@/lib/constants";
import { directoryStats, parseSearchParams, searchProfiles } from "@/lib/services/search";

export const metadata: Metadata = {
  title: "Find a 3D printer or laser cutter near you",
  description:
    "Maker Network connects you with makerspaces, libraries and individual makers who have the 3D printers, laser cutters and CNC machines to bring your project to life.",
};

const AUDIENCES = [
  {
    title: "I need something made",
    body: "Browse local makers, compare machines and materials, and send a request in minutes.",
    href: "/browse",
    cta: "Browse makers",
    Icon: BoxIcon,
    tone: "ember" as const,
  },
  {
    title: "We're a makerspace or library",
    body: "List your machines, materials and open hours so the public can find and book time.",
    href: "/signin?intent=provider",
    cta: "List your space",
    Icon: SparkIcon,
    tone: "blueprint" as const,
  },
  {
    title: "I own machines",
    body: "Turn your 3D printer or laser cutter into a side hustle with local pickup or shipping.",
    href: "/signin?intent=provider",
    cta: "Start earning",
    Icon: PrinterIcon,
    tone: "clay" as const,
  },
];

const STEPS = [
  {
    title: "Find a maker",
    body: "Search by machine, material or city to find someone nearby with the right setup.",
    Icon: SearchIcon,
  },
  {
    title: "Send a request",
    body: "Share your files, quantity and deadline. Message directly to agree on details and price.",
    Icon: SparkIcon,
  },
  {
    title: "Pick it up or get it shipped",
    body: "Collect locally or have it shipped to your door once your project is done.",
    Icon: TruckIcon,
  },
];

const FEATURED_TONES: Record<string, string> = {
  ember: "bg-ember-50 text-ember-700",
  blueprint: "bg-blueprint-50 text-blueprint-700",
  clay: "bg-clay-100 text-clay-600",
};

export default async function HomePage() {
  const [stats, featured] = await Promise.all([
    directoryStats(),
    searchProfiles(parseSearchParams({ perPage: 6 })),
  ]);

  const numberFmt = new Intl.NumberFormat("en-US");

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-canvas">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-muted">
              <SparkIcon className="h-4 w-4 text-ember-500" />
              Makerspaces, libraries &amp; independent makers in one place
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Find a 3D printer or laser cutter{" "}
              <span className="text-ember-600">near you</span>.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-ink-muted">
              Whether you need a single prototype or a hundred parts, Maker Network connects
              you with the machines, materials and people who can make it — down the street or
              shipped to your door.
            </p>

            <form
              action="/browse"
              method="get"
              role="search"
              aria-label="Search makers"
              className="mt-8 flex w-full max-w-2xl flex-col gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm sm:flex-row"
            >
              <div className="flex flex-1 items-center gap-2 px-2">
                <SearchIcon className="h-5 w-5 shrink-0 text-ink-muted" />
                <label htmlFor="hero-q" className="sr-only">
                  What do you want to make?
                </label>
                <input
                  id="hero-q"
                  name="q"
                  type="search"
                  placeholder="What do you want to make?"
                  className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/70"
                />
              </div>
              <label htmlFor="hero-category" className="sr-only">
                Machine type
              </label>
              <select
                id="hero-category"
                name="category"
                defaultValue=""
                className="h-11 rounded-lg border border-line bg-surface px-3 text-sm text-ink sm:w-52"
              >
                <option value="">Any machine</option>
                {MACHINE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {MACHINE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              <button type="submit" className={buttonClass("primary", "lg", "shrink-0")}>
                Search
              </button>
            </form>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="text-sm text-ink-muted">Makers listed</dt>
                <dd className="text-2xl font-semibold text-ink">
                  {numberFmt.format(stats.profiles)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Machines available</dt>
                <dd className="text-2xl font-semibold text-ink">
                  {numberFmt.format(stats.machines)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Materials in stock</dt>
                <dd className="text-2xl font-semibold text-ink">
                  {numberFmt.format(stats.materials)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="For everyone"
          title="Built for both sides of the workbench"
          description="However you approach making, there's a place for you here."
        />
        <div className="grid gap-5 md:grid-cols-3">
          {AUDIENCES.map(({ title, body, href, cta, Icon, tone }) => (
            <Card key={title} className="flex flex-col gap-4">
              <span
                aria-hidden
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${FEATURED_TONES[tone]}`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="text-lg font-semibold text-ink">{title}</h3>
              <p className="flex-1 text-sm text-ink-muted">{body}</p>
              <Link
                href={href}
                className="inline-flex items-center gap-1 text-sm font-semibold text-ember-600 hover:text-ember-700"
              >
                {cta}
                <ArrowIcon className="h-4 w-4" />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface-muted/50">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="How it works"
            title="From idea to object in three steps"
            action={
              <Link href="/how-it-works" className={buttonClass("outline", "sm")}>
                Learn more
              </Link>
            }
          />
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map(({ title, body, Icon }, index) => (
              <li key={title}>
                <Card className="h-full">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-ember-500 text-sm font-bold text-white"
                    >
                      {index + 1}
                    </span>
                    <Icon className="h-6 w-6 text-ink-muted" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Featured */}
      {featured.items.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Featured"
            title="Recently listed makers"
            action={
              <Link href="/browse" className={buttonClass("outline", "sm")}>
                View all
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Category strip */}
      <section className="border-t border-line bg-surface-muted/50">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Browse by machine" title="What do you want to use?" />
          <ul className="flex flex-wrap gap-3">
            {MACHINE_CATEGORIES.map((category) => (
              <li key={category}>
                <Link
                  href={`/browse?category=${category as MachineCategory}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink transition-colors hover:border-ember-200 hover:bg-ember-50"
                >
                  <PrinterIcon className="h-4 w-4 text-ember-500" />
                  {MACHINE_CATEGORY_LABELS[category]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center sm:px-12">
          <div className="bg-grid absolute inset-0 opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">
              Ready to make something?
            </h2>
            <p className="mt-3 text-lg text-white/70">
              Search hundreds of machines near you, or list your own to reach makers in your
              community.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/browse" className={buttonClass("primary", "lg")}>
                Browse makers
              </Link>
              <Link
                href="/signin?intent=provider"
                className={buttonClass("outline", "lg", "border-white/20 bg-transparent text-white hover:bg-white/10")}
              >
                List your machines
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
