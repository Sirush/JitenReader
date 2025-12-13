import { switchProfile } from '@shared/configuration/profile-operations';
import { ProfileMetadata } from '@shared/configuration/profile.types';
import { getProfilesState } from '@shared/configuration/profiles-state';

export class HTMLProfileSelectorElement extends HTMLElement {
  protected _select: HTMLSelectElement;
  protected _profiles: ProfileMetadata[] = [];
  protected _activeProfileId: string = '';

  public get value(): string {
    return this._select?.value ?? '';
  }

  public async connectedCallback(): Promise<void> {
    await this.loadProfiles();
    this.buildSelect();
  }

  protected async loadProfiles(): Promise<void> {
    const state = await getProfilesState();
    this._profiles = state.profiles;
    this._activeProfileId = state.activeProfileId;
  }

  protected buildSelect(): void {
    this._select = document.createElement('select');
    this._select.classList.add('outline');

    for (const profile of this._profiles) {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;
      option.selected = profile.id === this._activeProfileId;
      this._select.appendChild(option);
    }

    this._select.addEventListener('change', () => this.onSelectionChange());

    this.appendChild(this._select);
  }

  protected async onSelectionChange(): Promise<void> {
    const newProfileId = this._select.value;

    if (newProfileId !== this._activeProfileId) {
      const success = await switchProfile(newProfileId);

      if (success) {
        this._activeProfileId = newProfileId;
        this.dispatchEvent(new CustomEvent('profilechange', { detail: { profileId: newProfileId } }));
      } else {
        this._select.value = this._activeProfileId;
      }
    }
  }

  public async refresh(): Promise<void> {
    await this.loadProfiles();

    while (this._select.firstChild) {
      this._select.removeChild(this._select.firstChild);
    }

    for (const profile of this._profiles) {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;
      option.selected = profile.id === this._activeProfileId;
      this._select.appendChild(option);
    }
  }
}
