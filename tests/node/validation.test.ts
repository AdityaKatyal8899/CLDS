/**
 * Tests for API request validation schemas.
 */

import { describe, it, expect } from "vitest";
import { SearchRequestSchema, VerifyRequestSchema } from "../../lib/validation/schemas";

describe("SearchRequestSchema", () => {
  it("validates valid search request", () => {
    const valid = {
      category: "gift stores",
      country: "US",
      city: "Austin",
      limit: 20,
      provider: "auto",
    };
    const res = SearchRequestSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("fails when category or country is missing", () => {
    const invalid = { city: "Austin" };
    const res = SearchRequestSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("applies default provider and limit", () => {
    const minimal = { category: "cafes", country: "IN" };
    const res = SearchRequestSchema.safeParse(minimal);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.provider).toBe("auto");
      expect(res.data.limit).toBe(20);
    }
  });
});

describe("VerifyRequestSchema", () => {
  it("validates valid URL verify request", () => {
    const res = VerifyRequestSchema.safeParse({ url: "https://example.com" });
    expect(res.success).toBe(true);
  });

  it("validates valid batch verify request", () => {
    const res = VerifyRequestSchema.safeParse({ limit: 15 });
    expect(res.success).toBe(true);
  });

  it("validates valid lead_id verify request", () => {
    const res = VerifyRequestSchema.safeParse({ lead_id: "lead_123" });
    expect(res.success).toBe(true);
  });

  it("fails on malformed URL", () => {
    const res = VerifyRequestSchema.safeParse({ url: "not-a-valid-url" });
    expect(res.success).toBe(false);
  });
});
