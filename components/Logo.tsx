import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";
import { cn } from "@/lib/format";

/**
 * Official TR3S & CO. logo, rendered from the owner's original file without
 * any alteration. The artwork was designed on a light paper background, so on
 * the black UI it sits on a bone plate (the logo itself is untouched).
 */
export function Logo({
  size = 56,
  className,
  href = "/",
  priority,
}: {
  size?: number;
  className?: string;
  href?: string | null;
  priority?: boolean;
}) {
  const img = (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-bone", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={size > 200 ? site.logo.w640 : size > 90 ? site.logo.w320 : site.logo.w160}
        alt={site.logo.alt}
        width={size}
        height={size}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </span>
  );
  if (!href) return img;
  return (
    <Link href={href} aria-label={`${site.name} — inicio`} className="inline-flex">
      {img}
    </Link>
  );
}
