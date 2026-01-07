import { MessageSender } from '@shared/extension/types';
import { UpdateBadgeCommand } from '@shared/messages/background/update-badge.command';
import { BackgroundCommandHandler } from './background-command-handler';

function getComprehensionColour(percentage: number): string {
  const hue = Math.round(percentage * 1.42);

  return `hsl(${hue}, 78%, 52%)`;
}

export class UpdateBadgeCommandHandler extends BackgroundCommandHandler<UpdateBadgeCommand> {
  public readonly command = UpdateBadgeCommand;

  public handle(sender: MessageSender, percentage: number | null): void {
    const tabId = sender.tab?.id;

    if (tabId === undefined) {
      return;
    }

    if (percentage === null) {
      void chrome.action.setBadgeText({ text: '', tabId });

      return;
    }

    const text = percentage === 100 ? '100' : `${percentage}%`;
    const colour = getComprehensionColour(percentage);

    void chrome.action.setBadgeText({ text, tabId });
    void chrome.action.setBadgeBackgroundColor({ color: colour, tabId });
  }
}
