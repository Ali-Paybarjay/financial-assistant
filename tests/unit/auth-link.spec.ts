import { describe, expect, it } from "vitest";
import {
  isBrandNewAccount,
  isIdentityTaken,
  isSwitch,
  needsGoogleScreen,
  readLinkIntent,
} from "@/lib/auth-link";

/**
 * The single condition that decides whether a guest is told «you already have
 * an account» or «something went wrong». It is read off an OAuth redirect,
 * which is to say off a query string assembled by somebody else, so it must
 * not be over-eager: every other provider error has to keep falling through
 * to the ordinary failure path.
 */
describe("isIdentityTaken", () => {
  it("recognises the code GoTrue sends when the identity is somebody else's", () => {
    expect(
      isIdentityTaken("identity_already_exists", "Identity is already linked to another user"),
    ).toBe(true);
  });

  it("recognises it from the description alone", () => {
    // The code is not always carried through the redirect, and the prose is
    // then the only thing left to read.
    expect(isIdentityTaken(null, "Identity is already linked to another user")).toBe(true);
  });

  it("leaves every other refusal alone", () => {
    expect(isIdentityTaken("access_denied", "The user denied the request")).toBe(false);
    expect(isIdentityTaken("server_error", "Unable to exchange external code")).toBe(false);
    expect(isIdentityTaken(null, "")).toBe(false);
  });

  it("does not mistake an email that is already registered for a linked identity", () => {
    // A different failure with a nearly identical sentence: it means «pick
    // another address», not «you already have an account you can sign into».
    expect(isIdentityTaken(null, "A user with this email address has already been registered")).toBe(
      false,
    );
  });
});

/**
 * The cookie is the only thing that survives a trip to Google, so what it can
 * say and what it means are worth pinning down.
 */
describe("link intents", () => {
  it("reads the three it knows and refuses anything else", () => {
    expect(readLinkIntent("link")).toBe("link");
    expect(readLinkIntent("switch")).toBe("switch");
    expect(readLinkIntent("switch-retry")).toBe("switch-retry");
    expect(readLinkIntent("google")).toBeNull();
    expect(readLinkIntent(undefined)).toBeNull();
  });

  it("treats both legs of the switch as the same trip", () => {
    // Everything past the retry decision — which guest is being left, where
    // the user lands — must not care which leg got there.
    expect(isSwitch("switch")).toBe(true);
    expect(isSwitch("switch-retry")).toBe(true);
    expect(isSwitch("link")).toBe(false);
    expect(isSwitch(null)).toBe(false);
  });
});

describe("needsGoogleScreen", () => {
  it("recognises Google declining to sign in silently", () => {
    // What the live endpoint actually answers to `prompt=none` with no
    // session, measured rather than assumed.
    expect(needsGoogleScreen("interaction_required")).toBe(true);
    expect(needsGoogleScreen("login_required")).toBe(true);
    expect(needsGoogleScreen("consent_required")).toBe(true);
    expect(needsGoogleScreen("account_selection_required")).toBe(true);
  });

  it("does not retry the refusals that mean something else", () => {
    // Pressing cancel must not be answered by sending them back to Google.
    expect(needsGoogleScreen("access_denied")).toBe(false);
    expect(needsGoogleScreen("server_error")).toBe(false);
    expect(needsGoogleScreen(null)).toBe(false);
  });
});

/**
 * Telling «the account you already had» from «an account that did not exist
 * until you pressed that button».
 *
 * Getting this wrong in one direction leaves a guest deleted for an empty
 * account nobody wanted. Getting it wrong in the other points a delete at
 * somebody's real account, so the timestamps are compared to each other
 * rather than to our clock wherever both are there.
 */
describe("isBrandNewAccount", () => {
  const now = Date.parse("2026-09-23T12:00:00Z");

  it("knows an account made by this very sign-in", () => {
    expect(
      isBrandNewAccount("2026-09-23T11:59:58Z", "2026-09-23T11:59:58.400Z", now),
    ).toBe(true);
  });

  it("leaves an account that existed before alone", () => {
    // The one that matters: this is somebody's ledger, and the branch behind
    // this answer deletes things.
    expect(isBrandNewAccount("2026-03-01T09:00:00Z", "2026-09-23T11:59:58Z", now)).toBe(false);
  });

  it("is not fooled by a clock that disagrees, when both stamps are there", () => {
    // Both come from the same row, so an hour of skew moves them together and
    // an old account still reads as old.
    expect(isBrandNewAccount("2026-03-01T09:00:00Z", "2026-09-23T13:30:00Z", now)).toBe(false);
  });

  it("falls back to the clock only when there is no sign-in stamp", () => {
    expect(isBrandNewAccount("2026-09-23T11:59:40Z", null, now)).toBe(true);
    expect(isBrandNewAccount("2026-03-01T09:00:00Z", null, now)).toBe(false);
  });

  it("answers no to nonsense rather than guessing", () => {
    expect(isBrandNewAccount(undefined, undefined, now)).toBe(false);
    expect(isBrandNewAccount("not a date", "not a date", now)).toBe(false);
  });
});
