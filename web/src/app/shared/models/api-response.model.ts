export interface ApiResponse {
    ok: boolean;
    status: number;
    statusText: string;
    durationMs: number;
    headers: Record<string, string>;
    body: unknown;
    contentType: string;
    size: number;
}