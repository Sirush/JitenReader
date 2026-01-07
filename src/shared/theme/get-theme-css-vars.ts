import { getConfiguration } from '../configuration/get-configuration';

export const getThemeCssVars = async (): Promise<string> => {
  const bg = await getConfiguration('themeBgColour');
  const accent = await getConfiguration('themeAccentColour');
  return `:root, :host { --jiten-bg: ${bg}; --jiten-accent: ${accent}; }`;
};
