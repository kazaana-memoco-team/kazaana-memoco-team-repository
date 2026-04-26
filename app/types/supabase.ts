export type UserRole = 'super_admin' | 'company_admin' | 'member' | 'family_member';
export type UserStatus = 'pending' | 'active' | 'inactive' | 'deleted';
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          member_limit: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          email: string | null;
          company_id: string | null;
          role: UserRole;
          parent_user_id: string | null;
          relationship: string | null;
          kinship_degree: number | null;
          status: UserStatus;
          last_name: string | null;
          first_name: string | null;
          last_name_kana: string | null;
          first_name_kana: string | null;
          gender: string | null;
          birth_date: string | null;
          postal_code: string | null;
          prefecture: string | null;
          city: string | null;
          address: string | null;
          building: string | null;
          phone: string | null;
          last_login_at: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      product_discounts: {
        Row: {
          shopify_product_id: string;
          discount_rate: number;
        };
        Insert: Database['public']['Tables']['product_discounts']['Row'];
        Update: Partial<Database['public']['Tables']['product_discounts']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          user_id: string | null;
          company_id: string | null;
          shopify_order_id: string | null;
          shopify_draft_order_id: string | null;
          status: OrderStatus;
          total_regular_price: number | null;
          total_member_price: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string | null;
          shopify_product_id: string | null;
          shopify_variant_id: string | null;
          quantity: number;
          regular_price: number | null;
          member_price: number | null;
          discount_rate: number | null;
        };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id'> & {id?: string};
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
      };
    };
  };
}
