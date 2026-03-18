import knex, { Knex } from 'knex';
import path from 'path';

let db: Knex;

export function initDatabase(): Knex {
  if (db) return db;

  db = knex({
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DB_FILENAME || path.resolve(process.cwd(), 'db/dev.sqlite'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(process.cwd(), 'db/migrations'),
    },
    seeds: {
      directory: path.resolve(process.cwd(), 'db/seeds'),
    },
  });

  return db;
}

export function getDatabase(): Knex {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}
