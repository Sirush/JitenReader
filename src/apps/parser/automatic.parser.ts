import { debug } from '@shared/debug';
import { getParsingPaused } from '@shared/extension/get-parsing-paused';
import { HostMeta } from '@shared/host-meta/types';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { Registry } from '../integration/registry';
import { BaseParser } from './base.parser';

export class AutomaticParser extends BaseParser {
  protected _visibleObserver: IntersectionObserver | undefined;
  protected _addedObserver: MutationObserver | undefined;
  private _lazyDetectTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(meta: HostMeta) {
    super(meta);

    this._disposers.push(
      onBroadcastMessage('parsingPaused', (paused: boolean) => {
        if (paused) {
          this.disconnectObservers();
        } else {
          this.reconnectObservers();
        }
      }),
    );

    setTimeout(() => {
      void getParsingPaused().then((paused) => {
        if (paused) {
          debug('AutomaticParser: Parsing is paused, skipping setup');

          return;
        }

        this.startParsing();
      });
    }, 1);
  }

  public override destroy(): void {
    this.disconnectObservers();
    super.destroy();
  }

  protected startParsing(): void {
    if (this._destroyed) {
      return;
    }

    if (this._meta.parseVisibleObserver) {
      debug('AutomaticParser: Setting up visible observer', this._meta.parseVisibleObserver);

      this.setupVisibleObserver();
    }

    if (this._meta.addedObserver) {
      debug('AutomaticParser: Setting up added observer', this._meta.addedObserver);

      this.setupAddedObserver();
    }

    if (this._meta.parse) {
      debug('AutomaticParser: Parsing page with parse function', this._meta.parse);

      this.parsePage();
    }

    this.init();
  }

  protected disconnectObservers(): void {
    debug('AutomaticParser: Disconnecting observers due to pause');

    this._visibleObserver?.disconnect();
    this._addedObserver?.disconnect();

    if (this._lazyDetectTimer !== undefined) {
      clearTimeout(this._lazyDetectTimer);
      this._lazyDetectTimer = undefined;
    }
  }

  protected reconnectObservers(): void {
    if (this._destroyed) {
      return;
    }

    debug('AutomaticParser: Reconnecting observers after unpause');

    this.startParsing();
  }

  protected init(): void {
    /* NOP */
  }

  /** Sets up a `getParseVisibleObserver (IntersectionObserver)` for the page */
  protected setupVisibleObserver(): void {
    let filter: ((node: HTMLElement | Text) => boolean) | undefined;

    if (typeof this._meta.parseVisibleObserver === 'object') {
      const obs = this._meta.parseVisibleObserver;
      const { include = '', exclude = '' } = obs;

      const isInclude = include?.length > 0;
      const isExclude = exclude?.length > 0;

      filter = (node): boolean => {
        if (node instanceof Text) {
          return true;
        }

        if (isInclude && !node.matches(include)) {
          return false;
        }

        if (isExclude && node.matches(exclude)) {
          return false;
        }

        return true;
      };
    }

    this._visibleObserver = this.getParseVisibleObserver(filter ?? this.filter);
  }

  /**
   * Sets up a `getAddedObserver (MutationObserver)` for the page.
   *
   * If a `visibleObserver` is set, the elements that are added will be observed.
   * If not, the elements will be parsed immediately.
   */
  protected setupAddedObserver(): void {
    if (this._meta.addedObserver!.lazy) {
      this.pollForLazyTarget();

      return;
    }

    this.installFullAddedObserver();
  }

  /**
   * The callback to call when nodes are added in @see setupAddedObserver
   *
   * @param {HTMLElement[]} nodes The added nodes
   * @returns {void}
   */
  protected addedObserverCallback(nodes: HTMLElement[]): void {
    if (!this._visibleObserver) {
      return this.parseNodes(nodes, this.filter);
    }

    nodes.forEach((node) => this._visibleObserver?.observe(node));
  }

  protected removedObserverCallback(nodes: HTMLElement[]): void {
    nodes.forEach((node) => {
      Registry.sentenceManager.dismissContainer(node);
    });

    if (!this._visibleObserver) {
      return;
    }

    nodes.forEach((node) => this._visibleObserver?.unobserve(node));
  }

  private installFullAddedObserver(): void {
    this._addedObserver = this.getAddedObserver(
      this._meta.addedObserver!.observeFrom ?? 'body',
      this._meta.addedObserver!.notifyFor,
      this._meta.addedObserver!.checkNested,
      this._meta.addedObserver!.config ?? { childList: true, subtree: true },
      (nodes) => this.addedObserverCallback(nodes),
      (nodes) => this.removedObserverCallback(nodes),
    );
  }

  private pollForLazyTarget(): void {
    const selector = this._meta.addedObserver!.notifyFor;

    const check = (): void => {
      if (this._destroyed) {
        return;
      }

      const found = document.querySelector(selector);

      if (found) {
        debug('AutomaticParser: Lazy target detected, installing full observer');
        this._lazyDetectTimer = undefined;
        this.installFullAddedObserver();

        return;
      }

      this._lazyDetectTimer = setTimeout(check, 2000);
    };

    check();
  }
}
