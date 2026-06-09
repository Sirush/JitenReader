import { getConfiguration, invalidateProfileCache } from '@shared/configuration/get-configuration';
import { invalidateSetConfigurationCache } from '@shared/configuration/set-configuration';
import { debug } from '@shared/debug';
import { displayToast } from '@shared/dom/display-toast';
import { HostMeta, PredefinedHostMeta } from '@shared/host-meta/types';
import { JitenCardState } from '@shared/jiten/types';
import { FetchStudyDecksCommand } from '@shared/messages/background/fetch-study-decks.command';
import { LookupTextCommand } from '@shared/messages/background/lookup-text.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { receiveBackgroundMessage } from '@shared/messages/receiving/receive-background-message';
import { getFeatures } from './features/get-features';
import { KeybindManager } from './integration/keybind-manager';
import { MassReviewAction } from './integration/mass-review-action';
import { NoFocusTrigger } from './integration/no-focus-trigger';
import { Registry } from './integration/registry';
import { AutomaticParser } from './parser/automatic.parser';
import { getCustomParser } from './parser/get-custom-parser';
import { NoParser } from './parser/no.parser';
import { TriggerParser } from './parser/trigger.parser';
import { PopupManager } from './popup/popup-manager';
import { StatusBar } from './status-bar/status-bar';

export class AJB {
  private _lookupKeyManager = new KeybindManager(['lookupSelectionKey']);
  private _statusBarKeyManager = new KeybindManager(['toggleStatusBarKey']);
  private _massReviewAction = new MassReviewAction();
  private _lastUrl = location.href;
  private _lastMetaKey = '';
  private _navigationGeneration = 0;

  constructor() {
    debug('Initialize AJB', { mainFrame: window === window.top });

    this._lookupKeyManager.activate();

    NoFocusTrigger.get().install();

    Registry.wordEventDelegator.initialise();

    receiveBackgroundMessage('toast', displayToast);
    Registry.events.on('lookupSelectionKey', () => {
      this.withHiddenRT(() => {
        this.lookupText(window.getSelection()?.toString());
      });
    });

    this.installParsers();
    this.watchNavigation();

    Registry.popupManager = new PopupManager();

    if (Registry.isMainFrame) {
      Registry.statusBar = new StatusBar();
      this._statusBarKeyManager.activate();

      Registry.events.on('toggleStatusBarKey', () => {
        Registry.statusBar?.toggle();
      });

      void this.installReviewButton();
    }

    onBroadcastMessage(
      'cardStateUpdated',
      (wordId: number, readingIndex: number, state: JitenCardState[], deckIds: number[]) => {
        Registry.updateCard(wordId, readingIndex, state, deckIds);
        Registry.statusBar?.recalculateStats();
      },
    );

    onBroadcastMessage(
      'configurationUpdated',
      async (): Promise<void> => {
        const skipFurigana = await getConfiguration('skipFurigana');
        const generatePitch = await getConfiguration('generatePitch');
        const markTopX = await getConfiguration('markTopX');
        const markTopXCount = await getConfiguration('markTopXCount');
        const markAllTypes = await getConfiguration('markAllTypes');
        const markIPlus1 = await getConfiguration('markIPlus1');
        const minSentenceLength = await getConfiguration('minSentenceLength');
        const iPlusOneMaxFrequency = await getConfiguration('iPlusOneMaxFrequency');
        const iPlusOneMaxFrequencyCount = await getConfiguration('iPlusOneMaxFrequencyCount');
        const newStates = await getConfiguration('newStates');
        const markWordsInDeck = await getConfiguration('markWordsInDeck');

        Registry.textHighlighterOptions.skipFurigana = skipFurigana;
        Registry.textHighlighterOptions.generatePitch = generatePitch;
        Registry.textHighlighterOptions.markIPlus1 = markIPlus1;
        Registry.textHighlighterOptions.markAll = markAllTypes;
        Registry.textHighlighterOptions.markFrequency = markTopX ? markTopXCount : false;
        Registry.textHighlighterOptions.minSentenceLength = minSentenceLength;
        Registry.textHighlighterOptions.iPlusOneMaxFrequency = iPlusOneMaxFrequency
          ? iPlusOneMaxFrequencyCount
          : false;
        Registry.textHighlighterOptions.newStates = newStates;
        Registry.textHighlighterOptions.markWordsInDeck = markWordsInDeck;
      },
      true,
    );

    onBroadcastMessage('profileSwitched', (_profileId: string) => {
      invalidateProfileCache();
      invalidateSetConfigurationCache();
      void this.loadStudyDecks();
    });

    void this.loadStudyDecks();
    void this.installFeatures();
  }

