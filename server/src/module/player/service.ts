import { Knex } from 'knex';
import { AppError } from '../../utils/appError';
import { ErrorCode } from '../../utils/errorCodes';

export class PlayerService {
  constructor(private db: Knex) {}

  async resetNickname(username: string) {
    const player = await this.db('players').where({ username, deleted_at: null }).first();
    if (!player) throw new AppError(ErrorCode.PLAYER_NOT_FOUND);

    await this.db('players')
      .where({ username })
      .update({ nickname: username, nickname_review_status: null });

    return { username };
  }
}
