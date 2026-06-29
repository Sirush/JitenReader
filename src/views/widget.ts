import { getConfiguration } from '@shared/configuration/get-configuration';
import { setConfiguration } from '@shared/configuration/set-configuration';
import { appendElement } from '@shared/dom/append-element';
import { onLoaded } from '@shared/dom/on-loaded';
import { getParsingPaused } from '@shared/extension/get-parsing-paused';
import { getTabs } from '@shared/extension/get-tabs';
import { openOptionsPage } from '@shared/extension/open-options-page';
import { openView } from '@shared/extension/open-view';
import { setParsingPaused } from '@shared/extension/set-parsing-paused';
import { isDisabled } from '@shared/host-meta/is-disabled';
import { ConfigurationUpdatedCommand } from '@shared/messages/broadcast/configuration-updated.command';
import { ParsingPausedCommand } from '@shared/messages/broadcast/parsing-paused.command';
import { OpenReaderModeCommand } from '@shared/messages/foreground/open-reader-mode.command';
import { ParsePageCommand } from '@shared/messages/foreground/parse-page.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { getThemeCssVars } from '@shared/theme/get-theme-css-vars';
import { resolveThemeSync } from '@shared/word-style/resolve-theme';
import { getSavedThemes } from '@shared/word-style/saved-themes-state';
import { SavedThemesList } from '@shared/word-style/saved-themes.types';
import { PRESET_THEMES } from '@shared/word-style/themes';
import { HTMLProfileSelectorElement } from './elements/html-profile-selector-element';

customElements.define('profile-selector', HTMLProfileSelectorElement);

const applyThemeVars = async (): Promise<void> => {
  const cssVars = await getThemeCssVars();
  let styleEl = document.getElementById('jiten-theme-vars') as HTMLStyleElement;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'jiten-theme-vars';
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = cssVars;
};

void applyThemeVars();
onBroadcastMessage('configurationUpdated', () => void applyThemeVars());

const updatePauseToggle = (toggle: HTMLElement, paused: boolean): void => {
  toggle.innerText = paused ? 'Paused' : 'Enabled';
  toggle.classList.toggle('paused', paused);
};

onLoaded(async () => {
  document.getElementById('settings')?.addEventListener('click', () => {
    void openOptionsPage();
  });

  document.getElementById('changelog')?.addEventListener('click', () => {
    void openView('changelog');
  });

  document.getElementById('reader-mode')?.addEventListener('click', () => {
    void getTabs({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        new OpenReaderModeCommand().send(tab.id, () => window.close());
      }
    });
  });

  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
  const currentConfig = await getConfiguration('wordStyleConfig');
  const savedThemes: SavedThemesList = await getSavedThemes();

  const populateWidgetThemeDropdown = (): void => {
    themeSelect.innerHTML = '';

    const presetsGroup = document.createElement('optgroup');

    presetsGroup.label = 'Presets';

    for (const [key, { label }] of PRESET_THEMES) {
      const option = document.createElement('option');

      option.value = key;
      option.textContent = label;
      presetsGroup.appendChild(option);
    }

    themeSelect.appendChild(presetsGroup);

    if (savedThemes.length > 0) {
      const savedGroup = document.createElement('optgroup');

      savedGroup.label = 'Saved';

      for (const saved of savedThemes) {
        const option = document.createElement('option');

        option.value = saved.id;
        option.textContent = saved.label;
        savedGroup.appendChild(option);
      }

      themeSelect.appendChild(savedGroup);
    }

    const resolved = resolveThemeSync(currentConfig.theme, savedThemes);

    if (resolved.type === 'custom') {
      const customOption = document.createElement('option');

      customOption.value = 'custom';
      customOption.textContent = 'Custom';
      themeSelect.appendChild(customOption);
    }

    themeSelect.value = currentConfig.theme;
  };

  populateWidgetThemeDropdown();

  themeSelect.addEventListener('change', () => {
    if (currentConfig.theme === 'custom' && themeSelect.value !== 'custom') {
      if (!confirm('Your unsaved custom theme will be lost. Continue?')) {
        themeSelect.value = 'custom';

        return;
      }
    }

    const preset = PRESET_THEMES.get(themeSelect.value);

    if (preset) {
      currentConfig.theme = preset.config.theme;

      void setConfiguration('wordStyleConfig', structuredClone(preset.config)).then(() => {
        new ConfigurationUpdatedCommand().send();
      });

      return;
    }

    const saved = savedThemes.find((t) => t.id === themeSelect.value);

    if (saved) {
      const config = structuredClone(saved.config);

      config.theme = saved.id;
      currentConfig.theme = saved.id;

      void setConfiguration('wordStyleConfig', config).then(() => {
        new ConfigurationUpdatedCommand().send();
      });
    }
  });

  const pauseToggle = document.getElementById('pause-toggle')!;
  let isPaused = await getParsingPaused();

  updatePauseToggle(pauseToggle, isPaused);

  pauseToggle.addEventListener('click', () => {
    isPaused = !isPaused;
    void setParsingPaused(isPaused).then(() => {
      updatePauseToggle(pauseToggle, isPaused);
      new ParsingPausedCommand(isPaused).send();
    });
  });

  if (isPaused) {
    return;
  }

  const tabsFilter: Parameters<typeof chrome.tabs.query>[0] = { currentWindow: true };

  const showCurrentOnTop = await getConfiguration('showCurrentOnTop');
  const hideInactiveTabs = await getConfiguration('hideInactiveTabs');

  if (hideInactiveTabs) {
    tabsFilter.active = true;

    document.getElementById('not-parsable')!.innerText = 'Current tab parsed or disabled';
  }

  const allTabs = await getTabs(tabsFilter);
  const parsePage = new ParsePageCommand();

  let renderedTabs: chrome.tabs.Tab[] = [];

  for (const tab of allTabs) {
    if (
      tab.id &&
      !tab.url?.startsWith('about://') &&
      !tab.url?.startsWith('chrome://') &&
      !(await isDisabled(tab.url!))
    ) {
      renderedTabs.push(tab);
    }
  }

  if (showCurrentOnTop) {
    renderedTabs = renderedTabs.sort((a, b) => {
      if (a.active) {
        return -1;
      }

      if (b.active) {
        return 1;
      }

      return 0;
    });
  }

  for (const tab of renderedTabs) {
    appendElement<'a'>('.pages', {
      tag: 'a',
      class: ['outline'],
      handler: (): void => parsePage.send(tab.id!, () => window.close()),
      innerText: `Parse "${tab.title ?? 'Untitled'}"`,
    });
  }
});
