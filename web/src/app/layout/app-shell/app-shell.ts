import { Component, inject, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { CollectionsTree } from '../../features/collections/collections-tree/collections-tree';
import { HistoryList } from '../../features/history/history-list/history-list';
import { EnvironmentSelector } from '../../features/environments/environment-selector/environment-selector';
import { EnvironmentsList } from '../../features/environments/environments-list/environments-list';
import { RequestTabs } from '../../features/requests/request-tabs/request-tabs';
import { RequestEditor } from '../../features/requests/request-editor/request-editor';
import { ResponseViewer } from '../../features/responses/response-viewer/response-viewer';
import { SettingsMenu } from './settings-menu/settings-menu';
import { EnvironmentsService } from '../../core/state/environments';
import { HistoryService } from '../../core/state/history';
import { WorkspaceService } from '../../core/state/workspace';
import { RequestsService } from '../../core/state/requests';
import { ApiRequest } from '../../shared/models/api-request.model';

type SidenavSection = 'collections' | 'history' | 'environments';

@Component({
  selector: 'app-shell',
  imports: [
    MatToolbarModule,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    CollectionsTree,
    HistoryList,
    EnvironmentSelector,
    EnvironmentsList,
    RequestTabs,
    RequestEditor,
    ResponseViewer,
    SettingsMenu,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  readonly workspace = inject(WorkspaceService);
  readonly requestsService = inject(RequestsService);
  activeSection = signal<SidenavSection>('collections');

  constructor() {
    inject(EnvironmentsService).init();
    inject(HistoryService).init();
    this.requestsService.init();
  }

  setSection(section: SidenavSection): void {
    this.activeSection.set(section);
  }

  /** Save the current editor state to the collection. */
  saveRequest(): void {
    const current = this.workspace.currentRequest();
    if (!current) return;
    // Preserve any name set by the user via inline rename
    const existing = this.requestsService.requests().find(r => r.id === current.id);
    const toSave: ApiRequest = existing
      ? { ...current, name: existing.name }
      : current;
    this.requestsService.save(toSave);
  }

  /** Load a blank request into the editor (does not save to DB). */
  newRequest(): void {
    const now = new Date().toISOString();
    const blank: ApiRequest = {
      id: crypto.randomUUID(),
      name: 'New Request',
      method: 'GET',
      url: '',
      queryParams: [],
      headers: [],
      bodyType: 'none',
      bodyRaw: '',
      auth: { type: 'none' },
      createdAt: now,
      updatedAt: now,
    };
    this.workspace.loadRequest(blank);
  }
}
