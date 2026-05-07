import { getConfiguration, invalidateProfileCache } from '@shared/configuration/get-configuration';
import { migrateToProfiles } from '@shared/configuration/migrate-to-profiles';
import {
  invalidateSetConfigurationCache,
  setConfiguration,
} from '@shared/configuration/set-configuration';
import { addContextMenu } from '@shared/extension/add-context-menu';
import { runtime } from '@shared/extension/runtime';
import { addInstallListener } from '@shared/extension/add-install-listener';
import { getStyledTabIds } from '@shared/extension/inject-style';
import { openOptionsPage } from '@shared/extension/open-options-page';
import { openView } from '@shared/extension/open-view';
import { ParsePageCommand } from '@shared/messages/foreground/parse-page.command';
import { ParseSelectionCommand } from '@shared/messages/foreground/parse-selection.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { DEFAULT_WORD_STYLE_CONFIG } from '@shared/word-style/themes';
import { AddToStudyDeckCommandHandler } from './jiten-card-actions/add-to-study-deck-command.handler';
import { FetchStudyDecksCommandHandler } from './jiten-card-actions/fetch-study-decks-command.handler';
import { ForgetCardCommandHandler } from './jiten-card-actions/forget-card-command.handler';
import { GradeCardCommandHandler } from './jiten-card-actions/grade-card-command.handler';
import { RunDeckActionCommandHandler } from './jiten-card-actions/run-deck-action-command.handler';
import { UpdateCardStateCommandHandler } from './jiten-card-actions/update-card-state-command.handler';
import { BackgroundCommandHandlerCollection } from './lib/background-command-handler-collection';
import { OpenSettingsCommandHandler } from './lib/open-settings-command.handler';
import { UpdateBadgeCommandHandler } from './lib/update-badge-command.handler';
import { LookupController } from './lookup/lookup-controller';
import { LookupTextCommandHandler } from './lookup/lookup-text-command.handler';
import { AbortRequestCommandHandler } from './parser/abort-request-command.handler';
import { ParseCommandHandler } from './parser/parse-command.handler';
import { ParseController } from './parser/parse.controller';

const isMobile =
  navigator.userAgent.toLowerCase().includes('android') ??
  (
    navigator as {
      userAgentData?: {
        mobile: boolean;
      };
    }
  ).userAgentData?.mobile ??
  false;

const parsePageCommand = new ParsePageCommand();
const parseSelectionCommand = new ParseSelectionCommand();

const lookupController = new LookupController();
const lookupTextCommandHandler = new LookupTextCommandHandler(lookupController);

const parseController = new ParseController();
const parseCommandHandler = new ParseCommandHandler(parseController);
const abortRequestCommandHandler = new AbortRequestCommandHandler(parseController);

const updateCardStateCommandHandler = new UpdateCardStateCommandHandler();
const gradeCardCommandHandler = new GradeCardCommandHandler();
const runDeckActionCommandHandler = new RunDeckActionCommandHandler();
const fetchStudyDecksCommandHandler = new FetchStudyDecksCommandHandler();
const addToStudyDeckCommandHandler = new AddToStudyDeckCommandHandler();
const forgetCardCommandHandler = new ForgetCardCommandHandler();
const openSettingsCommandHandler = new OpenSettingsCommandHandler();
const updateBadgeCommandHandler = new UpdateBadgeCommandHandler();

const handlerCollection = new BackgroundCommandHandlerCollection(
  lookupTextCommandHandler,
  parseCommandHandler,
  abortRequestCommandHandler,
  updateCardStateCommandHandler,
  gradeCardCommandHandler,
  runDeckActionCommandHandler,
  fetchStudyDecksCommandHandler,
  addToStudyDeckCommandHandler,
  forgetCardCommandHandler,
  openSettingsCommandHandler,
  updateBadgeCommandHandler,
);

handlerCollection.listen();

async function ensureOffscreenDocument(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (contexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'views/offscreen.html',
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: 'TTS audio playback',
  });
}

runtime.onMessage.addListener(
  (
    message: { type?: string; wordId?: number; readingIndex?: number; voice?: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type === 'stopTts') {
      void runtime.sendMessage({ type: 'stopTtsAudio' });

      return false;
    }

    if (message.type !== 'playTts') {
      return false;
    }

    (async (): Promise<{ ok: boolean; error?: string }> => {
      const apiEndpoint = await getConfiguration('jitenApiEndpoint');
      const baseUrl = apiEndpoint.replace(/\/api\/?$/, '');
      const url =
        `${baseUrl}/api/tts/word/${message.wordId}/${message.readingIndex}` +
        `?voice=${encodeURIComponent(message.voice ?? 'female')}`;

      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const data = Array.from(new Uint8Array(buffer));

      await ensureOffscreenDocument();

      return runtime.sendMessage({ type: 'playTtsAudio', data });
    })()
      .then((result) => sendResponse(result))
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }));

    return true;
  },
);

onBroadcastMessage('profileSwitched', () => {
  invalidateProfileCache();
  invalidateSetConfigurationCache();
});

onBroadcastMessage('configurationUpdated', async () => {
  const tabIds = getStyledTabIds();

  for (const tabId of tabIds) {
    await parseCommandHandler.injectWordStyles(tabId);
  }
});

async function migrateWordStyleConfig(): Promise<void> {
  const existing = await getConfiguration('wordStyleConfig');

  if (existing?.v) {
    return;
  }

  await setConfiguration('wordStyleConfig', structuredClone(DEFAULT_WORD_STYLE_CONFIG));
}

addInstallListener(async ({ reason }) => {
  if (reason === 'install') {
    await migrateToProfiles();
    await openOptionsPage();
  }

  if (reason === 'update') {
    await migrateToProfiles();
    await migrateWordStyleConfig();

    const skipReleaseNotes = await getConfiguration('skipReleaseNotes');

    if (skipReleaseNotes) {
      return;
    }

    await openView('changelog');
  }
});

if (!isMobile) {
  addContextMenu(
    {
      id: 'parse-page',
      title: 'Parse Page',
      contexts: ['page'],
    },
    (_, { id }) => parsePageCommand.send(id!),
  );

  addContextMenu(
    {
      id: 'parse-selection',
      title: 'Parse Selection',
      contexts: ['selection'],
    },
    (_, { id }) => parseSelectionCommand.send(id!),
  );
}
