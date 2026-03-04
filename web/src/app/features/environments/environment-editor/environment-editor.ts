import { Component, computed, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EnvironmentModel, EnvironmentVariable } from '../../../shared/models/environment.model';

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
    MatIconModule,
    MatCheckboxModule,
    MatTooltipModule,
  ],
  templateUrl: './environment-editor.html',
  styleUrl: './environment-editor.scss',
})
export class EnvironmentEditor {
  private readonly dialogRef = inject(MatDialogRef<EnvironmentEditor>);
  private readonly data = inject<EnvironmentEditorData>(MAT_DIALOG_DATA);

  readonly isNew = !this.data.environment;

  readonly name = signal(this.data.environment?.name ?? '');
  readonly variables = signal<EnvironmentVariable[]>(
    this.data.environment?.variables.map(v => ({ ...v })) ?? [],
  );

  readonly canSave = computed(() => this.name().trim().length > 0);

  addVariable(): void {
    this.variables.update(vars => [
      ...vars,
      { key: '', value: '', enabled: true, secret: false },
    ]);
  }

  removeVariable(index: number): void {
    this.variables.update(vars => vars.filter((_, i) => i !== index));
  }

  setVarKey(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.variables.update(vars =>
      vars.map((v, i) => (i === index ? { ...v, key: value } : v)),
    );
  }

  setVarValue(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.variables.update(vars =>
      vars.map((v, i) => (i === index ? { ...v, value } : v)),
    );
  }

  setEnabled(index: number, enabled: boolean): void {
    this.variables.update(vars =>
      vars.map((v, i) => (i === index ? { ...v, enabled } : v)),
    );
  }

  setSecret(index: number, secret: boolean): void {
    this.variables.update(vars =>
      vars.map((v, i) => (i === index ? { ...v, secret } : v)),
    );
  }

  setName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  save(): void {
    if (!this.canSave()) return;
    const now = new Date().toISOString();
    const env: EnvironmentModel = {
      id: this.data.environment?.id ?? crypto.randomUUID(),
      name: this.name().trim(),
      variables: this.variables(),
      createdAt: this.data.environment?.createdAt ?? now,
      updatedAt: now,
    };
    this.dialogRef.close(env);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
