
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "addresses": {
                  Row: {
                    "city": string,"created_at": string,"id": string,"is_default": boolean,"label": Database["public"]['Enums']["address_label"],"landmark": string | null,"lat": number,"line1": string,"line2": string | null,"lng": number,"location": unknown,"pincode": string,"recipient_name": string | null,"recipient_phone": string | null,"state": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city": string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"label"?: Database["public"]['Enums']["address_label"],"landmark"?: string | null,"lat": number,"line1": string,"line2"?: string | null,"lng": number,"location"?: unknown,"pincode": string,"recipient_name"?: string | null,"recipient_phone"?: string | null,"state": string,"user_id": string
                  }
                  Update: {
                    "city"?: string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"label"?: Database["public"]['Enums']["address_label"],"landmark"?: string | null,"lat"?: number,"line1"?: string,"line2"?: string | null,"lng"?: number,"location"?: unknown,"pincode"?: string,"recipient_name"?: string | null,"recipient_phone"?: string | null,"state"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "addresses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"banners": {
                  Row: {
                    "ends_at": string | null,"id": string,"image_url": string,"is_active": boolean,"sort_order": number,"starts_at": string | null,"target_id": string | null,"target_type": string | null,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_at"?: string | null,"id"?: string,"image_url": string,"is_active"?: boolean,"sort_order"?: number,"starts_at"?: string | null,"target_id"?: string | null,"target_type"?: string | null,"title"?: string | null
                  }
                  Update: {
                    "ends_at"?: string | null,"id"?: string,"image_url"?: string,"is_active"?: boolean,"sort_order"?: number,"starts_at"?: string | null,"target_id"?: string | null,"target_type"?: string | null,"title"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"brands": {
                  Row: {
                    "id": string,"logo_url": string | null,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"logo_url"?: string | null,"name": string,"slug": string
                  }
                  Update: {
                    "id"?: string,"logo_url"?: string | null,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "cart_id": string,"product_id": string,"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cart_id": string,"product_id": string,"quantity": number
                  }
                  Update: {
                    "cart_id"?: string,"product_id"?: string,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_cart_id_fkey"
      columns: ["cart_id"]
isOneToOne: false
      referencedRelation: "carts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"carts": {
                  Row: {
                    "coupon_id": string | null,"id": string,"store_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coupon_id"?: string | null,"id"?: string,"store_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "coupon_id"?: string | null,"id"?: string,"store_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "carts_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "carts_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "carts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "id": string,"image_url": string | null,"is_active": boolean,"name": string,"parent_id": string | null,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"image_url"?: string | null,"is_active"?: boolean,"name": string,"parent_id"?: string | null,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"image_url"?: string | null,"is_active"?: boolean,"name"?: string,"parent_id"?: string | null,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"coupon_redemptions": {
                  Row: {
                    "coupon_id": string,"created_at": string,"id": number,"order_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coupon_id": string,"created_at"?: string,"id"?: never,"order_id": string,"user_id": string
                  }
                  Update: {
                    "coupon_id"?: string,"created_at"?: string,"id"?: never,"order_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupon_redemptions_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "code": string,"description": string | null,"discount_type": string,"discount_value": number,"ends_at": string | null,"first_order_only": boolean,"id": string,"is_active": boolean,"max_discount": number | null,"min_order_amount": number,"per_user_limit": number,"starts_at": string | null,"title": string,"total_limit": number | null,"used_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"description"?: string | null,"discount_type": string,"discount_value"?: number,"ends_at"?: string | null,"first_order_only"?: boolean,"id"?: string,"is_active"?: boolean,"max_discount"?: number | null,"min_order_amount"?: number,"per_user_limit"?: number,"starts_at"?: string | null,"title": string,"total_limit"?: number | null,"used_count"?: number
                  }
                  Update: {
                    "code"?: string,"description"?: string | null,"discount_type"?: string,"discount_value"?: number,"ends_at"?: string | null,"first_order_only"?: boolean,"id"?: string,"is_active"?: boolean,"max_discount"?: number | null,"min_order_amount"?: number,"per_user_limit"?: number,"starts_at"?: string | null,"title"?: string,"total_limit"?: number | null,"used_count"?: number
                  }
                  Relationships: [
                    
                  ]
                },"idempotency_keys": {
                  Row: {
                    "created_at": string,"key": string,"response": Json | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key": string,"response"?: Json | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"key"?: string,"response"?: Json | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "idempotency_keys_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory": {
                  Row: {
                    "price_override": number | null,"product_id": string,"quantity": number,"reserved": number,"store_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "price_override"?: number | null,"product_id": string,"quantity"?: number,"reserved"?: number,"store_id": string,"updated_at"?: string
                  }
                  Update: {
                    "price_override"?: number | null,"product_id"?: string,"quantity"?: number,"reserved"?: number,"store_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"order_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": number,"note": string | null,"order_id": string,"status": Database["public"]['Enums']["order_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"note"?: string | null,"order_id": string,"status": Database["public"]['Enums']["order_status"]
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"note"?: string | null,"order_id"?: string,"status"?: Database["public"]['Enums']["order_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"image_url": string | null,"line_total": number,"mrp": number,"name": string,"order_id": string,"product_id": string,"quantity": number,"unit_label": string,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"image_url"?: string | null,"line_total": number,"mrp": number,"name": string,"order_id": string,"product_id": string,"quantity": number,"unit_label": string,"unit_price": number
                  }
                  Update: {
                    "id"?: string,"image_url"?: string | null,"line_total"?: number,"mrp"?: number,"name"?: string,"order_id"?: string,"product_id"?: string,"quantity"?: number,"unit_label"?: string,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "address_snapshot": NonNullable<Json>,"cancel_reason": string | null,"cancelled_at": string | null,"coupon_code": string | null,"created_at": string,"customer_note": string | null,"delivered_at": string | null,"delivery_fee": number,"discount": number,"handling_fee": number,"id": string,"order_number": string,"payment_method": Database["public"]['Enums']["payment_method"],"promised_at": string | null,"rider_id": string | null,"status": Database["public"]['Enums']["order_status"],"store_id": string,"subtotal": number,"tip": number,"total": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_snapshot": NonNullable<Json>,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"coupon_code"?: string | null,"created_at"?: string,"customer_note"?: string | null,"delivered_at"?: string | null,"delivery_fee"?: number,"discount"?: number,"handling_fee"?: number,"id"?: string,"order_number"?: string,"payment_method": Database["public"]['Enums']["payment_method"],"promised_at"?: string | null,"rider_id"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"store_id": string,"subtotal": number,"tip"?: number,"total": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "address_snapshot"?: NonNullable<Json>,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"coupon_code"?: string | null,"created_at"?: string,"customer_note"?: string | null,"delivered_at"?: string | null,"delivery_fee"?: number,"discount"?: number,"handling_fee"?: number,"id"?: string,"order_number"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"promised_at"?: string | null,"rider_id"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"store_id"?: string,"subtotal"?: number,"tip"?: number,"total"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_rider_id_fkey"
      columns: ["rider_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"method": Database["public"]['Enums']["payment_method"],"order_id": string,"provider": string,"provider_order_id": string | null,"provider_payment_id": string | null,"raw": Json | null,"status": Database["public"]['Enums']["payment_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"method": Database["public"]['Enums']["payment_method"],"order_id": string,"provider"?: string,"provider_order_id"?: string | null,"provider_payment_id"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"order_id"?: string,"provider"?: string,"provider_order_id"?: string | null,"provider_payment_id"?: string | null,"raw"?: Json | null,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"product_reviews": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"order_id": string | null,"product_id": string,"rating": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"order_id"?: string | null,"product_id": string,"rating": number,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"order_id"?: string | null,"product_id"?: string,"rating"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_reviews_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_reviews_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "brand_id": string | null,"category_id": string,"created_at": string,"description": string | null,"id": string,"images": (string)[],"is_active": boolean,"is_veg": boolean | null,"mrp": number,"name": string,"price": number,"rating_avg": number | null,"rating_count": number,"search_text": unknown,"slug": string,"tags": (string)[],"tax_rate": number,"unit_label": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_id"?: string | null,"category_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"images"?: (string)[],"is_active"?: boolean,"is_veg"?: boolean | null,"mrp": number,"name": string,"price": number,"rating_avg"?: number | null,"rating_count"?: number,"search_text"?: never,"slug": string,"tags"?: (string)[],"tax_rate"?: number,"unit_label": string,"updated_at"?: string
                  }
                  Update: {
                    "brand_id"?: string | null,"category_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"images"?: (string)[],"is_active"?: boolean,"is_veg"?: boolean | null,"mrp"?: number,"name"?: string,"price"?: number,"rating_avg"?: number | null,"rating_count"?: number,"search_text"?: never,"slug"?: string,"tags"?: (string)[],"tax_rate"?: number,"unit_label"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_brand_id_fkey"
      columns: ["brand_id"]
isOneToOne: false
      referencedRelation: "brands"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string | null,"full_name": string | null,"id": string,"phone": string | null,"referral_code": string | null,"referred_by": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string,"wallet_balance": number
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"phone"?: string | null,"referral_code"?: string | null,"referred_by"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string,"wallet_balance"?: number
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"referral_code"?: string | null,"referred_by"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string,"wallet_balance"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_referred_by_fkey"
      columns: ["referred_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"push_tokens": {
                  Row: {
                    "platform": string,"token": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "platform": string,"token": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "platform"?: string,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"payment_id": string,"provider_refund_id": string | null,"reason": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"payment_id": string,"provider_refund_id"?: string | null,"reason"?: string | null,"status"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"payment_id"?: string,"provider_refund_id"?: string | null,"reason"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"rider_locations": {
                  Row: {
                    "heading": number | null,"is_online": boolean,"lat": number,"lng": number,"location": unknown,"rider_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "heading"?: number | null,"is_online"?: boolean,"lat": number,"lng": number,"location"?: unknown,"rider_id": string,"updated_at"?: string
                  }
                  Update: {
                    "heading"?: number | null,"is_online"?: boolean,"lat"?: number,"lng"?: number,"location"?: unknown,"rider_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rider_locations_rider_id_fkey"
      columns: ["rider_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stores": {
                  Row: {
                    "address": string,"closes_at": string,"code": string,"created_at": string,"delivery_fee": number,"free_delivery_above": number,"id": string,"is_open": boolean,"lat": number,"lng": number,"location": unknown,"min_order_amount": number,"name": string,"opens_at": string,"promised_minutes": number,"service_area": unknown,"service_radius_m": number
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"closes_at"?: string,"code": string,"created_at"?: string,"delivery_fee"?: number,"free_delivery_above"?: number,"id"?: string,"is_open"?: boolean,"lat": number,"lng": number,"location"?: unknown,"min_order_amount"?: number,"name": string,"opens_at"?: string,"promised_minutes"?: number,"service_area"?: unknown,"service_radius_m"?: number
                  }
                  Update: {
                    "address"?: string,"closes_at"?: string,"code"?: string,"created_at"?: string,"delivery_fee"?: number,"free_delivery_above"?: number,"id"?: string,"is_open"?: boolean,"lat"?: number,"lng"?: number,"location"?: unknown,"min_order_amount"?: number,"name"?: string,"opens_at"?: string,"promised_minutes"?: number,"service_area"?: unknown,"service_radius_m"?: number
                  }
                  Relationships: [
                    
                  ]
                },"wallet_transactions": {
                  Row: {
                    "amount": number,"created_at": string,"id": number,"kind": string,"note": string | null,"order_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: never,"kind": string,"note"?: string | null,"order_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: never,"kind"?: string,"note"?: string | null,"order_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wallet_transactions_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wallet_transactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "event_id": string,"provider": string,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"provider": string,"received_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"provider"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "advance_order":
{ Args: { "p_actor": string,"p_note"?: string,"p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           },
"append_order_event":
{ Args: { "p_actor"?: string,"p_note"?: string,"p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           },
"apply_referral_code":
{ Args: { "p_code": string }; Returns: boolean
                           },
"attach_provider_order":
{ Args: { "p_order_id": string,"p_provider_order_id": string }; Returns: undefined
                           },
"cancel_order":
{ Args: { "p_actor": string,"p_by_customer": boolean,"p_order_id": string,"p_reason": string }; Returns: Json
                           },
"confirm_payment":
{ Args: { "p_method"?: Database["public"]['Enums']["payment_method"],"p_order_id": string,"p_provider_order_id": string,"p_provider_payment_id": string,"p_raw"?: Json }; Returns: Database["public"]['Enums']["order_status"]
                           },
"current_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"find_serving_store":
{ Args: { "lat": number,"lng": number }; Returns: {
              "address": string,
"closes_at": string,
"code": string,
"created_at": string,
"delivery_fee": number,
"free_delivery_above": number,
"id": string,
"is_open": boolean,
"lat": number,
"lng": number,
"location": unknown,
"min_order_amount": number,
"name": string,
"opens_at": string,
"promised_minutes": number,
"service_area": unknown,
"service_radius_m": number
            }
                          SetofOptions: {
        from: "*"
        to: "stores"
        isOneToOne: true
        isSetofReturn: false
      } },
"immutable_array_to_text":
{ Args: { "arr": (string)[] }; Returns: string
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"place_order":
{ Args: { "p_address_id": string,"p_coupon_code"?: string,"p_customer_note"?: string,"p_items": Json,"p_payment_method": Database["public"]['Enums']["payment_method"],"p_store_id": string,"p_tip"?: number,"p_user_id": string }; Returns: Json
                           },
"rider_advance_order":
{ Args: { "p_note"?: string,"p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           },
"rider_claim_order":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"rider_set_online":
{ Args: { "p_lat"?: number,"p_lng"?: number,"p_online": boolean }; Returns: undefined
                           },
"rider_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"rider_update_location":
{ Args: { "p_heading"?: number,"p_lat": number,"p_lng": number }; Returns: undefined
                           },
"search_products":
{ Args: { "p_limit"?: number,"p_query": string,"p_store_id": string }; Returns: {
              "available": number,"brand_name": string,"category_id": string,"description": string,"id": string,"images": (string)[],"is_veg": boolean,"mrp": number,"name": string,"price": number,"rank": number,"slug": string,"unit_label": string
            }[]
                           },
"serving_store":
{ Args: { "lat": number,"lng": number }; Returns: {
              "closes_at": string,"code": string,"delivery_fee": number,"distance_m": number,"free_delivery_above": number,"id": string,"is_open": boolean,"min_order_amount": number,"name": string,"opens_at": string,"promised_minutes": number
            }[]
                           },
"staff_advance_order":
{ Args: { "p_note"?: string,"p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           },
"staff_assign_rider":
{ Args: { "p_order_id": string,"p_rider_id"?: string }; Returns: undefined
                           },
"staff_cancel_order":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: Json
                           },
"staff_dashboard":
{ Args: { "p_store_id"?: string }; Returns: Json
                           },
"staff_set_role":
{ Args: { "p_role": Database["public"]['Enums']["user_role"],"p_user_id": string }; Returns: undefined
                           },
"staff_set_stock":
{ Args: { "p_price_override"?: number,"p_product_id": string,"p_quantity": number,"p_store_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "address_label": "home"|"work"|"other","order_status": "pending_payment"|"placed"|"accepted"|"packing"|"ready"|"picked_up"|"out_for_delivery"|"delivered"|"cancelled"|"refunded","payment_method": "upi"|"card"|"netbanking"|"wallet"|"cod"|"ration_wallet","payment_status": "created"|"authorized"|"captured"|"failed"|"refunded"|"partially_refunded","user_role": "customer"|"rider"|"store_staff"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "address_label": ["home", "work", "other"],"order_status": ["pending_payment", "placed", "accepted", "packing", "ready", "picked_up", "out_for_delivery", "delivered", "cancelled", "refunded"],"payment_method": ["upi", "card", "netbanking", "wallet", "cod", "ration_wallet"],"payment_status": ["created", "authorized", "captured", "failed", "refunded", "partially_refunded"],"user_role": ["customer", "rider", "store_staff", "admin"]
          }
        }
} as const
