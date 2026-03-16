import type { Knex } from 'knex';

const config: Knex.Config = {
  client: 'better-sqlite3',
  connection: {
    filename: './db/dev.sqlite',
  },
  useNullAsDefault: true,
  migrations: {
    directory: './db/migrations',
  },
  seeds: {
    directory: './db/seeds',
  },
};

export default config;
