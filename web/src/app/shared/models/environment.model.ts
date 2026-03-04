export interface EnvironmentVariable {
    key: string;
    value: string;
    enabled: boolean;
    secret?: boolean;
}

export interface EnvironmentModel {
    id: string;
    name: string;
    variables: EnvironmentVariable[];
    createdAt: string;
    updatedAt: string;
}