import { ParsingPausedCommand } from '@shared/messages/broadcast/parsing-paused.command';

export const setParsingPaused = async (paused: boolean): Promise<void> => {
  await chrome.storage.local.set({ parsingPaused: paused });

  new ParsingPausedCommand(paused).send();
};
