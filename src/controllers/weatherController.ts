import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { matchFestival } from '../config/festivals.js';
import { advisoryService } from '../services/advisory/advisoryService.js';
import { conversationService } from '../services/conversation/conversationService.js';
import { languageService } from '../services/language/languageService.js';
import { llmService } from '../services/llm/llmService.js';
import { makeService } from '../services/make/makeService.js';
import { riskService } from '../services/risk/riskService.js';
import { timelineService } from '../services/timeline/timelineService.js';
import { weatherService } from '../services/weather/weatherService.js';
import { climateService } from '../services/climate/climateService.js';
import { imageService } from '../services/image/imageService.js';
import { notificationService } from '../services/notifications/notificationService.js';
import { ApiErrorResponse, AskResponseSuccess } from '../types/api.js';
import { logger } from '../utils/logger.js';

export const askRequestSchema = z.object({
  question: z.string().min(1, 'Question is required').max(500, 'Question max length is 500 characters'),
  location: z
    .object({
      name: z.string().optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional()
    })
    .optional(),
  language: z.string().optional(),
  conversationId: z.string().optional(),
  persona: z.enum(['farmer', 'student', 'traveler', 'elderly', 'outdoor_worker', 'general']).optional()
});

export const weatherQuerySchema = z.object({
  location: z
    .object({
      name: z.string().optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional()
    })
    .optional(),
  locationName: z.string().optional()
});

