import Link from "next/link";

import { Button, Checkbox, Field, Input, Select } from "@/components/ui";
import {
  MACHINE_CATEGORIES,
  MACHINE_CATEGORY_LABELS,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  PROFILE_TYPES,
  PROFILE_TYPE_LABELS,
} from "@/lib/constants";
import type { SearchParams } from "@/lib/validation";

export function DirectoryFilters({ params }: { params: SearchParams }) {
  return (
    <form method="get" className="space-y-4" aria-label="Filter makers">
      <Field label="Keyword" htmlFor="q">
        <Input
          id="q"
          name="q"
          type="search"
          defaultValue={params.q ?? ""}
          placeholder="PLA, laser cutter, Prusa…"
        />
      </Field>

      <Field label="Provider type" htmlFor="type">
        <Select id="type" name="type" defaultValue={params.type ?? ""}>
          <option value="">Any provider</option>
          {PROFILE_TYPES.map((type) => (
            <option key={type} value={type}>
              {PROFILE_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Machine" htmlFor="category">
        <Select id="category" name="category" defaultValue={params.category ?? ""}>
          <option value="">Any machine</option>
          {MACHINE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {MACHINE_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Material" htmlFor="material">
        <Select id="material" name="material" defaultValue={params.material ?? ""}>
          <option value="">Any material</option>
          {MATERIAL_CATEGORIES.map((material) => (
            <option key={material} value={material}>
              {MATERIAL_CATEGORY_LABELS[material]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="City" htmlFor="city">
        <Input
          id="city"
          name="city"
          defaultValue={params.city ?? ""}
          placeholder="e.g. Portland"
        />
      </Field>

      <Field label="Minimum rating" htmlFor="minRating">
        <Select
          id="minRating"
          name="minRating"
          defaultValue={params.minRating ? String(params.minRating) : ""}
        >
          <option value="">Any rating</option>
          <option value="3">3+ stars</option>
          <option value="4">4+ stars</option>
          <option value="4.5">4.5+ stars</option>
        </Select>
      </Field>

      <Field label="Sort by" htmlFor="sort">
        <Select id="sort" name="sort" defaultValue={params.sort ?? "recent"}>
          <option value="recent">Most recent</option>
          <option value="rating">Highest rated</option>
        </Select>
      </Field>

      <div className="space-y-2">
        <Checkbox
          name="shipping"
          value="true"
          defaultChecked={Boolean(params.shipping)}
          label="Ships to me"
          description="Only makers offering shipping"
        />
        <Checkbox
          name="acceptingOnly"
          value="true"
          defaultChecked={Boolean(params.acceptingOnly)}
          label="Accepting requests only"
          description="Hide providers on pause"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" className="flex-1">
          Apply filters
        </Button>
        <Link
          href="/browse"
          className="text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}
