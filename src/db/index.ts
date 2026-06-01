import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { join } from "path";
import { existsSync } from "fs";

const DB_PATH = join(process.cwd(), "data", "bear-tour.db");

let sqlite: Database.Database;

try {
  if (!existsSync(DB_PATH)) {
    throw new Error(`Database file not found: ${DB_PATH}`);
  }
  sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
} catch (e) {
  console.error("Failed to open database:", e);
  throw e;
}

export const db = drizzle(sqlite, { schema });
export { schema };
