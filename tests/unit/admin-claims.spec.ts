import { describe, expect, it } from "vitest";
import { isAdmin, isAdminPath } from "@/lib/admin/claims";

/**
 * The whole authorization model of the panel is these two functions, so they get
 * the test. The one that matters is `user_metadata`: it is writable by the user
 * through `auth.updateUser()`, so reading a role out of it would let anybody
 * promote themselves in one call. If somebody ever "fixes" a null-metadata bug by
 * widening the lookup, this is what says no.
 */
describe("isAdmin", () => {
  it("accepts the claim in app_metadata", () => {
    expect(isAdmin({ app_metadata: { role: "admin" } })).toBe(true);
  });

  it("keeps the claim beside the provider GoTrue puts there", () => {
    expect(
      isAdmin({ app_metadata: { provider: "google", providers: ["google"], role: "admin" } }),
    ).toBe(true);
  });

  it("refuses a role in user_metadata, which the user can write themselves", () => {
    const user = { app_metadata: {}, user_metadata: { role: "admin" } };
    expect(isAdmin(user)).toBe(false);
  });

  it("refuses an ordinary user, a missing object, and no user at all", () => {
    expect(isAdmin({ app_metadata: { provider: "google" } })).toBe(false);
    expect(isAdmin({ app_metadata: {} })).toBe(false);
    expect(isAdmin({ app_metadata: null })).toBe(false);
    expect(isAdmin({})).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("refuses anything that is not exactly the word", () => {
    expect(isAdmin({ app_metadata: { role: "Admin" } })).toBe(false);
    expect(isAdmin({ app_metadata: { role: "administrator" } })).toBe(false);
    expect(isAdmin({ app_metadata: { role: true } })).toBe(false);
    expect(isAdmin({ app_metadata: { role: ["admin"] } })).toBe(false);
  });
});

describe("isAdminPath", () => {
  it("covers the panel and everything under it", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/users")).toBe(true);
    expect(isAdminPath("/admin/users/abc-123")).toBe(true);
  });

  it("does not gate a path that merely starts with the same letters", () => {
    // The gate returns a 404 for non-admins. A prefix match would hide a real
    // page of the app behind it the day somebody adds /administration.
    expect(isAdminPath("/administrators")).toBe(false);
    expect(isAdminPath("/adminish")).toBe(false);
  });

  it("leaves the rest of the app alone", () => {
    expect(isAdminPath("/")).toBe(false);
    expect(isAdminPath("/dashboard")).toBe(false);
    expect(isAdminPath("/settings")).toBe(false);
  });
});
