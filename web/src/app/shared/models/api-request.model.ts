import { Assertion } from './assertion.model';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type BodyType = 'none' | 'json' | 'text' | 'form-data' | 'x-www-form-urlencoded';

/** Field type for multipart form-data rows. */
export type FormFieldType = 'text' | 'file';

/**
 * A single row in a form-data or x-www-form-urlencoded body.
 * For urlencoded, `type` is always 'text'.
 * For form-data, `value` holds the text content or filename for display;
 * the actual File object is managed transiently in the editor component.
 */
export interface FormField {
  key: string;
  /** Text content for 'text' type; selected filename for display with 'file' type. */
  value: string;
  enabled: boolean;
  type: FormFieldType;
  /**
   * Base64-encoded file content for 'file' type fields.
   * Populated when the user selects a file; passed through the JSON proxy so
   * the backend can reconstruct a Blob for multipart upload.
   */
  fileContent?: string;
}

export interface KeyValueItem {
  key: string;
  value: string;
  enabled: boolean;
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey';

export interface AuthConfig {
  type: AuthType;
  bearerToken?: string;
  username?: string;
  password?: string;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyLocation?: 'header' | 'query';
}

/** Per-request variable override — highest precedence during resolution. */
export interface RequestVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  queryParams: KeyValueItem[];
  headers: KeyValueItem[];
  bodyType: BodyType;
  bodyRaw: string;
  /** Rows for form-data and x-www-form-urlencoded body types. */
  bodyFormFields: FormField[];
  auth: AuthConfig;
  /** Per-request variable overrides (highest precedence). UI not yet implemented. */
  variables: RequestVariable[];
  /** Assertions evaluated after each execution. UI not yet implemented. */
  assertions: Assertion[];
  collectionId?: string | null;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
}
