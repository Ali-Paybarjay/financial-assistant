import { describe, expect, it } from "vitest";
import { isIdentityTaken } from "@/lib/auth-link";

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
