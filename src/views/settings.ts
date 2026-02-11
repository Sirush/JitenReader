import { getConfiguration } from '@shared/configuration/get-configuration';
import { getActiveProfileId } from '@shared/configuration/profiles-state';
import { setConfiguration } from '@shared/configuration/set-configuration';
import { ConfigurationSchema } from '@shared/configuration/types';
import { createElement } from '@shared/dom/create-element';
import { displayToast } from '@shared/dom/display-toast';
import { findElement } from '@shared/dom/find-element';
import { withElement } from '@shared/dom/with-element';
import { withElements } from '@shared/dom/with-elements';
import { ping } from '@shared/jiten/ping';
import { ConfigurationUpdatedCommand } from '@shared/messages/broadcast/configuration-updated.command';
import { ProfileSwitchedCommand } from '@shared/messages/broadcast/profile-switched.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { getThemeCssVars } from '@shared/theme/get-theme-css-vars';
import { HTMLFeaturesInputElement } from './elements/html-features-input-element';
import { HTMLKeybindInputElement } from './elements/html-keybind-input-element';
import { HTMLMiningInputElement } from './elements/html-mining-input-element';
import { HTMLNewStateInputElement } from './elements/html-new-state-input-element';
import { HTMLParsersInputElement } from './elements/html-parsers-input-element';
import { HTMLProfileManagerElement } from './elements/html-profile-manager-element';
import { HTMLProfileSelectorElement } from './elements/html-profile-selector-element';
import { HTMLWordStyleEditorElement } from './elements/html-word-style-editor-element';

customElements.define('mining-input', HTMLMiningInputElement);
customElements.define('profile-selector', HTMLProfileSelectorElement);
customElements.define('keybind-input', HTMLKeybindInputElement);
customElements.define('parsers-input', HTMLParsersInputElement);
customElements.define('features-input', HTMLFeaturesInputElement);
customElements.define('new-state-input', HTMLNewStateInputElement);
customElements.define('profile-manager', HTMLProfileManagerElement);
customElements.define('word-style-editor', HTMLWordStyleEditorElement);

withElement('#currentProfile', (selector: HTMLProfileSelectorElement) => {
  selector.addEventListener('profilechange', () => {
    window.location.reload();
  });
});

const localConfiguration = new Map<
  keyof ConfigurationSchema,
  ConfigurationSchema[keyof ConfigurationSchema]
>();
const bindings = new Map<string, Set<HTMLElement>>();
const validators: Partial<
  Record<keyof ConfigurationSchema, (value: unknown) => boolean | Promise<boolean>>
> = {
  jitenApiKey: validateJitenApiKey,
};

const configurationUpdatedCommand = new ConfigurationUpdatedCommand();

//#region Theme Variables

const getThemeStyleEl = (): HTMLStyleElement => {
  let styleEl = document.getElementById('jiten-theme-vars') as HTMLStyleElement;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'jiten-theme-vars';
    document.head.appendChild(styleEl);
  }

  return styleEl;
};

const applyThemeVars = async (): Promise<void> => {
  getThemeStyleEl().textContent = await getThemeCssVars();
};

const applyThemeVarsFromInputs = (): void => {
  const bg = (document.getElementById('themeBgColour') as HTMLInputElement)?.value || '#181818';
  const accent =
    (document.getElementById('themeAccentColour') as HTMLInputElement)?.value || '#D8B9FA';

  getThemeStyleEl().textContent = `:root, :host { --jiten-bg: ${bg}; --jiten-accent: ${accent}; }`;
};

void applyThemeVars();
onBroadcastMessage('configurationUpdated', () => void applyThemeVars());

