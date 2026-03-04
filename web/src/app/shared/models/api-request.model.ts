export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type BodyType = 'none' | 'json' | 'text';

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

export interface ApiRequest {
    id: string;
    name: string;
    method: HttpMethod;
    url: string;
    queryParams: KeyValueItem[];
    headers: KeyValueItem[];
    bodyType: BodyType;
    bodyRaw: string;
    auth: AuthConfig;
    collectionId?: string | null;
    folderId?: string | null;
    createdAt: string;
    updatedAt: string;
}