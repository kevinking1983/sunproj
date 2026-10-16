import type { Client } from "./client";

export interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
}

export interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  target_type: string | null;
  target_id: string | null;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  unit_label: string;
  mrp: number;
  /** Effective selling price for the current store (inventory override applied). */
  price: number;
  images: string[];
  is_veg: boolean | null;
  category_id: string;
  brand_name: string | null;
  /** Units available to sell at the current store. */
  available: number;
}

const PRODUCT_COLUMNS =
  "id, slug, name, description, unit_label, mrp, price, images, is_veg, category_id, brands(name), inventory!inner(store_id, quantity, reserved, price_override)";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  unit_label: string;
  mrp: number;
  price: number;
  images: string[];
  is_veg: boolean | null;
  category_id: string;
  brands: { name: string } | null;
  inventory: { store_id: string; quantity: number; reserved: number; price_override: number | null }[];
};

const toProduct = (r: ProductRow): Product => {
  const inv = r.inventory[0];
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    unit_label: r.unit_label,
    mrp: r.mrp,
    price: inv?.price_override ?? r.price,
    images: r.images ?? [],
    is_veg: r.is_veg,
    category_id: r.category_id,
    brand_name: r.brands?.name ?? null,
    available: inv ? Math.max(0, inv.quantity - inv.reserved) : 0,
  };
};

export const createCatalogApi = (client: Client) => ({
  categories: async (): Promise<Category[]> => {
    const { data, error } = await client.from("categories").select("id, parent_id, name, slug, image_url, sort_order").eq("is_active", true).order("sort_order");
    if (error) throw error;
    return data ?? [];
  },

  banners: async (): Promise<Banner[]> => {
    const now = new Date().toISOString();
    const { data, error } = await client
      .from("banners")
      .select("id, title, image_url, target_type, target_id")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },

  /** Products stocked at a store, optionally within a set of categories. */
  products: async (storeId: string, categoryIds?: string[], limit = 200): Promise<Product[]> => {
    let q = client.from("products").select(PRODUCT_COLUMNS).eq("is_active", true).eq("inventory.store_id", storeId).limit(limit);
    if (categoryIds?.length) q = q.in("category_id", categoryIds);
    const { data, error } = await q.order("name");
    if (error) throw error;
    return (data as unknown as ProductRow[]).map(toProduct);
  },

  product: async (storeId: string, slug: string): Promise<Product | null> => {
    const { data, error } = await client.from("products").select(PRODUCT_COLUMNS).eq("slug", slug).eq("inventory.store_id", storeId).maybeSingle();
    if (error) throw error;
    return data ? toProduct(data as unknown as ProductRow) : null;
  },

  search: async (storeId: string, query: string, limit = 40): Promise<Product[]> => {
    const q = query.trim();
    if (!q) return [];
    const { data, error } = await client.rpc("search_products", { p_store_id: storeId, p_query: q, p_limit: limit });
    if (error) throw error;
    type Row = Omit<Product, "images"> & { images: string[] | null; rank: number };
    return ((data ?? []) as unknown as Row[]).map(({ rank: _rank, ...p }) => ({ ...p, images: p.images ?? [] }));
  },
});

export type CatalogApi = ReturnType<typeof createCatalogApi>;
