import { Component, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CollectionsService } from '../../../core/state/collections';
import { Collection, CollectionVariable } from '../../../shared/models/collection.model';
import { VarRow, VarsTable } from '../../../shared/vars-table/vars-table';

export interface CollectionVarsEditorData {
  collection: Collection;
}

@Component({
  selector: 'app-collection-vars-editor',
  imports: [MatDialogModule, MatButtonModule, VarsTable],
  templateUrl: './collection-vars-editor.html',
  styleUrl: './collection-vars-editor.scss',
})
export class CollectionVarsEditor {
  private readonly dialogRef = inject(MatDialogRef<CollectionVarsEditor>);
  private readonly data = inject<CollectionVarsEditorData>(MAT_DIALOG_DATA);
  private readonly collService = inject(CollectionsService);

  readonly collectionName = this.data.collection.name;
  readonly rows = signal<VarRow[]>(
    (this.data.collection.variables ?? []).map(v => ({ ...v })),
  );

  save(): void {
    this.collService.setVariables(this.data.collection.id, this.rows() as CollectionVariable[]);
    this.dialogRef.close();
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
