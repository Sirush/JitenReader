import { getConfiguration } from '@shared/configuration/get-configuration';
import { getThemeCssVars } from '@shared/theme/get-theme-css-vars';
import { generateWordStyleCSS } from '@shared/word-style/generate-css';

const STYLE_SELECTOR = 'style[data-jiten-style="word-dynamic"]';

// Word styling is owned by a single content-script <style> element whose textContent is fully
// replaced on every change. This must not go through chrome.scripting.insertCSS: that injection
// is bookkept in the service worker's memory, which MV3 recycles at will, leaving stale
// stylesheets stuck on the page (a previous theme's colours then leak through an empty theme).
export const applyWordStyles = async (): Promise<void> => {
  const themeVars = await getThemeCssVars();
  const wordStyleConfig = await getConfiguration('wordStyleConfig');
  const generatedCSS = generateWordStyleCSS(wordStyleConfig);
  const customWordCSS = await getConfiguration('customWordCSS');

  let style = document.head.querySelector<HTMLStyleElement>(STYLE_SELECTOR);

  if (!style) {
    style = document.createElement('style');
    style.setAttribute('data-jiten-style', 'word-dynamic');
    document.head.appendChild(style);
  }

  style.textContent = `${themeVars}\n${generatedCSS}\n${customWordCSS}`;
};

export const hasWordStyles = (): boolean => !!document.head.querySelector(STYLE_SELECTOR);
