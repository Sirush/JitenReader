import { BroadcastCommand } from '../lib/broadcast-command';

export class ProfileSwitchedCommand extends BroadcastCommand<[string]> {
  public readonly key = 'profileSwitched';

  constructor(profileId: string) {
    super();

    this.arguments = [profileId];
  }
}
