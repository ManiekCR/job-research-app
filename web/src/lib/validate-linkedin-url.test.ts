import { describe, expect, it } from "vitest";
import { isValidLinkedinProfileUrl } from "./validate-linkedin-url";

describe("isValidLinkedinProfileUrl", () => {
  it("accepts a standard profile URL", () => {
    expect(isValidLinkedinProfileUrl("https://www.linkedin.com/in/marian-caron")).toBe(true);
  });

  it("accepts a profile URL without www and with a trailing slash", () => {
    expect(isValidLinkedinProfileUrl("https://linkedin.com/in/marian-caron/")).toBe(true);
  });

  it("accepts a country subdomain", () => {
    expect(isValidLinkedinProfileUrl("https://de.linkedin.com/in/marian-caron")).toBe(true);
  });

  it("rejects a company page", () => {
    expect(isValidLinkedinProfileUrl("https://linkedin.com/company/n26")).toBe(false);
  });

  it("rejects plain text", () => {
    expect(isValidLinkedinProfileUrl("not a url")).toBe(false);
  });

  it("rejects http (non-https)", () => {
    expect(isValidLinkedinProfileUrl("http://www.linkedin.com/in/marian-caron")).toBe(false);
  });

  it("rejects a lookalike domain", () => {
    expect(isValidLinkedinProfileUrl("https://linked.in/in/foo")).toBe(false);
  });
});
