import { Badge } from "@/components/ui";

type GalleryMachine = {
  id: string;
  make: string;
  model: string;
  category: string;
};

export type GalleryItem = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  altText: string | null;
  materialUsed: string | null;
  featured: boolean;
  machine: GalleryMachine | null;
};

export function ProjectGallery({
  items,
  makerName,
}: {
  items: GalleryItem[];
  makerName: string;
}) {
  if (items.length === 0) return null;

  return (
    <>
      <span className="sr-only">Recent work by {makerName}</span>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <figure
            key={item.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(20,22,26,0.04)]"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-surface-muted">
              {/*
                These are arbitrary third-party image URLs. We deliberately render a
                plain <img> instead of next/image so the Next.js image optimizer does
                not fetch remote URLs server-side.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.altText || item.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
            <figcaption className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{item.title}</h3>
                {item.featured ? <Badge tone="ember">Featured</Badge> : null}
              </div>
              {item.description ? (
                <p className="text-sm text-ink-muted">{item.description}</p>
              ) : null}
              {item.machine || item.materialUsed ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {item.machine ? (
                    <Badge tone="blueprint">
                      {item.machine.make} {item.machine.model}
                    </Badge>
                  ) : null}
                  {item.materialUsed ? (
                    <Badge tone="moss">{item.materialUsed}</Badge>
                  ) : null}
                </div>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
