import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DbTransferService } from '../../../core/storage/db-transfer.service';
import { VarsTransferService } from '../../../core/storage/vars-transfer.service';
import { GlobalsEditor } from '../../../features/globals/globals-editor/globals-editor';

@Component({
  selector: 'app-settings-menu',
  imports: [MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './settings-menu.html',
  styleUrl: './settings-menu.scss',
})
export class SettingsMenu {
  private readonly transfer = inject(DbTransferService);
  private readonly varsTransfer = inject(VarsTransferService);
  private readonly dialog = inject(MatDialog);

  readonly importError = signal<string | null>(null);
  readonly isImporting = signal(false);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('varsFileInput') varsFileInputRef!: ElementRef<HTMLInputElement>;

  openGlobals(): void {
    this.dialog.open(GlobalsEditor, { width: '640px', maxHeight: '80vh' });
  }

  // ── Full DB backup ─────────────────────────────────────────────────────────

  async onExport(): Promise<void> {
    this.importError.set(null);
    await this.transfer.exportDb();
  }

  openFilePicker(): void {
    this.importError.set(null);
    this.fileInputRef.nativeElement.value = '';
    this.fileInputRef.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isImporting.set(true);
    this.importError.set(null);

    const error = await this.transfer.importDb(file);

    this.isImporting.set(false);
    this.importError.set(error);
  }

  // ── Variables export / import ──────────────────────────────────────────────

  onExportVars(): void {
    this.importError.set(null);
    this.varsTransfer.exportVariables();
  }

  openVarsFilePicker(): void {
    this.importError.set(null);
    this.varsFileInputRef.nativeElement.value = '';
    this.varsFileInputRef.nativeElement.click();
  }

  async onVarsFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isImporting.set(true);
    this.importError.set(null);

    const error = await this.varsTransfer.importVariables(file);

    this.isImporting.set(false);
    this.importError.set(error);
  }
}
