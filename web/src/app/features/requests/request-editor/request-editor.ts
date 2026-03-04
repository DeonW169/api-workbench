import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { KeyValueTable } from '../key-value-table/key-value-table';
import {
  ApiRequest,
  AuthConfig,
  AuthType,
  BodyType,
  FormField,
  FormFieldType,
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
    MatCheckboxModule,
    MatTooltipModule,
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
  /** Rows for form-data and x-www-form-urlencoded body types. Shared between both. */
  readonly bodyFormFields = signal<FormField[]>([]);

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
    { value: 'none',                  label: 'None' },
    { value: 'json',                  label: 'JSON' },
    { value: 'text',                  label: 'Plain Text' },
    { value: 'form-data',             label: 'Form Data' },
    { value: 'x-www-form-urlencoded', label: 'URL-Encoded' },
  ];

  readonly authTypes: AuthTypeOption[] = [
    { value: 'none',    label: 'No Auth' },
    { value: 'bearer',  label: 'Bearer Token' },
    { value: 'basic',   label: 'Basic Auth' },
    { value: 'apiKey',  label: 'API Key' },
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
    bodyFormFields: this.bodyFormFields(),
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
        // ?? [] guards against existing saved requests that predate this field
        this.bodyFormFields.set([...(req.bodyFormFields ?? [])]);
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

  // ── Form-field mutations ──────────────────────────────────────────────────

  addFormField(): void {
    this.bodyFormFields.update(fields => [
      ...fields,
      { key: '', value: '', enabled: true, type: 'text' },
    ]);
  }

  removeFormField(index: number): void {
    this.bodyFormFields.update(fields => fields.filter((_, i) => i !== index));
  }

  setFormFieldEnabled(index: number, enabled: boolean): void {
    this.bodyFormFields.update(fields =>
      fields.map((f, i) => (i === index ? { ...f, enabled } : f)),
    );
  }

  setFormFieldKey(index: number, event: Event): void {
    const key = (event.target as HTMLInputElement).value;
    this.bodyFormFields.update(fields =>
      fields.map((f, i) => (i === index ? { ...f, key } : f)),
    );
  }

  setFormFieldValue(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.bodyFormFields.update(fields =>
      fields.map((f, i) => (i === index ? { ...f, value } : f)),
    );
  }

  /**
   * Toggle a row's type between 'text' and 'file' (form-data only).
   * Clears value and fileContent on type change since the data format differs.
   */
  toggleFormFieldType(index: number): void {
    this.bodyFormFields.update(fields =>
      fields.map((f, i) => {
        if (i !== index) return f;
        const type: FormFieldType = f.type === 'text' ? 'file' : 'text';
        return { ...f, type, value: '', fileContent: undefined };
      }),
    );
  }

  /**
   * Read the selected file as base64 and store both the filename (value)
   * and the encoded content (fileContent) so the backend proxy can reconstruct
   * the Blob for multipart upload.
   */
  onFileSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // Reset input immediately so the same file can be re-selected after clearing
    input.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      // result is a data URL: "data:<mime>;base64,<content>"
      const dataUrl = reader.result as string;
      const fileContent = dataUrl.split(',')[1] ?? '';
      this.bodyFormFields.update(fields =>
        fields.map((f, i) =>
          i === index ? { ...f, value: file.name, fileContent } : f,
        ),
      );
    };
    reader.readAsDataURL(file);
  }
}
