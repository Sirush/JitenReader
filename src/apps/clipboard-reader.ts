import { onLoaded } from '@shared/dom/on-loaded';
import { ClipboardReader } from './clipboard-reader/clipboard-reader';
import { bootstrapPipeline } from './standalone/bootstrap-pipeline';

onLoaded(async () => {
  await bootstrapPipeline();
  await new ClipboardReader().init();
});
