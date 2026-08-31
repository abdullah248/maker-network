import type { Metadata } from "next";
import Link from "next/link";

import { Card, EmptyState } from "@/components/ui";
import { DirectoryFilters } from "@/components/public/directory-filters";
import { ProfileCard } from "@/components/public/profile-card";
import { parseSearchParams, searchProfiles } from "@/lib/services/search";
import type { SearchParams } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Browse makers",
  description:
    "Search makerspaces, libraries and individual makers with 3D printers, laser cutters, CNC machines and more.",
};

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Rebuilds a query string for pagination, preserving active filters. */
function buildQuery(params: SearchParams, page: number): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.type) query.set("type", params.type);
  if (params.category) query.set("category", params.category);
  if (params.material) query.set("material", params.material);
  if (params.city) query.set("city", params.city);
  if (params.shipping) query.set("shipping", "true");
  if (params.acceptingOnly) query.set("acceptingOnly", "true");
  if (params.perPage !== 12) query.set("perPage", String(params.perPage));
  if (page > 1) query.set("page", String(page));
  const str = query.toString();
  return str ? `/browse?${str}` : "/browse";
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const sp = await searchParams;
  const params = parseSearchParams(sp);
  const result = await searchProfiles(params);

  const start = (result.page - 1) * result.perPage + 1;
  const end = Math.min(result.total, result.page * result.perPage);
  const hasPrev = result.page > 1;
  const hasNext = result.page < result.pageCount;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Browse makers</h1>
        <p className="mt-1 text-ink-muted">
          {result.total > 0
            ? `${result.total} maker${result.total === 1 ? " matches" : "s match"} your search.`
            : "Adjust your filters to find makers near you."}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside aria-label="Filters">
          <Card className="lg:sticky lg:top-24">
            <DirectoryFilters params={params} />
          </Card>
        </aside>

        <section aria-label="Results">
          {result.items.length === 0 ? (
            <EmptyState
              title="No makers found"
              description="Try removing a filter or searching a nearby city."
              action={
                <Link
                  href="/browse"
                  className="text-sm font-semibold text-ember-600 hover:text-ember-700"
                >
                  Clear filters
                </Link>
              }
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((profile) => (
                  <ProfileCard key={profile.id} profile={profile} />
                ))}
              </div>

              <nav
                aria-label="Pagination"
                className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-4"
              >
                <p className="text-sm text-ink-muted">
                  Showing {start}–{end} of {result.total}
                </p>
                <div className="flex items-center gap-2">
                  {hasPrev ? (
                    <Link
                      href={buildQuery(params, result.page - 1)}
                      rel="prev"
                      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-line px-3 py-2 text-sm text-ink-muted/50">
                      Previous
                    </span>
                  )}
                  <span className="text-sm text-ink-muted">
                    Page {result.page} of {result.pageCount}
                  </span>
                  {hasNext ? (
                    <Link
                      href={buildQuery(params, result.page + 1)}
                      rel="next"
                      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
                    >
                      Next
                    </Link>
                  ) : (
                    <span className="rounded-lg border border-line px-3 py-2 text-sm text-ink-muted/50">
                      Next
                    </span>
                  )}
                </div>
              </nav>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
