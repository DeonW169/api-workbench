import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { KeyValueTable } from '../key-value-table/key-value-table';
import {
  ApiRequest,
  AuthConfig,
  AuthType,
  BodyType,
  HttpMethod,
  KeyValueItem,
} from '../../../shared/models/api-request.model';

interface BodyTypeOption {
  value: BodyType;
  label: string;
}

interface AuthTypeOption {
  value: AuthType;
  label: string;
}

@Component({
  selector: 'app-request-editor',
  imports: [
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    KeyValueTable,
  ],
  templateUrl: './request-editor.html',
  styleUrl: './request-editor.scss',
})
export class RequestEditor {
  // ── State ─────────────────────────────────────────────────────────────────

  readonly method = signal<HttpMethod>('GET');
  readonly url = signal('');
  readonly queryParams = signal<KeyValueItem[]>([]);
  readonly headers = signal<KeyValueItem[]>([]);
  readonly bodyType = signal<BodyType>('none');
  readonly bodyRaw = signal('');

  // Auth sub-state — kept flat for ergonomic binding
  readonly authType = signal<AuthType>('none');
  readonly bearerToken = signal('');
  readonly authUsername = signal('');
  readonly authPassword = signal('');
  readonly apiKeyName = signal('');
  readonly apiKeyValue = signal('');
  readonly apiKeyLocation = signal<'header' | 'query'>('header');

  // ── Constants ─────────────────────────────────────────────────────────────

  readonly methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  readonly bodyTypes: BodyTypeOption[] = [
    { value: 'none', label: 'None' },
    { value: 'json', label: 'JSON' },
    { value: 'text', label: 'Plain Text' },
  ];

  readonly authTypes: AuthTypeOption[] = [
    { value: 'none', label: 'No Auth' },
    { value: 'bearer', label: 'Bearer Token' },
    { value: 'basic', label: 'Basic Auth' },
    { value: 'apiKey', label: 'API Key' },
  ];

  // ── Computed tab labels ───────────────────────────────────────────────────

  readonly paramsLabel = computed(() => {
    const count = this.queryParams().filter(p => p.enabled && p.key).length;
    return count ? `Params (${count})` : 'Params';
  });

  readonly headersLabel = computed(() => {
    const count = this.headers().filter(h => h.enabled && h.key).length;
    return count ? `Headers (${count})` : 'Headers';
  });

  readonly bodyLabel = computed(() => {
    const type = this.bodyType();
    if (type === 'none') return 'Body';
    const label = this.bodyTypes.find(b => b.value === type)?.label ?? type;
    return `Body · ${label}`;
  });

  readonly authLabel = computed(() => {
    const type = this.authType();
    if (type === 'none') return 'Auth';
    const label = this.authTypes.find(a => a.value === type)?.label ?? type;
    return `Auth · ${label}`;
  });

  readonly bodyPlaceholder = computed(() => {
    switch (this.bodyType()) {
      case 'json': return '{\n  "key": "value"\n}';
      case 'text': return 'Enter plain text body…';
      default:     return '';
    }
  });

  // ── Computed request snapshot ─────────────────────────────────────────────

  private readonly authConfig = computed<AuthConfig>(() => {
    const type = this.authType();
    switch (type) {
      case 'bearer':
        return { type, bearerToken: this.bearerToken() };
      case 'basic':
        return { type, username: this.authUsername(), password: this.authPassword() };
      case 'apiKey':
        return {
          type,
          apiKeyKey: this.apiKeyName(),
          apiKeyValue: this.apiKeyValue(),
          apiKeyLocation: this.apiKeyLocation(),
        };
      default:
        return { type: 'none' };
    }
  });

  private readonly requestSnapshot = computed<ApiRequest>(() => ({
    id: this._id,
    name: this._name,
    method: this.method(),
    url: this.url(),
    queryParams: this.queryParams(),
    headers: this.headers(),
    bodyType: this.bodyType(),
    bodyRaw: this.bodyRaw(),
    auth: this.authConfig(),
    createdAt: this._createdAt,
    updatedAt: new Date().toISOString(),
  }));

  // ── Inputs / Outputs ──────────────────────────────────────────────────────

  /** When set, loads the provided request into all editor fields. */
  readonly requestToLoad = input<ApiRequest | null>(null);

  /** True while a request is in flight — disables the Send button. */
  readonly isLoading = input(false);

  /** Emits the complete ApiRequest on every state change. */
  readonly requestChange = output<ApiRequest>();

  /** Emits when the user clicks Send. */
  readonly sendClicked = output<void>();

  // ── Private ───────────────────────────────────────────────────────────────

  // Plain mutable fields — not signals, but picked up by requestSnapshot
  // whenever any signal dependency changes.
  private _id: string = crypto.randomUUID();
  private _name = 'New Request';
  private _createdAt = new Date().toISOString();

  constructor() {
    // When a saved request is loaded, populate all editor signals from it.
    effect(() => {
      const req = this.requestToLoad();
      if (!req) return;
      untracked(() => {
        this._id = req.id;
        this._name = req.name;
        this._createdAt = req.createdAt;
        this.method.set(req.method);
        this.url.set(req.url);
        this.queryParams.set([...req.queryParams]);
        this.headers.set([...req.headers]);
        this.bodyType.set(req.bodyType);
        this.bodyRaw.set(req.bodyRaw);
        this.authType.set(req.auth.type);
        this.bearerToken.set(req.auth.bearerToken ?? '');
        this.authUsername.set(req.auth.username ?? '');
        this.authPassword.set(req.auth.password ?? '');
        this.apiKeyName.set(req.auth.apiKeyKey ?? '');
        this.apiKeyValue.set(req.auth.apiKeyValue ?? '');
        this.apiKeyLocation.set(req.auth.apiKeyLocation ?? 'header');
      });
    });

    // Emit to parent whenever any part of the request changes.
    effect(() => {
      this.requestChange.emit(this.requestSnapshot());
    });
  }
}
