import { createClient } from "@/lib/supabase/client";
import type { Business, BusinessCategory, CountryCode } from "@/lib/types";

interface BusinessRow {
  id: string;
  name: string;
  category: BusinessCategory;
  country: CountryCode;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
}

const BUSINESS_SELECT = "id, name, category, country, address, lat, lng, phone";

function mapBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    country: row.country,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone ?? undefined,
  };
}

export async function fetchBusinesses(country: CountryCode | "all"): Promise<Business[]> {
  const supabase = createClient();
  let query = supabase.from("businesses").select(BUSINESS_SELECT).eq("is_active", true);
  if (country !== "all") {
    query = query.eq("country", country);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapBusiness(row as unknown as BusinessRow));
}
