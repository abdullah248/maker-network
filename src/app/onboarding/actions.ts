"use server";

import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/session";
import { completeOnboarding } from "@/lib/services/profiles";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/constants";

export async function completeOnboardingAction(formData: FormData) {
  const user = await requireSessionUser("/onboarding");

  const raw = formData.get("accountType");
  const accountType = ACCOUNT_TYPES.includes(raw as AccountType)
    ? (raw as AccountType)
    : "CUSTOMER";

  await completeOnboarding(user.id, { accountType });

  redirect(accountType === "CUSTOMER" ? "/browse" : "/dashboard");
}
