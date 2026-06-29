import { getURL } from '@shared/extension/get-url';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

// The whole pdfjs library (~1.7 MB) is shipped as a prebuilt minified asset under vendor/ and pulled
// in with a native dynamic import so webpack never bundles it into this page's entry — and crucially
// never into the every-frame content script. The /* webpackIgnore */ keeps webpack from rewriting
// the import into a chunk request.
export type Pdfjs = typeof import('pdfjs-dist');
export type { TextContent, TextItem };

let modulePromise: Promise<Pdfjs> | null = null;

export const loadPdfjs = (): Promise<Pdfjs> => {
  if (!modulePromise) {
    modulePromise = (async (): Promise<Pdfjs> => {
      const pdfjs = (await import(/* webpackIgnore: true */ getURL('vendor/pdf.min.mjs'))) as Pdfjs;

      pdfjs.GlobalWorkerOptions.workerSrc = getURL('vendor/pdf.worker.min.mjs');

      return pdfjs;
    })();
  }

  return modulePromise;
};

// Adobe CMaps are mandatory for CID-keyed Japanese fonts: without them getTextContent() returns
// empty or mojibake for a large share of real Japanese PDFs.
export const CMAP_URL = (): string => getURL('vendor/cmaps/');

export const isTextItem = (item: TextContent['items'][number]): item is TextItem => 'str' in item;
