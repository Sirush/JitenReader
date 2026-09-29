import { onLoaded } from '@shared/dom/on-loaded';
import { applyFaithfulHighlight } from './pdf-reader/faithful-highlight';
import { PdfReader } from './pdf-reader/pdf-reader';
import { bootstrapPipeline } from './standalone/bootstrap-pipeline';

// Entry point for the standalone PDF reader page (views/pdf-reader.html). It lives under apps/ rather
// than views/ so it can import the foreground parsing pipeline without tripping the cross-scope
// import rule, and is auto-discovered by the webpack apps glob as js/pdf-reader.js.
onLoaded(async () => {
  const root = document.getElementById('jiten-pdf');

  if (!root) {
    return;
  }

  await bootstrapPipeline(applyFaithfulHighlight);
  await new PdfReader(root).init();
});
