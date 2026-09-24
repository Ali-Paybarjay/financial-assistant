import { describe, expect, it } from "vitest";
import { workspaceForPath } from "@/lib/workspaces";

/**
 * Which half of the app a url belongs to. Everything the shell shows hangs
 * off this one answer — the sidebar, the tab bar, the header that says where
 * you are — so the cases worth pinning are the ones where a wrong answer is
 * invisible rather than loud.
 */
describe("workspaceForPath", () => {
  it("puts the ledger's pages on the personal side", () => {
    for (const path of [
      "/dashboard",
      "/transactions",
      "/accounts",
      "/income",
      "/goals",
      "/import",
      "/settings",
    ]) {
      expect(workspaceForPath(path)).toBe("personal");
    }
  });

  it("puts a group and its own page on the dong side", () => {
    expect(workspaceForPath("/dong")).toBe("dong");
    expect(workspaceForPath("/dong/3f1a0c24-1111-2222-3333-444455556666")).toBe("dong");
  });

  it("keeps query strings and trailing segments on the same side", () => {
    expect(workspaceForPath("/transactions/9")).toBe("personal");
  });

  it("gives the chooser no workspace at all", () => {
    // It must not arrive wearing one of the two navs: that would be answering
    // the question it exists to ask.
    expect(workspaceForPath("/switch")).toBeNull();
  });

  it("puts the capture screen on the personal side", () => {
    // It writes to the personal ledger, so it gets the personal chrome — the
    // sidebar, the tab bar, and the way out to the other half. What it does
    // not get is the docked composer, and that is the shell's call, not this
    // function's: see isCapturePath.
    expect(workspaceForPath("/")).toBe("personal");
  });

  it("gives a path outside both sides no workspace", () => {
    // Onboarding and a mistyped url are not «جایی در حسابداری شخصی», and a
    // shell that claimed otherwise would put a nav on a page that has none.
    // This is also what the capture screen's *exact* match protects: «/» is a
    // prefix of both of these, so matching it the way every other route is
    // matched would hand them the ledger's nav.
    expect(workspaceForPath("/onboarding/3")).toBeNull();
    expect(workspaceForPath("/nowhere")).toBeNull();
  });

  it("does not match a prefix that is merely a prefix", () => {
    // `/dong` must not claim `/dongle`, and `/income` must not claim
    // `/incomers`. String.startsWith alone would hand both the wrong nav.
    expect(workspaceForPath("/dongle")).toBeNull();
    expect(workspaceForPath("/incomers")).toBeNull();
  });
});
