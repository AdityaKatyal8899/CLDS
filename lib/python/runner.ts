/**
 * Python subprocess orchestrator for CLDS.
 * Executes CLI commands asynchronously, parses machine events, streams logs, and manages lifecycles.
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import path from "path";
import { JobRepository } from "@/lib/jobs/repository";

// In-memory maps preserved during server runtime
const activeProcesses = new Map<string, ChildProcess>();
const jobEmitters = new Map<string, EventEmitter>();

export interface JobEventPayload {
  jobId: string;
  type: "log" | "progress" | "status" | "error" | "done";
  status?: string;
  progress?: number;
  message?: string;
  data?: any;
  timestamp: string;
}

export function getJobEventEmitter(jobId: string): EventEmitter {
  if (!jobEmitters.has(jobId)) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(50);
    jobEmitters.set(jobId, emitter);
  }
  return jobEmitters.get(jobId)!;
}

export function removeJobEventEmitter(jobId: string): void {
  const emitter = jobEmitters.get(jobId);
  if (emitter) {
    emitter.removeAllListeners();
    jobEmitters.delete(jobId);
  }
}

export class PythonProcessRunner {
  /**
   * Spawns Python CLDS CLI process in the background.
   * Does NOT block HTTP response.
   */
  static async spawnJob(
    jobId: string,
    command: string,
    args: string[]
  ): Promise<void> {
    const pythonExe = process.env.PYTHON_EXECUTABLE || "python";
    const enginePath = process.env.CLDS_ENGINE_PATH
      ? path.resolve(process.env.CLDS_ENGINE_PATH)
      : process.cwd();

    const emitter = getJobEventEmitter(jobId);

    // Full CLI arguments: run.py <command> <args...> --json-events
    const fullArgs = ["run.py", command, ...args];
    if (!fullArgs.includes("--json-events")) {
      fullArgs.push("--json-events");
    }

    const env = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      CLDS_DIR: enginePath,
    };

    let child: ChildProcess;
    try {
      child = spawn(pythonExe, fullArgs, {
        cwd: enginePath,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err: any) {
      const errMsg = `Failed to spawn Python executable '${pythonExe}': ${err?.message || err}`;
      await JobRepository.failJob(jobId, errMsg);
      emitter.emit("event", {
        jobId,
        type: "error",
        message: errMsg,
        timestamp: new Date().toISOString(),
      } as JobEventPayload);
      return;
    }

    if (!child.pid) {
      const errMsg = `Failed to obtain PID for Python process`;
      await JobRepository.failJob(jobId, errMsg);
      return;
    }

    activeProcesses.set(jobId, child);
    await JobRepository.setJobRunning(jobId, child.pid);

    emitter.emit("event", {
      jobId,
      type: "status",
      status: "running",
      message: `Process started (PID: ${child.pid})`,
      timestamp: new Date().toISOString(),
    } as JobEventPayload);

    let stdoutBuffer = "";

    // Process stdout stream
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf-8");
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Attempt JSON event parse
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          try {
            const eventData = JSON.parse(trimmed);
            if (eventData.event) {
              this.handleStructuredEvent(jobId, eventData, emitter);
              continue;
            }
          } catch {
            // Not a JSON event, treat as raw log
          }
        }

        // Regular log line
        JobRepository.appendJobLog(jobId, trimmed).catch(() => {});
        emitter.emit("event", {
          jobId,
          type: "log",
          message: trimmed,
          timestamp: new Date().toISOString(),
        } as JobEventPayload);
      }
    });

    // Process stderr stream
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8").trim();
      if (!text) return;

      JobRepository.appendJobLog(jobId, `[stderr] ${text}`).catch(() => {});
      emitter.emit("event", {
        jobId,
        type: "log",
        message: `[stderr] ${text}`,
        timestamp: new Date().toISOString(),
      } as JobEventPayload);
    });

    // Process error (e.g. process crashed on spawn)
    child.on("error", async (err: Error) => {
      activeProcesses.delete(jobId);
      const errMsg = `Process error: ${err.message}`;
      await JobRepository.failJob(jobId, errMsg);
      emitter.emit("event", {
        jobId,
        type: "error",
        message: errMsg,
        timestamp: new Date().toISOString(),
      } as JobEventPayload);
    });

    // Process completion / close
    child.on("close", async (code: number | null, signal: string | null) => {
      activeProcesses.delete(jobId);

      // Flush remaining stdout buffer if any
      if (stdoutBuffer.trim()) {
        const trimmed = stdoutBuffer.trim();
        JobRepository.appendJobLog(jobId, trimmed).catch(() => {});
        emitter.emit("event", {
          jobId,
          type: "log",
          message: trimmed,
          timestamp: new Date().toISOString(),
        } as JobEventPayload);
      }

      // Check current job status in DB (to avoid overriding cancelled status)
      const currentJob = await JobRepository.getJob(jobId);
      if (currentJob?.status === "cancelled") {
        emitter.emit("event", {
          jobId,
          type: "status",
          status: "cancelled",
          message: "Job execution cancelled",
          timestamp: new Date().toISOString(),
        } as JobEventPayload);
        emitter.emit("event", { jobId, type: "done", timestamp: new Date().toISOString() });
        return;
      }

      if (code === 0) {
        if (currentJob?.status !== "completed") {
          await JobRepository.completeJob(jobId, null, "Process completed successfully (Exit Code: 0)");
        }
        emitter.emit("event", {
          jobId,
          type: "status",
          status: "completed",
          message: "Process completed successfully",
          timestamp: new Date().toISOString(),
        } as JobEventPayload);
      } else {
        const failMsg = signal
          ? `Process terminated by signal ${signal}`
          : `Process exited with error code ${code}`;
        await JobRepository.failJob(jobId, failMsg);
        emitter.emit("event", {
          jobId,
          type: "error",
          message: failMsg,
          timestamp: new Date().toISOString(),
        } as JobEventPayload);
      }

      emitter.emit("event", { jobId, type: "done", timestamp: new Date().toISOString() });
    });
  }

  private static handleStructuredEvent(
    jobId: string,
    data: any,
    emitter: EventEmitter
  ): void {
    const eventType = data.event;

    if (eventType === "progress") {
      const progress = typeof data.value === "number" ? data.value : 0;
      const msg = data.message || `Progress: ${progress}%`;
      JobRepository.updateJobProgress(jobId, progress, msg).catch(() => {});
      emitter.emit("event", {
        jobId,
        type: "progress",
        progress,
        message: msg,
        data,
        timestamp: new Date().toISOString(),
      } as JobEventPayload);
    } else if (eventType === "job_completed") {
      JobRepository.completeJob(jobId, data.summary || data, data.message).catch(() => {});
      emitter.emit("event", {
        jobId,
        type: "status",
        status: "completed",
        progress: 100,
        message: data.message || "Job completed",
        data: data.summary || data,
        timestamp: new Date().toISOString(),
      } as JobEventPayload);
    } else if (eventType === "job_failed") {
      JobRepository.failJob(jobId, data.error || "Unknown job failure").catch(() => {});
      emitter.emit("event", {
        jobId,
        type: "error",
        status: "failed",
        message: data.error,
        timestamp: new Date().toISOString(),
      } as JobEventPayload);
    } else if (eventType === "job_started") {
      emitter.emit("event", {
        jobId,
        type: "log",
        message: `[EVENT] Started ${data.type || ""}`,
        data,
        timestamp: new Date().toISOString(),
      } as JobEventPayload);
    }
  }

  /**
   * Terminate a running process safely.
   */
  static async cancelJob(jobId: string): Promise<boolean> {
    const child = activeProcesses.get(jobId);
    let killed = false;

    if (child && child.pid) {
      try {
        if (process.platform === "win32") {
          // Force kill tree on Windows
          spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"]);
        } else {
          child.kill("SIGTERM");
        }
        killed = true;
      } catch {
        // Process might have already exited
      }
      activeProcesses.delete(jobId);
    }

    const modified = await JobRepository.cancelJob(jobId);
    const emitter = getJobEventEmitter(jobId);
    emitter.emit("event", {
      jobId,
      type: "status",
      status: "cancelled",
      message: "Job cancelled by user",
      timestamp: new Date().toISOString(),
    } as JobEventPayload);
    emitter.emit("event", { jobId, type: "done", timestamp: new Date().toISOString() });

    return modified || killed;
  }
}
