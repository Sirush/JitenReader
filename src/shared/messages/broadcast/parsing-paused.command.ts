import { BroadcastCommand } from '../lib/broadcast-command';

export class ParsingPausedCommand extends BroadcastCommand<[boolean]> {
  public readonly key = 'parsingPaused';

  constructor(paused: boolean) {
    super();

    this.arguments = [paused];
  }
}
