import knex, { Knex } from 'knex';
import path from 'path';

let db: Knex;

export function initDatabase(): Knex {
  if (db) return db;

  db = knex({
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(__dirname, '../../db/dev.sqlite'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, '../../db/migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, '../../db/seeds'),
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