  protected async loadStudyDecks(): Promise<void> {
    try {
      const decks = await new FetchStudyDecksCommand().call();

      Registry.setStudyDecks(decks);
    } catch {
      // Not signed in / API unavailable — deck membership marking simply stays inert.
    }
  }

  protected lookupText(text: string | undefined): void {
    if (!text?.length) {
      displayToast('error', 'No text to lookup!');

      return;
    }

    new LookupTextCommand(text).send();
  }

  protected withHiddenRT(action: () => void): void {
    const style = document.createElement('style');

    style.innerText = 'rt { display: none !important; }';
    document.head.appendChild(style);

    try {
      action();
    } finally {
      document.head.removeChild(style);
    }
  }

  protected installParsers(): void {
    const { hostEvaluator, parsers } = Registry;
    const isPredefined = (meta: HostMeta): meta is PredefinedHostMeta => 'id' in meta;
    const generation = this._navigationGeneration;

    void hostEvaluator.load().then(({ canBeTriggered, relevantMeta }) => {
      if (generation !== this._navigationGeneration) {
        return;
      }

      this._lastMetaKey = hostEvaluator.metaKey;

      if (!canBeTriggered) {
        parsers.push(new NoParser(hostEvaluator.rejectionReason));
      }

      for (const meta of relevantMeta) {
        if (!meta.auto) {
          if (!meta.disabled) {
            parsers.push(new TriggerParser(meta));
          }

          continue;
        }

        if (isPredefined(meta) && meta.custom) {
          parsers.push(getCustomParser(meta.custom, meta));

          continue;
        }

        parsers.push(new AutomaticParser(meta));
      }
    });
  }

  protected async installFeatures(): Promise<void> {
    const features = await getFeatures();

    for (const feature of features) {
      feature.apply();
    }
  }

  private async installReviewButton(): Promise<void> {
    const showButton = await getConfiguration('statusBarShowReviewButton');
    const disableReviews = await getConfiguration('jitenDisableReviews');

    if (!showButton || disableReviews) {
      return;
    }

    Registry.statusBar?.addButton({
      id: 'ajb-review-btn',
      icon: '✅',
      tooltip: 'Review on-screen words as good',
      handler: () => void this._massReviewAction.confirmViaDialog(),
    });
  }

  private watchNavigation(): void {
    setInterval(() => {
      if (location.href !== this._lastUrl) {
        this._lastUrl = location.href;
        this.handleNavigationChange();
      }
    }, 500);

    window.addEventListener('popstate', () => {
      if (location.href !== this._lastUrl) {
        this._lastUrl = location.href;
        this.handleNavigationChange();
      }
    });
  }

  private handleNavigationChange(): void {
    const { hostEvaluator } = Registry;
    const generation = ++this._navigationGeneration;

    hostEvaluator.updateUrl(location.href);

    void hostEvaluator.load().then(() => {
      if (generation !== this._navigationGeneration) {
        return;
      }

      const newMetaKey = hostEvaluator.metaKey;

      if (newMetaKey === this._lastMetaKey) {
        return;
      }

      debug('SPA navigation detected, reinstalling parsers');

      this.destroyParsers();
      this.installParsers();
    });
  }

  private destroyParsers(): void {
    const { batchController, parsers, sentenceManager } = Registry;

    batchController.abortAll();
    parsers.forEach((parser) => parser.destroy());
    parsers.length = 0;
    sentenceManager.reset();
    Registry.clearCards();
    Registry.statusBar?.recalculateStats();
  }
}

new AJB();
