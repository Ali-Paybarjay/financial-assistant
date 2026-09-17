import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  StatementImportRow,
  StatementLineRow,
} from "@/lib/supabase/database.types";

/**
 * Every read of an import goes through here, the way transactions do. RLS is
 * what keeps one user out of another's statement; this module is what keeps
 * the ordering and the "which import is the open one" rule in one place.
 */

/** Imports that are still waiting on the user, newest first. */
const OPEN_STATUSES = ["uploading", "parsing", "review"] as const;

export async function openImport(): Promise<StatementImportRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("statement_imports")
    .select("*")
    .in("status", [...OPEN_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function getImport(id: string): Promise<StatementImportRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("statement_imports")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return data ?? null;
}

/** Finished imports, for the history strip under the uploader. */
export async function listImports(limit = 8): Promise<StatementImportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("statement_imports")
    .select("*")
    .in("status", ["applied", "failed", "discarded"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/** In statement order, which is the order reconciliation assigned. */
export async function listLines(importId: string): Promise<StatementLineRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("statement_lines")
    .select("*")
    .eq("import_id", importId)
    .order("row_index", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
