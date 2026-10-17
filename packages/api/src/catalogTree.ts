import type { Category } from "./catalog";

/**
 * The catalog is a three-level tree stored flat in `categories` (parent_id):
 * department -> category -> subcategory (shelf). These helpers turn the flat list the
 * apps already fetch into that tree, so screens never need extra queries to navigate.
 */
export interface CategoryNode extends Category {
  children: CategoryNode[];
  depth: number;
}

export const buildCategoryTree = (categories: Category[]): CategoryNode[] => {
  const nodes = new Map<string, CategoryNode>(categories.map((c) => [c.id, { ...c, children: [], depth: 0 }]));
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else if (!node.parent_id) roots.push(node);
  }
  const sort = (list: CategoryNode[], depth: number) => {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const n of list) {
      n.depth = depth;
      sort(n.children, depth + 1);
    }
  };
  sort(roots, 0);
  return roots;
};

export const findCategory = (tree: CategoryNode[], slug: string): CategoryNode | undefined => {
  for (const n of tree) {
    if (n.slug === slug) return n;
    const hit = findCategory(n.children, slug);
    if (hit) return hit;
  }
  return undefined;
};

/** Ancestors from the department down to the node itself. */
export const categoryPath = (tree: CategoryNode[], slug: string): CategoryNode[] => {
  for (const n of tree) {
    if (n.slug === slug) return [n];
    const rest = categoryPath(n.children, slug);
    if (rest.length) return [n, ...rest];
  }
  return [];
};

/** The node and every category below it (ids), for "All" listings. */
export const descendantIds = (node: CategoryNode): string[] => [node.id, ...node.children.flatMap(descendantIds)];

/** Emoji shown for a category without a photo: its own icon, else the nearest ancestor's. */
export const categoryIcon = (tree: CategoryNode[], slug: string): string => {
  const path = categoryPath(tree, slug);
  for (let i = path.length - 1; i >= 0; i--) if (path[i].icon) return path[i].icon!;
  return "🛍️";
};
