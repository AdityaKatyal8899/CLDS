/**
 * GET /api/jobs/:id
 * Retrieve current state of a specific job from MongoDB.
 */

import { NextRequest, NextResponse } from "next/server";
import { JobRepository } from "@/lib/jobs/repository";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const job = await JobRepository.getJob(id);

    if (!job) {
      return NextResponse.json(
        { error: `Job with ID '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(job);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch job", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
