import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CollectionsService } from '../../../core/state/collections';
import { FoldersService } from '../../../core/state/folders';
import { RequestsService } from '../../../core/state/requests';
import { WorkspaceService } from '../../../core/state/workspace';
import { ApiRequest } from '../../../shared/models/api-request.model';
import { Collection } from '../../../shared/models/collection.model';
import { Folder } from '../../../shared/models/folder.model';
import {
  CollectionVarsEditor,
  CollectionVarsEditorData,
} from '../collection-vars-editor/collection-vars-editor';
import {
  CollectionRunnerDialog,
  CollectionRunnerDialogData,
} from '../collection-runner/collection-runner-dialog';

type EditTarget = 'collection' | 'folder' | 'request';

@Component({
  selector: 'app-collections-tree',
  imports: [MatIconModule, MatButtonModule, MatTooltipModule, MatDividerModule],
  templateUrl: './collections-tree.html',
  styleUrl: './collections-tree.scss',
})
export class CollectionsTree {
  private readonly dialog = inject(MatDialog);
  readonly collService = inject(CollectionsService);
  readonly folderService = inject(FoldersService);
  readonly reqService = inject(RequestsService);
  readonly workspace = inject(WorkspaceService);

  // ── Expand / collapse (collapsed = in set; default: all open) ─────────────

  readonly collapsedCollections = signal<ReadonlySet<string>>(new Set());
  readonly collapsedFolders = signal<ReadonlySet<string>>(new Set());

  isCollectionExpanded(id: string): boolean {
    return !this.collapsedCollections().has(id);
  }

  isFolderExpanded(id: string): boolean {
    return !this.collapsedFolders().has(id);
  }

  toggleCollection(id: string): void {
    this.collapsedCollections.update(s => toggle(s, id));
  }

  toggleFolder(id: string): void {
    this.collapsedFolders.update(s => toggle(s, id));
  }

  // ── Inline rename ─────────────────────────────────────────────────────────

  readonly editingId = signal<string | null>(null);
  private editTarget: EditTarget = 'request';
  readonly editingName = signal('');

  startRename(type: EditTarget, id: string, name: string, event: MouseEvent): void {
    event.stopPropagation();
    this.beginEdit(type, id, name);
  }

  commitRename(id: string): void {
    const name = this.editingName().trim();
    if (name) {
      if (this.editTarget === 'collection') this.collService.rename(id, name);
      else if (this.editTarget === 'folder') this.folderService.rename(id, name);
      else this.reqService.rename(id, name);
    }
    this.editingId.set(null);
  }

  cancelRename(): void {
    this.editingId.set(null);
  }

  // ── Data helpers ──────────────────────────────────────────────────────────

  foldersForCollection(collectionId: string): Folder[] {
    return this.folderService.forCollection(collectionId);
  }

  requestsForFolder(collectionId: string, folderId: string): ApiRequest[] {
    return this.reqService
      .requests()
      .filter(r => r.collectionId === collectionId && r.folderId === folderId);
  }

  requestsInCollection(collectionId: string): ApiRequest[] {
    return this.reqService
      .requests()
      .filter(r => r.collectionId === collectionId && !r.folderId);
  }

  uncategorizedRequests(): ApiRequest[] {
    return this.reqService.requests().filter(r => !r.collectionId);
  }

  isActive(id: string): boolean {
    return this.workspace.currentRequest()?.id === id;
  }

  openRequest(req: ApiRequest): void {
    if (this.editingId()) return;
    this.workspace.loadRequest(req);
  }

  // ── Collection variables ──────────────────────────────────────────────────

  openVariables(coll: Collection, event: MouseEvent): void {
    event.stopPropagation();
    this.dialog.open<CollectionVarsEditor, CollectionVarsEditorData>(
      CollectionVarsEditor,
      { data: { collection: coll }, width: '640px', maxHeight: '80vh' },
    );
  }

  // ── Collection runner ──────────────────────────────────────────────────────

  openRunnerForCollection(coll: Collection, event: MouseEvent): void {
    event.stopPropagation();
    this.dialog.open<CollectionRunnerDialog, CollectionRunnerDialogData>(
      CollectionRunnerDialog,
      { data: { collectionId: coll.id, name: coll.name }, width: '700px', maxHeight: '80vh' },
    );
  }

  openRunnerForFolder(coll: Collection, folder: Folder, event: MouseEvent): void {
    event.stopPropagation();
    this.dialog.open<CollectionRunnerDialog, CollectionRunnerDialogData>(
      CollectionRunnerDialog,
      {
        data: { collectionId: coll.id, folderId: folder.id, name: folder.name },
        width: '700px',
        maxHeight: '80vh',
      },
    );
  }

  // ── Create ────────────────────────────────────────────────────────────────

  addCollection(): void {
    const c = this.collService.create('New Collection');
    this.beginEdit('collection', c.id, c.name);
  }

  addFolder(collectionId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.collapsedCollections.update(s => remove(s, collectionId));
    const f = this.folderService.create('New Folder', collectionId);
    this.beginEdit('folder', f.id, f.name);
  }

  addRequest(
    collectionId: string | null,
    folderId: string | null,
    event: MouseEvent,
  ): void {
    event.stopPropagation();
    if (collectionId) this.collapsedCollections.update(s => remove(s, collectionId));
    if (folderId) this.collapsedFolders.update(s => remove(s, folderId));
    const req = this.reqService.createInCollection(collectionId, folderId);
    this.workspace.loadRequest(req);
    this.beginEdit('request', req.id, req.name);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  deleteCollection(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.folderService
      .folders()
      .filter(f => f.collectionId === id)
      .forEach(f => {
        this.reqService.deleteByFolder(f.id);
        this.folderService.delete(f.id);
      });
    this.reqService.deleteByCollection(id);
    this.collService.delete(id);
  }

  deleteFolder(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.reqService.deleteByFolder(id);
    this.folderService.delete(id);
  }

  deleteRequest(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.reqService.delete(id);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private beginEdit(type: EditTarget, id: string, name: string): void {
    this.editTarget = type;
    this.editingId.set(id);
    this.editingName.set(name);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(`input[data-edit-id="${id}"]`);
      el?.focus();
      el?.select();
    });
  }
}

// ── Immutable set helpers ─────────────────────────────────────────────────────

function toggle(s: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const n = new Set(s);
  n.has(id) ? n.delete(id) : n.add(id);
  return n;
}

function remove(s: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const n = new Set(s);
  n.delete(id);
  return n;
}
