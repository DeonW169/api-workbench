import { Component, computed, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ApiRequest, KeyValueItem } from '../../../shared/models/api-request.model';
import { HighlightVarsPipe } from '../../../shared/pipes/highlight-vars.pipe';

@Component({
  selector: 'app-resolved-preview',
  imports: [MatIconModule, HighlightVarsPipe],
  templateUrl: './resolved-preview.html',
  styleUrl: './resolved-preview.scss',
})
export class ResolvedPreviewPanel {
  /** The fully-resolved request snapshot (variables already substituted). */
  readonly resolved = input.required<ApiRequest | null>();

  /** Names of {{variables}} that could not be resolved. */
  readonly unresolved = input.required<Set<string>>();

  readonly expanded = signal(false);

  toggle(): void {
    this.expanded.update(v => !v);
  }

  // ── Derived view data ──────────────────────────────────────────────────────

  readonly enabledParams = computed<KeyValueItem[]>(() =>
    this.resolved()?.queryParams.filter(p => p.enabled && p.key) ?? [],
  );

  readonly enabledHeaders = computed<KeyValueItem[]>(() =>
    this.resolved()?.headers.filter(h => h.enabled && h.key) ?? [],
  );

  readonly hasBody = computed<boolean>(() => {
    const r = this.resolved();
    if (!r) return false;
    return r.bodyType !== 'none' && r.bodyRaw.length > 0;
  });

  readonly unresolvedList = computed<string[]>(() =>
    [...this.unresolved()].sort(),
  );
}
