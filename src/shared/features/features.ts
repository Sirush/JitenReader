import { Feature } from './types';

export const CRUNCHYROLL: Feature = {
  id: 'crunchyroll.com',
  name: 'Crunchyroll',
  description: 'Force removes Crunchyroll subtitles',
  host: '*://static.crunchyroll.com/*',
  allFrames: true,
};

export const READER_MODE: Feature = {
  id: 'reader-mode',
  name: 'Reader mode',
  description:
    'Adds a button and keybind to extract the main article of any page into a ' +
    'distraction-free reading view with parsing applied',
  host: '<all_urls>',
  allFrames: false,
};

export const FEATURES: Feature[] = [CRUNCHYROLL, READER_MODE];
