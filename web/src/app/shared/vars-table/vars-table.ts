import { Component, model, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/** Minimal variable row shape shared by all variable scopes. */
export interface VarRow {
  key: string;
  value: string;
  enabled: boolean;
  secret?: boolean;
}

/**
 * Reusable variable table with add / remove / inline-edit and secret masking.
 *
 * Use two-way model binding in the parent:
 *   `<app-vars-table [(rows)]="mySignal" />`
 */
@Component({
  selector: 'app-vars-table',
  imports: [MatButtonModule, MatCheckboxModule, MatIconModule, MatTooltipModule],
  templateUrl: './vars-table.html',
  styleUrl: './vars-table.scss',
})
export class VarsTable {
  readonly rows = model.required<VarRow[]>();

  /** Indices of secret rows whose value is currently visible. */
  private readonly revealed = signal<ReadonlySet<number>>(new Set());

  isRevealed(i: number): boolean {
    return this.revealed().has(i);
  }

  toggleReveal(i: number): void {
    this.revealed.update(s => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }

  add(): void {
    this.rows.update(rows => [...rows, { key: '', value: '', enabled: true, secret: false }]);
  }

  remove(i: number): void {
    // Re-index the revealed set so positions shift correctly after removal.
    this.revealed.update(s =>
      new Set([...s].filter(j => j !== i).map(j => (j > i ? j - 1 : j))),
    );
    this.rows.update(rows => rows.filter((_, j) => j !== i));
  }

  setKey(i: number, event: Event): void {
    const key = (event.target as HTMLInputElement).value;
    this.rows.update(rows => rows.map((r, j) => (j === i ? { ...r, key } : r)));
  }

  setValue(i: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rows.update(rows => rows.map((r, j) => (j === i ? { ...r, value } : r)));
  }

  setEnabled(i: number, enabled: boolean): void {
    this.rows.update(rows => rows.map((r, j) => (j === i ? { ...r, enabled } : r)));
  }

  setSecret(i: number, secret: boolean): void {
    if (!secret) {
      this.revealed.update(s => {
        const n = new Set(s);
        n.delete(i);
        return n;
      });
    }
    this.rows.update(rows => rows.map((r, j) => (j === i ? { ...r, secret } : r)));
  }
}
