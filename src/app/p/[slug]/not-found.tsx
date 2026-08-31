import Link from "next/link";

import { buttonClass, EmptyState } from "@/components/ui";

export default function ProfileNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-24 sm:px-6 lg:px-8">
      <EmptyState
        title="Maker not found"
        description="This profile doesn't exist, or it hasn't been published yet."
        action={
          <Link href="/browse" className={buttonClass("primary", "md")}>
            Browse makers
          </Link>
        }
      />
    </div>
  );
}
