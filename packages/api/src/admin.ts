import type { Json, OrderStatus } from "@ration/shared";

import type { Client } from "./client";
import { ORDER_COLUMNS, type Order } from "./orders";

export interface StoreRow {
  id: string;
  name: string;
  code: string;
  address: string;
  lat: number;
  lng: number;
  service_radius_m: number;
  auto_assign_riders: boolean;
  assign_radius_m: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
  min_order_amount: number;
  delivery_fee: number;
  free_delivery_above: number;
  promised_minutes: number;
}

export interface ProductImportRow {
  /** CSV line number, echoed back in errors. */
  row: number;
  slug: string;
  name: string;
  brand: string | null;
  subcategories: string[];
  unit_label: string;
  mrp: number;
  price: number;
  tax_rate: number;
  description: string | null;
  image_url: string | null;
  image_credit: string | null;
  is_veg: boolean | null;
  tags: string[];
  orderable: boolean;
  is_active: boolean;
  stock: number | null;
}

export interface ProductImportResult {
  created: number;
  updated: number;
  brands_created: number;
  errors: { row: number; message: string }[];
}

export interface ProductRow {
  id: string;
  category_id: string;
  brand_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  unit_label: string;
  mrp: number;
  price: number;
  tax_rate: number;
  images: string[];
  tags: string[];
  is_veg: boolean | null;
  is_active: boolean;
}

export interface InventoryRow {
  store_id: string;
  product_id: string;
  quantity: number;
  reserved: number;
  price_override: number | null;
}

