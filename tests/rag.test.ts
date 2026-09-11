import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('RAG Knowledge Engine', () => {

  // ─── POST /api/rag/search ───

  describe('POST /api/rag/search', () => {
    it('should return relevant knowledge chunks for a flood query', async () => {
      const res = await request(app)
        .post('/api/rag/search')
        .send({ query: 'What to do during floods?' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(res.body.results[0].domain).toBe('ndma');
      expect(res.body.results[0].title).toContain('Flood');
      expect(res.body.results[0].relevanceScore).toBeGreaterThan(0);
      expect(res.body.results[0].source).toBeDefined();
    });

    it('should return agriculture advisories for farming queries', async () => {
      const res = await request(app)
        .post('/api/rag/search')
        .send({ query: 'kharif season crop sowing advice' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
      const domains = res.body.results.map((r: any) => r.domain);
      expect(domains).toContain('icar');
    });

    it('should return IMD warning info for weather warning queries', async () => {
      const res = await request(app)
        .post('/api/rag/search')
        .send({ query: 'IMD colour code warning meaning red orange yellow' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
      const domains = res.body.results.map((r: any) => r.domain);
      expect(domains).toContain('imd');
    });

    it('should return crop insurance info for PMFBY queries', async () => {
      const res = await request(app)
        .post('/api/rag/search')
        .send({ query: 'crop insurance claim process PMFBY premium' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
      const domains = res.body.results.map((r: any) => r.domain);
      expect(domains).toContain('pmfby');
    });

    it('should return empty results for irrelevant queries', async () => {
      const res = await request(app)
        .post('/api/rag/search')
        .send({ query: 'how to play guitar' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.length).toBe(0);
    });

    it('should support Hindi keyword search', async () => {
      const res = await request(app)
        .post('/api/rag/search')
        .send({ query: 'बाढ़ में क्या करें?', language: 'hi' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
    });

    it('should support Gujarati keyword search', async () => {
      const res = await request(app)
        .post('/api/rag/search')
        .send({ query: 'પૂર સુરક્ષા માહિતી', language: 'gu' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
    });

    it('should respect topK parameter', async () => {
      const res = await request(app)
        .post('/api/rag/search')
        .send({ query: 'weather safety disaster flood rain', topK: 1 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.results.length).toBeLessThanOrEqual(1);
    });

    it('should reject empty query', async () => {
      const res = await request(app)
        .post('/api/rag/search')
        .send({ query: '' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── POST /api/rag/ask ───

  describe('POST /api/rag/ask', () => {
    it('should return a knowledge-augmented answer for heatwave query', async () => {
      const res = await request(app)
        .post('/api/rag/ask')
        .send({ query: 'What is a heatwave and how to stay safe?' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.answer).toBeDefined();
      expect(res.body.answer.length).toBeGreaterThan(50);
      expect(res.body.rag).toBeDefined();
      expect(res.body.rag.hasKnowledge).toBe(true);
      expect(res.body.rag.sources.length).toBeGreaterThan(0);
      expect(res.body.rag.documents.length).toBeGreaterThan(0);
    });

    it('should return a no-knowledge answer for unrelated queries', async () => {
      const res = await request(app)
        .post('/api/rag/ask')
        .send({ query: 'tell me about quantum physics' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.rag.hasKnowledge).toBe(false);
      expect(res.body.rag.documents.length).toBe(0);
    });

    it('should return Hindi answer when language is hi', async () => {
      const res = await request(app)
        .post('/api/rag/ask')
        .send({ query: 'चक्रवात में क्या करें?', language: 'hi' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.answer).toContain('स्रोत');
    });

    it('should reject empty query', async () => {
      const res = await request(app)
        .post('/api/rag/ask')
        .send({ query: '' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── RAG integration in /api/ask ───

  describe('RAG integration in /api/ask', () => {
    it('should include rag field in /api/ask response for weather+disaster queries', async () => {
      const res = await request(app)
        .post('/api/ask')
        .send({ question: 'Is there a flood risk in Mumbai due to heavy rain?' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.rag).toBeDefined();
      expect(res.body.rag.totalChunksSearched).toBeGreaterThan(0);
    });

    it('should include rag field even for regular weather queries', async () => {
      const res = await request(app)
        .post('/api/ask')
        .send({ question: 'What is the weather in Delhi?' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.rag).toBeDefined();
      // May or may not have hasKnowledge depending on query content
      expect(typeof res.body.rag.hasKnowledge).toBe('boolean');
    });
  });
});
