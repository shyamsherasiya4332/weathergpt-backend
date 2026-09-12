import { knowledgeBase, KnowledgeChunk, KnowledgeDomain } from '../../knowledge/knowledgeBase.js';
import { WeatherData } from '../../types/weather.js';
import { logger } from '../../utils/logger.js';

// ─── RAG Types ───

export interface RAGSearchResult {
  chunk: KnowledgeChunk;
  score: number;
  matchedKeywords: string[];
  weatherBoost: boolean;
}

export interface RAGContext {
  hasKnowledge: boolean;
  sources: string[];
  documents: Array<{
    id: string;
    domain: KnowledgeDomain;
    title: string;
    content: string;
    relevanceScore: number;
    source: string;
  }>;
  query: string;
  totalChunksSearched: number;
}

// ─── Tokenization & Scoring Utilities ───

const STOP_WORDS = new Set([
  // English
  'how', 'to', 'play', 'what', 'is', 'are', 'the', 'a', 'an', 'in', 'on', 'at', 'for', 'of',
  'and', 'or', 'do', 'does', 'did', 'can', 'could', 'tell', 'me', 'about', 'there', 'here',
  'with', 'from', 'by', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'please',
  'give', 'some', 'any', 'all', 'be', 'been', 'being', 'have', 'has', 'had',
  // Hindi
  'क्या', 'करें', 'करे', 'करना', 'में', 'से', 'को', 'का', 'की', 'के', 'है', 'हैं', 'था', 'थी', 'थे',
  'और', 'या', 'पर', 'लिए', 'बताओ', 'बताइए', 'मुझे', 'इस', 'उस', 'तो', 'भी', 'होता', 'होती',
  // Gujarati
  'શું', 'કરો', 'કરવું', 'માં', 'થી', 'ને', 'નો', 'ની', 'નું', 'ના', 'છે', 'હતો', 'હતી', 'અને',
  'કે', 'પર', 'માટે', 'કહો', 'જણાવો', 'મને', 'આ', 'તે',
  // Generic weather terms (prevent standard weather queries from triggering agricultural/disaster chunks)
  'weather', 'weathr', 'forecast', 'climate', 'temperature', 'temp', 'city', 'location', 'live', 'report',
  'today', 'tomorrow', 'yesterday', 'day', 'night', 'morning', 'evening', 'now', 'right', 'current',
  'hawaaman', 'mausam', 'tapman', 'kevi', 'hase', 'kaisa', 'hoga', 'hai', 'batao',
  'હવામાન', 'તાપમાન', 'સ્થળ', 'આજે', 'કાલે', 'શહેર', 'ગામ', 'અહેવાલ', 'કેવું', 'હશે',
  'मौसम', 'तापमान', 'आज', 'कल', 'शहर', 'गाँव', 'स्थान', 'हाल', 'कैसा', 'रहेगा'
]);

/** Normalize and tokenize text into words, preserving Indic vowel marks (\p{M}) */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

/** Check if query term matches document term (avoids substring false positives in English) */
function termsMatch(t1: string, t2: string): boolean {
  if (t1 === t2) return true;
  // ASCII / English words
  const isAscii = /^[\x00-\x7F]+$/.test(t1) && /^[\x00-\x7F]+$/.test(t2);
  if (isAscii) {
    if (t1.length >= 4 && t2.length >= 4) {
      return t1.startsWith(t2) || t2.startsWith(t1);
    }
    return false;
  }
  // Indic scripts (Devanagari, Gujarati)
  if (t1.length >= 2 && t2.length >= 2) {
    return t1.includes(t2) || t2.includes(t1);
  }
  return t1 === t2;
}

/** BM25 parameters */
const BM25_K1 = 1.5;
const BM25_B = 0.75;

/**
 * Compute BM25 score for a query against a document's keyword list.
 */
