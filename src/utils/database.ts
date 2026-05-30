import { Db, MongoClient } from "mongodb";
import { v7 as uuidv7 } from "uuid";
import type { ID } from "@utils/types.ts";

/**
 * Connects a MongoClient using the `MONGODB_URL` environment variable.
 * Bun loads variables from `.env` automatically.
 */
async function initMongoClient(): Promise<MongoClient> {
  const DB_CONN = process.env.MONGODB_URL;
  if (DB_CONN === undefined) {
    throw new Error("Could not find environment variable: MONGODB_URL");
  }
  const client = new MongoClient(DB_CONN);
  try {
    await client.connect();
  } catch (e) {
    throw new Error("MongoDB connection failed: " + e);
  }
  return client;
}

async function init(): Promise<[MongoClient, string]> {
  const client = await initMongoClient();
  const DB_NAME = process.env.DB_NAME;
  if (DB_NAME === undefined) {
    throw new Error("Could not find environment variable: DB_NAME");
  }
  return [client, DB_NAME];
}

async function dropAllCollections(db: Db): Promise<void> {
  const collections = await db.listCollections().toArray();
  for (const collection of collections) {
    await db.collection(collection.name).drop();
  }
}

/**
 * MongoDB database configured by `.env`.
 * @returns initialized database and client
 */
export async function getDb(): Promise<[Db, MongoClient]> {
  const [client, DB_NAME] = await init();
  return [client.db(DB_NAME), client];
}

/**
 * Test database initialization: connects to a `test-` prefixed database and
 * drops all of its collections so each run starts from a clean slate.
 * @returns initialized test database and client
 */
export async function testDb(): Promise<[Db, MongoClient]> {
  const [client, DB_NAME] = await init();
  const testDbName = `test-${DB_NAME}`;
  const database = client.db(testDbName);
  await dropAllCollections(database);
  return [database, client];
}

/**
 * Creates a fresh ID.
 * @returns a UUID v7 generic ID.
 */
export function freshID(): ID {
  return uuidv7() as ID;
}
