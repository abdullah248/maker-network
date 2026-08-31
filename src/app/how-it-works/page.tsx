import type { Metadata } from "next";
import Link from "next/link";

import { buttonClass, Card, SectionHeading } from "@/components/ui";
import {
  BoxIcon,
  CheckIcon,
  PrinterIcon,
  SearchIcon,
  SparkIcon,
  TruckIcon,
} from "@/components/public/icons";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Learn how Maker Network connects customers with makerspaces, libraries and individual makers.",
};

const CUSTOMER_STEPS = [
  {
    title: "Search for a maker",
    body: "Filter by machine, material, city and fulfilment to find the right fit near you.",
    Icon: SearchIcon,
  },
  {
    title: "Send a request or message",
    body: "Share your files, quantity and deadline, then chat to agree on the details and price.",
    Icon: SparkIcon,
  },
  {
    title: "Collect or ship",
    body: "Pick up locally at a makerspace or have an individual maker ship it to you.",
    Icon: TruckIcon,
  },
];

const PROVIDER_STEPS = [
  {
    title: "Create your profile",
    body: "Add your machines, materials with pricing, hours and access rules.",
    Icon: PrinterIcon,
  },
  {
    title: "Publish and get found",
    body: "Appear in the directory so nearby customers can discover what you offer.",
    Icon: BoxIcon,
  },
  {
    title: "Respond to requests",
    body: "Accept, decline or discuss requests, and manage your availability calendar.",
    Icon: CheckIcon,
  },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="mb-12 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ember-600">
          How it works
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          Making things, made simple
        </h1>
        <p className="mt-3 text-lg text-ink-muted">
          Maker Network is a directory and messaging layer that connects people who need
          something fabricated with the machines and makers who can help.
        </p>
      </header>

      <section className="mb-14">
        <SectionHeading eyebrow="For customers" title="Get something made" />
        <ol className="grid gap-5 md:grid-cols-3">
          {CUSTOMER_STEPS.map(({ title, body, Icon }, index) => (
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
        <div className="mt-6">
          <Link href="/browse" className={buttonClass("primary", "md")}>
            Browse makers
          </Link>
        </div>
      </section>

      <section className="mb-14">
        <SectionHeading eyebrow="For providers" title="List your machines" />
        <ol className="grid gap-5 md:grid-cols-3">
          {PROVIDER_STEPS.map(({ title, body, Icon }, index) => (
            <li key={title}>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-blueprint-500 text-sm font-bold text-white"
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
        <div className="mt-6">
          <Link href="/signin?intent=provider" className={buttonClass("secondary", "md")}>
            List your machines
          </Link>
        </div>
      </section>

      <Card className="bg-surface-muted/50">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Meeting in person?</h2>
            <p className="text-sm text-ink-muted">
              Read our safety tips before you travel to a makerspace or maker.
            </p>
          </div>
          <Link href="/safety" className={buttonClass("outline", "md", "shrink-0")}>
            Read safety tips
          </Link>
        </div>
      </Card>
    </div>
  );
}
