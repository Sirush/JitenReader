import { DeckConfiguration, DiscoverWordConfiguration } from '../anki/types';
import { JitenCardState } from '../jiten/types';
import { WordStyleConfig } from '../word-style/types';

export type Keybind = { key: string; code: string; modifiers: string[] };
export type Keybinds = Keybind | [Keybind?, Keybind?];
export type ConfigurationSchema = {
  schemaVersion: number;

  //#region Theme
  themeBgColour: string;
  themeAccentColour: string;
  //#endregion

  //#region Jiten Integration

  jitenApiKey: string;
  jitenApiEndpoint: string;

  //#endregion
  //#region Mining configuration

  jitenAddToForq: boolean;
  setSentences: boolean;
  jitenDisableReviews: boolean;
  jitenUseTwoGrades: boolean;

  jitenMineToStudyDeck: boolean;
  jitenStudyDeckId: string;

  // Jiten Flag settings
  jitenRotateFlags: boolean;
  jitenRotateCycle: boolean;
  jitenCycleNeverForget: boolean;
  jitenCycleBlacklist: boolean;
  jitenCycleSuspended: boolean;

  //#endregion
  //#region Parsing

  hideInactiveTabs: boolean;
  showCurrentOnTop: boolean;
  showParseButton: boolean;

  enabledFeatures: string[];
  disabledParsers: string[];
  additionalHosts: string;
  additionalMeta: string;

  //#endregion
  //#region Texthighlighting

  newStates: JitenCardState[];

  markTopX: boolean;
  markTopXCount: number;
  markAllTypes: boolean;
  markIPlus1: boolean;
  minSentenceLength: number;
  iPlusOneMaxFrequency: boolean;
  iPlusOneMaxFrequencyCount: number;
  skipFurigana: boolean;
  generatePitch: boolean;

  wordStyleConfig: WordStyleConfig;
  customWordCSS: string;

  //#endregion
  //#region Popup

  showPopupOnHover: boolean;
  renderCloseButton: boolean;
  touchscreenSupport: boolean;
  touchscreenDoubleTap: boolean;
  touchscreenLongPress: boolean;
  touchscreenLongPressDuration: number;
  disableFadeAnimation: boolean;
  leftAlignPopupToWord: boolean;

  // Popup settings
  hideAfterAction: boolean;
  hidePopupAutomatically: boolean;
  hidePopupDelay: number;

  showMiningActions: boolean;
  moveMiningActions: boolean;

  showGradingActions: boolean;
  moveGradingActions: boolean;

  showRotateActions: boolean;
  moveRotateActions: boolean;

  showConjugations: boolean;
  showPitchDiagrams: boolean;
  disableHeadWordLink: boolean;

  ttsVoice: string;
  ttsAutoPlay: boolean;

  popupWidth: number;
  popupHeight: number;

  customPopupCSS: string;

  //#endregion
  //#region Keybinds

  // General keybinds
  parseKey: Keybinds;
  showPopupKey: Keybinds;
  showAdvancedDialogKey: Keybinds;
  lookupSelectionKey: Keybinds;

  // Mining keybinds
  addToStudyDeckKey: Keybinds;
  addToMiningKey: Keybinds;
  addToBlacklistKey: Keybinds;
  addToNeverForgetKey: Keybinds;
  addToSuspendedKey: Keybinds;
  cycleMasterBlacklistKey: Keybinds;

  // Review keybinds
  jitenReviewNothing: Keybinds;
  jitenReviewSomething: Keybinds;
  jitenReviewHard: Keybinds;
  jitenReviewOkay: Keybinds;
  jitenReviewEasy: Keybinds;
  jitenReviewFail: Keybinds;
  jitenReviewPass: Keybinds;

  // Rotation keybinds
  jitenRotateForward: Keybinds;
  jitenRotateBackward: Keybinds;

  //#endregion
  //#region Anki Integration (not implemented!)

  enableAnkiIntegration: boolean;
  ankiUrl: string;
  ankiProxyUrl: string;
  ankiMiningConfig: DeckConfiguration;
  ankiBlacklistConfig: DeckConfiguration;
  ankiNeverForgetConfig: DeckConfiguration;
  ankiReadonlyConfigs: DiscoverWordConfiguration[];

  //#endregion
  //#region Status Bar

  statusBarEnabled: boolean;
  statusBarAutoHide: boolean;
  statusBarHideIcon: boolean;
  statusBarShowBadge: boolean;
  statusBarPosition: 'top' | 'bottom';
  toggleStatusBarKey: Keybinds;

  //#endregion

  skipReleaseNotes: boolean;
  enableDebugMode: boolean;
};
