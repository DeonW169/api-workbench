import { Component, computed, input, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiResponse } from '../../../shared/models/api-response.model';
import { JsonTree } from '../json-tree/json-tree';

/** Status range for color-coding. */
type StatusRange = '1xx' | '2xx' | '3xx' | '4xx' | '5xx' | 'unknown';

@Component({
  selector: 'app-response-viewer',
  imports: [
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    JsonTree,
  ],
  templateUrl: './response-viewer.html',
  styleUrl: './response-viewer.scss',
})
export class ResponseViewer {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Null means no response received yet (idle state). */
  readonly response = input<ApiResponse | null>(null);

  /** True while a request is in flight. */
  readonly isLoading = input(false);

  /** Error message from the last failed execution, or null. */
  readonly errorMessage = input<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  readonly statusRange = computed<StatusRange>(() => {
    const s = this.response()?.status ?? 0;
    if (s >= 100 && s < 200) return '1xx';
    if (s >= 200 && s < 300) return '2xx';
    if (s >= 300 && s < 400) return '3xx';
    if (s >= 400 && s < 500) return '4xx';
    if (s >= 500 && s < 600) return '5xx';
    return 'unknown';
  });

  readonly durationLabel = computed(() => {
    const ms = this.response()?.durationMs ?? 0;
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
  });

  readonly sizeLabel = computed(() => {
    const bytes = this.response()?.size ?? 0;
    if (bytes < 1024)         return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  });

  readonly isJson = computed(() =>
    (this.response()?.contentType ?? '').toLowerCase().includes('application/json'),
  );

  /** Pretty-printed body string (used for copy and non-JSON display). */
  readonly prettyBody = computed(() => {
    const r = this.response();
    if (!r) return '';

    if (this.isJson()) {
      try {
        const parsed = typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
        return JSON.stringify(parsed, null, 2);
      } catch {
        // Body claims to be JSON but is malformed — fall through to raw display.
      }
    }

    return typeof r.body === 'string' ? r.body : JSON.stringify(r.body, null, 2);
  });

  /** Raw body as a plain string (no pretty-printing). */
  readonly rawBody = computed(() => {
    const r = this.response();
    if (!r) return '';
    return typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
  });

  readonly hasBody = computed(() => {
    const body = this.response()?.body;
    if (body === null || body === undefined) return false;
    if (typeof body === 'string') return body.trim().length > 0;
    return true;
  });

  /** Parsed JSON object for the tree viewer, or null if not JSON / parse fails. */
  readonly parsedBody = computed<unknown>(() => {
    if (!this.isJson()) return null;
    const r = this.response();
    if (!r) return null;
    try {
      return typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
    } catch {
      return null;
    }
  });

  readonly headersArray = computed<{ key: string; value: string }[]>(() =>
    Object.entries(this.response()?.headers ?? {}).map(([key, value]) => ({ key, value })),
  );

  readonly headersCount = computed(() => this.headersArray().length);

  // ── Image ──────────────────────────────────────────────────────────────────

  readonly isImage = computed(() =>
    (this.response()?.contentType ?? '').toLowerCase().startsWith('image/'),
  );

  /**
   * The body as a base64 data URL for image responses.
   * The backend returns `data:<mime>;base64,<data>` for all image content types.
   */
  readonly imageSrc = computed<string | null>(() => {
    if (!this.isImage()) return null;
    const body = this.response()?.body;
    return typeof body === 'string' ? body : null;
  });

  /** File extension derived from the image content type. */
  readonly imageExtension = computed(() => {
    const ct = (this.response()?.contentType ?? '').toLowerCase();
    if (ct.includes('png'))                      return 'png';
    if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
    if (ct.includes('gif'))                      return 'gif';
    if (ct.includes('webp'))                     return 'webp';
    if (ct.includes('svg'))                      return 'svg';
    if (ct.includes('bmp'))                      return 'bmp';
    if (ct.includes('ico'))                      return 'ico';
    return 'img';
  });

  // ── Tree controls ─────────────────────────────────────────────────────────

  readonly bodySearch   = signal('');
  readonly expandAllGen = signal(0);
  readonly collapseAllGen = signal(0);

  expandAll(): void   { this.expandAllGen.update(n => n + 1); }
  collapseAll(): void { this.collapseAllGen.update(n => n + 1); }

  // ── Copy ─────────────────────────────────────────────────────────────────

  readonly copiedBody    = signal(false);
  readonly copiedHeaders = signal(false);
  readonly copiedRaw     = signal(false);

  copyBody(): void {
    this.writeClipboard(this.prettyBody(), this.copiedBody);
  }

  copyHeaders(): void {
    const text = this.headersArray()
      .map(h => `${h.key}: ${h.value}`)
      .join('\n');
    this.writeClipboard(text, this.copiedHeaders);
  }

  copyRaw(): void {
    this.writeClipboard(this.rawBody(), this.copiedRaw);
  }

  // ── Download ──────────────────────────────────────────────────────────────

  downloadResponse(): void {
    const r = this.response();
    if (!r) return;

    // Images: the body is already a data URL — use it directly as the href.
    if (this.isImage()) {
      const src = this.imageSrc();
      if (!src) return;
      this.triggerDownload(src, `response.${this.imageExtension()}`);
      return;
    }

    // Text / JSON: create a Blob from the pretty-printed body.
    const content  = this.prettyBody();
    const ext      = this.isJson() ? 'json' : 'txt';
    const mimeType = this.isJson() ? 'application/json' : 'text/plain';
    const blob     = new Blob([content], { type: mimeType });
    const url      = URL.createObjectURL(blob);
    this.triggerDownload(url, `response.${ext}`);
    URL.revokeObjectURL(url);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private writeClipboard(text: string, flag: ReturnType<typeof signal<boolean>>): void {
    navigator.clipboard.writeText(text).then(() => {
      flag.set(true);
      setTimeout(() => flag.set(false), 2000);
    });
  }

  private triggerDownload(href: string, filename: string): void {
    const a = document.createElement('a');
    a.href     = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
