import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert, Card } from "@/components/ui";
import { DevSignInForm, GoogleSignInButton } from "@/components/auth-buttons";
import { SparkIcon } from "@/components/public/icons";
import { devLoginEnabled, googleConfigured } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { safeCallbackUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Maker Network to send requests, message makers and list your machines.",
};

type RawSearchParams = Record<string, string | string[] | undefined>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const intentRaw = Array.isArray(sp.intent) ? sp.intent[0] : sp.intent;
  const isProvider = intentRaw === "provider";
  // Someone arriving via "List your machines" should land on the account-type
  // picker, not a generic dashboard.
  const callbackUrl = safeCallbackUrl(sp.callbackUrl, isProvider ? "/onboarding" : "/dashboard");

  const user = await getSessionUser();
  if (user) redirect(callbackUrl);

  const hasGoogle = googleConfigured();
  const hasDev = devLoginEnabled();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ember-500 text-white"
        >
          <SparkIcon className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {isProvider ? "List your machines" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {isProvider
            ? "Sign in to create your maker profile and start receiving requests from your community."
            : "Sign in to send requests, message makers and track your projects."}
        </p>
      </div>

      <Card className="space-y-4">
        {hasGoogle ? (
          <GoogleSignInButton
            callbackUrl={callbackUrl}
            label={isProvider ? "Continue with Google" : "Continue with Google"}
          />
        ) : (
          <Alert tone="info" title="Google sign-in unavailable">
            Google OAuth isn&apos;t configured on this deployment yet.
            {hasDev ? " Use the development sign-in below." : ""}
          </Alert>
        )}

        {hasGoogle && hasDev ? (
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        ) : null}

        {hasDev ? <DevSignInForm callbackUrl={callbackUrl} /> : null}
      </Card>

      <p className="mt-6 text-center text-xs text-ink-muted">
        By continuing you agree to our community guidelines. Review our{" "}
        <Link href="/safety" className="font-medium text-blueprint-600 hover:underline">
          safety tips
        </Link>{" "}
        before meeting makers in person.
      </p>
    </div>
  );
}
