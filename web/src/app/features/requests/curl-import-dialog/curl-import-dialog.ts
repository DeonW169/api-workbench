import { Component, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { parseCurl, suggestName } from '../../../core/utils/curl-parser';
import { WorkspaceService } from '../../../core/state/workspace';

@Component({
  selector: 'app-curl-import-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './curl-import-dialog.html',
  styleUrl: './curl-import-dialog.scss',
})
export class CurlImportDialog {
  private readonly dialogRef = inject(MatDialogRef<CurlImportDialog>);
  private readonly workspace = inject(WorkspaceService);

  readonly command = signal('');
  readonly error   = signal<string | null>(null);

  onInput(event: Event): void {
    this.command.set((event.target as HTMLTextAreaElement).value);
    this.error.set(null);
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      this.doImport();
    }
  }

  doImport(): void {
    const parsed = parseCurl(this.command());
    if (!parsed) {
      this.error.set('Not a valid cURL command. Make sure it starts with "curl".');
      return;
    }

    const name = suggestName(parsed.method, parsed.url);
    this.workspace.importFromParsed({ ...parsed, name });
    this.dialogRef.close();
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
