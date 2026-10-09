/**
 * Job types and data models for CLDS background execution.
 */

import { ObjectId } from "mongodb";

export type JobType = "discovery" | "verification";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobDocument {
  _id?: ObjectId;
  type: JobType;
  status: JobStatus;
  command: string;
  args: string[];
  pid: number | null;
  started_at: string | null;
  completed_at: string | null;
  progress: number;
  logs: string[];
  result: Record<string, any> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobResponse {
  id: string;
  type: JobType;
  status: JobStatus;
  command: string;
  args: string[];
  pid: number | null;
  started_at: string | null;
  completed_at: string | null;
  progress: number;
  logs: string[];
  result: Record<string, any> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function formatJobDocument(doc: any): JobResponse {
  return {
    id: doc._id ? doc._id.toString() : "",
    type: doc.type,
    status: doc.status,
    command: doc.command,
    args: doc.args || [],
    pid: doc.pid ?? null,
    started_at: doc.started_at ?? null,
    completed_at: doc.completed_at ?? null,
    progress: doc.progress ?? 0,
    logs: doc.logs || [],
    result: doc.result ?? null,
    error: doc.error ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}
