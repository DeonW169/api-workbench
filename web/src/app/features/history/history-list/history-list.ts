import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HistoryService } from '../../../core/state/history';
import { WorkspaceService } from '../../../core/state/workspace';
import { HistoryItem } from '../../../shared/models/history-item.model';

@Component({
  selector: 'app-history-list',
  imports: [MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './history-list.html',
  styleUrl: './history-list.scss',
})
export class HistoryList {
  readonly historyService = inject(HistoryService);
  readonly workspace = inject(WorkspaceService);

  open(item: HistoryItem): void {
    this.workspace.loadRequest(item.request);
  }

  clear(): void {
    this.historyService.clear();
  }

  /** Display label: prefer a meaningful name over the default. */
  displayLabel(item: HistoryItem): string {
    const name = item.request.name;
    return name && name !== 'New Request' ? name : (item.request.url || '(no url)');
  }

  /** Classify status code into a CSS range class. */
  statusRange(status: number): string {
    if (status >= 500) return 'status-5xx';
    if (status >= 400) return 'status-4xx';
    if (status >= 200) return 'status-2xx';
    return 'status-other';
  }

  /** Human-readable relative time (e.g. "2m", "1h", "3d"). */
  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }
}
