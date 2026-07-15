import { describe, expect, it } from "vitest";
import { errorCode, errorMessage } from "./errors";

describe("errorMessage", () => {
  it("unwraps an Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });
  it("passes through strings", () => {
    expect(errorMessage("nope")).toBe("nope");
  });
  it("reads .message off plain objects", () => {
    expect(errorMessage({ message: "api down" })).toBe("api down");
  });
  it("falls back for unknown shapes", () => {
    expect(errorMessage(undefined)).toBe("Something went wrong.");
    expect(errorMessage(42, "fallback")).toBe("fallback");
  });
});

describe("errorCode", () => {
  it("returns firebase-style codes when present", () => {
    expect(errorCode({ code: "auth/popup-blocked" })).toBe("auth/popup-blocked");
  });
  it("returns empty string when absent", () => {
    expect(errorCode(new Error("x"))).toBe("");
    expect(errorCode(null)).toBe("");
  });
});
