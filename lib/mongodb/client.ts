/**
 * MongoDB Atlas client singleton for Next.js App Router.
 */

import { MongoClient, Db, Collection } from "mongodb";

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI || "";
  if (!uri) {
    throw new Error(
      "MongoDB configuration missing.\nSet MONGODB_URI in your .env or .env.local file."
    );
  }

  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so the MongoClient is not repeated
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  } else {
    // In production, instantiate fresh or cached promise
    if (!clientPromise) {
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
      clientPromise = client.connect();
    }
    return clientPromise;
  }
}

export async function getDb(): Promise<Db> {
  const dbName = process.env.MONGODB_DATABASE || "clds";
  const mongoClient = await getMongoClient();
  return mongoClient.db(dbName);
}

export async function getCollection<T extends import("mongodb").Document>(
  name: "leads" | "verifications" | "jobs" | string
): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}