const setupColourPicker = (colourId: string, textId: string): void => {
  const colourInput = document.getElementById(colourId) as HTMLInputElement;
  const textInput = document.getElementById(textId) as HTMLInputElement;

  if (!colourInput || !textInput) {
    return;
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const saveAndApply = (value: string): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Apply theme vars immediately from current input values for instant visual feedback
    applyThemeVarsFromInputs();

    // Debounce the save to avoid spamming storage
    debounceTimer = setTimeout(() => {
      void setConfiguration(colourId as keyof ConfigurationSchema, value).then(() => {
        configurationUpdatedCommand.send();
      });
    }, 150);
  };

  // Initial load: sync text input from colour input (which is loaded by withElements)
  const syncTextFromColour = (): void => {
    textInput.value = colourInput.value.toUpperCase();
  };

  // Wait for colour input to be loaded by withElements, then sync text
  setTimeout(syncTextFromColour, 50);

  // When user types in text input, update colour picker and save
  textInput.addEventListener('input', () => {
    const value = textInput.value.trim();

    if (/^#[0-9A-Fa-f]{6}$/i.test(value)) {
      colourInput.value = value;
      saveAndApply(value);
    }
  });

  // When user picks colour, update text input and save
  colourInput.addEventListener('input', () => {
    textInput.value = colourInput.value.toUpperCase();
    saveAndApply(colourInput.value);
  });
};

setupColourPicker('themeBgColour', 'themeBgColourText');
setupColourPicker('themeAccentColour', 'themeAccentColourText');

//#endregion

//#region Init Interactions

withElements(
  'input, textarea, select, keybind-input, parsers-input, features-input, new-state-input, word-style-editor',
  (field: HTMLInputElement) => {
    const internal = field.hasAttribute('internal');
    const ignored = ['hidden', 'submit', 'button'];
    const checkbox = field.type === 'checkbox';

    if (internal || ignored.includes(field.type)) {
      return;
    }

    void getConfiguration(field.name as keyof ConfigurationSchema)
      // Load current or default configuration
      .then((value) => {
        if (checkbox) {
          field.checked = value as boolean;
        } else {
          field.value = value as string;
        }

        return validateAndSet(field.name as keyof ConfigurationSchema, value);
      })
      // Apply change listeners
      .then(() => {
        field.onchange = (): void => {
          const value = checkbox ? field.checked : field.value;

          void validateAndSet(field.name as keyof ConfigurationSchema, value, async () => {
            await setConfiguration(field.name as keyof ConfigurationSchema, value);
            configurationUpdatedCommand.send();

            displayToast('success', 'Settings saved successfully', undefined, true);
          });
        };
      });
  },
);

withElement('#apiTokenButton', (button) => {
  button.onclick = (): void => {
    withElement('#jitenApiKey', (i: HTMLInputElement) => {
      void validateJitenApiKey(i.value);
    });
  };
});

