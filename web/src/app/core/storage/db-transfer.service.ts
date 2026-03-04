import { Injectable, inject } from '@angular/core';
import { AppDbService } from './app-db.service';
import { CollectionsService } from '../state/collections';
import { GlobalsService } from '../state/globals';
import { RequestsService } from '../state/requests';
import { EnvironmentsService } from '../state/environments';
import { HistoryService } from '../state/history';

export type ImportError =
  | 'invalid-json'
  | 'wrong-format'
  | 'wrong-database'
  | 'missing-tables';

const DB_NAME = 'api-workbench-db';
const REQUIRED_TABLES = ['requests', 'environments', 'history'];

const ERROR_MESSAGES: Record<ImportError, string> = {
  'invalid-json': 'File is not valid JSON.',
  'wrong-format': 'Not a Dexie export file.',
  'wrong-database': 'This backup is from a different database.',
  'missing-tables': 'Backup is missing required tables.',
};

@Injectable({ providedIn: 'root' })
export class DbTransferService {
  private readonly db = inject(AppDbService);
  private readonly collections = inject(CollectionsService);
  private readonly globals = inject(GlobalsService);
  private readonly requests = inject(RequestsService);
  private readonly environments = inject(EnvironmentsService);
  private readonly history = inject(HistoryService);

  /** Export all tables as a pretty-printed JSON blob and trigger browser download. */
  async exportDb(): Promise<void> {
    const { exportDB } = await import('dexie-export-import');
    const blob = await exportDB(this.db, { prettyJson: true });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-workbench-backup-${isoDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Validate then import a file, replacing all existing data.
   * Returns a human-readable error string on failure, null on success.
   */
  async importDb(file: File): Promise<string | null> {
    const errorKey = await this.validate(file);
    if (errorKey) return ERROR_MESSAGES[errorKey];

    const text = await file.text();
    const blob = new Blob([text], { type: 'application/json' });
    const { importInto } = await import('dexie-export-import');
    await importInto(this.db, blob, { clearTablesBeforeImport: true });

    // Refresh all in-memory signal stores
    await Promise.all([
      this.collections.init(),
      this.globals.init(),
      this.requests.init(),
      this.environments.init(),
      this.history.init(),
    ]);

    // Clear stale active environment selection
    this.environments.setActive(null);

    return null;
  }

  private async validate(file: File): Promise<ImportError | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return 'invalid-json';
    }

    if (typeof parsed !== 'object' || parsed === null) return 'wrong-format';

    const root = parsed as Record<string, unknown>;

    if (root['formatName'] !== 'dexie') return 'wrong-format';

    const data = root['data'] as Record<string, unknown> | undefined;
    if (!data || data['databaseName'] !== DB_NAME) return 'wrong-database';

    const tables = data['tables'] as { name: string }[] | undefined;
    const tableNames = Array.isArray(tables) ? tables.map(t => t.name) : [];
    if (!REQUIRED_TABLES.every(t => tableNames.includes(t))) return 'missing-tables';

    return null;
  }
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
