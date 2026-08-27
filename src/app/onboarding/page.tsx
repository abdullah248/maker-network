import type { Metadata } from "next";

import { Button, Card } from "@/components/ui";
import { BoxIcon, PrinterIcon, SparkIcon } from "@/components/public/icons";
import { requireSessionUser } from "@/lib/session";
import { completeOnboardingAction } from "./actions";

export const metadata: Metadata = {
  title: "Get started",
  description: "Tell us how you'll use Maker Network.",
};

const OPTIONS = [
  {
    accountType: "CUSTOMER",
    title: "I'm looking to get something made",
    body: "Browse makers, compare machines and materials, and send print requests.",
    cta: "Start browsing",
    Icon: BoxIcon,
    tone: "bg-ember-50 text-ember-700",
  },
  {
    accountType: "MAKERSPACE",
    title: "We're a makerspace or library",
    body: "List machines, materials, hours and access rules so the public can book time.",
    cta: "Set up our space",
    Icon: SparkIcon,
    tone: "bg-blueprint-50 text-blueprint-700",
  },
  {
    accountType: "INDIVIDUAL",
    title: "I own machines",
    body: "Offer your 3D printer or laser cutter for local pickup or shipping.",
    cta: "Set up my profile",
    Icon: PrinterIcon,
    tone: "bg-clay-100 text-clay-600",
  },
] as const;

export default async function OnboardingPage() {
  await requireSessionUser("/onboarding");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          How will you use Maker Network?
        </h1>
        <p className="mt-2 text-ink-muted">
          Pick the option that fits best. You can always change this later.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        {OPTIONS.map(({ accountType, title, body, cta, Icon, tone }) => (
          <Card key={accountType} className="flex h-full flex-col gap-4">
            <span
              aria-hidden
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}
            >
              <Icon className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <p className="flex-1 text-sm text-ink-muted">{body}</p>
            <form action={completeOnboardingAction}>
              <input type="hidden" name="accountType" value={accountType} />
              <Button type="submit" variant="outline" className="w-full">
                {cta}
              </Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
