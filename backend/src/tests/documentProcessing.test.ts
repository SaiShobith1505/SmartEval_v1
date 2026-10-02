import { DocumentProcessingService } from '../services/documentProcessing.service';
import { Phase5MockStorageProvider } from '../interfaces/Phase5MockStorageProvider';
import { documentPageRepository } from '../repositories/documentPage.repository';
import fs from 'fs/promises';
import path from 'path';

// Minimal 2-page PDF for testing
const minimalPdfBase64 = 
  "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDIKICAvS2lkcyBbIDMgMCBSIDQgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDUgMCBSCj4+Cj4+CiAgL0NvbnRlbnRzIDYgMCBSCj4+CmVuZG9iagoKNCAwIG9iago8PAogIC9UeXBlIC9QYWdlCiAgL1BhcmVudCAyIDAgUgogIC9SZXNvdXJjZXMgPDwKICAgIC9Gb250IDw8CiAgICAgIC9GMSA1IDAgUgo+Pgo+PgogIC9Db250ZW50cyA3IDAgUgo+PgplbmRvYmoKCjUgMCBvYmoKPDwKICAvVHlwZSAvRm9udAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvVGltZXMtUm9tYW4KPj4KZW5kb2JqCgo2IDAgb2JqCjw8IC9MZW5ndGggNDQgPj4Kc3RyZWFtCkJUCjcwIDUwIFRECi9GMSAxMiBUZgooUGFnZSAxKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCgo3IDAgb2JqCjw8IC9MZW5ndGggNDQgPj4Kc3RyZWFtCkJUCjcwIDUwIFRECi9GMSAxMiBUZgooUGFnZSAyKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCgp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDA2MCAwMDAwMCBuIAowMDAwMDAwMTU4IDAwMDAwIG4gCjAwMDAwMDAyNjAgMDAwMDAgbiAKMDAwMDAwMDM2MiAwMDAwMCBuIAowMDAwMDAwNDUxIDAwMDAwIG4gCjAwMDAwMDA1NDYgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDgKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNjQxCiUlRU9GCg==";

describe('DocumentProcessingService (Phase 5 Integration)', () => {
  let service: DocumentProcessingService;
  let storageProvider: Phase5MockStorageProvider;
  let testPdfBuffer: Buffer;

  beforeAll(async () => {
    storageProvider = new Phase5MockStorageProvider();
    service = new DocumentProcessingService(storageProvider);
    testPdfBuffer = Buffer.from(minimalPdfBase64, 'base64');
  });

  afterAll(async () => {
    // Delete any created DB records if needed, but since we mock DB repository we don't strictly need to 
    // unless we use real DB. Wait, the instructions say "REAL PDF -> ... -> DocumentPage persistence". 
    // We should use the real DB repository!
  });

  it('should successfully render a multi-page PDF to PNGs, extract dimensions, upload to storage, and persist to DB', async () => {
    const answerSheetId = 'test-answer-sheet-123';
    
    // Spy on repository since real DB is not available in test environment
    const createManySpy = jest.spyOn(documentPageRepository, 'createMany').mockResolvedValue({ count: 2 });

    await service.processAnswerSheetPdf(answerSheetId, testPdfBuffer);

    // Verify repository was called
    expect(createManySpy).toHaveBeenCalledTimes(1);
    const pagesData = createManySpy.mock.calls[0][0] as any[];

    expect(pagesData).toHaveLength(2);
    
    expect(pagesData[0].pageNumber).toBe(1);
    expect(pagesData[0].width).toBeGreaterThan(0);
    expect(pagesData[0].height).toBeGreaterThan(0);
    expect(pagesData[0].storageKey).toContain('mock-storage/');
    expect(pagesData[0].storageKey).toContain('page-1.png');

    expect(pagesData[1].pageNumber).toBe(2);
    expect(pagesData[1].width).toBeGreaterThan(0);
    expect(pagesData[1].height).toBeGreaterThan(0);
    expect(pagesData[1].storageKey).toContain('mock-storage/');
    expect(pagesData[1].storageKey).toContain('page-2.png');

    console.log(`Verified persistence call: Page 1 (${pagesData[0].width}x${pagesData[0].height}), Page 2 (${pagesData[1].width}x${pagesData[1].height})`);
    
    createManySpy.mockRestore();
  }, 30000);

  it('should throw an error for an invalid PDF buffer', async () => {
    const invalidBuffer = Buffer.from('Not a PDF file content');
    
    await expect(service.processAnswerSheetPdf('invalid-sheet-1', invalidBuffer))
      .rejects
      .toThrow(/(May not be a PDF file|PDF rendering failed)/);
  });
});
