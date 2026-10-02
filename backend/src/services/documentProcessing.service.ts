import { Poppler } from 'node-poppler';
import sizeOf from 'image-size';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { IStorageProvider } from '../interfaces/IStorageProvider';
import { documentPageRepository } from '../repositories/documentPage.repository';
import * as crypto from 'crypto';

export class DocumentProcessingService {
  constructor(private storageProvider: IStorageProvider) {}

  /**
   * Processes a PDF answer sheet, rendering it to PNGs and saving DocumentPage records.
   */
  async processAnswerSheetPdf(answerSheetId: string, pdfBuffer: Buffer): Promise<void> {
    const tempDir = path.join(os.tmpdir(), `smarteval-${crypto.randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    const pdfPath = path.join(tempDir, 'source.pdf');
    await fs.writeFile(pdfPath, pdfBuffer);

    try {
      const poppler = new Poppler();
      
      const outputPrefix = path.join(tempDir, 'page');
      
      const options = {
        pngFile: true,
        resolutionXYAxis: 300 // Configurable resolution suitable for handwritten answer sheets
      };

      await poppler.pdfToPpm(pdfPath, outputPrefix, options);

      const files = await fs.readdir(tempDir);
      const pngFiles = files.filter(f => f.endsWith('.png')).sort((a, b) => {
        // Sort properly by page number (page-1.png, page-2.png, ..., page-10.png)
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });

      if (pngFiles.length === 0) {
        throw new Error('PDF rendering failed: No PNG files produced or invalid PDF.');
      }

      const pagesData = [];

      for (let i = 0; i < pngFiles.length; i++) {
        const pngFile = pngFiles[i];
        const pngPath = path.join(tempDir, pngFile);
        
        const pngBuffer = await fs.readFile(pngPath);
        const dimensions = sizeOf(pngBuffer);
        if (!dimensions.width || !dimensions.height) {
            throw new Error(`Failed to read dimensions for ${pngFile}`);
        }
        
        const fileName = `answer-sheets/${answerSheetId}/page-${i + 1}.png`;
        
        // Upload via storage abstraction
        const storageKey = await this.storageProvider.uploadBuffer(pngBuffer, fileName, 'image/png');

        pagesData.push({
          answerSheetId,
          pageNumber: i + 1,
          storageKey,
          width: dimensions.width,
          height: dimensions.height
        });
      }

      // Persist DocumentPage records
      await documentPageRepository.createMany(pagesData);
      
    } catch (error) {
      console.error(`[DocumentProcessingService] Error processing answer sheet ${answerSheetId}:`, error);
      throw error;
    } finally {
      // Clean up temporary resources
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
