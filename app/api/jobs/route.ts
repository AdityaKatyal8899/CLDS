/**
 * GET /api/jobs
 * List recent jobs from MongoDB.
 */

import { NextRequest, NextResponse } from "next/server";
import { JobRepository } from "@/lib/jobs/repository";
import { JobStatus } from "@/lib/jobs/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = (searchParams.get("status") as JobStatus) || undefined;

    const jobs = await JobRepository.listJobs(limit, status);
    return NextResponse.json({ jobs, count: jobs.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch jobs", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
