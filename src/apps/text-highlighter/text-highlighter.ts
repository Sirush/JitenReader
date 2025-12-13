import { createElement } from '@shared/dom/create-element';
import { JitenToken, JitenRuby } from '@shared/jiten/types';
import { Fragment } from '../batches/types';
import { Registry } from '../integration/registry';
import { BaseTextHighlighter } from './base.text-highlighter';

export class TextHighlighter extends BaseTextHighlighter {
  private static readonly CHUNK_SIZE = 40;

  protected _fragments = new Set<Fragment>(this.fragments);
  protected _tokens = new Set<JitenToken>(this.tokens);
  protected _tokenToFragmentsMap = new Map<JitenToken, Fragment[]>();
  protected _fragmentToTokensMap = new Map<Fragment, JitenToken[]>();

  public async apply(): Promise<void> {
    await this.preprocess();

    this.patchUnparsedFragments();

    await this.yieldToMainThread();

    await this.patchNonRubyTokensChunked();
    await this.patchContainedRubyElementsChunked();
    await this.patchFragmentedRubyTokensChunked();

    this.patchRemainingMisparses();

    if (Registry.textHighlighterOptions.markIPlus1) {
      Registry.sentenceManager.calculateTargetSentences();
    }
  }

  private yieldToMainThread(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  private async processInChunks<T>(
    items: Map<T, Fragment[]>,
    processor: (item: T, fragments: Fragment[]) => void,
  ): Promise<void> {
    const entries = [...items.entries()];
    let processed = 0;

    for (const [item, fragments] of entries) {
      processor(item, fragments);
      processed++;

      if (processed % TextHighlighter.CHUNK_SIZE === 0 && processed < entries.length) {
        await this.yieldToMainThread();
      }
    }
  }

  private async splitMultiTokenFragmentsChunked(): Promise<void> {
    const filtered = this.filterMap(
      this._fragmentToTokensMap,
      (tokens, _fragment) => tokens.length > 1,
    );

    const entries = [...filtered.entries()];
    let processed = 0;

    for (const [fragment, tokens] of entries) {
      let token: JitenToken | undefined;

      while ((token = tokens.pop())) {
        this.cutoffTokenEnd(token, fragment);

        if (token.start < fragment.start) {
          tokens.push(token);
          break;
        }

        const newFragmentNode = this.splitFragmentsNode(fragment, token.start);
        const newFragment = this.insertNewFragment(newFragmentNode, token.start);

        this._fragmentToTokensMap.set(newFragment, [token]);
        this._tokenToFragmentsMap.set(token, [newFragment]);

        this.fixFragmentParameters(fragment);
      }

      if (fragment.length) {
        this.patchOrWrap(fragment);
      }

      this.dismissElements(fragment);

      processed++;
      if (processed % TextHighlighter.CHUNK_SIZE === 0 && processed < entries.length) {
        await this.yieldToMainThread();
      }
    }
  }

  private async adjustUnmatchedFragmentsChunked(): Promise<void> {
    const filtered = this.filterMap(
      this._tokenToFragmentsMap,
      (fragments, token) => !this.areBoundariesExactMatch(token, fragments),
    );

    const entries = [...filtered.entries()];
    let processed = 0;

    for (const [token, fragments] of entries) {
      this.adjustFragmentEnds(fragments, token);
      this.adjustFragmentStarts(fragments, token);

      processed++;
      if (processed % TextHighlighter.CHUNK_SIZE === 0 && processed < entries.length) {
        await this.yieldToMainThread();
      }
    }
  }

  private async patchNonRubyTokensChunked(): Promise<void> {
    const filtered = this.filterMap(
      this._tokenToFragmentsMap,
      (fragments, token) => !token.rubies.length && this.areBoundariesExactMatch(token, fragments),
    );

    await this.processInChunks(filtered, (token, fragments) => {
      fragments.forEach((fragment) => this.patchOrWrap(fragment, token));
    });
  }

  private async patchContainedRubyElementsChunked(): Promise<void> {
    const filtered = this.filterMap(
      this._tokenToFragmentsMap,
      (fragments, token) =>
        fragments.length === 1 &&
        !!token.rubies.length &&
        this.areBoundariesExactMatch(token, fragments),
    );

    await this.processInChunks(filtered, (token, fragments) => {
      const [fragment] = fragments;
      const rubyElement = this.findParent(fragment.node, 'RUBY');

      this.dismissElements(fragment, token);

      if (!rubyElement) {
        return this.applyRubiesToFragment(fragment, token);
      }

      if (this.isMisparsedRuby(rubyElement, token)) {
        return this.markElementAsMisparsed(rubyElement);
      }

      this.patchElement(rubyElement, token);
    });
  }

  private async patchFragmentedRubyTokensChunked(): Promise<void> {
    const filtered = this.filterMap(this._tokenToFragmentsMap, (fragments, token) =>
      this.areBoundariesExactMatch(token, fragments),
    );

    await this.processInChunks(filtered, (token, fragments) => {
      if (this.applyOnSharedParent(fragments, token)) {
        return;
      }

      fragments.forEach((fragment) => {
        const fragmentsRuby = this.findParent(fragment.node, 'RUBY');

        if (fragmentsRuby) {
          this.patchElement(fragmentsRuby, token);
          this.dismissElements(fragment, token);

          return;
        }

        const fragmentRubies = token.rubies.filter(
          (ruby) => ruby.start >= fragment.start && ruby.end <= fragment.end,
        );

        if (fragmentRubies?.length) {
          return this.applyRubiesToFragment(fragment, token, fragmentRubies);
        }

        this.patchOrWrap(fragment, token);
      });
    });
  }

  /**
   * Preprocess the data - this maps tokens and fragment relations as well as applies error correction
   */
  protected async preprocess(): Promise<void> {
    // Match tokens and fragments together
    this.buildMaps();

    // Split fragments that contain multiple tokens into multiple fragments (e.g. sentences)
    await this.splitMultiTokenFragmentsChunked();

    // Apply error correction to fragments that do not match the tokens exactly
    await this.adjustUnmatchedFragmentsChunked();

    // Rebuild the maps after error correction. This also sorts fragments and tokens beforehand
    this.rebuildMaps();

    // Error correction may have resulted in new fragments that need to be split (e.g. sentences behind a malformed node)
    await this.splitMultiTokenFragmentsChunked();
  }

  //#region Building Maps

  /**
   * Rebuild the maps between tokens and fragments
   *
   * The maps are sorted by the start position of the tokens and fragments
   * This is necessary after error correction to ensure the maps are up to date, otherwise splitted fragments may not be matched correctly
   */
  protected rebuildMaps(): void {
    this._fragments = new Set([...this._fragments].sort((a, b) => a.start - b.start));
    this._tokens = new Set([...this._tokens].sort((a, b) => a.start - b.start));

    this._fragmentToTokensMap.clear();
    this._tokenToFragmentsMap.clear();

    this.buildMaps();
  }

  /**
   * Build bidirectional maps between tokens and fragments using O(n+m) sweep-line algorithm
   * Both tokens and fragments are sorted by start position, allowing efficient matching
   */
  protected buildMaps(): void {
    const sortedTokens = [...this._tokens].sort((a, b) => a.start - b.start);
    const sortedFragments = [...this._fragments].sort((a, b) => a.start - b.start);

    // Initialise fragment map with empty arrays
    for (const fragment of sortedFragments) {
      this._fragmentToTokensMap.set(fragment, []);
    }

    let fragIndex = 0;

    for (const token of sortedTokens) {
      const matchingFragments: Fragment[] = [];

      // Advance past fragments that end before this token starts
      while (fragIndex < sortedFragments.length && sortedFragments[fragIndex].end <= token.start) {
        fragIndex++;
      }

      // Scan through potentially overlapping fragments
      let scanIndex = fragIndex;
      while (scanIndex < sortedFragments.length && sortedFragments[scanIndex].start < token.end) {
        const fragment = sortedFragments[scanIndex];
        if (this.isFragmentWithinToken(fragment, token)) {
          matchingFragments.push(fragment);
          this._fragmentToTokensMap.get(fragment)!.push(token);
        }
        scanIndex++;
      }

      this._tokenToFragmentsMap.set(token, matchingFragments);
    }
  }

  //#endregion Building Maps
  //#region Splitting Fragments

  /**
   * Split fragments that contain multiple tokens into multiple fragments and add them to the fragment set
   */
  protected splitMultiTokenFragments(): void {
    this.filterMap(this._fragmentToTokensMap, (tokens, _fragment) => tokens.length > 1).forEach(
      (tokens, fragment) => {
        let token: JitenToken | undefined;

        while ((token = tokens.pop())) {
          this.cutoffTokenEnd(token, fragment);

          if (token.start < fragment.start) {
            // The token begins before the fragment - this hints to a kanji with ruby in the previous fragment
            // in this case we cancel the processing and let the previous fragment handle the token

            // because we already popped the token, we need to readd it to the tokens list
            tokens.push(token);

            return;
          }

          // We cut off the token length from the fragment and save it as a new fragment
          // this shortens the original fragment and may fix its length
          const newFragmentNode = this.splitFragmentsNode(fragment, token.start);
          const newFragment = this.insertNewFragment(newFragmentNode, token.start);

          this._fragmentToTokensMap.set(newFragment, [token]);
          this._tokenToFragmentsMap.set(token, [newFragment]);

          this.fixFragmentParameters(fragment);
        }

        if (fragment.length) {
          this.patchOrWrap(fragment);
        }

        this.dismissElements(fragment);
      },
    );
  }

  protected cutoffTokenEnd(token: JitenToken, fragment: Fragment): void {
    // If the fragment is longer than the token (e.g. a sentence ending with a period)
    // we cut off the end and mark it as unparsed
    if (token.end < fragment.end) {
      // The fragment is longer than the token (e.g. a sentence ending with a period)
      this.patchOrWrap(this.splitFragmentsNode(fragment, token.end));

      this.fixFragmentParameters(fragment);
    }
  }

  //#endregion Splitting Fragments
  //#region Error Correction

  protected adjustUnmatchedFragments(): void {
    this.filterMap(
      this._tokenToFragmentsMap,
      (fragments, tokens) => !this.areBoundariesExactMatch(tokens, fragments),
    ).forEach((fragments, token) => {
      // An mismatch in boundaries has two common reasons:
      // 1. It is related to a misparsed kanji where the boundaries shift - we ignore those for now
      // 2. Special caracters like 。, 、 or parentheses are not included in the token

      this.adjustFragmentEnds(fragments, token);
      this.adjustFragmentStarts(fragments, token);
    });
  }

  protected adjustFragmentEnds(fragments: Fragment[], token: JitenToken): void {
    fragments
      .filter((fragment) => this.isFragmentWithinToken(fragment, token))
      .forEach((fragment) => {
        if (fragment.end > token.end) {
          const overlap = this.splitFragmentsNode(fragment, token.end);

          this.fixFragmentParameters(fragment);
          this.insertNewFragment(overlap, token.end);
        }
      });
  }

  protected adjustFragmentStarts(fragments: Fragment[], token: JitenToken): void {
    fragments
      .filter((fragment) => this.isFragmentWithinToken(fragment, token))
      .forEach((fragment) => {
        if (fragment.start < token.start) {
          const correctedFragmentTextNode = this.splitFragmentsNode(fragment, token.start);

          fragment.node = correctedFragmentTextNode;
          fragment.start = token.start;

          this.fixFragmentParameters(fragment);
        }
      });
  }

  //#endregion Error Correction
  //#region Patch unparsed Fragments

  /**
   * Fragments with zero tokens could not be parsed - we mark them as unparsed
   */
  protected patchUnparsedFragments(): void {
    this.filterMap(this._fragmentToTokensMap, (tokens) => !tokens.length).forEach((_, fragment) =>
      this.patchOrWrap(fragment),
    );
  }

  //#endregion Patch unparsed Fragments
  //#region Patch non ruby tokens

  /**
   * Apply tokens without rubies with fragments matching the boundaries of the token
   */
  protected patchNonRubyTokens(): void {
    this.filterMap(
      this._tokenToFragmentsMap,
      (fragments, token) => !token.rubies.length && this.areBoundariesExactMatch(token, fragments),
    ).forEach((fragments, token) =>
      fragments.forEach((fragment) => this.patchOrWrap(fragment, token)),
    );
  }

  //#endregion Patch non ruby tokens
  //#region Patch contained ruby elements

  /**
   * Apply ruby tokens which have only one fragment and the boundaries match exactly
   */
  protected patchContainedRubyElements(): void {
    this.filterMap(
      this._tokenToFragmentsMap,
      (fragments, token) =>
        fragments.length === 1 &&
        !!token.rubies.length &&
        this.areBoundariesExactMatch(token, fragments),
    ).forEach(([fragment], token) => {
      const rubyElement = this.findParent(fragment.node, 'RUBY');

      this.dismissElements(fragment, token);

      if (!rubyElement) {
        return this.applyRubiesToFragment(fragment, token);
      }

      if (this.isMisparsedRuby(rubyElement, token)) {
        return this.markElementAsMisparsed(rubyElement);
      }

      this.patchElement(rubyElement, token);
    });
  }

  protected applyRubiesToFragment(
    fragment: Fragment,
    token: JitenToken,
    rubies: JitenRuby[] = token.rubies,
  ): void {
    const newRuby = this.wrapElement(fragment.node, token);

    if (Registry.textHighlighterOptions.skipFurigana) {
      return;
    }

    const docFrag = this.createRubyNodesForFragment(fragment, rubies);

    newRuby.textContent = '';
    newRuby.append(docFrag);
  }

  protected createRubyNodesForFragment(fragment: Fragment, rubies: JitenRuby[]): DocumentFragment {
    const nodeText = fragment.node.textContent;
    let lastIndex = 0;
    const docFrag = document.createDocumentFragment();

    const sortedRubies = [...rubies].sort((a, b) => a.start - b.start);

    for (const ruby of sortedRubies) {
      const rubyStart = ruby.start - fragment.start;
      const rubyEnd = ruby.end - fragment.start;

      if (rubyStart > lastIndex) {
        docFrag.append(document.createTextNode(nodeText.slice(lastIndex, rubyStart)));
      }

      const rubyElem = document.createElement('ruby');
      const rt = document.createElement('rt');

      rubyElem.append(document.createTextNode(nodeText.slice(rubyStart, rubyEnd)));
      rt.className = 'jiten-furi';
      rt.textContent = ruby.text;

      rubyElem.append(rt);
      docFrag.append(rubyElem);

      lastIndex = rubyEnd;
    }

    if (lastIndex < nodeText.length) {
      docFrag.append(document.createTextNode(nodeText.slice(lastIndex)));
    }

    return docFrag;
  }

  //#endregion Patch contained ruby elements
  //#region Patch fragmented ruby tokens

  /**
   * Apply ruby tokens which span multiple fragments and the boundaries match exactly
   */
  protected patchFragmentedRubyTokens(): void {
    this.filterMap(this._tokenToFragmentsMap, (fragments, token) =>
      this.areBoundariesExactMatch(token, fragments),
    ).forEach((fragments, token) => {
      if (this.applyOnSharedParent(fragments, token)) {
        return;
      }

      fragments.forEach((fragment) => {
        const fragmentsRuby = this.findParent(fragment.node, 'RUBY');

        if (fragmentsRuby) {
          this.patchElement(fragmentsRuby, token);
          this.dismissElements(fragment, token);

          return;
        }

        const fragmentRubies = token.rubies.filter(
          (ruby) => ruby.start >= fragment.start && ruby.end <= fragment.end,
        );

        if (fragmentRubies?.length) {
          return this.applyRubiesToFragment(fragment, token, fragmentRubies);
        }

        this.patchOrWrap(fragment, token);
      });
    });
  }

  protected applyOnSharedParent(fragments: Fragment[], token: JitenToken): boolean {
    const anyHasRuby = fragments.some((fragment) => this.findParent(fragment.node, 'RUBY'));
    const sharedParentNode = this.findSharedParent(
      fragments[0].node,
      fragments[fragments.length - 1].node,
    );

    if (sharedParentNode && anyHasRuby) {
      const clone = sharedParentNode.cloneNode(true) as HTMLElement;

      if (!Registry.textHighlighterOptions.skipFurigana) {
        clone.querySelectorAll('rt').forEach((rt) => rt.remove());
      }

      const cloneText = clone.textContent;
      const fragmentText = fragments.map((fragment) => fragment.node.textContent).join('');

      if (cloneText === fragmentText) {
        this.patchElement(sharedParentNode, token);

        fragments.forEach((fragment) => {
          this.dismissElements(fragment, token);
        });

        return true;
      }
    }

    return false;
  }

  protected findSharedParent(nodeA: Node, NodeB: Node): HTMLElement | null {
    let parent = nodeA.parentElement;

    while (parent) {
      if (parent.contains(NodeB)) {
        return parent;
      }

      parent = parent.parentElement;
    }

    return null;
  }

  //#endregion
  //#region Patch remaining misparses

  protected patchRemainingMisparses(): void {
    this._tokenToFragmentsMap.forEach((fragments, token) => {
      if (this.checkUnmatchedFragmentMisparse(token, fragments)) {
        fragments.forEach((fragment) => this.dismissElements(fragment, token));
      }
    });
  }

  protected checkUnmatchedFragmentMisparse(token: JitenToken, fragments: Fragment[]): boolean {
    let isMisparse = false;

    // If we have a definitive ruby, we can attempt a direct match
    // If it was a misparsed ruby, we can already mark and it do not need to check those anymore
    if (token.rubies.length && fragments.some((fragment) => fragment.hasRuby)) {
      fragments.forEach((fragment) => {
        if (!fragment.hasRuby) {
          return;
        }

        const parentRuby = this.findParent(fragment.node, 'RUBY');

        isMisparse = isMisparse || (parentRuby ? this.isMisparsedRuby(parentRuby, token) : false);
      });

      if (isMisparse) {
        fragments.forEach((fragment) => {
          const rubyParent = this.findParent(fragment.node, 'RUBY');

          if (rubyParent) {
            this.markElementAsMisparsed(rubyParent);
          }

          this.markNodeAsMisparsed(fragment.node);
        });
      }
    }

    return isMisparse;
  }

  protected markNodeAsMisparsed(node: Text): void {
    const parent = node.parentElement;

    if (!parent) {
      return;
    }

    const wrapper = createElement('span', {
      class: ['jiten-word', 'misparsed'],
      attributes: { ajb: 'true' },
    });

    parent.replaceChild(wrapper, node);
    wrapper.appendChild(node);
  }

  //#endregion Patch remaining misparses
  //#region Shared Helpers

  /**
   * Check if a fragment is within a token or overlaps with it
   *
   * @param {Fragment} fragment The fragment to check
   * @param {JitenToken} token The token to check
   * @returns {boolean} True if the fragment is within the token or overlaps, false otherwise
   */
  protected isFragmentWithinToken(fragment: Fragment, token: JitenToken): boolean {
    return fragment.end > token.start && fragment.start < token.end;
  }

  /**
   * Split the text of a fragment at a given offset
   * The offset is relative to the fragment and will respect the fragment boundaries
   *
   * The node of the fragment is modified and the new node is returned
   *
   * @param {Fragment} fragment The fragment to cut the end off
   * @param {number} start The start position in relation to the fragment
   * @returns {Text} The new node that was created
   */
  protected splitFragmentsNode(fragment: Fragment, start: number): Text {
    const node = fragment.node as Text;

    try {
      return node.splitText(start - fragment.start);
    } catch (error) {
      // In case of an error we push additional details to the console and rethrow the error for further handling
      // eslint-disable-next-line no-console
      console.error('Error splitting fragment node', {
        fragment,
        start,
        internalLength: node.data.length,
      });

      throw error;
    }
  }

  protected fixFragmentParameters(fragment: Fragment): void {
    fragment.length = fragment.node.data.length;
    fragment.end = fragment.start + fragment.length;
  }

  protected insertNewFragment(node: Text, start: number): Fragment {
    const length = node.data.length;

    const newFragment: Fragment = {
      node,
      start: start,
      end: start + length,
      length: length,
      hasRuby: false,
    };

    this._fragments.add(newFragment);

    return newFragment;
  }

  protected filterMap<TKey, TValue>(
    map: Map<TKey, TValue[]>,
    filter: (values: TValue[], key: TKey) => boolean,
  ): Map<TKey, TValue[]> {
    const result = new Map<TKey, TValue[]>();

    map.forEach((values, key) => {
      if (filter(values, key)) {
        result.set(key, values);
      }
    });

    return result;
  }

  protected patchOrWrap(fragment: Fragment | Text, token?: JitenToken): HTMLElement | null {
    const isFragment = this.isFragment(fragment);
    const node = isFragment ? fragment.node : fragment;
    const fragmentsParent = isFragment ? node.parentElement : node.parentElement;

    if (!fragmentsParent) {
      return null;
    }

    if (isFragment) {
      this.dismissElements(fragment, token);
    }

    if (fragmentsParent.childNodes.length > 1) {
      const element = this.wrapElement(node, token);

      if (!Registry.textHighlighterOptions.skipFurigana) {
        element.querySelectorAll('rt').forEach((rt) => rt.classList.add('jiten-furi'));
      }

      return element;
    }

    this.patchElement(fragmentsParent, token);

    return fragmentsParent;
  }

  protected isFragment(element: Fragment | Text): element is Fragment {
    return 'node' in element;
  }

  protected dismissElements(fragment?: Fragment, token?: JitenToken): void {
    if (fragment) {
      this._fragments.delete(fragment);
      this._fragmentToTokensMap.delete(fragment);
    }

    if (token) {
      this._tokens.delete(token);
      this._tokenToFragmentsMap.delete(token);
    }
  }

  protected wrapElement(node: Text, token: JitenToken | undefined): HTMLElement {
    const element = document.createElement('span');

    this.patchElement(element, token);

    node.parentElement?.replaceChild(element, node);
    element.appendChild(node);

    return element;
  }

  protected patchElement(element: HTMLElement, token: JitenToken | undefined): void {
    const { skipFurigana, markFrequency, markAll, generatePitch, markIPlus1, newStates } =
      Registry.textHighlighterOptions;
    const { card, pitchClass, sentence, conjugations } = token ?? {};

    // do not apply the same card twice
    if (element.hasAttribute('ajb')) {
      return;
    }

    element.setAttribute('ajb', 'true');

    //TODO: reintroduce
    if (markIPlus1) {
      Registry.sentenceManager.addElement(element, undefined);
    }

    if (!skipFurigana) {
      element.querySelectorAll('rt').forEach((rt) => rt.classList.add('jiten-furi'));
    }

    if (card) {
      Registry.addCard(card, element, conjugations);

      element.classList.add('jiten-word', ...card.cardState);

      if (markFrequency && card.frequencyRank <= markFrequency) {
        const states = card.cardState;
        const isNew = states.some((s) => newStates.includes(s));

        if (markAll || isNew) {
          element.classList.add('frequent');
        }
      }

      if (pitchClass && generatePitch) {
        element.classList.add(pitchClass);
      }

      element.setAttribute('wordId', card.wordId.toString());
      element.setAttribute('readingIndex', card.readingIndex.toString());

      Registry.wordEventDelegator.setSentence(element, sentence);

      return;
    }

    element.classList.add('jiten-word', 'unparsed');
  }

  protected areBoundariesExactMatch(
    reference: { start: number; end: number },
    targets: { start: number; end: number }[],
  ): boolean {
    if (!targets.length) {
      return false;
    }

    return (
      reference.start === targets[0].start && reference.end === targets[targets.length - 1].end
    );
  }

  protected findParent(node: Node, tag: Uppercase<string>): HTMLElement | null {
    let parent = node.parentElement;

    while (parent && parent.tagName !== tag) {
      parent = parent.parentElement;
    }

    return parent;
  }

  protected isMisparsedRuby(rubyElement: HTMLElement, token: JitenToken): boolean {
    const originalRubyText = Array.from(rubyElement.querySelectorAll('rt'))
      .map((rt) => rt.innerText)
      .join('');

    return false;

    // const cardsRubyText =
    //   token.card.wordWithReading?.replace(/[^[]*\[([^\]]*)\][^[]*/g, '$1') ?? '';
    //
    // return originalRubyText !== cardsRubyText;
  }

  protected markElementAsMisparsed(element: HTMLElement): void {
    if (element.hasAttribute('ajb')) {
      return;
    }

    element.classList.add('jiten-word', 'misparsed');
    element.setAttribute('ajb', 'true');
  }

  //#endregion Shared Helpers
}
