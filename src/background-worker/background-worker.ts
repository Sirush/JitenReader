import { getConfiguration, invalidateProfileCache } from '@shared/configuration/get-configuration';
import { migrateToProfiles } from '@shared/configuration/migrate-to-profiles';
import { invalidateSetConfigurationCache } from '@shared/configuration/set-configuration';
import { addContextMenu } from '@shared/extension/add-context-menu';
import { addInstallListener } from '@shared/extension/add-install-listener';
import { openOptionsPage } from '@shared/extension/open-options-page';
import { openView } from '@shared/extension/open-view';
import { ParsePageCommand } from '@shared/messages/foreground/parse-page.command';
import { ParseSelectionCommand } from '@shared/messages/foreground/parse-selection.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
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
  forgetCardCommandHandler,
  openSettingsCommandHandler,
  updateBadgeCommandHandler,
);

handlerCollection.listen();

onBroadcastMessage('profileSwitched', () => {
  invalidateProfileCache();
  invalidateSetConfigurationCache();
});

addInstallListener(async ({ reason }) => {
  if (reason === 'install') {
    await migrateToProfiles();
    await openOptionsPage();
  }

  if (reason === 'update') {
    await migrateToProfiles();

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
