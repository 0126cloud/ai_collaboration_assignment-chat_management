import type { Knex } from 'knex';
import { hash } from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // 清除既有資料
  await knex('admins').del();

  const passwordHash = await hash('123456', 10);

  await knex('admins').insert([
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
