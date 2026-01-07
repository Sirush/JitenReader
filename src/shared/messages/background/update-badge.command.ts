import { BackgroundCommand } from '../lib/background-command';

export class UpdateBadgeCommand extends BackgroundCommand<[percentage: number | null]> {
  public readonly key = 'updateBadge';
}
