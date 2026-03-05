import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';
import { CollectionRunnerService } from '../../../core/state/collection-runner.service';
import { RequestsService } from '../../../core/state/requests';
import { CollectionRunItem, CollectionRunSummary } from '../../../shared/models/collection-run.model';
import { ApiRequest } from '../../../shared/models/api-request.model';

export interface CollectionRunnerDialogData {
  collectionId: string;
  folderId?: string;
  /** Human-readable label shown in the dialog title. */
  name: string;
}

type RunPhase = 'config' | 'running' | 'done';

@Component({
  selector: 'app-collection-runner-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './collection-runner-dialog.html',
  styleUrl: './collection-runner-dialog.scss',
})
export class CollectionRunnerDialog implements OnDestroy {
  private readonly dialogRef    = inject(MatDialogRef<CollectionRunnerDialog>);
  private readonly data         = inject<CollectionRunnerDialogData>(MAT_DIALOG_DATA);
  private readonly runnerService = inject(CollectionRunnerService);
  private readonly requestsService = inject(RequestsService);

  private runSub?: Subscription;

  // ── Dialog context ────────────────────────────────────────────────────────

  readonly scopeName = this.data.name;

  readonly requestCount = computed(() => {
    const all = this.requestsService.requests();
    if (this.data.folderId) {
      return all.filter(
        r => r.collectionId === this.data.collectionId && r.folderId === this.data.folderId,
      ).length;
    }
    return all.filter(r => r.collectionId === this.data.collectionId).length;
  });

  // ── Options ───────────────────────────────────────────────────────────────

  readonly stopOnFailure = signal(false);
  readonly delayMs       = signal(0);

  // ── Phase ─────────────────────────────────────────────────────────────────

  readonly phase = signal<RunPhase>('config');

  // ── Running state ─────────────────────────────────────────────────────────

  readonly currentRequest = signal<ApiRequest | null>(null);
  readonly total          = signal(0);
  readonly results        = signal<CollectionRunItem[]>([]);

  readonly progress = computed(() => {
    const t = this.total();
    return t === 0 ? 0 : Math.round((this.results().length / t) * 100);
  });

  // ── Done state ────────────────────────────────────────────────────────────

  readonly summary = signal<CollectionRunSummary | null>(null);

  // ── Actions ───────────────────────────────────────────────────────────────

  run(): void {
    this.results.set([]);
    this.currentRequest.set(null);
    this.total.set(this.requestCount());
    this.summary.set(null);
    this.phase.set('running');

    this.runSub = this.runnerService
      .run(
        { collectionId: this.data.collectionId, folderId: this.data.folderId },
        { stopOnFailure: this.stopOnFailure(), delayMs: this.delayMs() },
      )
      .subscribe({
        next: event => {
          if (event.type === 'start') {
            this.currentRequest.set(event.request);
            this.total.set(event.total);
          } else if (event.type === 'result') {
            this.results.update(r => [...r, event.item]);
          } else if (event.type === 'complete') {
            this.summary.set(event.summary);
            this.phase.set('done');
          }
        },
        error: () => this.phase.set('done'),
      });
  }

  stop(): void {
    this.runSub?.unsubscribe();
    const items = this.results();
    const total = this.total();
    this.summary.set({
      totalRequests:   total,
      passed:          items.filter(r => r.passed).length,
      failed:          items.filter(r => !r.passed).length,
      skipped:         total - items.length,
      totalDurationMs: items.reduce((sum, r) => sum + r.durationMs, 0),
      items,
      stoppedEarly:    true,
    });
    this.phase.set('done');
  }

  reset(): void {
    this.runSub?.unsubscribe();
    this.phase.set('config');
  }

  close(): void {
    this.runSub?.unsubscribe();
    this.dialogRef.close();
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  formatDuration(ms: number): string {
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
  }

  setDelayMs(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.delayMs.set(isNaN(val) || val < 0 ? 0 : val);
  }

  ngOnDestroy(): void {
    this.runSub?.unsubscribe();
  }
}
