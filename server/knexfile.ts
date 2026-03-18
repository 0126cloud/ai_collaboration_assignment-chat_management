import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(__dirname, `.env.${process.env.NODE_ENV || 'development'}`),
});

const config: Knex.Config = {
  client: 'better-sqlite3',
  connection: {
    filename: process.env.DB_FILENAME || './db/dev.sqlite',
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
