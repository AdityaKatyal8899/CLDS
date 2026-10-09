/**
 * POST /api/jobs/:id/cancel
 * Terminate a running Python process and mark the job cancelled in MongoDB.
 */

import { NextRequest, NextResponse } from "next/server";
import { PythonProcessRunner } from "@/lib/python/runner";
import { JobRepository } from "@/lib/jobs/repository";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const existing = await JobRepository.getJob(id);

    if (!existing) {
      return NextResponse.json(
        { error: `Job with ID '${id}' not found` },
        { status: 404 }
      );
    }

    if (["completed", "failed", "cancelled"].includes(existing.status)) {
      return NextResponse.json(
        {
          message: `Job is already in terminal state: ${existing.status}`,
          job: existing,
        },
        { status: 200 }
      );
    }

    // Terminate process and update state
    await PythonProcessRunner.cancelJob(id);

    const updatedJob = await JobRepository.getJob(id);
    return NextResponse.json({
      message: "Job cancelled successfully",
      job: updatedJob,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to cancel job", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
