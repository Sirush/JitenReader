import { BackgroundCommand } from '../lib/background-command';

export type FetchPdfResult = { ok: true; base64: string } | { ok: false; error: string };

// Fetches a PDF in the service worker (which has real host-permission cross-origin access, unlike an
// extension page subject to CORS) and returns it base64-encoded so the bytes survive runtime
// messaging serialisation. Errors are returned in the result (not thrown) so the page can show the
// real reason rather than the generic "command failed".
export class FetchPdfCommand extends BackgroundCommand<[url: string], FetchPdfResult> {
  public readonly key = 'fetchPdf';
}
