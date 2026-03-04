import { ApiRequest } from './api-request.model';
import { ApiResponse } from './api-response.model';

export interface HistoryItem {
    id: string;
    executedAt: string;
    request: ApiRequest;
    response: ApiResponse;
}