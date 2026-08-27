"use client";

import { signIn, signOut } from "next-auth/react";
import { useState } from "react";

import { Button, buttonClass } from "@/components/ui";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/" })}
      className={buttonClass("outline", "sm")}
    >
      Sign out
    </button>
  );
}

export function GoogleSignInButton({
  callbackUrl = "/dashboard",
  label = "Continue with Google",
}: {
  callbackUrl?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      size="lg"
      variant="secondary"
      disabled={pending}
      className="w-full"
      onClick={() => {
        setPending(true);
        void signIn("google", { callbackUrl });
      }}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2.1H12Z"
        />
        <path
          fill="#34A853"
          d="M6.6 14.3 5.9 15l-2.5 2A9.9 9.9 0 0 0 12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1a6 6 0 0 1-5.4-3.8Z"
        />
        <path
          fill="#4A90E2"
          d="M3.4 7A9.9 9.9 0 0 0 2 12c0 1.8.4 3.5 1.4 5l3.2-2.5A6 6 0 0 1 6.3 12c0-.5.1-1 .3-1.5L3.4 7Z"
        />
        <path
          fill="#FBBC05"
          d="M12 6.2c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a9.9 9.9 0 0 0-8.6 5l3.2 2.5A6 6 0 0 1 12 6.2Z"
        />
      </svg>
      {pending ? "Redirecting…" : label}
    </Button>
  );
}

/**
 * Development-only sign-in. The backing credentials provider is disabled in
 * production builds, so this is safe to ship behind the same flag.
 */
export function DevSignInForm({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void signIn("dev-login", { email, callbackUrl });
      }}
    >
      <label htmlFor="dev-email" className="block text-sm font-medium text-ink">
        Development sign-in
      </label>
      <input
        id="dev-email"
        name="email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm"
      />
      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in without Google"}
      </Button>
    </form>
  );
}