export class WeatherController {
  async handleAsk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question, location: locationInput, language: reqLanguage, conversationId: reqConvId, persona } = req.body;
      logger.info(`Received weather query: "${question}"`);

      // 1. Conversation Memory retrieval
      let convContext = reqConvId ? conversationService.getConversation(reqConvId) : undefined;
      if (!convContext && reqConvId) {
        convContext = conversationService.createConversation();
      }

      // 2. Language Detection across all 22 official Indian languages + Hinglish
      const detectedLang = languageService.detect(question);
      const effectiveLanguage = reqLanguage || (detectedLang.code !== 'en' ? detectedLang.code : undefined);

      // 3. NLU & Intent parsing
      const nlu = await llmService.parseNLU(question);
      if (effectiveLanguage) {
        nlu.language = effectiveLanguage;
      }

      // Check Festival / Event mode
      const festivalMatch = matchFestival(question);
      if (festivalMatch) {
        logger.info(`Matched festival/event '${festivalMatch.festival.name}' (${festivalMatch.dateRange.start})`);
        nlu.intent = 'general_forecast';
        nlu.targetDate = 'specific_date';
        nlu.specificDateStr = festivalMatch.dateRange.start;
      }

      // 4. Resolve Location (Explicit > Question > Conversation Memory)
      let finalLocationInput = locationInput;
      let extractedName = nlu.locationName;

      if (!finalLocationInput && !extractedName && convContext?.locationName) {
        logger.info(`Using conversation memory location '${convContext.locationName}' for follow-up query.`);
        extractedName = convContext.locationName;
        if (convContext.latitude !== undefined && convContext.longitude !== undefined) {
          finalLocationInput = {
            name: convContext.locationName,
            latitude: convContext.latitude,
            longitude: convContext.longitude
          };
        }
      }

      const weatherResult = await weatherService.resolveAndFetchWeather(
        finalLocationInput,
        extractedName
      );

      // Handle location missing or ambiguity
      if (weatherResult.error === 'LOCATION_MISSING') {
        const askLocMsg =
          nlu.language === 'gu'
            ? 'કૃપા કરીને તમારું શહેર અથવા સ્થળ જણાવો (દા.ત. "મોરબી" અથવા "રાજકોટ").'
            : nlu.language === 'hi'
            ? 'कृपया अपना शहर या स्थान बताएं (जैसे "मोरबी" या "राजकोट")।'
            : 'Please specify your location (city or coordinates) to get live weather forecasts.';

        const resp: AskResponseSuccess = {
          success: true,
          answer: askLocMsg,
          language: nlu.language,
          conversationId: convContext?.id,
          generated_at: new Date().toISOString()
        };
        res.json(resp);
        return;
      }

      if (weatherResult.isAmbiguous) {
        const ambMsg =
          nlu.language === 'gu'
            ? `સ્થળ '${nlu.locationName}' માટે બહુવિધ પરિણામો મળ્યા. કૃપા કરીને રાજ્ય અથવા દેશ સ્પષ્ટ કરો.`
            : `Multiple places matching '${nlu.locationName}' were found. Please clarify state or country.`;

        const resp: AskResponseSuccess = {
          success: true,
          answer: ambMsg,
          language: nlu.language,
          conversationId: convContext?.id,
          generated_at: new Date().toISOString()
        };
        res.json(resp);
        return;
      }

      if (weatherResult.error?.startsWith('WEATHER_API_ERROR')) {
        throw new Error(weatherResult.error);
      }

      if (!weatherResult.weatherData || !weatherResult.location) {
        const errResp: ApiErrorResponse = {
          success: false,
          error: {
            code: 'LOCATION_NOT_FOUND',
            message: weatherResult.error || `Could not find weather data for requested location.`
          }
        };
        res.status(404).json(errResp);
        return;
      }

      const weatherData = weatherResult.weatherData;

      // Update Conversation Memory Context
      if (!convContext) {
        convContext = conversationService.createConversation();
      }
      conversationService.updateConversation(convContext.id, {
        locationName: weatherData.location.name,
        latitude: weatherData.location.latitude,
        longitude: weatherData.location.longitude,
        timezone: weatherData.location.timezone,
        language: nlu.language,
        lastQuestion: question,
        lastWeatherData: weatherData
      });

      // 5. Rain & Hourly Analysis
      const rainAnalysis = weatherService.analyzeRainForecast(weatherData, nlu);

      // 6. Compute SIH Feature Services
      // A. AI Weather Risk Scores (0-100)
      const riskScores = riskService.calculateRiskScores(weatherData, rainAnalysis);

      // B. Smart Advisories & Best Time To Go Outside & Weather Mood
      const advisoriesData = advisoryService.generateAdvisories(weatherData, rainAnalysis, riskScores);

      // C. Structured Weather Timeline
      const targetDateStr = weatherData.daily[0]?.date || new Date().toISOString().split('T')[0];
      const timelineData = timelineService.generateTimeline(weatherData, targetDateStr);

      // 7. Generate Natural Language Answer via WeatherGPT System Prompt
      let answer = await llmService.generateAnswer(
        question,
        nlu,
        weatherData,
        rainAnalysis
      );

      // Append Offline Cache Notice if serving cached data
      if (weatherData.isCached && weatherData.cacheNotice) {
        answer = `${answer}\n\n⚠️ ${weatherData.cacheNotice}`;
      }

      // 8. Trigger non-blocking Make Webhook if rain threshold is high
      if (rainAnalysis.maxRainProbability >= 70) {
        makeService.triggerRainAlertAsync(
          weatherData.location.name,
          rainAnalysis.maxRainProbability,
          rainAnalysis.totalRainAmountMm,
          rainAnalysis.peakRainTimeWindow
        );
      }

      // Advanced AI Services
      const climateAnomaly = climateService.analyzeClimateAnomaly(weatherData);
      const emergencyNotification = notificationService.generateNotificationPayload(weatherData, riskScores);
      const weatherInfographic = imageService.generateWeatherCardSvg(weatherData, riskScores);

      // 9. Return Enriched Production JSON Response
      const responsePayload: AskResponseSuccess = {
        success: true,
        answer,
        language: nlu.language,
        conversationId: convContext.id,
        location: {
          name: weatherData.location.name,
          latitude: weatherData.location.latitude,
          longitude: weatherData.location.longitude,
          country: weatherData.location.country,
          state: weatherData.location.state,
          timezone: weatherData.location.timezone
        },
        weather: {
          temperature: Math.round(weatherData.current.temperature),
          apparentTemperature: Math.round(weatherData.current.apparentTemperature),
          condition: weatherData.current.condition,
          rain_probability: rainAnalysis.maxRainProbability,
          rain_amount_mm: rainAnalysis.totalRainAmountMm,
          humidity: weatherData.current.humidity,
          windSpeed: weatherData.current.windSpeed,
          uvIndex: weatherData.current.uvIndex
        },
        forecast: weatherData.daily.slice(0, 5).map((d) => ({
          date: d.date,
          condition: d.condition,
          tempMax: Math.round(d.temperatureMax),
          tempMin: Math.round(d.temperatureMin),
          rainProbability: d.precipitationProbabilityMax
        })),
        // SIH Innovations & Advanced AI
        riskScores,
        advisories: {
          general: advisoriesData.general,
          personalized: persona
            ? advisoriesData.personalized.filter((p) => p.persona === persona || p.persona === 'general')
            : advisoriesData.personalized
        },
        bestTimeToGoOut: advisoriesData.bestTimeToGoOut,
        mood: advisoriesData.mood,
        timeline: timelineData,
        climateAnomaly,
        emergencyNotification,
        weatherInfographic,
        generated_at: new Date().toISOString()
      };

      res.json(responsePayload);
    } catch (error) {
      next(error);
    }
  }

  async handleDirectWeather(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { location, locationName } = req.body;
      const weatherResult = await weatherService.resolveAndFetchWeather(location, locationName);

      if (weatherResult.error || !weatherResult.weatherData) {
        res.status(404).json({
          success: false,
          error: {
            code: 'WEATHER_FETCH_FAILED',
            message: weatherResult.error || 'Failed to retrieve weather data.'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: weatherResult.weatherData,
        generated_at: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }

  handleGetMeta(req: Request, res: Response): void {
    res.json({
      success: true,
      service: 'WeatherGPT AI Backend API',
      version: '2.0.0',
      supportedLanguages: [
        { code: 'gu', name: 'Gujarati (ગુજરાતી)', script: 'Gujarati' },
        { code: 'hi', name: 'Hindi (हिन्दी)', script: 'Devanagari' },
        { code: 'mr', name: 'Marathi (मराठी)', script: 'Devanagari' },
        { code: 'bn', name: 'Bengali (বাংলা)', script: 'Bengali' },
        { code: 'ta', name: 'Tamil (தமிழ்)', script: 'Tamil' },
        { code: 'te', name: 'Telugu (తెలుగు)', script: 'Telugu' },
        { code: 'kn', name: 'Kannada (ಕನ್ನಡ)', script: 'Kannada' },
        { code: 'ml', name: 'Malayalam (മലയാളം)', script: 'Malayalam' },
        { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)', script: 'Gurmukhi' },
        { code: 'or', name: 'Odia (ଓଡ଼ିଆ)', script: 'Odia' },
        { code: 'as', name: 'Assamese (অসমীয়া)', script: 'Bengali-Assamese' },
        { code: 'ur', name: 'Urdu (اردو)', script: 'Arabic' },
        { code: 'sa', name: 'Sanskrit (संस्कृतम्)', script: 'Devanagari' },
        { code: 'kok', name: 'Konkani (कोंकणी)', script: 'Devanagari' },
        { code: 'mai', name: 'Maithili (मैथिली)', script: 'Devanagari' },
        { code: 'sd', name: 'Sindhi', script: 'Arabic/Devanagari' },
        { code: 'ks', name: 'Kashmiri', script: 'Arabic/Devanagari' },
        { code: 'mni', name: 'Manipuri / Meitei', script: 'Meetei Mayek' },
        { code: 'brx', name: 'Bodo', script: 'Devanagari' },
        { code: 'doi', name: 'Dogri', script: 'Devanagari' },
        { code: 'en', name: 'English', script: 'Latin' },
        { code: 'hinglish', name: 'Hinglish (Romanized Hindi)', script: 'Latin' }
      ],
      supportedPersonas: [
        { id: 'farmer', name: 'Farmer (कृષિ / किसान)', icon: '🌾' },
        { id: 'student', name: 'Student / Youth', icon: '🎓' },
        { id: 'traveler', name: 'Traveler / Tourist', icon: '🧳' },
        { id: 'elderly', name: 'Senior Citizen', icon: '👵' },
        { id: 'outdoor_worker', name: 'Outdoor Worker', icon: '👷' },
        { id: 'general', name: 'General Public', icon: '🌐' }
      ],
      knownLandmarks: [
        'Statue of Unity', 'Somnath Temple', 'Gir National Park', 'Sabarmati Riverfront',
        'Taj Mahal', 'India Gate', 'Gateway of India', 'Rann of Kutch', 'Dwarkadhish Temple'
      ],
      knownFestivals: [
        'Navratri', 'Diwali', 'Holi', 'Uttarayan', 'Rath Yatra', 'Ganesh Chaturthi',
        'Janmashtami', 'IPL Cricket Match', 'Eid', 'Christmas'
      ],
      riskMetrics: ['rain', 'heat', 'wind', 'flood', 'uv'],
      endpoints: {
        ask: 'POST /api/ask',
        weather: 'POST /api/weather',
        alerts: 'POST /api/alerts',
        transcribe: 'POST /api/voice/transcribe',
        speak: 'POST /api/voice/speak',
        voiceAsk: 'POST /api/voice/ask',
        makeWebhook: 'POST /api/make/webhook',
        health: 'GET /health'
      }
    });
  }
}

export const weatherController = new WeatherController();
