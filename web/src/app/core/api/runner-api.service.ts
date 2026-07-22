import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiRequest } from '../../shared/models/api-request.model';
import { ApiResponse } from '../../shared/models/api-response.model';

/** Error envelope returned by the runner backend for 4xx / 5xx failures. */
interface RunnerErrorBody {
    error?: string;
    message?: string;
}

@Injectable({ providedIn: 'root' })
export class RunnerApiService {
    private http = inject(HttpClient);
    private baseUrl = environment.runnerBaseUrl;

    execute(request: ApiRequest): Observable<ApiResponse> {
        return this.http
            .post<ApiResponse>(`${this.baseUrl}/runner/execute`, {
                method: request.method,
                url: request.url,
                queryParams: request.queryParams,
                headers: request.headers,
                bodyType: request.bodyType,
                bodyRaw: request.bodyRaw,
                bodyFormFields: request.bodyFormFields,
            })
            .pipe(catchError(err => throwError(() => new Error(describeError(err, this.baseUrl)))));
    }

    health(): Observable<{ ok: boolean }> {
        return this.http.get<{ ok: boolean }>(`${this.baseUrl}/health`);
    }
}

/**
 * Turn an HttpErrorResponse into something worth showing a user.
 *
 * The backend sends `{ error, message }` for URL and network failures; prefer
 * that. Status 0 means the browser never reached the runner at all, which is
 * almost always "the backend isn't running" and deserves saying so plainly.
 */
export function describeError(err: unknown, baseUrl: string): string {
    if (!(err instanceof HttpErrorResponse)) {
        return err instanceof Error ? err.message : 'An unexpected error occurred.';
    }

    if (err.status === 0) {
        return `Cannot reach the request runner at ${baseUrl}. Is the backend running?`;
    }

    const body = err.error as RunnerErrorBody | string | null;
    if (body && typeof body === 'object' && typeof body.message === 'string') {
        return body.message;
    }

    if (err.status === 413) {
        return 'Request too large for the runner. Try a smaller file attachment.';
    }

    return `Request runner returned ${err.status} ${err.statusText}.`;
}
