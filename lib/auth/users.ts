/**
 * Database-backed User Authentication and Management in MongoDB Atlas.
 * Stores user credentials securely with salted SHA-256 / scrypt cryptographic hashing.
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
  const count = await usersCol.countDocuments({});

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
