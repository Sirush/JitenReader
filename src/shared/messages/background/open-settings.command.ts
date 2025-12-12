import { BackgroundCommand } from '../lib/background-command';

export class OpenSettingsCommand extends BackgroundCommand<[]> {
  public readonly key = 'openSettings';
}
