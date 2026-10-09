/**
 * MongoDB Repository for CLDS Job persistence and state transitions.
 */

import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb/client";
import { JobDocument, JobResponse, JobStatus, JobType, formatJobDocument } from "./types";

export class JobRepository {
  private static async getCol() {
    const col = await getCollection<JobDocument>("jobs");
    // Ensure index on status and created_at
    try {
      await col.createIndex({ status: 1, created_at: -1 });
      await col.createIndex({ type: 1, created_at: -1 });
    } catch {
      // Ignore index duplicate in race
    }
    return col;
  }

  static async createJob(
    type: JobType,
    command: string,
    args: string[]
  ): Promise<JobResponse> {
    const col = await this.getCol();
    const now = new Date().toISOString();

    const doc: JobDocument = {
      type,
      status: "queued",
      command,
      args,
      pid: null,
      started_at: null,
      completed_at: null,
      progress: 0,
      logs: [],
      result: null,
      error: null,
      created_at: now,
      updated_at: now,
    };

    const res = await col.insertOne(doc);
    return formatJobDocument({ ...doc, _id: res.insertedId });
  }

  static async getJob(id: string): Promise<JobResponse | null> {
    if (!id || !ObjectId.isValid(id)) return null;
    const col = await this.getCol();
    const doc = await col.findOne({ _id: new ObjectId(id) });
    if (!doc) return null;
    return formatJobDocument(doc);
  }

  static async listJobs(limit = 20, status?: JobStatus): Promise<JobResponse[]> {
    const col = await this.getCol();
    const query: any = {};
    if (status) query.status = status;

    const docs = await col
      .find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();

    return docs.map(formatJobDocument);
  }

  static async setJobRunning(id: string, pid: number): Promise<void> {
    if (!ObjectId.isValid(id)) return;
    const col = await this.getCol();
    const now = new Date().toISOString();

    await col.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "running",
          pid,
          started_at: now,
          updated_at: now,
        },
      }
    );
  }

  static async appendJobLog(id: string, logLine: string): Promise<void> {
    if (!ObjectId.isValid(id) || !logLine) return;
    const col = await this.getCol();
    const now = new Date().toISOString();

    await col.updateOne(
      { _id: new ObjectId(id) },
      {
        $push: { logs: { $each: [logLine], $slice: -500 } }, // keep last 500 lines
        $set: { updated_at: now },
      }
    );
  }

  static async updateJobProgress(
    id: string,
    progress: number,
    logMessage?: string
  ): Promise<void> {
    if (!ObjectId.isValid(id)) return;
    const col = await this.getCol();
    const now = new Date().toISOString();

    const update: any = {
      $set: {
        progress: Math.min(100, Math.max(0, Math.round(progress))),
        updated_at: now,
      },
    };

    if (logMessage) {
      update.$push = { logs: { $each: [logMessage], $slice: -500 } };
    }

    await col.updateOne({ _id: new ObjectId(id) }, update);
  }

  static async completeJob(
    id: string,
    result: Record<string, any> | null = null,
    finalMessage?: string
  ): Promise<void> {
    if (!ObjectId.isValid(id)) return;
    const col = await this.getCol();
    const now = new Date().toISOString();

    const update: any = {
      $set: {
        status: "completed",
        progress: 100,
        result,
        completed_at: now,
        updated_at: now,
      },
    };

    if (finalMessage) {
      update.$push = { logs: { $each: [finalMessage], $slice: -500 } };
    }

    await col.updateOne({ _id: new ObjectId(id) }, update);
  }

  static async failJob(id: string, error: string): Promise<void> {
    if (!ObjectId.isValid(id)) return;
    const col = await this.getCol();
    const now = new Date().toISOString();

    await col.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "failed",
          error,
          completed_at: now,
          updated_at: now,
        },
        $push: { logs: { $each: [`[ERROR] ${error}`], $slice: -500 } },
      }
    );
  }

  static async cancelJob(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const col = await this.getCol();
    const now = new Date().toISOString();

    const res = await col.updateOne(
      { _id: new ObjectId(id), status: { $in: ["queued", "running"] } },
      {
        $set: {
          status: "cancelled",
          completed_at: now,
          updated_at: now,
        },
        $push: { logs: { $each: ["[JOB CANCELLED BY USER]"], $slice: -500 } },
      }
    );

    return res.modifiedCount > 0;
  }
}
