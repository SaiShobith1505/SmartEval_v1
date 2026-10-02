export interface IStorageProvider {
  /**
   * Uploads a file buffer to the storage provider.
   * @param buffer The file buffer.
   * @param fileName The intended file name/path in storage.
   * @param mimeType The mime type of the file (e.g., 'image/png').
   * @returns The storage key or URI.
   */
  uploadBuffer(buffer: Buffer, fileName: string, mimeType: string): Promise<string>;

  /**
   * Uploads a file from a local path to the storage provider.
   * @param localPath The path to the local file.
   * @param fileName The intended file name/path in storage.
   * @param mimeType The mime type of the file.
   * @returns The storage key or URI.
   */
  uploadFile(localPath: string, fileName: string, mimeType: string): Promise<string>;

  /**
   * Generates a signed URL for reading a file.
   * @param storageKey The storage key.
   */
  getSignedUrl(storageKey: string): Promise<string>;
}
