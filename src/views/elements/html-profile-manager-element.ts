import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  renameProfile,
  switchProfile,
} from '@shared/configuration/profile-operations';
import { MAX_PROFILES, ProfileMetadata } from '@shared/configuration/profile.types';
import { getProfilesState } from '@shared/configuration/profiles-state';
import { createElement } from '@shared/dom/create-element';
import { displayToast } from '@shared/dom/display-toast';

export class HTMLProfileManagerElement extends HTMLElement {
  protected _profiles: ProfileMetadata[] = [];
  protected _activeProfileId: string = '';
  protected _tableHost: HTMLElement;
  protected _createButton: HTMLButtonElement;
  protected _limitWarning: HTMLElement;

  public async connectedCallback(): Promise<void> {
    await this.loadProfiles();
    this.render();
  }

  protected async loadProfiles(): Promise<void> {
    const state = await getProfilesState();
    this._profiles = state.profiles;
    this._activeProfileId = state.activeProfileId;
  }

  protected render(): void {
    this.innerHTML = '';

    this._limitWarning = createElement('div', {
      class: 'limit-warning',
      style: { display: 'none', color: '#ff9800', marginBottom: '1em' },
      innerText: `Maximum of ${MAX_PROFILES} profiles reached. Delete a profile to create a new one.`,
    });
    this.appendChild(this._limitWarning);

    this._tableHost = createElement('div', { class: 'table-box' });
    this.appendChild(this._tableHost);

    this.renderProfileRows();

    this._createButton = createElement('button', {
      class: ['outline', 'create-profile-btn'],
      innerText: '+ Create New Profile',
      handler: () => this.showCreateDialog(),
    }) as HTMLButtonElement;

    this.appendChild(this._createButton);
    this.updateLimitWarning();
  }

  protected renderProfileRows(): void {
    this._tableHost.innerHTML = '';

    const headerRow = createElement('div', { class: ['row', 'header'] });
    headerRow.appendChild(createElement('div', {
      class: 'col',
      innerText: 'Profile',
      style: { fontWeight: 'bold', flex: '1' },
    }));
    headerRow.appendChild(createElement('div', {
      class: 'col',
      innerText: 'Actions',
      style: { fontWeight: 'bold', width: '200px' },
    }));
    this._tableHost.appendChild(headerRow);

    for (const profile of this._profiles) {
      const isActive = profile.id === this._activeProfileId;
      const canDelete = this._profiles.length > 1 && !isActive;

      const row = createElement('div', { class: ['row', isActive ? 'active-profile' : ''] });

      const nameCol = createElement('div', {
        class: 'col',
        style: { flex: '1', display: 'flex', alignItems: 'center', gap: '0.5em' },
      });
      nameCol.appendChild(createElement('span', { innerText: profile.name }));
      if (isActive) {
        nameCol.appendChild(createElement('span', {
          class: 'active-badge',
          innerText: '(active)',
          style: { opacity: '0.6' },
        }));
      }
      row.appendChild(nameCol);

      const actionsCol = createElement('div', {
        class: 'col',
        style: { width: '200px', display: 'flex', gap: '0.5em' },
      });
      actionsCol.appendChild(createElement('button', {
        class: 'outline',
        innerText: 'Rename',
        handler: () => this.showRenameDialog(profile),
      }));
      actionsCol.appendChild(createElement('button', {
        class: 'outline',
        innerText: 'Duplicate',
        handler: () => this.handleDuplicate(profile),
      }));
      if (canDelete) {
        actionsCol.appendChild(createElement('button', {
          class: ['outline', 'v1'],
          innerText: 'Delete',
          handler: () => this.showDeleteDialog(profile),
        }));
      }
      row.appendChild(actionsCol);

      this._tableHost.appendChild(row);
    }
  }

  protected updateLimitWarning(): void {
    const atLimit = this._profiles.length >= MAX_PROFILES;
    this._limitWarning.style.display = atLimit ? 'block' : 'none';
    this._createButton.disabled = atLimit;
  }

  protected showCreateDialog(): void {
    const name = prompt('Enter profile name:');

    if (name?.trim()) {
      void this.handleCreate(name.trim());
    }
  }

  protected async handleCreate(name: string): Promise<void> {
    const newProfile = await createProfile(name);

    if (newProfile) {
      displayToast('success', `Profile "${name}" created`);
      await this.refresh();
    } else {
      displayToast('error', 'Failed to create profile');
    }
  }

  protected showRenameDialog(profile: ProfileMetadata): void {
    const newName = prompt('Enter new profile name:', profile.name);

    if (newName?.trim() && newName.trim() !== profile.name) {
      void this.handleRename(profile.id, newName.trim());
    }
  }

  protected async handleRename(profileId: string, newName: string): Promise<void> {
    const success = await renameProfile(profileId, newName);

    if (success) {
      displayToast('success', `Profile renamed to "${newName}"`);
      await this.refresh();
    } else {
      displayToast('error', 'Failed to rename profile');
    }
  }

  protected async handleDuplicate(profile: ProfileMetadata): Promise<void> {
    if (this._profiles.length >= MAX_PROFILES) {
      displayToast('error', `Maximum of ${MAX_PROFILES} profiles reached`);
      return;
    }

    const newProfile = await duplicateProfile(profile.id);

    if (newProfile) {
      displayToast('success', `Profile "${newProfile.name}" created`);
      await this.refresh();
    } else {
      displayToast('error', 'Failed to duplicate profile');
    }
  }

  protected showDeleteDialog(profile: ProfileMetadata): void {
    const confirmed = confirm(`Are you sure you want to delete profile "${profile.name}"?\n\nThis action cannot be undone.`);

    if (confirmed) {
      void this.handleDelete(profile);
    }
  }

  protected async handleDelete(profile: ProfileMetadata): Promise<void> {
    const success = await deleteProfile(profile.id);

    if (success) {
      displayToast('success', `Profile "${profile.name}" deleted`);
      await this.refresh();
    } else {
      displayToast('error', 'Failed to delete profile');
    }
  }

  public async refresh(): Promise<void> {
    await this.loadProfiles();
    this.renderProfileRows();
    this.updateLimitWarning();
  }

  public async switchToProfile(profileId: string): Promise<boolean> {
    const success = await switchProfile(profileId);

    if (success) {
      this._activeProfileId = profileId;
      this.renderProfileRows();
    }

    return success;
  }
}
