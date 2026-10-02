import { PrismaClient, DocumentPage, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class DocumentPageRepository {
  async create(data: Prisma.DocumentPageCreateInput): Promise<DocumentPage> {
    return prisma.documentPage.create({
      data,
    });
  }

  async createMany(data: Prisma.DocumentPageCreateManyInput[]): Promise<Prisma.BatchPayload> {
    return prisma.documentPage.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async findByAnswerSheetId(answerSheetId: string): Promise<DocumentPage[]> {
    return prisma.documentPage.findMany({
      where: { answerSheetId },
      orderBy: { pageNumber: 'asc' },
    });
  }
}

export const documentPageRepository = new DocumentPageRepository();
