import { execSync } from 'child_process';
import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../..');

export function resetDb(): void {
  execSync('npm run db:migrate && npm run db:seed', {
    cwd: ROOT_DIR,
    stdio: 'pipe',
  });
}
