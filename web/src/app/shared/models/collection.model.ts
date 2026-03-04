export interface CollectionVariable {
  key: string;
  value: string;
  enabled: boolean;
  secret?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  variables: CollectionVariable[];
  createdAt: string;
  updatedAt: string;
}
