import { getConfiguration } from '@shared/configuration/get-configuration';
import { setConfiguration } from '@shared/configuration/set-configuration';
import { createElement } from '@shared/dom/create-element';
import { getStyleUrl } from '@shared/extension/get-style-url';
import { getURL } from '@shared/extension/get-url';
import { OpenSettingsCommand } from '@shared/messages/background/open-settings.command';
import { UpdateBadgeCommand } from '@shared/messages/background/update-badge.command';
import { ConfigurationUpdatedCommand } from '@shared/messages/broadcast/configuration-updated.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import {
  calculateComprehension,
  calculateCoverageFromDOM,
  calculateStatsFromRegistry,
  calculateUniqueComprehension,
  CoverageStats,
  getComprehensionColour,
} from './stats-calculator';
import { StatusBarButton, StatusBarStats } from './types';

export class StatusBar {
  private _root: HTMLDivElement = createElement('div', {
    id: 'ajb-status-bar',
    style: {
      all: 'initial',
      zIndex: '2147483646',
      position: 'fixed',
      bottom: '0',
      left: '50%',
      transform: 'translateX(-50%)',
      visibility: 'hidden',
    },
  });

  private _bar: HTMLDivElement = createElement('div', {
    class: ['status-bar', 'hidden'],
    events: {
      onmouseenter: () => this.onMouseEnter(),
      onmouseleave: () => this.onMouseLeave(),
    },
  });

  private _icon: HTMLDivElement = createElement('div', {
    class: ['status-icon', 'hidden'],
    events: {
      onclick: () => this.show(),
      onmouseenter: () => this.onMouseEnter(),
      onmouseleave: () => this.onMouseLeave(),
    },
    children: [
      createElement('img', {
        attributes: { src: getURL('assets/32.png'), alt: 'Jiten Reader' },
      }),
    ],
  });

  private _coverageContainer: HTMLDivElement = createElement('div', {
    class: ['coverage-container'],
  });

  private _coverageLabel: HTMLSpanElement = createElement('span', {
    class: ['coverage-label'],
    innerText: 'Coverage:',
  });

  private _coverageValue: HTMLSpanElement = createElement('span', { class: ['coverage-value'] });

  private _buttonsContainer: HTMLDivElement = createElement('div', {
    class: ['buttons-container'],
  });

  private _statsButton: HTMLButtonElement = createElement('button', {
    class: ['status-btn', 'stats-btn'],
    attributes: { title: 'View statistics' },
    innerText: '📊',
    events: {
      onmouseenter: () => this.onStatsMouseEnter(),
      onmouseleave: () => this.onStatsMouseLeave(),
    },
  });

  private _statsDropdown: HTMLDivElement = createElement('div', {
    class: ['stats-dropdown'],
    events: {
      onmouseenter: () => this.onStatsMouseEnter(),
      onmouseleave: () => this.onStatsMouseLeave(),
    },
  });

  private _totalEl: HTMLSpanElement = createElement('span', { class: ['stat', 'total'] });
  private _masteredEl: HTMLSpanElement = createElement('span', { class: ['stat', 'mastered'] });
  private _matureEl: HTMLSpanElement = createElement('span', { class: ['stat', 'mature'] });
  private _youngEl: HTMLSpanElement = createElement('span', { class: ['stat', 'young'] });
  private _blacklistedEl: HTMLSpanElement = createElement('span', {
    class: ['stat', 'blacklisted'],
  });
  private _newEl: HTMLSpanElement = createElement('span', { class: ['stat', 'new'] });
  private _dueEl: HTMLSpanElement = createElement('span', { class: ['stat', 'due'] });

  private _lockButton: HTMLButtonElement = createElement('button', {
    class: ['status-btn', 'lock-btn'],
    attributes: { title: 'Toggle auto-hide' },
    handler: () => void this.toggleAutoHide(),
  });

  private _settingsButton: HTMLButtonElement = createElement('button', {
    class: ['status-btn', 'settings-btn'],
    attributes: { title: 'Open settings' },
    innerText: '⚙',
    handler: () => this.openSettings(),
  });

  private _hideTimeout?: NodeJS.Timeout;
  private _statsDropdownTimeout?: NodeJS.Timeout;
  private _stats: StatusBarStats = { total: 0, mastered: 0, mature: 0, young: 0, blacklisted: 0, new: 0, due: 0 };
  private _isVisible = false;
  private _isHovering = false;
  private _isStatsHovering = false;

