import { DeckConfiguration, DiscoverWordConfiguration } from '../anki/types';
import { JitenCardState } from '../jiten/types';
import { ReaderTheme } from '../reader-mode/themes';
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

  // Review on-screen words / auto-fail on dwell
  massReviewNew: boolean;
  massReviewDue: boolean;
  massReviewYoung: boolean;
  massReviewMature: boolean;
  massReviewCooldownHours: number;
  massReviewRequireConfirm: boolean;
  autoFailOnDwell: boolean;
  autoFailDwellDuration: number;

  jitenMineToStudyDeck: boolean;
  jitenStudyDeckId: string;
  jitenAutoMineOnReview: boolean;

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

  readerModeTheme: ReaderTheme;
  readerModeFont: string;
  readerModeFontSize: number;
  readerModeBold: boolean;
  readerModeWidth: number;
  readerModeLineHeight: number;

  pdfReaderMode: 'reflow' | 'faithful';

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
  markWordsInDeck: boolean;

  wordStyleConfig: WordStyleConfig;
  customWordCSS: string;

  //#endregion
  //#region Popup

  showPopupOnHover: boolean;
  renderCloseButton: boolean;
  closeButtonBottomLeft: boolean;
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
  showDeckButton: boolean;

  showGradingActions: boolean;
  moveGradingActions: boolean;

  showRotateActions: boolean;
  moveRotateActions: boolean;

  showConjugations: boolean;
  showPitchDiagrams: boolean;
  showDeckMembership: boolean;
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
  readerModeKey: Keybinds;

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
  massReviewKey: Keybinds;

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
  statusBarShowReviewButton: boolean;
  statusBarPosition: 'top' | 'bottom';
  toggleStatusBarKey: Keybinds;

  //#endregion

  skipReleaseNotes: boolean;
  enableDebugMode: boolean;
};
