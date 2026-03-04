import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiRequest } from '../../shared/models/api-request.model';
import { ApiResponse } from '../../shared/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class RunnerApiService {
    private http = inject(HttpClient);
    private baseUrl = 'http://localhost:3000/api';

    execute(request: ApiRequest): Observable<ApiResponse> {
        return this.http.post<ApiResponse>(`${this.baseUrl}/runner/execute`, {
            method: request.method,
            url: request.url,
            queryParams: request.queryParams,
            headers: request.headers,
            bodyType: request.bodyType,
            bodyRaw: request.bodyRaw,
            bodyFormFields: request.bodyFormFields,
        });
    }

    health(): Observable<{ ok: boolean }> {
        return this.http.get<{ ok: boolean }>(`${this.baseUrl}/health`);
    }
}