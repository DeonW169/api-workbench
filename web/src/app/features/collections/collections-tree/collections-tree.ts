import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RequestsService } from '../../../core/state/requests';
import { WorkspaceService } from '../../../core/state/workspace';
import { ApiRequest } from '../../../shared/models/api-request.model';

@Component({
  selector: 'app-collections-tree',
  imports: [MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './collections-tree.html',
  styleUrl: './collections-tree.scss',
})
export class CollectionsTree {
  readonly reqService = inject(RequestsService);
  readonly workspace = inject(WorkspaceService);

  // ── Inline rename state ───────────────────────────────────────────────────

  readonly editingId = signal<string | null>(null);
  readonly editingName = signal('');

  // ── Actions ───────────────────────────────────────────────────────────────

  open(req: ApiRequest): void {
    if (this.editingId()) return; // ignore click while renaming
    this.workspace.loadRequest(req);
  }

  startRename(req: ApiRequest, event: MouseEvent): void {
    event.stopPropagation();
    this.editingId.set(req.id);
    this.editingName.set(req.name);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        `input[data-rename-id="${req.id}"]`,
      );
      input?.focus();
      input?.select();
    });
  }

  commitRename(id: string): void {
    const name = this.editingName().trim();
    if (name) this.reqService.rename(id, name);
    this.editingId.set(null);
  }

  cancelRename(): void {
    this.editingId.set(null);
  }

  duplicate(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.reqService.duplicate(id);
  }

  delete(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.reqService.delete(id);
  }

  isActive(id: string): boolean {
    return this.workspace.currentRequest()?.id === id;
  }
}
