import { MessageSender } from '@shared/extension/types';
import { FetchPdfCommand, FetchPdfResult } from '@shared/messages/background/fetch-pdf.command';
import { BackgroundCommandHandler } from '../lib/background-command-handler';

const delay = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const looksLikePdf = (bytes: Uint8Array): boolean =>
  bytes.length >= 5 &&
  bytes[0] === 0x25 && // %
  bytes[1] === 0x50 && // P
  bytes[2] === 0x44 && // D
  bytes[3] === 0x46; // F

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary);
};

export class FetchPdfCommandHandler extends BackgroundCommandHandler<FetchPdfCommand> {
  public readonly command = FetchPdfCommand;

  // Some repositories (bepress/Digital Commons CGI endpoints) answer the first request with a 202
  // "still generating" placeholder, then serve the real PDF 200 on a retry. 202 passes response.ok,
  // so retry until the body actually begins with the %PDF magic.
  public async handle(_sender: MessageSender, url: string): Promise<FetchPdfResult> {
    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        const response = await fetch(url, { redirect: 'follow', credentials: 'include' });

        if (response.status === 202) {
          await delay(1500);

          continue;
        }

        if (!response.ok) {
          return { ok: false, error: `Server responded ${response.status} ${response.statusText}` };
        }

        const bytes = new Uint8Array(await response.arrayBuffer());

        if (looksLikePdf(bytes)) {
          return { ok: true, base64: toBase64(bytes) };
        }

        await delay(1500);
      }

      return { ok: false, error: 'The server kept returning a non-PDF / 202 response' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