export interface CouponRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: "flat" | "percent" | "free_delivery";
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number;
  per_user_limit: number;
  total_limit: number | null;
  used_count: number;
  first_order_only: boolean;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface BannerRow {
  id: string;
  title: string | null;
  image_url: string;
  target_type: string | null;
  target_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface RiderRow {
  id: string;
  full_name: string | null;
  phone: string | null;
}

export interface CustomerRow {
  id: string;
  phone: string | null;
  full_name: string | null;
  role: string;
  wallet_balance: number;
  created_at: string;
}

/** Staff operations. Every write goes through RLS (is_staff) or a staff_* RPC. */
export const createAdminApi = (client: Client) => ({
  orders: {
    list: async (opts: { storeId?: string; active?: boolean; limit?: number } = {}): Promise<Order[]> => {
      let q = client.from("orders").select(ORDER_COLUMNS).order("created_at", { ascending: false }).limit(opts.limit ?? 100);
      if (opts.storeId) q = q.eq("store_id", opts.storeId);
      if (opts.active) q = q.in("status", ["placed", "accepted", "packing", "ready", "picked_up", "out_for_delivery"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
    advance: async (orderId: string, status: OrderStatus, note?: string): Promise<void> => {
      const { error } = await client.rpc("staff_advance_order", { p_order_id: orderId, p_status: status, p_note: note ?? undefined });
      if (error) throw error;
    },
    assignRider: async (orderId: string, riderId: string | null): Promise<void> => {
      const { error } = await client.rpc("staff_assign_rider", { p_order_id: orderId, p_rider_id: riderId ?? undefined });
      if (error) throw error;
    },
    cancel: async (orderId: string, reason: string): Promise<void> => {
      const { error } = await client.rpc("staff_cancel_order", { p_order_id: orderId, p_reason: reason });
      if (error) throw error;
    },
  },

  stores: {
    list: async (): Promise<StoreRow[]> => {
      const { data, error } = await client.from("stores").select("id, name, code, address, lat, lng, service_radius_m, auto_assign_riders, assign_radius_m, is_open, opens_at, closes_at, min_order_amount, delivery_fee, free_delivery_above, promised_minutes").order("name");
      if (error) throw error;
      return (data ?? []) as StoreRow[];
    },
    upsert: async (row: Partial<StoreRow> & Pick<StoreRow, "name" | "code" | "address" | "lat" | "lng">): Promise<void> => {
      const { error } = await client.from("stores").upsert(row);
      if (error) throw error;
    },
  },

  products: {
    /** Bulk create/update from the CSV import; at most 500 rows per call. Money in paise. */
    import: async (rows: ProductImportRow[], storeId: string | null): Promise<ProductImportResult> => {
      const { data, error } = await client.rpc("staff_import_products", { p_rows: rows as unknown as Json, p_store_id: storeId ?? undefined });
      if (error) throw error;
      return data as unknown as ProductImportResult;
    },
    list: async (): Promise<ProductRow[]> => {
      const { data, error } = await client.from("products").select("id, category_id, brand_id, name, slug, description, unit_label, mrp, price, tax_rate, images, tags, is_veg, is_active").order("name");
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
    upsert: async (row: Partial<ProductRow> & Pick<ProductRow, "name" | "slug" | "category_id" | "unit_label" | "mrp" | "price">): Promise<ProductRow> => {
      const { data, error } = await client.from("products").upsert(row).select("id, category_id, brand_id, name, slug, description, unit_label, mrp, price, tax_rate, images, tags, is_veg, is_active").single();
      if (error) throw error;
      return data as ProductRow;
    },
  },

  inventory: {
    forStore: async (storeId: string): Promise<InventoryRow[]> => {
      const { data, error } = await client.from("inventory").select("store_id, product_id, quantity, reserved, price_override").eq("store_id", storeId);
      if (error) throw error;
      return (data ?? []) as InventoryRow[];
    },
    set: async (storeId: string, productId: string, quantity: number, priceOverride: number | null): Promise<void> => {
      const { error } = await client.rpc("staff_set_stock", { p_store_id: storeId, p_product_id: productId, p_quantity: quantity, p_price_override: priceOverride ?? undefined });
      if (error) throw error;
    },
  },

  categories: {
    list: async (): Promise<CategoryRow[]> => {
      const { data, error } = await client.from("categories").select("id, parent_id, name, slug, image_url, sort_order, is_active").order("sort_order");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
    upsert: async (row: Partial<CategoryRow> & Pick<CategoryRow, "name" | "slug">): Promise<void> => {
      const { error } = await client.from("categories").upsert(row);
      if (error) throw error;
    },
  },

  coupons: {
    list: async (): Promise<CouponRow[]> => {
      const { data, error } = await client.from("coupons").select("*").order("code");
      if (error) throw error;
      return (data ?? []) as CouponRow[];
    },
    upsert: async (row: Partial<CouponRow> & Pick<CouponRow, "code" | "title" | "discount_type">): Promise<void> => {
      const { error } = await client.from("coupons").upsert(row);
      if (error) throw error;
    },
  },

  banners: {
    list: async (): Promise<BannerRow[]> => {
      const { data, error } = await client.from("banners").select("id, title, image_url, target_type, target_id, sort_order, is_active").order("sort_order");
      if (error) throw error;
      return (data ?? []) as BannerRow[];
    },
    upsert: async (row: Partial<BannerRow> & Pick<BannerRow, "image_url">): Promise<void> => {
      const { error } = await client.from("banners").upsert(row);
      if (error) throw error;
    },
    remove: async (id: string): Promise<void> => {
      const { error } = await client.from("banners").delete().eq("id", id);
      if (error) throw error;
    },
  },

  people: {
    riders: async (): Promise<RiderRow[]> => {
      const { data, error } = await client.from("profiles").select("id, full_name, phone").eq("role", "rider").order("full_name");
      if (error) throw error;
      return (data ?? []) as RiderRow[];
    },
    customers: async (limit = 200): Promise<CustomerRow[]> => {
      const { data, error } = await client.from("profiles").select("id, phone, full_name, role, wallet_balance, created_at").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as CustomerRow[];
    },
    setRole: async (userId: string, role: "customer" | "rider" | "store_staff" | "admin"): Promise<void> => {
      const { error } = await client.rpc("staff_set_role", { p_user_id: userId, p_role: role });
      if (error) throw error;
    },
  },

  uploadImage: async (bucket: "product-images" | "banners", file: File | Blob, path: string): Promise<string> => {
    const { error } = await client.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (error) throw error;
    return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },
});

export type AdminApi = ReturnType<typeof createAdminApi>;
