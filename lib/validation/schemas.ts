/**
 * Zod validation schemas for CLDS API endpoints.
 */

import { z } from "zod";

export const SearchRequestSchema = z.object({
  category: z.string().min(1, "Category is required"),
  country: z.string().min(1, "Country is required"),
  city: z.string().optional(),
  state: z.string().optional(),
  provider: z.enum(["auto", "osm", "web", "google"]).default("auto"),
  limit: z.number().int().min(1).max(100).default(20),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const VerifyRequestSchema = z.object({
  url: z.string().url("Invalid URL format").optional(),
  lead_id: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(20),
}).refine(
  (data) => Boolean(data.url || data.lead_id || data.limit),
  { message: "Must provide either 'url', 'lead_id', or 'limit'" }
);

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