  private _enabled = true;
  private _autoHide = true;
  private _hideIcon = false;
  private _showBadge = true;
  private _position: 'top' | 'bottom' = 'bottom';
  private _hasContent = false;

  constructor() {
    this.renderNodes();
    void this.applyConfiguration();
    this.setupEventListeners();
  }

  public show(): void {
    if (!this._enabled || !this._hasContent) {
      return;
    }

    this._isVisible = true;
    this.cancelHideTimer();
    this._bar.classList.remove('hidden');
    this._bar.classList.add('visible');
    this._statsDropdown.classList.remove('hidden');
    this._icon.classList.remove('visible');
  }

  public hide(): void {
    this._isVisible = false;
    this._bar.classList.remove('visible');
    this._bar.classList.add('hidden');
    this._statsDropdown.classList.add('hidden');

    if (!this._hideIcon && this._hasContent) {
      this._icon.classList.remove('hidden');
      this._icon.classList.add('visible');
    } else {
      this._icon.classList.remove('visible');
    }
  }

  public toggle(): void {
    if (!this._enabled || !this._hasContent) {
      return;
    }

    if (this._isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public recalculateStats(): void {
    this._stats = calculateStatsFromRegistry();
    const coverage = calculateCoverageFromDOM();

    this.updateStatsDisplay(coverage);

    const isInitialLoad = !this._hasContent && this._stats.total > 0;

    if (isInitialLoad) {
      this._hasContent = true;

      if (this._enabled) {
        if (this._autoHide) {
          this.hide();
        } else {
          this.show();
        }
      }
    }
  }

  public addButton(button: StatusBarButton): void {
    const btn = createElement('button', {
      id: button.id,
      class: ['status-btn'],
      attributes: { title: button.tooltip },
      innerText: button.icon,
      handler: button.handler,
    });

    this._buttonsContainer.insertBefore(btn, this._settingsButton);
  }

  private renderNodes(): void {
    const shadowRoot = this._root.attachShadow({ mode: 'closed' });

    this._coverageContainer.append(this._coverageLabel, this._coverageValue);

    this._statsDropdown.append(
      createElement('div', {
        class: ['stat-row'],
        children: [
          createElement('span', { class: ['stat-label'], innerText: 'Total:' }),
          this._totalEl,
        ],
      }),
      createElement('div', {
        class: ['stat-row'],
        children: [
          createElement('span', { class: ['stat-label'], innerText: 'Mastered:' }),
          this._masteredEl,
        ],
      }),
      createElement('div', {
        class: ['stat-row'],
        children: [
          createElement('span', { class: ['stat-label'], innerText: 'Mature:' }),
          this._matureEl,
        ],
      }),
      createElement('div', {
        class: ['stat-row'],
        children: [
          createElement('span', { class: ['stat-label'], innerText: 'Young:' }),
          this._youngEl,
        ],
      }),
      createElement('div', {
        class: ['stat-row'],
        children: [
          createElement('span', { class: ['stat-label'], innerText: 'New:' }),
          this._newEl,
        ],
      }),
      createElement('div', {
        class: ['stat-row'],
        children: [
          createElement('span', { class: ['stat-label'], innerText: 'Due:' }),
          this._dueEl,
        ],
      }),
      createElement('div', {
        class: ['stat-row'],
        children: [
          createElement('span', { class: ['stat-label'], innerText: 'Blacklisted:' }),
          this._blacklistedEl,
        ],
      }),
    );

    this._buttonsContainer.append(this._statsButton, this._lockButton, this._settingsButton);

    this._bar.append(this._coverageContainer, this._buttonsContainer, this._statsDropdown);

    const stylesheet = createElement('link', {
      attributes: { rel: 'stylesheet', href: getStyleUrl('status-bar') },
      events: { onload: () => (this._root.style.visibility = 'visible') },
    });

    shadowRoot.append(stylesheet, this._bar, this._icon);

    document.body.appendChild(this._root);
  }

  private async applyConfiguration(): Promise<void> {
    this._enabled = await getConfiguration('statusBarEnabled');
    this._autoHide = await getConfiguration('statusBarAutoHide');
    this._hideIcon = await getConfiguration('statusBarHideIcon');
    this._showBadge = await getConfiguration('statusBarShowBadge');
    this._position = await getConfiguration('statusBarPosition');

    this.updateLockButton();
    this.updatePosition();
    this.updateBadge();

    if (!this._enabled || !this._hasContent) {
      this._bar.classList.remove('visible');
      this._icon.classList.remove('visible');

      return;
    }

    if (this._autoHide) {
      if (!this._isHovering) {
        this.hide();
      }
    } else {
      this.show();
    }
  }

  private setupEventListeners(): void {
    onBroadcastMessage('configurationUpdated', () => void this.applyConfiguration());
  }

  private onMouseEnter(): void {
    this._isHovering = true;
    this.cancelHideTimer();

    if (this._enabled && !this._isVisible) {
      this.show();
    }
  }

  private onMouseLeave(): void {
    this._isHovering = false;

    if (this._autoHide && this._isVisible) {
      this.startHideTimer();
    }
  }

  private startHideTimer(): void {
    this.cancelHideTimer();

    this._hideTimeout = setTimeout(() => {
      this.hide();
    }, 2000);
  }

  private cancelHideTimer(): void {
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = undefined;
    }
  }

  private updateStatsDisplay(coverage?: CoverageStats): void {
    const coverageStats = coverage ?? calculateCoverageFromDOM();
    const comprehension = calculateComprehension(coverageStats);
    const uniqueComprehension = calculateUniqueComprehension(coverageStats);
    const colour = getComprehensionColour(comprehension);

    this._coverageValue.innerText = `${comprehension}% (Unique ${uniqueComprehension}%)`;
    this._coverageValue.style.color = colour;

    this._totalEl.innerText = this._stats.total.toString();
    this._masteredEl.innerText = this._stats.mastered.toString();
    this._matureEl.innerText = this._stats.mature.toString();
    this._youngEl.innerText = this._stats.young.toString();
    this._blacklistedEl.innerText = this._stats.blacklisted.toString();
    this._newEl.innerText = this._stats.new.toString();
    this._dueEl.innerText = this._stats.due.toString();

    this.updateBadge();
  }

  private updateBadge(): void {
    if (!this._showBadge || !this._hasContent) {
      new UpdateBadgeCommand(null).send();

      return;
    }

    const coverage = calculateCoverageFromDOM();
    const comprehension = calculateComprehension(coverage);

    new UpdateBadgeCommand(comprehension).send();
  }

  private updateLockButton(): void {
    this._lockButton.innerText = this._autoHide ? '🔓' : '🔒';
    this._lockButton.classList.toggle('locked', !this._autoHide);
  }

  private updatePosition(): void {
    const isTop = this._position === 'top';

    this._root.style.top = isTop ? '0' : '';
    this._root.style.bottom = isTop ? '' : '0';

    this._bar.classList.toggle('top', isTop);
    this._icon.classList.toggle('top', isTop);
    this._statsDropdown.classList.toggle('top', isTop);
  }

  private async toggleAutoHide(): Promise<void> {
    this._autoHide = !this._autoHide;
    this.updateLockButton();

    if (this._autoHide) {
      if (!this._isHovering) {
        this.startHideTimer();
      }
    } else {
      this.cancelHideTimer();
    }

    await setConfiguration('statusBarAutoHide', this._autoHide);
    new ConfigurationUpdatedCommand().send();
  }

  private openSettings(): void {
    new OpenSettingsCommand().send();
  }

  private onStatsMouseEnter(): void {
    this._isStatsHovering = true;
    this.cancelStatsDropdownTimer();
    this._statsDropdown.classList.add('visible');
  }

  private onStatsMouseLeave(): void {
    this._isStatsHovering = false;
    this.startStatsDropdownTimer();
  }

  private startStatsDropdownTimer(): void {
    this.cancelStatsDropdownTimer();

    this._statsDropdownTimeout = setTimeout(() => {
      if (!this._isStatsHovering) {
        this._statsDropdown.classList.remove('visible');
      }
    }, 200);
  }

  private cancelStatsDropdownTimer(): void {
    if (this._statsDropdownTimeout) {
      clearTimeout(this._statsDropdownTimeout);
      this._statsDropdownTimeout = undefined;
    }
  }
}
