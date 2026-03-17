import knex, { Knex } from 'knex';
import { hash } from 'bcryptjs';

let db: Knex;

export function createTestDb(): Knex {
  db = knex({
    client: 'better-sqlite3',
    connection: {
      filename: ':memory:',
    },
    useNullAsDefault: true,
  });
  return db;
}

// 直接建立 schema，避免 knex 動態 import .ts migration 的問題
export async function setupTestSchema(database: Knex): Promise<void> {
  await database.schema.createTable('admins', (table) => {
    table.increments('id').primary();
    table.string('username', 50).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('role', 20).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('created_by').nullable();
    table.timestamp('created_at').notNullable().defaultTo(database.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(database.fn.now());
  });

  await database.schema.createTable('operation_logs', (table) => {
    table.increments('id').primary();
    table.string('operation_type', 50).notNullable();
    table.integer('operator_id').notNullable();
    table.string('operator', 50).notNullable();
    table.text('request').notNullable(); // JSON string: { url, method, payload }
    table.timestamp('created_at').defaultTo(database.fn.now());

    table.index('operation_type');
    table.index('operator_id');
    table.index('created_at');
  });
}

// 插入測試 seed 資料
export async function seedTestData(database: Knex): Promise<void> {
  const passwordHash = await hash('123456', 10);

  await database('admins').insert([
    {
      username: 'admin01',
      password_hash: passwordHash,
      role: 'senior_manager',
      is_active: true,
      created_by: null,
    },
    {
      username: 'admin02',
      password_hash: passwordHash,
      role: 'general_manager',
      is_active: true,
      created_by: null,
    },
    {
      username: 'admin03',
      password_hash: passwordHash,
      role: 'general_manager',
      is_active: false,
      created_by: null,
    },
  ]);
}

export function getTestDb(): Knex {
  return db;
}

export async function closeTestDb(): Promise<void> {
  if (db) {
    await db.destroy();
  }
}
