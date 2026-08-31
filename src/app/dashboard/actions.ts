"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/session";
import { setPublished } from "@/lib/services/profiles";

export async function togglePublishedAction(formData: FormData) {
  const user = await requireSessionUser("/dashboard");
  const publish = formData.get("published") === "true";
  await setPublished(user.id, publish);
  revalidatePath("/dashboard");
}
