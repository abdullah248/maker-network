import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  accountType: "CUSTOMER" | "MAKERSPACE" | "INDIVIDUAL";
  onboarded: boolean;
  profileId: string | null;
  profileSlug: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

/** Server-component guard: redirects anonymous visitors to sign in. */
export async function requireSessionUser(callbackUrl = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return user;
}
