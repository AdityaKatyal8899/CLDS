/**
 * Tests for PythonProcessRunner event emission and lifecycle.
 */

import { describe, it, expect, vi } from "vitest";
import { getJobEventEmitter, removeJobEventEmitter } from "../../lib/python/runner";

describe("PythonProcessRunner Event System", () => {
  it("creates and retrieves a singleton EventEmitter per job", () => {
    const emitter1 = getJobEventEmitter("job_1");
    const emitter2 = getJobEventEmitter("job_1");
    expect(emitter1).toBe(emitter2);

    const emitterOther = getJobEventEmitter("job_2");
    expect(emitter1).not.toBe(emitterOther);

    removeJobEventEmitter("job_1");
    removeJobEventEmitter("job_2");
  });

  it("emits and receives job lifecycle events", () => {
    const emitter = getJobEventEmitter("job_test");
    const events: any[] = [];

    emitter.on("event", (payload) => {
      events.push(payload);
    });

    emitter.emit("event", {
      jobId: "job_test",
      type: "status",
      status: "running",
      timestamp: new Date().toISOString(),
    });

    emitter.emit("event", {
      jobId: "job_test",
      type: "progress",
      progress: 50,
      timestamp: new Date().toISOString(),
    });

    expect(events.length).toBe(2);
    expect(events[0].status).toBe("running");
    expect(events[1].progress).toBe(50);

    removeJobEventEmitter("job_test");
  });
});