withElement('#export-settings', (button) => {
  button.onclick = (event: Event): void => {
    event.stopPropagation();
    event.preventDefault();

    const downloadTitleWithDate = `configuration-${new Date().toISOString().slice(0, 10)}.json`;

    void chrome.storage.local.get().then((configuration) => {
      const includeApiKey = (document.getElementById('exportApiKey') as HTMLInputElement)?.checked;

      if (!includeApiKey) {
        Object.keys(configuration).forEach((key) => {
          if (key.includes('jitenApiKey')) {
            delete configuration[key];
          }
        });
      }

      const blob = new Blob([JSON.stringify(configuration, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const a = createElement('a', {
        attributes: { href: url, download: downloadTitleWithDate },
      });

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    });
  };
});

withElement('#import-settings', (button) => {
  button.onclick = (event: Event): void => {
    event.stopPropagation();
    event.preventDefault();

    const fileInput = createElement('input', {
      attributes: { type: 'file', accept: '.json' },
    });

    fileInput.onchange = async (): Promise<void> => {
      if (!fileInput.files?.length) {
        return;
      }

      const file = fileInput.files[0];
      const text = await file.text();

      let data: Record<string, unknown> | undefined;

      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        alert('Failed to import settings: invalid JSON file');

        return;
      }

      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);

      const activeProfileId = await getActiveProfileId();

      new ProfileSwitchedCommand(activeProfileId).send();
      configurationUpdatedCommand.send();

      window.location.reload();
    };

    fileInput.click();
  };
});

withElement('#exportApiKey', (checkbox: HTMLInputElement) => {
  checkbox.addEventListener('change', () => {
    const warning = document.getElementById('exportApiKeyWarning');

    if (warning) {
      warning.style.display = checkbox.checked ? 'block' : 'none';
    }
  });
});

//#endregion
//#region Field Updates

function afterValueUpdated(
  key: keyof ConfigurationSchema,
  value: ConfigurationSchema[keyof ConfigurationSchema],
): void {
  localConfiguration.set(key, value);

  updateBindings(key);
}

async function validateAndSet(
  key: keyof ConfigurationSchema,
  value: ConfigurationSchema[keyof ConfigurationSchema],
  afterValidate?: () => void | Promise<void>,
): Promise<void> {
  if (validators[key]) {
    const isValid = await validators[key](value);

    if (!isValid) {
      updateBindings(key);

      return;
    }
  }

  afterValueUpdated(key, value);

  await afterValidate?.();
}

//#endregion
//#region Field Bindings

withElements('[data-show]', (element) => {
  const attributeValue = element.getAttribute('data-show');

  /**
   * The property resembles a javascript condition - the following are valid
   *
   * - myProperty
   * - !myProperty
   * - myProperty && !myOtherProperty
   * - myProperty || myOtherProperty
   * - (myProperty && myOtherProperty) || !myThirdProperty
   */

  const fields =
    attributeValue
      ?.match(/(\w+)/g)
      ?.map((field) => field.trim())
      .filter(Boolean) ?? [];

  for (const f of fields) {
    if (!bindings.has(f)) {
      bindings.set(f, new Set());
    }

    bindings.get(f)!.add(element);
  }
});

function updateBindings(key: keyof ConfigurationSchema): void {
  const affected = bindings.get(key);

  if (!affected?.size) {
    return;
  }

  for (const current of affected) {
    const attributeValue = current.getAttribute('data-show');

    if (!attributeValue) {
      continue;
    }

    current.style.display = parseCondition(attributeValue) ? '' : 'none';
  }
}

function parseCondition(expr: string): boolean {
  // Tokenize
  const tokens = expr
    .replace(/([()!])/g, ' $1 ')
    .replace(/&&/g, ' && ')
    .replace(/\|\|/g, ' || ')
    .split(/\s+/)
    .filter(Boolean);

  let pos = 0;

  function peek(): string {
    return tokens[pos];
  }

  function next(): string {
    return tokens[pos++];
  }

  function parsePrimary(): boolean {
    const token = peek();

    if (token === '(') {
      next(); // consume '('
      const value = parseOr();

      if (next() !== ')') {
        throw new Error('Expected )');
      }

      return value;
    }

    if (token === '!') {
      next();

      return !parsePrimary();
    }

    // Property name
    next();

    const value = localConfiguration.get(token as keyof ConfigurationSchema);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return value?.length > 0;
    }

    return !!value;
  }

  function parseAnd(): boolean {
    let value = parsePrimary();

    while (peek() === '&&') {
      next();

      value = value && parsePrimary();
    }

    return value;
  }

  function parseOr(): boolean {
    let value = parseAnd();

    while (peek() === '||') {
      next();

      value = value || parseAnd();
    }

    return value;
  }

  if (!tokens.length) {
    return false;
  }

  try {
    const result = parseOr();

    if (pos !== tokens.length) {
      throw new Error('Unexpected token');
    }

    return result;
  } catch {
    return false;
  }
}

//#endregion
//#region Validators

async function validateJitenApiKey(value: string): Promise<boolean> {
  let isValid = false;

  if (value?.length) {
    try {
      await ping({ apiToken: value });

      isValid = true;
    } catch (_e) {
      /* NOP */
    }
  }

  const button = findElement('#apiTokenButton');
  const input = findElement('#jitenApiKey');

  button.classList.toggle('v1', !isValid);
  input.classList.toggle('v1', !isValid);

  return isValid;
}

//#endregion
