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

  await database.schema.createTable('chatrooms', (table) => {
    table.string('id', 50).primary();
    table.string('name', 100).notNullable();
    table.integer('online_user_count').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(database.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(database.fn.now());
    table.timestamp('deleted_at').nullable();

    table.index('name');
  });

  await database.schema.createTable('players', (table) => {
    table.string('username', 50).primary();
    table.string('nickname', 50).notNullable();
    table.string('nickname_review_status', 20).nullable();
    table.string('nickname_reviewed_by', 50).nullable();
    table.datetime('nickname_reviewed_at').nullable();
    table.datetime('nickname_apply_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(database.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(database.fn.now());
    table.timestamp('deleted_at').nullable();
  });

  await database.schema.createTable('chatroom_players', (table) => {
    table.increments('id').primary();
    table.string('chatroom_id', 50).notNullable();
    table.string('player_username', 50).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(database.fn.now());
    table.timestamp('deleted_at').nullable();

    table.unique(['chatroom_id', 'player_username']);
    table.index('chatroom_id');
    table.index('player_username');
  });

  await database.schema.createTable('chat_messages', (table) => {
    table.increments('id').primary();
    table.string('chatroom_id', 50).notNullable();
    table.string('player_username', 50).notNullable();
    table.string('player_nickname', 50).notNullable();
    table.text('message').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(database.fn.now());
    table.timestamp('deleted_at').nullable();

    table.index('chatroom_id');
    table.index('player_username');
    table.index('created_at');
  });

  await database.schema.createTable('blacklist', (table) => {
    table.increments('id').primary();
    table.string('block_type', 10).notNullable();
    table.string('target', 100).notNullable();
    table.string('reason', 20).notNullable();
    table.string('operator', 50).notNullable();
    table.string('chatroom_id', 50).notNullable().defaultTo('*');
    table.timestamp('created_at').defaultTo(database.fn.now());
    table.boolean('is_blocked').notNullable().defaultTo(true);

    table.unique(['block_type', 'target', 'chatroom_id']);
    table.index(['block_type', 'target']);
    table.index('created_at');
  });

  await database.schema.createTable('reports', (table) => {
    table.increments('id').primary();
    table.string('reporter_username', 50).notNullable();
    table.string('target_username', 50).notNullable();
    table.string('chatroom_id', 50).notNullable();
    table.integer('chat_message_id').nullable();
    table.text('chat_message').notNullable();
    table.string('reason', 20).notNullable();
    table.string('status', 20).notNullable().defaultTo('pending');
    table.string('reviewed_by', 50).nullable();
    table.datetime('reviewed_at').nullable();
    table.datetime('created_at').defaultTo(database.fn.now());

    table.index('status');
    table.index('reporter_username');
    table.index('target_username');
    table.index('created_at');
  });

  await database.schema.createTable('broadcasts', (table) => {
    table.increments('id').primary();
    table.text('message').notNullable();
    table.string('chatroom_id', 50).notNullable();
    table.integer('duration').notNullable();
    table.datetime('start_at').notNullable();
    table.string('operator', 50).notNullable();
    table.datetime('created_at').defaultTo(database.fn.now());
    table.datetime('deleted_at').nullable();

    table.index('chatroom_id');
    table.index('start_at');
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
