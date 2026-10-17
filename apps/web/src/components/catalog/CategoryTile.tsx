"use client";

import type { CategoryNode } from "@ration/api";
import Image from "next/image";
import Link from "next/link";

/** Square tile with the category photo, or its icon while no photo is set. */
export function CategoryTile({ node, icon, href, label }: { node: Pick<CategoryNode, "slug" | "name" | "image_url">; icon: string; href?: string; label?: string }) {
  return (
    <Link href={href ?? `/category/${node.slug}`} className="group flex flex-col items-center gap-2 text-center">
      <span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-card bg-primary-tint transition group-hover:ring-2 group-hover:ring-primary-light">
        {node.image_url ? <Image src={node.image_url} alt="" fill sizes="(min-width: 1024px) 12vw, 25vw" className="object-cover" unoptimized /> : <span className="text-4xl" aria-hidden>{icon}</span>}
      </span>
      <span className="line-clamp-2 text-xs font-medium leading-tight">{label ?? node.name}</span>
    </Link>
  );
}
