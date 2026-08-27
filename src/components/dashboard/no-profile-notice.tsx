import Link from "next/link";

import { buttonClass, EmptyState } from "@/components/ui";

export function NoProfileNotice({ feature }: { feature: string }) {
  return (
    <EmptyState
      title="Create your profile first"
      description={`You need a maker profile before you can add ${feature}.`}
      action={
        <Link href="/dashboard/profile" className={buttonClass("primary", "md")}>
          Create your profile
        </Link>
      }
    />
  );
}
