import { Registry } from '../../integration/registry';
import { AutomaticParser } from '../automatic.parser';

/**
 * Custom parser for Aozora Bunko (aozora.gr.jp) literature pages.
 *
 * Aozora pages have a specific structure where text is inline with <br> tags
 * and chapter headers in <div class="jisage_X"> elements. The default parser
 * batches all paragraphs together which causes token misalignment issues.
 *
 * This parser wraps each logical section in a container and parses them
 * one at a time to ensure tokens are correctly applied.
 */
export class AozoraParser extends AutomaticParser {
  protected override init(): void {
    const mainText = document.querySelector<HTMLElement>('.main_text');

    if (!mainText) {
      return;
    }

    this.installAppStyles();

    // Wrap text sections in containers for individual parsing
    this.wrapAndParseSections(mainText);
  }

  private wrapAndParseSections(mainText: HTMLElement): void {
    // Find all chapter/section dividers
    const dividers = Array.from(
      mainText.querySelectorAll<HTMLElement>(
        'div[class^="jisage"], .naka-midashi, .o-midashi, .ko-midashi',
      ),
    );

    if (dividers.length === 0) {
      // No dividers - parse the whole thing
      Registry.batchController.registerNode(mainText, { filter: this.filter });
      Registry.batchController.parseBatches();

      return;
    }

    // Parse each divider section individually
    for (const divider of dividers) {
      if (divider.textContent?.trim()) {
        Registry.batchController.registerNode(divider, { filter: this.filter });
        Registry.batchController.parseBatches();
      }
    }

    // Now we need to parse the text that's NOT inside dividers
    // These are direct text children of main_text between the dividers
    this.parseTextBetweenDividers(mainText, dividers);
  }

  private parseTextBetweenDividers(mainText: HTMLElement, dividers: HTMLElement[]): void {
    // Create a set of divider elements for quick lookup
    const dividerSet = new Set(dividers);

    // Collect runs of non-divider content
    let currentWrapper: HTMLSpanElement | null = null;
    const wrappers: HTMLSpanElement[] = [];

    for (const child of Array.from(mainText.childNodes)) {
      // Skip divider elements - they're already parsed
      if (child instanceof HTMLElement && dividerSet.has(child)) {
        // End current wrapper if any
        if (currentWrapper) {
          wrappers.push(currentWrapper);
          currentWrapper = null;
        }

        continue;
      }

      // Skip empty text nodes
      if (child instanceof Text && !child.data.trim()) {
        continue;
      }

      // Skip BR elements on their own
      if (child instanceof HTMLBRElement) {
        continue;
      }

      // This is content to parse - wrap it
      if (!currentWrapper) {
        currentWrapper = document.createElement('span');
        currentWrapper.className = 'aozora-section';
        currentWrapper.style.display = 'contents';
      }

      // Move the node into the wrapper
      mainText.insertBefore(currentWrapper, child);
      currentWrapper.appendChild(child);
    }

    // Don't forget the last wrapper
    if (currentWrapper) {
      wrappers.push(currentWrapper);
    }

    // Parse each wrapper individually
    for (const wrapper of wrappers) {
      if (wrapper.textContent?.trim()) {
        Registry.batchController.registerNode(wrapper, { filter: this.filter });
        Registry.batchController.parseBatches();
      }
    }
  }
}
