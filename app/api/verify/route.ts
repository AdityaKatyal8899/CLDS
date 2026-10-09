/**
 * POST /api/verify
 * Trigger Stage 2 Website Verification job asynchronously via native TypeScript engine.
 */

import { NextRequest, NextResponse } from "next/server";
import { VerifyRequestSchema } from "@/lib/validation/schemas";
import { JobRepository } from "@/lib/jobs/repository";
import { EngineJobExecutor } from "@/lib/engine/job_executor";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = VerifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { url, lead_id, limit } = parsed.data;

    const args: string[] = [];
    if (url) {
      args.push("--url", url);
    } else if (lead_id) {
      args.push("--lead-id", lead_id);
    } else {
      args.push("--limit", (limit || 20).toString());
    }

    // 1. Create job in MongoDB
    const job = await JobRepository.createJob("verification", "verify", args);

    // 2. Execute Stage 2 Fast Verification asynchronously via native TypeScript engine
    EngineJobExecutor.executeVerifyJob(job.id, {
      url: url || undefined,
      lead_id: lead_id || undefined,
      limit: limit || 20,
    }).catch((err) => {
      console.error(`[Native Engine Verify Error] Job ${job.id}:`, err);
    });

    // 3. Return immediately with job_id
    return NextResponse.json(
      {
        job_id: job.id,
        status: "queued",
        type: "verification",
        created_at: job.created_at,
        message: "Verification job queued successfully",
      },
      { status: 202 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to queue verification job", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
