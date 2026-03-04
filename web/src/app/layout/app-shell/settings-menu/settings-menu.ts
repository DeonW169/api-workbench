import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DbTransferService } from '../../../core/storage/db-transfer.service';

@Component({
  selector: 'app-settings-menu',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './settings-menu.html',
  styleUrl: './settings-menu.scss',
})
export class SettingsMenu {
  private readonly transfer = inject(DbTransferService);

  readonly importError = signal<string | null>(null);
  readonly isImporting = signal(false);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

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
}
