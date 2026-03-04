export interface Folder {
  id: string;
  collectionId: string;
  /** Null means top-level within the collection. */
  parentFolderId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}
