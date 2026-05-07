import { Registry } from '../../integration/registry';
import { AutomaticParser } from '../automatic.parser';

export class AozoraParser extends AutomaticParser {
  protected override init(): void {
    const mainText = document.querySelector<HTMLElement>('.main_text');

    if (!mainText) {
      return;
    }

    this.installAppStyles();
    this.parseSections(mainText);
  }

  private parseSections(mainText: HTMLElement): void {
    let currentWrapper: HTMLSpanElement | null = null;

    for (const child of Array.from(mainText.childNodes)) {
      const isDiv = child instanceof HTMLDivElement;

      if (child instanceof HTMLBRElement || isDiv) {
        this.registerWrapper(currentWrapper);
        currentWrapper = null;

        if (isDiv && child.textContent?.trim()) {
          Registry.batchController.registerNode(child, { filter: this.filter });
        }

        continue;
      }

      if (child instanceof Text && !child.data.trim()) {
        continue;
      }

      if (!currentWrapper) {
        currentWrapper = document.createElement('span');
        currentWrapper.className = 'aozora-section';
        currentWrapper.style.display = 'contents';
      }

      mainText.insertBefore(currentWrapper, child);
      currentWrapper.appendChild(child);
    }

    this.registerWrapper(currentWrapper);
    Registry.batchController.parseBatches();
  }

  private registerWrapper(wrapper: HTMLSpanElement | null): void {
    if (wrapper?.textContent?.trim()) {
      Registry.batchController.registerNode(wrapper, { filter: this.filter });
    }
  }
}
