import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { CategoryRow } from "@/lib/supabase/database.types";

/**
 * System categories plus the user's own, ordered as the design lists them.
 *
 * Memoized: the layout reads this for the composer and the page under it
 * reads it again. Same request, same rows, one query.
 */
export const listCategories = cache(async function listCategories(): Promise<
  CategoryRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
});

export async function categoryIdsBySlug(): Promise<Map<string, string>> {
  const categories = await listCategories();
  return new Map(categories.map((category) => [category.slug, category.id]));
}
