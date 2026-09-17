/**
 * What an import will accept. Plain constants rather than exports from the
 * actions module: a "use server" file may only export async functions, and a
 * const smuggled in beside them silently turns the whole module into nothing.
 */

/** Enough for three months photographed a page at a time. */
export const MAX_FILES_PER_IMPORT = 12;

/** Matches the ceiling on the statements bucket. */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** What Storage and the model between them can actually take. */
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "text/csv",
  "text/plain",
] as const;

export const FILE_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "text/csv": "csv",
  "text/plain": "txt",
};

/**
 * Some browsers hand over an empty type for a .csv picked out of a file
 * manager, and Storage rejects an upload with no declared type.
 */
export function mimeTypeFor(file: { name: string; type: string }): string {
  if ((ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) return file.type;

  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";

  return file.type || "application/octet-stream";
}
