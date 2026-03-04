export interface GlobalVariable {
  key: string;
  value: string;
  enabled: boolean;
  secret?: boolean;
}

/** Singleton record stored in the `globals` Dexie table under the fixed id `'global'`. */
export interface GlobalsRecord {
  id: 'global';
  variables: GlobalVariable[];
  updatedAt: string;
}
