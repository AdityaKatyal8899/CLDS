/**
 * POST /api/search
 * Trigger Stage 1 Business Discovery job asynchronously via native TypeScript engine.
 * Enforces 3 free searches for Trial users, unlimited for Administrator.
 */

import { NextRequest, NextResponse } from "next/server";
import { SearchRequestSchema } from "@/lib/validation/schemas";
import { JobRepository } from "@/lib/jobs/repository";
import { EngineJobExecutor } from "@/lib/engine/job_executor";
import { checkAndIncrementTrialSearch } from "@/lib/auth/users";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = SearchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Check user session
    const sessionCookie = req.cookies.get("clds_session");
    let userSession: any = null;
    if (sessionCookie?.value) {
      try {
        userSession = JSON.parse(sessionCookie.value);
      } catch {}
    }

    let searchesRemaining: number | null = null;

    // Enforce 3-search limit for trial users
    if (userSession && userSession.is_trial && userSession.email) {
      const quotaCheck = await checkAndIncrementTrialSearch(userSession.email);
      if (!quotaCheck.allowed) {
        return NextResponse.json(
          {
            error: "Trial limit reached",
            message:
              quotaCheck.message ||
              "You have used all 3 free trial searches! Contact Aditya on Peerlist to get full unlimited access.",
            trial_limit_reached: true,
            searches_remaining: 0,
          },
          { status: 403 }
        );
      }
      searchesRemaining = quotaCheck.remaining;
    }

    const { category, country, city, state, provider, limit } = parsed.data;

    const args = [
      "--category",
      category,
      "--country",
      country,
      "--provider",
      provider,
      "--limit",
      limit.toString(),
    ];

    if (city) args.push("--city", city);
    if (state) args.push("--state", state);

    // 1. Create job in MongoDB
    const job = await JobRepository.createJob("discovery", "search", args);

    // 2. Execute Stage 1 Lead Discovery asynchronously via native TypeScript engine
    EngineJobExecutor.executeSearchJob(job.id, {
      category,
      country,
      city: city || "",
      state: state || "",
      provider: provider || "auto",
      limit: limit || 50,
    }).catch((err) => {
      console.error(`[Native Engine Search Error] Job ${job.id}:`, err);
    });

    // 3. Return immediately with job_id
    return NextResponse.json(
      {
        job_id: job.id,
        status: "queued",
        type: "discovery",
        created_at: job.created_at,
        message: "Discovery job queued successfully",
        searches_remaining: searchesRemaining,
      },
      { status: 202 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to queue discovery job", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
