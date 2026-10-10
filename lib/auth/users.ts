/**
 * Database-backed User Authentication and Management in MongoDB Atlas.
 * Stores user credentials securely with salted SHA-256 / scrypt cryptographic hashing.
 * Manages 3-search free public trial accounts for Peerlist users.
 */

import crypto from "crypto";
import { getCollection } from "@/lib/mongodb/client";

export interface DbUser {
  _id?: any;
  email: string;
  username: string;
  name: string;
  role: string;
  workspace: string;
  password_hash: string;
  salt: string;
  created_at: string;
  updated_at: string;
}

export interface DbTrialUser {
  _id?: any;
  email: string;
  searches_count: number;
  searches_limit: number;
  created_at: string;
  last_login_at: string;
  last_search_at?: string;
  ip?: string | null;
}

export interface UserSessionData {
  email: string;
  username: string;
  name: string;
  role: string;
  workspace: string;
  is_trial: boolean;
  searches_limit?: number;
  searches_used?: number;
  searches_remaining?: number;
}

/**
 * Hash password using HMAC SHA-256 with cryptographic salt.
 */
export function hashPassword(password: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

/**
 * Generate a random cryptographic hex salt.
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Ensures the initial administrator account exists in the MongoDB Atlas users collection.
 */
export async function ensureAdminUserExists(): Promise<void> {
  const usersCol = await getCollection<DbUser>("users");
  const targetEmail = "adityakatyal45678@gmail.com";
  const existingAdmin = await usersCol.findOne({
    $or: [{ email: targetEmail }, { username: "aditya" }],
  });

  if (!existingAdmin) {
    const salt = generateSalt();
    const passwordHash = hashPassword("Password@Aditya8899", salt);
    const now = new Date().toISOString();

    await usersCol.insertOne({
      email: targetEmail,
      username: "aditya",
      name: "Aditya Katyal",
      role: "Administrator",
      workspace: "CLDS Production Workspace",
      password_hash: passwordHash,
      salt: salt,
      created_at: now,
      updated_at: now,
    });
  }
}

/**
 * Authenticate credentials against MongoDB Atlas users collection.
 */
export async function authenticateUser(loginInput: string, passwordInput: string): Promise<DbUser | null> {
  await ensureAdminUserExists();

  const usersCol = await getCollection<DbUser>("users");
  const trimmed = loginInput.trim().toLowerCase();

  const user = await usersCol.findOne({
    $or: [
      { email: { $regex: `^${trimmed}$`, $options: "i" } },
      { username: { $regex: `^${trimmed}$`, $options: "i" } },
    ],
  });

  if (!user) {
    return null;
  }

  const computedHash = hashPassword(passwordInput, user.salt);
  if (crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(user.password_hash))) {
    return user;
  }

  return null;
}

/**
 * Handle a 3-free-search trial login for public/Peerlist visitors.
 */
export async function handleTrialLogin(email: string, ip?: string): Promise<UserSessionData> {
  const trimmedEmail = email.trim().toLowerCase();
  const trialCol = await getCollection<DbTrialUser>("trial_users");

  const existing = await trialCol.findOne({ email: trimmedEmail });
  const now = new Date().toISOString();

  let searchesUsed = 0;
  const limit = 3;

  if (existing) {
    searchesUsed = existing.searches_count || 0;
    await trialCol.updateOne(
      { email: trimmedEmail },
      { $set: { last_login_at: now, ...(ip ? { ip } : {}) } }
    );
  } else {
    await trialCol.insertOne({
      email: trimmedEmail,
      searches_count: 0,
      searches_limit: limit,
      created_at: now,
      last_login_at: now,
      ip: ip || null,
    });
  }

  const remaining = Math.max(0, limit - searchesUsed);
  const displayName = trimmedEmail.split("@")[0];

  return {
    email: trimmedEmail,
    username: displayName,
    name: displayName,
    role: "Trial User",
    workspace: "Peerlist Public Trial",
    is_trial: true,
    searches_limit: limit,
    searches_used: searchesUsed,
    searches_remaining: remaining,
  };
}

/**
 * Get current trial usage for a given email.
 */
export async function getTrialStatus(email: string): Promise<{ used: number; remaining: number; limit: number }> {
  const trimmedEmail = email.trim().toLowerCase();
  const trialCol = await getCollection<DbTrialUser>("trial_users");
  const existing = await trialCol.findOne({ email: trimmedEmail });
  const limit = 3;
  const used = existing?.searches_count || 0;
  const remaining = Math.max(0, limit - used);
  return { used, remaining, limit };
}

/**
 * Check and increment trial search count.
 * Returns whether the search is permitted and remaining counts.
 */
export async function checkAndIncrementTrialSearch(email: string): Promise<{
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  message?: string;
}> {
  const trimmedEmail = email.trim().toLowerCase();
  const trialCol = await getCollection<DbTrialUser>("trial_users");
  const existing = await trialCol.findOne({ email: trimmedEmail });

  const limit = 3;
  const currentCount = existing?.searches_count || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      used: currentCount,
      remaining: 0,
      limit,
      message: "You have completed your 3 free trial searches! Contact Aditya on Peerlist to get full access.",
    };
  }

  const now = new Date().toISOString();
  await trialCol.updateOne(
    { email: trimmedEmail },
    {
      $inc: { searches_count: 1 },
      $set: { last_search_at: now },
    },
    { upsert: true }
  );

  const newUsed = currentCount + 1;
  const remaining = Math.max(0, limit - newUsed);

  return {
    allowed: true,
    used: newUsed,
    remaining,
    limit,
  };
}