function bm25Score(queryTokens: string[], docKeywords: string[], avgDocLength: number): number {
  const docLen = docKeywords.length;
  let score = 0;

  // Build term frequency map for docKeywords
  const tf = new Map<string, number>();
  for (const kw of docKeywords) {
    tf.set(kw, (tf.get(kw) || 0) + 1);
  }

  const totalDocs = knowledgeBase.size;

  for (const qt of queryTokens) {
    let termFreq = 0;
    for (const [kw, freq] of tf) {
      if (termsMatch(qt, kw)) {
        termFreq += freq;
      }
    }

    if (termFreq === 0) continue;

    let docFreq = 0;
    for (const chunk of knowledgeBase.getAllChunks()) {
      const allKw = getAllKeywords(chunk);
      if (allKw.some(kw => termsMatch(qt, kw))) {
        docFreq++;
      }
    }

    const idf = Math.log((totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);
    const tfNorm = (termFreq * (BM25_K1 + 1)) / (termFreq + BM25_K1 * (1 - BM25_B + BM25_B * docLen / avgDocLength));
    score += idf * tfNorm;
  }

  return score;
}

/** Get all keywords (en + hi + gu) for a chunk */
function getAllKeywords(chunk: KnowledgeChunk): string[] {
  return [
    ...chunk.keywords,
    ...(chunk.keywordsHi || []),
    ...(chunk.keywordsGu || [])
  ].map(k => k.toLowerCase());
}

/** Content-based TF-IDF style keyword matching against chunk content */
function contentMatchScore(queryTokens: string[], chunk: KnowledgeChunk): number {
  const contentTokens = tokenize(chunk.content + ' ' + chunk.title);
  let matches = 0;
  for (const qt of queryTokens) {
    if (contentTokens.some(ct => termsMatch(qt, ct))) {
      matches++;
    }
  }
  return queryTokens.length > 0 ? matches / queryTokens.length : 0;
}

/** Weather-contextual boost: check if current weather matches chunk triggers */
function weatherContextBoost(chunk: KnowledgeChunk, weatherData?: WeatherData): number {
  if (!weatherData || !chunk.weatherTriggers) return 0;

  const triggers = chunk.weatherTriggers;
  let boost = 0;
  const current = weatherData.current;

  // Rain probability trigger
  if (triggers.minRainProbability !== undefined) {
    const rainProb = current.rainProbability || 0;
    if (rainProb >= triggers.minRainProbability) {
      boost += 0.3;
    }
  }

  // Temperature triggers
  if (triggers.minTemperature !== undefined && current.temperature >= triggers.minTemperature) {
    boost += 0.3;
  }
  if (triggers.maxTemperature !== undefined && current.temperature <= triggers.maxTemperature) {
    boost += 0.3;
  }

  // Wind speed trigger
  if (triggers.minWindSpeed !== undefined) {
    const wind = current.windSpeed || 0;
    if (wind >= triggers.minWindSpeed) {
      boost += 0.25;
    }
  }

  // Condition trigger
  if (triggers.conditions && triggers.conditions.length > 0) {
    const currentCondition = current.condition.toLowerCase();
    if (triggers.conditions.some(c => currentCondition.includes(c.toLowerCase()))) {
      boost += 0.35;
    }
  }

  return Math.min(boost, 0.6); // Cap weather boost at 0.6
}

// ─── RAG Service ───

class RAGService {
  private avgKeywordLength: number;

  constructor() {
    const chunks = knowledgeBase.getAllChunks();
    const totalKeywords = chunks.reduce((sum, c) => sum + getAllKeywords(c).length, 0);
    this.avgKeywordLength = chunks.length > 0 ? totalKeywords / chunks.length : 10;
    logger.info(`RAG service initialized (${chunks.length} chunks, avg keyword length: ${this.avgKeywordLength.toFixed(1)})`);
  }

  /**
   * Search the knowledge base using hybrid BM25 + content matching + weather context.
   *
   * @param query - User's question text
   * @param language - Language code ('en', 'hi', 'gu')
   * @param weatherData - Optional current weather data for contextual boosting
   * @param topK - Number of top results to return (default: 3)
   * @param minScore - Minimum relevance score threshold (default: 0.1)
   */
  search(
    query: string,
    language: string = 'en',
    weatherData?: WeatherData,
    topK: number = 3,
    minScore: number = 0.1
  ): RAGSearchResult[] {
    const queryTokens = tokenize(query);

    if (queryTokens.length === 0) {
      return [];
    }

    const chunks = knowledgeBase.getAllChunks();
    const scored: RAGSearchResult[] = [];

    for (const chunk of chunks) {
      const allKeywords = getAllKeywords(chunk);

      // 1. BM25 keyword score (primary signal)
      const bm25 = bm25Score(queryTokens, allKeywords, this.avgKeywordLength);

      // 2. Content match score (secondary signal)
      const contentScore = contentMatchScore(queryTokens, chunk);

      // 3. Weather context boost (tertiary signal)
      const wxBoost = weatherContextBoost(chunk, weatherData);
      const hasWeatherBoost = wxBoost > 0;

      // Hybrid score: weighted combination
      const rawScore = bm25 * 0.5 + contentScore * 0.35 + wxBoost * 0.15;

      // Track matched keywords
      const matchedKeywords: string[] = [];
      for (const qt of queryTokens) {
        for (const kw of allKeywords) {
          if (termsMatch(qt, kw)) {
            if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw);
          }
        }
      }

      if (rawScore >= minScore && matchedKeywords.length > 0) {
        scored.push({
          chunk,
          score: Math.round(rawScore * 1000) / 1000,
          matchedKeywords,
          weatherBoost: hasWeatherBoost
        });
      }
    }

    // Sort by score descending, take top K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Build a RAG context object suitable for inclusion in the /api/ask response.
   * Retrieves relevant knowledge and formats it.
   */
  buildContext(
    query: string,
    language: string = 'en',
    weatherData?: WeatherData
  ): RAGContext {
    const results = this.search(query, language, weatherData, 3, 0.1);

    return {
      hasKnowledge: results.length > 0,
      sources: [...new Set(results.map(r => r.chunk.source))],
      documents: results.map(r => ({
        id: r.chunk.id,
        domain: r.chunk.domain,
        title: r.chunk.title,
        content: r.chunk.content,
        relevanceScore: r.score,
        source: r.chunk.source
      })),
      query,
      totalChunksSearched: knowledgeBase.size
    };
  }

  /**
   * Generate an augmented answer by appending relevant knowledge context
   * to the base answer.
   */
  augmentAnswer(baseAnswer: string, ragContext: RAGContext, language: string = 'en'): string {
    if (!ragContext.hasKnowledge || ragContext.documents.length === 0) {
      return baseAnswer;
    }

    // Only augment if the top document has a strong relevance score (>= 0.2)
    const topDoc = ragContext.documents[0];
    if (topDoc.relevanceScore < 0.2) {
      return baseAnswer;
    }

    // SIH Demo: Knowledge retrieval works in background, but we skip appending it 
    // to the final voice answer to avoid extremely long TTS speech outputs.
    // return baseAnswer + separator + knowledgeNote;
    return baseAnswer;
  }
}

export const ragService = new RAGService();
