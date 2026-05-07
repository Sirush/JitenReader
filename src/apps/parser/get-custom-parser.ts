import { debug } from '@shared/debug';
import { HostMeta, PredefinedHostMeta } from '@shared/host-meta/types';
import { BaseParser } from './base.parser';
import { AozoraParser } from './custom-parsers/aozora.parser';
import { BunproParser } from './custom-parsers/bunpro.parser';
import { ExStaticParser } from './custom-parsers/ex-static.parser';
import { ManatanMangaParser } from './custom-parsers/manatan-manga.parser';
import { MokuroLegacyParser } from './custom-parsers/mokuro-legacy.parser';
import { MokuroParser } from './custom-parsers/mokuro.parser';
import { ReadwokParser } from './custom-parsers/readwok.parser';
import { SatoriReaderParser } from './custom-parsers/satori-reader.parser';
import { TtsuParser } from './custom-parsers/ttsu.parser';
import { YatsuParser } from './custom-parsers/yatsu.parser';

export const getCustomParser = (
  name: Exclude<PredefinedHostMeta['custom'], undefined>,
  meta: HostMeta,
): BaseParser => {
  const parsers: Record<
    Exclude<PredefinedHostMeta['custom'], undefined>,
    new (meta: HostMeta) => BaseParser
  > = {
    AozoraParser,
    BunproParser,
    ManatanMangaParser,
    MokuroParser,
    MokuroLegacyParser,
    ReadwokParser,
    TtsuParser,
    YatsuParser,
    ExStaticParser,
    SatoriReaderParser,
  };
  const parser = parsers[name];

  debug(`getCustomParser called with name: ${name}`, 'meta:', meta);

  return new parser(meta);
};
