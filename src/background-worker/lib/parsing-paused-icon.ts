import { getParsingPaused } from '@shared/extension/get-parsing-paused';
import { onParsingPausedChanged } from '@shared/extension/on-parsing-paused-changed';

const ICON_SIZES = [16, 24, 32, 48, 64, 96, 128];

const iconPaths = (prefix: string): Record<string, string> =>
  Object.fromEntries(ICON_SIZES.map((size) => [size, `/assets/${prefix}${size}.png`]));

const applyParsingPausedIcon = async (paused: boolean): Promise<void> => {
  await chrome.action.setIcon({ path: iconPaths(paused ? 'paused-' : '') });
  await chrome.action.setTitle({
    title: paused ? 'Jiten Reader (parsing paused)' : 'Jiten Reader',
  });
};

export const initParsingPausedIcon = (): void => {
  onParsingPausedChanged((paused) => void applyParsingPausedIcon(paused));

  // The global icon is reset on browser restart and extension reload, so reapply on every worker start.
  void getParsingPaused().then(applyParsingPausedIcon);
};
