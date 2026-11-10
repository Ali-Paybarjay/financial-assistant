import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F11: `purgeUser` listed one page of a user's uploads and removed those, then
 * deleted the account. The SDK's default page size is 100, so anyone with more
 * than a hundred receipts had the rest outlive their account — and no error from
 * `list`, `remove` or `deleteUser` was looked at, so a storage call that failed
 * produced a "successful" purge with every file still in the bucket. The audit's
 * in-memory reproduction finished successfully against an API that returned an
 * error on every call.
 *
 * The fake storage below shortens the folder as pages are removed, which is what
 * makes the re-read-from-zero rule testable: an implementation that advanced its
 * offset instead would skip whatever moved up into page 1.
 */

type Bucket = { files: string[]; listError?: string; removeError?: string };

const buckets = new Map<string, Bucket>();
let deleteUserError: string | undefined;
let deletedUsers: string[] = [];
const listCalls: { bucket: string; limit?: number; offset?: number }[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        list: async (
          prefix: string,
          options?: { limit?: number; offset?: number },
        ) => {
          listCalls.push({ bucket, limit: options?.limit, offset: options?.offset });
          const store = buckets.get(bucket)!;
          if (store.listError) return { data: null, error: { message: store.listError } };

          const limit = options?.limit ?? 100;
          const offset = options?.offset ?? 0;
          const names = store.files
            .filter((path) => path.startsWith(`${prefix}/`))
            .map((path) => path.slice(prefix.length + 1))
            .slice(offset, offset + limit);

          return { data: names.map((name) => ({ name })), error: null };
        },
        remove: async (paths: string[]) => {
          const store = buckets.get(bucket)!;
          if (store.removeError) {
            return { data: null, error: { message: store.removeError } };
          }
          store.files = store.files.filter((path) => !paths.includes(path));
          return { data: paths.map((path) => ({ name: path })), error: null };
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async (userId: string) => {
          if (deleteUserError) return { data: null, error: { message: deleteUserError } };
          deletedUsers.push(userId);
          return { data: null, error: null };
        },
      },
    },
  }),
}));

const { purgeUser } = await import("@/lib/guests");

const USER = "11111111-1111-1111-1111-111111111111";

function seed(bucket: string, count: number, over: Partial<Bucket> = {}) {
  buckets.set(bucket, {
    files: Array.from({ length: count }, (_, index) => `${USER}/file-${index}.png`),
    ...over,
  });
}

beforeEach(() => {
  buckets.clear();
  listCalls.length = 0;
  deletedUsers = [];
  deleteUserError = undefined;
  seed("receipts", 0);
  seed("statements", 0);
});

describe("purgeUser", () => {
  it("empties a folder that holds more than one page of files", async () => {
    // 101, not 200: one file past the SDK's default page is all it took.
    seed("receipts", 101);

    await purgeUser(USER);

    expect(buckets.get("receipts")!.files).toEqual([]);
    expect(deletedUsers).toEqual([USER]);
  });

  it("re-reads the folder from the start rather than advancing an offset", async () => {
    seed("statements", 250);
    await purgeUser(USER);

    // Every listing of that bucket starts at zero. Paging forward over a folder
    // that is being emptied skips whatever moved up into the page just removed.
    const statementLists = listCalls.filter((call) => call.bucket === "statements");
    expect(statementLists.every((call) => (call.offset ?? 0) === 0)).toBe(true);
    // Three full pages plus the empty listing that ends the loop.
    expect(statementLists).toHaveLength(4);
    expect(buckets.get("statements")!.files).toEqual([]);
  });

  it("sweeps every bucket, not just the first", async () => {
    seed("receipts", 5);
    seed("statements", 5);
    await purgeUser(USER);

    expect(buckets.get("receipts")!.files).toEqual([]);
    expect(buckets.get("statements")!.files).toEqual([]);
  });

  it("refuses to delete the account when the files could not be listed", async () => {
    seed("receipts", 3, { listError: "storage unavailable" });

    await expect(purgeUser(USER)).rejects.toThrow(/could not list/);
    // The account survives, so the sweep will try again tomorrow rather than
    // leaving somebody's receipts behind a deleted login.
    expect(deletedUsers).toEqual([]);
  });

  it("refuses to delete the account when a removal failed", async () => {
    seed("receipts", 3, { removeError: "permission denied" });

    await expect(purgeUser(USER)).rejects.toThrow(/could not remove/);
    expect(deletedUsers).toEqual([]);
  });

  it("reports a failed account delete instead of returning quietly", async () => {
    seed("receipts", 2);
    deleteUserError = "auth down";

    await expect(purgeUser(USER)).rejects.toThrow(/could not delete user/);
  });

  it("is safe to run again after a failure", async () => {
    seed("receipts", 120, { removeError: "permission denied" });
    await expect(purgeUser(USER)).rejects.toThrow();

    // Whatever was wrong is fixed and the caller retries. Nothing about the
    // first attempt has to be undone.
    buckets.get("receipts")!.removeError = undefined;
    await purgeUser(USER);

    expect(buckets.get("receipts")!.files).toEqual([]);
    expect(deletedUsers).toEqual([USER]);
  });
});
