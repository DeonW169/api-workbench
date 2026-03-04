import { Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiResponse } from '../../../shared/models/api-response.model';

/** Status range for color-coding. */
type StatusRange = '1xx' | '2xx' | '3xx' | '4xx' | '5xx' | 'unknown';

@Component({
  selector: 'app-response-viewer',
  imports: [MatTabsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  templateUrl: './response-viewer.html',
  styleUrl: './response-viewer.scss',
})
export class ResponseViewer {
  private readonly sanitizer = inject(DomSanitizer);

  // ── Input ─────────────────────────────────────────────────────────────────

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
    if (bytes < 1024)            return `${bytes} B`;
    if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  });

  readonly isJson = computed(() =>
    (this.response()?.contentType ?? '').toLowerCase().includes('application/json'),
  );

  /** Pretty-printed body string. Returns empty string when no response. */
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

  /**
   * Syntax-highlighted JSON as SafeHtml.
   * Undefined when the response is not JSON.
   */
  readonly highlightedBody = computed<SafeHtml | null>(() => {
    if (!this.isJson() || !this.hasBody()) return null;
    const html = this.buildHighlightedHtml(this.prettyBody());
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  readonly headersArray = computed<{ key: string; value: string }[]>(() =>
    Object.entries(this.response()?.headers ?? {}).map(([key, value]) => ({ key, value })),
  );

  readonly headersCount = computed(() => this.headersArray().length);

  // ── Copy ─────────────────────────────────────────────────────────────────

  readonly copiedBody = signal(false);
  readonly copiedHeaders = signal(false);
  readonly copiedRaw = signal(false);

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

  // ── Private ───────────────────────────────────────────────────────────────

  private writeClipboard(text: string, flag: ReturnType<typeof signal<boolean>>): void {
    navigator.clipboard.writeText(text).then(() => {
      flag.set(true);
      setTimeout(() => flag.set(false), 2000);
    });
  }

  /**
   * Produces a syntax-highlighted HTML string from a pretty-printed JSON string.
   *
   * Safety strategy:
   *  1. HTML-escape the entire JSON string first (&, <, > only).
   *  2. Apply regex spans over the escaped string — the span class names are
   *     hard-coded, so there is no injection surface.
   *  3. Caller wraps the result in bypassSecurityTrustHtml.
   */
  private buildHighlightedHtml(json: string): string {
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Regex captures four mutually-exclusive alternatives:
    //   [1] JSON string  [2] trailing colon (marks a key)
    //   [3] keyword      [4] number
    return escaped.replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (_match, str, colon, keyword, num) => {
        if (str !== undefined) {
          if (colon) return `<span class="jk">${str}</span>${colon}`;
          return `<span class="js">${str}</span>`;
        }
        if (keyword !== undefined) {
          return `<span class="${keyword === 'null' ? 'jn' : 'jb'}">${keyword}</span>`;
        }
        if (num !== undefined) {
          return `<span class="jnum">${num}</span>`;
        }
        return _match;
      },
    );
  }
}
