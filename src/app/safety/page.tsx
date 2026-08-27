import type { Metadata } from "next";
import Link from "next/link";

import { buttonClass, Card } from "@/components/ui";
import { CheckIcon } from "@/components/public/icons";

export const metadata: Metadata = {
  title: "Safety tips",
  description:
    "Stay safe on Maker Network: verify access rules, meet in public, protect your address and report problems.",
};

const TIPS = [
  {
    title: "Verify access rules before you travel",
    body: "Some makerspaces require an appointment, membership or a library card before you can use a machine. Confirm the requirements and hours directly with the provider so you're not turned away at the door.",
  },
  {
    title: "Meet in public places",
    body: "When picking up or dropping off a project with an individual maker, choose a public location such as the makerspace, a library or a busy café. Bring a friend if you can.",
  },
  {
    title: "Don't share your exact home address",
    body: "Maker Network only ever shows city-level locations. Keep it that way — arrange pickups in public and use shipping to a locker or workplace when you'd rather not share where you live.",
  },
  {
    title: "Keep payments and files sensible",
    body: "Agree on scope and price up front in messages. Be cautious with unusual payment requests, and avoid sending sensitive or proprietary files until you trust the maker.",
  },
  {
    title: "Report problems",
    body: "If someone behaves inappropriately, misrepresents their machines, or makes you feel unsafe, stop the conversation and report them so we can take action.",
  },
];

export default function SafetyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ember-600">
          Safety
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          Staying safe on Maker Network
        </h1>
        <p className="mt-3 text-lg text-ink-muted">
          Most makers are welcoming and helpful. A few simple habits keep every meetup and
          project safe for both sides.
        </p>
      </header>

      <ul className="space-y-4">
        {TIPS.map((tip) => (
          <li key={tip.title}>
            <Card className="flex gap-4">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-moss-100 text-moss-600"
              >
                <CheckIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-ink">{tip.title}</h2>
                <p className="mt-1 text-sm text-ink-muted">{tip.body}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-10 bg-surface-muted/50">
        <h2 className="text-lg font-semibold text-ink">Need to report something?</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Message the maker to resolve small issues, or reach out to us through your dashboard
          if you feel unsafe. Trust your instincts — if something feels off, walk away.
        </p>
        <div className="mt-4">
          <Link href="/how-it-works" className={buttonClass("outline", "md")}>
            Learn how it works
          </Link>
        </div>
      </Card>
    </div>
  );
}
