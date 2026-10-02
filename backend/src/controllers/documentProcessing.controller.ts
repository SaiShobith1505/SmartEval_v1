import { Request, Response } from 'express';
import { DocumentProcessingService } from '../services/documentProcessing.service';

export class DocumentProcessingController {
  constructor(private documentProcessingService: DocumentProcessingService) {}

  /**
   * POST /api/v1/answer-sheets/:id/process
   * Triggers document processing (PDF rendering).
   */
  processAnswerSheet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'PDF file is required.',
          }
        });
        return;
      }

      if (file.mimetype !== 'application/pdf') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'File must be a PDF.',
          }
        });
        return;
      }

      // Asynchronous processing (No BullMQ in Phase 5)
      // Fire and forget for now to respect HTTP 202 semantics
      this.documentProcessingService.processAnswerSheetPdf(id, file.buffer)
        .then(() => {
          console.log(`[DocumentProcessingController] Successfully processed answer sheet ${id}`);
        })
        .catch(err => {
          console.error(`[DocumentProcessingController] Failed to process answer sheet ${id}`, err);
          // In a real system, we would update the AnswerSheet status to FAILED here
        });

      res.status(202).json({
        data: {
          message: 'Document processing started.',
          answerSheetId: id
        }
      });
    } catch (error: any) {
      console.error('[DocumentProcessingController] Error in processAnswerSheet:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'An unexpected error occurred.',
        }
      });
    }
  };
}
