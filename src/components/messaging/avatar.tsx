import { initials } from "@/lib/format";
import { cn } from "@/components/ui";

export function Avatar({
  name,
  image,
  size = 40,
  className,
}: {
  name: string;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const dimension = { width: size, height: size };
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        style={dimension}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={dimension}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-blueprint-100 text-sm font-semibold text-blueprint-700",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
