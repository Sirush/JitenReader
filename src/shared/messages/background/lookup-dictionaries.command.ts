import { DictionaryLookup, DictionaryLookupResult } from '../../dictionaries/types';
import { BackgroundCommand } from '../lib/background-command';

export class LookupDictionariesCommand extends BackgroundCommand<
  [DictionaryLookup],
  DictionaryLookupResult
> {
  public readonly key = 'lookupDictionaries';
}
