import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { GlobalsService } from '../../../core/state/globals';
import { GlobalVariable } from '../../../shared/models/globals.model';
import { VarRow, VarsTable } from '../../../shared/vars-table/vars-table';

@Component({
  selector: 'app-globals-editor',
  imports: [MatDialogModule, MatButtonModule, VarsTable],
  templateUrl: './globals-editor.html',
  styleUrl: './globals-editor.scss',
})
export class GlobalsEditor {
  private readonly dialogRef = inject(MatDialogRef<GlobalsEditor>);
  private readonly globalsService = inject(GlobalsService);

  readonly rows = signal<VarRow[]>(
    this.globalsService.variables().map(v => ({ ...v })),
  );

  save(): void {
    this.globalsService.setVariables(this.rows() as GlobalVariable[]);
    this.dialogRef.close();
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
