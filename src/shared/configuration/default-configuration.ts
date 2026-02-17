import { JitenCardState } from '../jiten/types';
import { DEFAULT_WORD_STYLE_CONFIG } from '../word-style/themes';
import { ConfigurationSchema } from './types';

export const DEFAULT_CONFIGURATION = Object.freeze<ConfigurationSchema>({
  schemaVersion: 1,

  //#region Theme
  themeBgColour: '#181818',
  themeAccentColour: '#D8B9FA',
  //#endregion

  //#region JPDB Integration

  jitenApiKey: '',
  jitenApiEndpoint: 'https://api.jiten.moe/api',

  //#endregion
  //#region Mining configuration

  jitenAddToForq: false,
  setSentences: false,
  jitenDisableReviews: false,
  jitenUseTwoGrades: false,

  // JPDB Flag settings
  jitenRotateFlags: false,
  jitenRotateCycle: false,
  jitenCycleNeverForget: true,
  jitenCycleBlacklist: true,
  jitenCycleSuspended: false,

  //#endregion
  //#region Parsing

  hideInactiveTabs: true,
  showCurrentOnTop: true,
  showParseButton: true,

  enabledFeatures: [],
  disabledParsers: [],
  additionalHosts: '',
  additionalMeta: '[]',

  //#endregion
  //#region Texthighlighting

  newStates: [JitenCardState.NEW],

  markTopX: false,
  markAllTypes: false,
  markTopXCount: 10_000,
  markIPlus1: false,
  minSentenceLength: 3,
  iPlusOneMaxFrequency: false,
  iPlusOneMaxFrequencyCount: 15_000,
  skipFurigana: false,
  generatePitch: false,

  wordStyleConfig: structuredClone(DEFAULT_WORD_STYLE_CONFIG),
  customWordCSS: '',

  //#endregion
  //#region Popup

  showPopupOnHover: false,
  renderCloseButton: true,
  touchscreenSupport: false,
  disableFadeAnimation: false,
  leftAlignPopupToWord: false,

  // Popup settings
  hideAfterAction: true,
  hidePopupAutomatically: true,
  hidePopupDelay: 500,

  showMiningActions: true,
  moveMiningActions: false,

  showGradingActions: true,
  moveGradingActions: false,

  showRotateActions: false,
  moveRotateActions: false,

  showConjugations: true,

  customPopupCSS: '',

  //#endregion
  //#region Keybinds

  // General keybinds
  parseKey: [{ key: 'P', code: 'KeyP', modifiers: ['Alt'] }],
  showPopupKey: [{ key: 'Shift', code: 'ShiftLeft', modifiers: [] }],
  showAdvancedDialogKey: [],
  lookupSelectionKey: [{ key: 'L', code: 'KeyL', modifiers: ['Alt'] }],

  // Mining keybinds
  addToMiningKey: [],
  addToBlacklistKey: [],
  addToNeverForgetKey: [],
  addToSuspendedKey: [],
  cycleMasterBlacklistKey: [],

  // Review keybinds
  jitenReviewNothing: [],
  jitenReviewSomething: [],
  jitenReviewHard: [],
  jitenReviewOkay: [],
  jitenReviewEasy: [],
  jitenReviewFail: [],
  jitenReviewPass: [],

  // Rotation keybinds
  jitenRotateForward: [],
  jitenRotateBackward: [],

  //#endregion
  //#region Anki Integration (not implemented!)

  enableAnkiIntegration: false,
  ankiUrl: 'http://localhost:8765',
  ankiProxyUrl: '',
  ankiMiningConfig: {
    deck: '',
    model: '',
    proxy: false,
    wordField: '',
    readingField: '',
    templateTargets: [],
  },
  ankiBlacklistConfig: {
    deck: '',
    model: '',
    proxy: false,
    wordField: '',
    readingField: '',
    templateTargets: [],
  },
  ankiNeverForgetConfig: {
    deck: '',
    model: '',
    proxy: false,
    wordField: '',
    readingField: '',
    templateTargets: [],
  },
  ankiReadonlyConfigs: [],

  //#endregion
  //#region Status Bar

  statusBarEnabled: true,
  statusBarAutoHide: true,
  statusBarHideIcon: false,
  statusBarShowBadge: true,
  statusBarPosition: 'bottom',
  toggleStatusBarKey: [{ key: 'S', code: 'KeyS', modifiers: ['Alt'] }],

  //#endregion

  skipReleaseNotes: false,
  enableDebugMode: false,
});
