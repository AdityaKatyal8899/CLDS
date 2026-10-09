/**
 * GET /api/jobs/:id/stream
 * Server-Sent Events (SSE) live progress and log stream for a specific job.
 */

import { NextRequest, NextResponse } from "next/server";
import { JobRepository } from "@/lib/jobs/repository";
import { getJobEventEmitter, JobEventPayload } from "@/lib/python/runner";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const initialJob = await JobRepository.getJob(id);

  if (!initialJob) {
    return NextResponse.json(
      { error: `Job with ID '${id}' not found` },
      { status: 404 }
    );
  }

  const emitter = getJobEventEmitter(id);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (event: string, data: any) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed by client
        }
      };

      // 1. Send initial state from MongoDB
      sendEvent("init", initialJob);

      // If job already reached terminal state, close immediately
      if (["completed", "failed", "cancelled"].includes(initialJob.status)) {
        sendEvent("done", { status: initialJob.status });
        controller.close();
        return;
      }

      // 2. Listen to live events from PythonProcessRunner
      const onEvent = (payload: JobEventPayload) => {
        if (payload.type === "done") {
          sendEvent("done", { status: payload.status || "done" });
          cleanup();
          try {
            controller.close();
          } catch {}
        } else {
          sendEvent(payload.type, payload);
        }
      };

      emitter.on("event", onEvent);

      // 3. Fallback database poller (every 2.5s) to guarantee MongoDB consistency
      const pollInterval = setInterval(async () => {
        try {
          const current = await JobRepository.getJob(id);
          if (!current) return;

          sendEvent("sync", {
            status: current.status,
            progress: current.progress,
            updated_at: current.updated_at,
          });

          if (["completed", "failed", "cancelled"].includes(current.status)) {
            sendEvent("done", current);
            cleanup();
            try {
              controller.close();
            } catch {}
          }
        } catch {
          cleanup();
        }
      }, 2500);

      const cleanup = () => {
        clearInterval(pollInterval);
        emitter.off("event", onEvent);
      };

      // Clean up when request is aborted
      req.signal.addEventListener("abort", () => {
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
