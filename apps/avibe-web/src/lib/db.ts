import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { isDemo, required } from "./config";
export type Row = Record<string, any>;
export interface DB {
  query<T = Row>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}
type Store = {
  db: DB;
  transaction: <T>(fn: (db: DB) => Promise<T>) => Promise<T>;
};
const globals = globalThis as typeof globalThis & { avibeDB?: Promise<Store> };
export async function getStore(): Promise<Store> {
  return (globals.avibeDB ??= (async () => {
    if (!isDemo()) {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: required("DATABASE_URL"),
        max: 8,
      });
      return {
        db: pool as DB,
        transaction: async <T>(fn: (db: DB) => Promise<T>) => {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            const result = await fn(client as DB);
            await client.query("COMMIT");
            return result;
          } catch (e) {
            await client.query("ROLLBACK");
            throw e;
          } finally {
            client.release();
          }
        },
      };
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const dir =
      process.env.AVIBE_DATA_DIR || path.join(process.cwd(), ".data/db");
    await mkdir(dir, { recursive: true });
    const db = new PGlite(dir);
    await db.waitReady;
    await db.exec(
      await readFile(
        path.join(process.cwd(), "supabase/migrations/001_core.sql"),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        path.join(process.cwd(), "supabase/migrations/003_talent_leads.sql"),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        path.join(process.cwd(), "supabase/migrations/004_asset_passports.sql"),
        "utf8",
      ),
    );
    return {
      db: db as DB,
      transaction: async <T>(fn: (db: DB) => Promise<T>) =>
        db.transaction((tx) => fn(tx as DB)),
    };
  })());
}
export async function query<T = Row>(sql: string, params: any[] = []) {
  return (await (await getStore()).db.query<T>(sql, params)).rows;
}
export async function one<T = Row>(sql: string, params: any[] = []) {
  return (await query<T>(sql, params))[0];
}
export async function transaction<T>(fn: (db: DB) => Promise<T>) {
  return (await getStore()).transaction(fn);
}
export async function migrate() {
  const { db } = await getStore();
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/001_core.sql"),
    "utf8",
  );
  await db.query(sql);
}
