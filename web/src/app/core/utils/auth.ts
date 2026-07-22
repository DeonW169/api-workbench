import { ApiRequest } from '../../shared/models/api-request.model';

/**
 * Translates the request's auth config into concrete HTTP headers or query
 * params before the payload is sent to the backend runner.
 * The original request is never mutated.
 */
export function applyAuth(request: ApiRequest): ApiRequest {
  const { auth } = request;

  if (auth.type === 'bearer' && auth.bearerToken) {
    return {
      ...request,
      headers: [
        ...request.headers,
        { key: 'Authorization', value: `Bearer ${auth.bearerToken}`, enabled: true },
      ],
    };
  }

  if (auth.type === 'basic') {
    const encoded = base64Utf8(`${auth.username ?? ''}:${auth.password ?? ''}`);
    return {
      ...request,
      headers: [
        ...request.headers,
        { key: 'Authorization', value: `Basic ${encoded}`, enabled: true },
      ],
    };
  }

  if (auth.type === 'apiKey' && auth.apiKeyKey && auth.apiKeyValue) {
    if (auth.apiKeyLocation === 'header') {
      return {
        ...request,
        headers: [
          ...request.headers,
          { key: auth.apiKeyKey, value: auth.apiKeyValue, enabled: true },
        ],
      };
    }
    return {
      ...request,
      queryParams: [
        ...request.queryParams,
        { key: auth.apiKeyKey, value: auth.apiKeyValue, enabled: true },
      ],
    };
  }

  return request;
}

/**
 * Base64-encode a string that may contain non-latin1 characters.
 *
 * Bare `btoa` throws InvalidCharacterError on any code point above U+00FF, so
 * accented or non-Latin credentials would abort the request before it was sent.
 * Encoding to UTF-8 bytes first matches what servers expect (RFC 7617).
 */
function base64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
