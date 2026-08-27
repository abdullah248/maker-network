import { Badge } from "@/components/ui";
import { formatPrice, parseColorList } from "@/lib/format";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  type MaterialCategory,
} from "@/lib/constants";
import type { PublicProfile } from "@/lib/services/profiles";

type Material = PublicProfile["materials"][number];

function MaterialRow({ material }: { material: Material }) {
  const colors = parseColorList(material.colors);
  return (
    <div className="grid gap-2 border-t border-line py-3 sm:grid-cols-[1.6fr_1fr_auto] sm:items-start">
      <div className="min-w-0">
        <p className="font-medium text-ink">{material.name}</p>
        {material.brand ? (
          <p className="text-sm text-ink-muted">{material.brand}</p>
        ) : null}
        {material.specs ? (
          <p className="text-xs text-ink-muted">{material.specs}</p>
        ) : null}
        {colors.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {colors.map((color) => (
              <li
                key={color}
                className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted"
              >
                {color}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="text-sm">
        <p className="font-medium text-ink">{formatPrice(material.pricePerUnit, material.unit)}</p>
        {material.canCustomOrder ? (
          <p className="mt-1 text-xs text-moss-600">
            Can custom order
            {material.customOrderLeadDays
              ? ` (${material.customOrderLeadDays} day lead time)`
              : ""}
          </p>
        ) : null}
      </div>
      <div className="sm:text-right">
        {material.inStock ? (
          <Badge tone="moss">In stock</Badge>
        ) : (
          <Badge tone="neutral">Out of stock</Badge>
        )}
      </div>
    </div>
  );
}

export function MaterialTable({ materials }: { materials: Material[] }) {
  const grouped = MATERIAL_CATEGORIES.map((category) => ({
    category: category as MaterialCategory,
    items: materials.filter((material) => material.category === category),
  })).filter((group) => group.items.length > 0);

  if (grouped.length === 0) return null;

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.category}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {MATERIAL_CATEGORY_LABELS[group.category]}
          </h3>
          <div>
            {group.items.map((material) => (
              <MaterialRow key={material.id} material={material} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
