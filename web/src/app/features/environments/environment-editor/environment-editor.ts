import { Component, computed, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EnvironmentModel, EnvironmentVariable } from '../../../shared/models/environment.model';
import { VarRow, VarsTable } from '../../../shared/vars-table/vars-table';

export interface EnvironmentEditorData {
  environment: EnvironmentModel | null;
}

@Component({
  selector: 'app-environment-editor',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    VarsTable,
  ],
  templateUrl: './environment-editor.html',
  styleUrl: './environment-editor.scss',
})
export class EnvironmentEditor {
  private readonly dialogRef = inject(MatDialogRef<EnvironmentEditor>);
  private readonly data = inject<EnvironmentEditorData>(MAT_DIALOG_DATA);

  readonly isNew = !this.data.environment;

  readonly name = signal(this.data.environment?.name ?? '');
  readonly rows = signal<VarRow[]>(
    this.data.environment?.variables.map(v => ({ ...v })) ?? [],
  );

  readonly canSave = computed(() => this.name().trim().length > 0);

  setName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  save(): void {
    if (!this.canSave()) return;
    const now = new Date().toISOString();
    const env: EnvironmentModel = {
      id: this.data.environment?.id ?? crypto.randomUUID(),
      name: this.name().trim(),
      variables: this.rows() as EnvironmentVariable[],
      createdAt: this.data.environment?.createdAt ?? now,
      updatedAt: now,
    };
    this.dialogRef.close(env);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
