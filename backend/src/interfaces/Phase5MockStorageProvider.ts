import { IStorageProvider } from './IStorageProvider';
import * as crypto from 'crypto';

export class Phase5MockStorageProvider implements IStorageProvider {
  async uploadBuffer(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const key = `mock-storage/${crypto.randomUUID()}-${fileName}`;
    console.log(`[Phase5MockStorageProvider] Uploaded buffer of size ${buffer.length} to ${key} (${mimeType})`);
    return key;
  }

  async uploadFile(localPath: string, fileName: string, mimeType: string): Promise<string> {
    const key = `mock-storage/${crypto.randomUUID()}-${fileName}`;
    console.log(`[Phase5MockStorageProvider] Uploaded file from ${localPath} to ${key} (${mimeType})`);
    return key;
  }

  async getSignedUrl(storageKey: string): Promise<string> {
    return `http://mock-storage.local/${storageKey}`;
  }
}
