import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ragService } from '../services/rag/ragService.js';
import { logger } from '../utils/logger.js';

// ─── Request Schemas ───

export const ragSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query max length is 1000 characters'),
  language: z.string().optional().default('en'),
  topK: z.number().int().min(1).max(10).optional().default(3)
});

export const ragAskSchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query max length is 1000 characters'),
  language: z.string().optional().default('en')
});

// ─── Controller ───

class RAGController {

  /**
   * POST /api/rag/search
   * Search the knowledge base for relevant documents.
   */
  async handleSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, language, topK } = ragSearchSchema.parse(req.body);

      const results = ragService.search(query, language, undefined, topK);

      res.json({
        success: true,
        query,
        language,
        results: results.map(r => ({
          id: r.chunk.id,
          domain: r.chunk.domain,
          title: r.chunk.title,
          content: r.chunk.content,
          relevanceScore: r.score,
          matchedKeywords: r.matchedKeywords,
          weatherBoost: r.weatherBoost,
          source: r.chunk.source
        })),
        totalResults: results.length,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
        });
        return;
      }
      logger.error('RAG search error:', error);
      next(error);
    }
  }

  /**
   * POST /api/rag/ask
   * Get a knowledge-augmented answer for a question.
   */
  async handleAsk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, language } = ragAskSchema.parse(req.body);

      const ragContext = ragService.buildContext(query, language);

      let answer: string;
      if (ragContext.hasKnowledge) {
        const topDoc = ragContext.documents[0];
        switch (language) {
          case 'hi':
            answer = `📚 **${topDoc.title}**\n\n${topDoc.content}\n\n_स्रोत: ${topDoc.source}_`;
            break;
          case 'gu':
            answer = `📚 **${topDoc.title}**\n\n${topDoc.content}\n\n_સ્ત્રોત: ${topDoc.source}_`;
            break;
          default:
            answer = `📚 **${topDoc.title}**\n\n${topDoc.content}\n\n_Source: ${topDoc.source}_`;
            break;
        }
      } else {
        switch (language) {
          case 'hi':
            answer = 'इस प्रश्न के लिए ज्ञान आधार में कोई प्रासंगिक जानकारी नहीं मिली।';
            break;
          case 'gu':
            answer = 'આ પ્રશ્ન માટે જ્ઞાન આધારમાં કોઈ સંબંધિત માહિતી મળી નથી.';
            break;
          default:
            answer = 'No relevant knowledge found in the knowledge base for this query.';
            break;
        }
      }

      res.json({
        success: true,
        answer,
        rag: ragContext,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
        });
        return;
      }
      logger.error('RAG ask error:', error);
      next(error);
    }
  }
}

export const ragController = new RAGController();
