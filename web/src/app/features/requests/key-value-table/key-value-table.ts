import { Component, model } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { KeyValueItem } from '../../../shared/models/api-request.model';

@Component({
  selector: 'app-key-value-table',
  imports: [MatCheckboxModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './key-value-table.html',
  styleUrl: './key-value-table.scss',
})
export class KeyValueTable {
  readonly rows = model.required<KeyValueItem[]>();

  addRow(): void {
    this.rows.update(rows => [...rows, { key: '', value: '', enabled: true }]);
  }

  removeRow(index: number): void {
    this.rows.update(rows => rows.filter((_, i) => i !== index));
  }

  setKey(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rows.update(rows =>
      rows.map((row, i) => (i === index ? { ...row, key: value } : row)),
    );
  }

  setValue(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rows.update(rows =>
      rows.map((row, i) => (i === index ? { ...row, value } : row)),
    );
  }

  setEnabled(index: number, enabled: boolean): void {
    this.rows.update(rows =>
      rows.map((row, i) => (i === index ? { ...row, enabled } : row)),
    );
  }
}
