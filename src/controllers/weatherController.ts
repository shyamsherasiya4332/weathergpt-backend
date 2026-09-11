import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { matchFestival } from '../config/festivals.js';
import { advisoryService } from '../services/advisory/advisoryService.js';
import { conversationService } from '../services/conversation/conversationService.js';
import { languageService } from '../services/language/languageService.js';
import { llmService, getTimeRangeStats, translateConditionToGujarati, translateConditionToHindi } from '../services/llm/llmService.js';
import { makeService } from '../services/make/makeService.js';
import { riskService } from '../services/risk/riskService.js';
import { timelineService } from '../services/timeline/timelineService.js';
import { weatherService } from '../services/weather/weatherService.js';
import { climateService } from '../services/climate/climateService.js';
import { imageService } from '../services/image/imageService.js';
import { notificationService } from '../services/notification/notificationService.js';
import { moesService } from '../services/moes/moesService.js';
import { airQualityService } from '../services/airQuality/airQualityService.js';
import { disasterService } from '../services/disaster/disasterService.js';
import { confidenceService } from '../services/confidence/confidenceService.js';
import { communityService } from '../services/community/communityService.js';
import { explainableService } from '../services/explain/explainableService.js';
import { shareService } from '../services/share/shareService.js';
import { agriService } from '../services/agri/agriService.js';
import { weatherLensService } from '../services/lens/weatherLensService.js';
import { ragService } from '../services/rag/ragService.js';
import { ApiErrorResponse, AskResponseSuccess } from '../types/api.js';
import { logger } from '../utils/logger.js';

export const askRequestSchema = z.object({
  question: z.string().min(1, 'Question is required').max(2500, 'Question max length is 2500 characters'),
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
      
      // Clean query and strip any UI-injected system directives (dashboard language directives)
      let cleanQuestion = (question || '')
        .replace(/\[System Directive:[\s\S]*?\]/gi, '')
        .trim();

      if (!cleanQuestion) {
        cleanQuestion = (question || '').trim();
      }

      logger.info(`Received weather query: "${cleanQuestion}"`);

      // 1. Conversation Memory retrieval
      let convContext = reqConvId ? conversationService.getConversation(reqConvId) : undefined;
      if (!convContext && reqConvId) {
        convContext = conversationService.createConversation();
      }

      // 2. Language Auto-Detection:
      // The language dropdown in the UI is strictly for Dashboard display.
      // In AI Chat, language MUST be 100% AUTO-DETECTED from what the user asks!
      const detectedLang = languageService.detect(cleanQuestion);
      const effectiveLanguage = detectedLang.code;

      // 3. NLU & Intent parsing
      const nlu = await llmService.parseNLU(cleanQuestion, locationInput);
      nlu.language = effectiveLanguage;

      // Check Greeting Intent (e.g. "hello", "hi", "kem cho", "namaste", "halo", "ram ram")
      const isGreetingPattern = /^(?:hello|hi|hey|helo|kem\s*cho|namaste|namaskar|halo|ram\s*ram|su\s*prabhat|good\s*morning|good\s*evening|good\s*afternoon|good\s*night|pranam|jay\s*shree\s*krishna|har\s*har\s*mahadev|kaisa\s*ho|નમસ્તે|નમસ્કાર|કેમ\s*છો|હલો|પ્રણામ|હાય|હેલો|હરિ\s*ઓમ)\b/i.test(cleanQuestion.trim());
      if (nlu.intent === 'greeting' || isGreetingPattern) {
        logger.info(`Handling greeting intent for query: "${cleanQuestion}"`);
        const greetingAns = await llmService.generateGreeting(cleanQuestion, nlu.language);
        res.json({
          success: true,
          answer: greetingAns,
          language: nlu.language,
          conversationId: convContext?.id,
          generated_at: new Date().toISOString()
        });
        return;
      }

      // Check Off-Topic / Unknown Intent (e.g. "what is my name", "who are you", "tell me a joke", "who is PM")
      if (nlu.intent === 'unknown') {
        logger.info(`Handling off-topic unknown intent for query: "${cleanQuestion}"`);
        const offTopicAns = await llmService.generateOffTopicResponse(cleanQuestion, nlu.language);
        res.json({
          success: true,
          answer: offTopicAns,
          language: nlu.language,
          conversationId: convContext?.id,
          generated_at: new Date().toISOString()
        });
        return;
      }

      // Check Affirmative Follow-up (e.g. "yes", "ha", "haan", "હા", "हाँ", "ok", "sure", "bato")
      const isAffirmative = /^(?:yes|ha|haan|haa|haanji|હા|हाँ|ok|okay|sure|yeah|yep|yup|hange|true|bato|kaho|aapo|ha\s+bato|ha\s+aapo|baporo|sanj)$/i.test(cleanQuestion.trim());
      if ((nlu.intent === 'follow_up_time_breakdown' || isAffirmative) && convContext?.lastWeatherData) {
        logger.info(`Handling affirmative follow-up query for location '${convContext.locationName}'`);
        const weatherData = convContext.lastWeatherData;
        const targetDateStr = weatherData.daily[0]?.date || new Date().toISOString().split('T')[0];
        const locName = weatherData.location.name;
        const isGu = nlu.language === 'gu' || convContext.language === 'gu';
        const isHi = !isGu && (nlu.language === 'hi' || convContext.language === 'hi');

        const morningStats = getTimeRangeStats(weatherData, targetDateStr, 'morning', { startHour: 6, endHour: 12 });
        const afternoonStats = getTimeRangeStats(weatherData, targetDateStr, 'afternoon', { startHour: 12, endHour: 17 });
        const eveningStats = getTimeRangeStats(weatherData, targetDateStr, 'evening', { startHour: 17, endHour: 21 });
        const nightStats = getTimeRangeStats(weatherData, targetDateStr, 'night', { startHour: 21, endHour: 23 });

        let breakdownAnswer = '';
        if (isGu) {
          breakdownAnswer = `ચોક્કસ! અહીં **${locName}** માટે સમયગાળા મુજબ (સવાર, બપોર, સાંજ, રાત) કલાકવાર હવામાનની સંપૂર્ણ વિગત છે:

🌅 **સવાર (06:00 થી 12:00)**:
• વાતાવરણ: ${translateConditionToGujarati(morningStats.condition)}
• તાપમાન: ${morningStats.minTemp}°C થી ${morningStats.maxTemp}°C
• વરસાદની શક્યતા: ${morningStats.maxRainProb}% (${morningStats.totalRainMm > 0 ? `${morningStats.totalRainMm} mm` : 'નહિવત'})

☀️ **બપોર (12:00 થી 17:00)**:
• વાતાવરણ: ${translateConditionToGujarati(afternoonStats.condition)}
• તાપમાન: ${afternoonStats.minTemp}°C થી ${afternoonStats.maxTemp}°C
• વરસાદની શક્યતા: ${afternoonStats.maxRainProb}% (${afternoonStats.totalRainMm > 0 ? `${afternoonStats.totalRainMm} mm` : 'નહિવત'})

🌆 **સાંજ (17:00 થી 21:00)**:
• વાતાવરણ: ${translateConditionToGujarati(eveningStats.condition)}
• તાપમાન: ${eveningStats.minTemp}°C થી ${eveningStats.maxTemp}°C
• વરસાદની શક્યતા: ${eveningStats.maxRainProb}% (${eveningStats.totalRainMm > 0 ? `${eveningStats.totalRainMm} mm` : 'નહિવત'})

🌙 **રાત (21:00 થી 06:00)**:
• વાતાવરણ: ${translateConditionToGujarati(nightStats.condition)}
• તાપમાન: ${nightStats.minTemp}°C થી ${nightStats.maxTemp}°C
• વરસાદની શક્યતા: ${nightStats.maxRainProb}% (${nightStats.totalRainMm > 0 ? `${nightStats.totalRainMm} mm` : 'નહિવત'})

— *India Meteorological Department (IMD) / MoES Data*`;
        } else if (isHi) {
          breakdownAnswer = `बिल्कुल! यहाँ **${locName}** के लिए समयानुसार (सुबह, दोपहर, शाम, रात) मौसम का पूरा विवरण है:

🌅 **सुबह (06:00 से 12:00)**:
• मौसम: ${translateConditionToHindi(morningStats.condition)}
• तापमान: ${morningStats.minTemp}°C से ${morningStats.maxTemp}°C
• बारिश की संभावना: ${morningStats.maxRainProb}% (${morningStats.totalRainMm > 0 ? `${morningStats.totalRainMm} mm` : 'नगण्य'})

☀️ **दोपहर (12:00 से 17:00)**:
• मौसम: ${translateConditionToHindi(afternoonStats.condition)}
• तापमान: ${afternoonStats.minTemp}°C से ${afternoonStats.maxTemp}°C
• बारिश की संभावना: ${afternoonStats.maxRainProb}% (${afternoonStats.totalRainMm > 0 ? `${afternoonStats.totalRainMm} mm` : 'नगण्य'})

🌆 **शाम (17:00 से 21:00)**:
• मौसम: ${translateConditionToHindi(eveningStats.condition)}
• तापमान: ${eveningStats.minTemp}°C से ${eveningStats.maxTemp}°C
• बारिश की संभावना: ${eveningStats.maxRainProb}% (${eveningStats.totalRainMm > 0 ? `${eveningStats.totalRainMm} mm` : 'नगण्य'})

🌙 **रात (21:00 से 06:00)**:
• मौसम: ${translateConditionToHindi(nightStats.condition)}
• तापमान: ${nightStats.minTemp}°C से ${nightStats.maxTemp}°C
• बारिश की संभावना: ${nightStats.maxRainProb}% (${nightStats.totalRainMm > 0 ? `${nightStats.totalRainMm} mm` : 'नगण्य'})

— *India Meteorological Department (IMD) / MoES Data*`;
        } else {
          breakdownAnswer = `Sure! Here is the time-of-day weather breakdown (morning, afternoon, evening, night) for **${locName}**:

🌅 **Morning (6:00 AM - 12:00 PM)**:
• Condition: ${morningStats.condition}
• Temperature: ${morningStats.minTemp}°C to ${morningStats.maxTemp}°C
• Rain Probability: ${morningStats.maxRainProb}% (${morningStats.totalRainMm > 0 ? `${morningStats.totalRainMm} mm` : 'negligible'})

☀️ **Afternoon (12:00 PM - 5:00 PM)**:
• Condition: ${afternoonStats.condition}
• Temperature: ${afternoonStats.minTemp}°C to ${afternoonStats.maxTemp}°C
• Rain Probability: ${afternoonStats.maxRainProb}% (${afternoonStats.totalRainMm > 0 ? `${afternoonStats.totalRainMm} mm` : 'negligible'})

🌆 **Evening (5:00 PM - 9:00 PM)**:
• Condition: ${eveningStats.condition}
• Temperature: ${eveningStats.minTemp}°C to ${eveningStats.maxTemp}°C
• Rain Probability: ${eveningStats.maxRainProb}% (${eveningStats.totalRainMm > 0 ? `${eveningStats.totalRainMm} mm` : 'negligible'})

🌙 **Night (9:00 PM - 6:00 AM)**:
• Condition: ${nightStats.condition}
• Temperature: ${nightStats.minTemp}°C to ${nightStats.maxTemp}°C
• Rain Probability: ${nightStats.maxRainProb}% (${nightStats.totalRainMm > 0 ? `${nightStats.totalRainMm} mm` : 'negligible'})

— *India Meteorological Department (IMD) / MoES Data*`;
        }

        const rainAnalysis = weatherService.analyzeRainForecast(weatherData, nlu);
        const riskScores = riskService.calculateRiskScores(weatherData, rainAnalysis);
        const timelineData = timelineService.generateTimeline(weatherData, targetDateStr);

        res.json({
          success: true,
          answer: breakdownAnswer,
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
          timeline: timelineData,
          riskScores,
          generated_at: new Date().toISOString()
        });
        return;
      }

      // Check Festival / Event mode
      const festivalMatch = matchFestival(cleanQuestion);
      if (festivalMatch) {
        logger.info(`Matched festival/event '${festivalMatch.festival.name}' (${festivalMatch.dateRange.start})`);
        nlu.intent = 'general_forecast';
        nlu.targetDate = 'specific_date';
        nlu.specificDateStr = festivalMatch.dateRange.start;
      }

      // 4. Resolve Location (Explicit Question City > GPS Coordinates > Conversation Memory > Relative Query Fallback)
      let finalLocationInput = locationInput;
      let extractedName = nlu.locationName;

      // Word boundary regex so words like 'temperature' don't falsely trigger 'per'
      const isRelativeQuery = /\b(?:my\s*location|mara\s*location|mare\s*location|near\s*me|here|uper|per|par)\b|અહીં|અહીંનું|મારી\s*જગ્યા|મેરે\s*પાસ|મેરે\s*શહર/i.test(cleanQuestion);

      // If user asked about a specific city in the question, do NOT let ambient browser GPS coordinates override it!
      if (extractedName && extractedName.trim() !== '') {
        if (!finalLocationInput?.name || finalLocationInput.name.toLowerCase() !== extractedName.toLowerCase()) {
          finalLocationInput = undefined;
        }
      }

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

      if (!finalLocationInput && !extractedName) {
        logger.info(`No location provided in query or conversation memory. Defaulting to 'Ahmedabad' for instant responsive forecast.`);
        extractedName = 'Ahmedabad';
      }

      const weatherResult = await weatherService.resolveAndFetchWeather(
        finalLocationInput,
        extractedName
      );

      // Handle location missing or ambiguity
      if (weatherResult.error === 'LOCATION_MISSING') {
        let askLocMsg = '';
        if (nlu.language === 'gu') {
          askLocMsg = isRelativeQuery
            ? 'તમારું લાઈવ હવામાન મેળવવા માટે કૃપા કરીને તમારા બ્રાઉઝરમાં Location Permission Allow કરો અથવા તમારા શહેરનું નામ જણાવો (દા.ત. "મોરબી" અથવા "રાજકોટ").'
            : 'કૃપા કરીને તમારું શહેર અથવા સ્થળ જણાવો (દા.ત. "મોરબી" અથવા "રાજકોટ").';
        } else if (nlu.language === 'hi' || nlu.language === 'hinglish') {
          askLocMsg = isRelativeQuery
            ? 'अपना लाइव मौसम जानने के लिए कृपया लोकेशन की अनुमति (Permission) दें या अपने शहर का नाम बताएं (जैसे "मोरबी" या "राजकोट)।'
            : 'कृपया अपना शहर या स्थान बताएं (जैसे "मोरबी" या "राजकोट")।';
        } else if (nlu.language === 'mr') {
          askLocMsg = isRelativeQuery
            ? 'आपले हवामान पाहण्यासाठी कृपया लोकेशन परवानगी द्या किंवा आपल्या शहराचे नाव सांगा (उदा. "मुंबई" किंवा "पुणे").'
            : 'कृपया आपले शहर किंवा ठिकाण सांगा (उदा. "मुंबई" किंवा "पुणे").';
        } else {
          askLocMsg = isRelativeQuery
            ? 'To get weather for your current location, please enable location permission in your browser or type your city name (e.g. "Morbi" or "Rajkot").'
            : 'Please specify your location (city or coordinates) to get live weather forecasts.';
        }

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
        lastQuestion: cleanQuestion,
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

      // Natural language answer generation
      const baseAnswer = await llmService.generateAnswer(
        cleanQuestion,
        nlu,
        weatherData,
        rainAnalysis
      );

      // RAG Knowledge Retrieval — augment answer with expert knowledge
      const ragContext = ragService.buildContext(cleanQuestion, nlu.language, weatherData);
      const answer = ragService.augmentAnswer(baseAnswer, ragContext, nlu.language);

      // 8. Trigger non-blocking Make Webhook if rain threshold is high
      if (rainAnalysis.maxRainProbability >= 70) {
        makeService.triggerRainAlertAsync(
          weatherData.location.name,
          rainAnalysis.maxRainProbability,
          rainAnalysis.totalRainAmountMm,
          rainAnalysis.peakRainTimeWindow
        );
      }

      // Advanced AI Services & Production Modules
      const climateAnomaly = climateService.analyzeClimateAnomaly(weatherData);
      const emergencyNotification = notificationService.generateNotificationPayload(weatherData, riskScores);
      const weatherInfographic = imageService.generateWeatherCardSvg(weatherData, riskScores);
      const moesBulletin = moesService.generateBulletin(weatherData, rainAnalysis, riskScores, nlu.language, cleanQuestion);

      const disasterAlerts = disasterService.generateDisasterAlerts(weatherData, rainAnalysis, riskScores);
      const forecastConfidence = confidenceService.calculateConfidence(weatherData, 0);
      const explainWhy = explainableService.generateExplanation(weatherData, weatherData.location.name);
      const communityReports = communityService.calculateCommunityConfidence(weatherData.location.name, weatherData.location.latitude, weatherData.location.longitude);
      const shareCard = shareService.generateShareCard(weatherData.location.name, weatherData, cleanQuestion);

      // Fast parallel enrichment with pre-fetched weatherData (eliminates duplicate Open-Meteo API network calls)
      const [airQuality, agri, weatherLens] = await Promise.all([
        airQualityService.getAirQuality(weatherData.location.latitude, weatherData.location.longitude, nlu.language).catch((err) => {
          logger.warn('AirQuality fetch failed non-critically:', err);
          return undefined;
        }),
        agriService.generateAgriAdvisory(weatherData.location.name, weatherData.location.latitude, weatherData.location.longitude, undefined, nlu.language, weatherData).catch((err) => {
          logger.warn('Agri advisory failed non-critically:', err);
          return undefined;
        }),
        weatherLensService.analyzeSkyImage({
          question: cleanQuestion,
          latitude: weatherData.location.latitude,
          longitude: weatherData.location.longitude,
          location: weatherData.location,
          language: nlu.language,
          existingWeatherData: weatherData
        }).catch((err) => {
          logger.warn('WeatherLens analysis failed non-critically:', err);
          return undefined;
        })
      ]);

      const conversationContextObject = {
        id: convContext.id,
        resolvedLocation: weatherData.location,
        targetDate: nlu.targetDate || 'today',
        intent: nlu.intent,
        language: nlu.language,
        turnCount: convContext.turnCount || 1,
        lastUpdated: new Date().toISOString()
      };

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
        moes_bulletin: moesBulletin,
        suggested_followups: moesBulletin.suggestedFollowups,
        climate_fact: moesBulletin.climateFact,
        ui_widgets: moesBulletin.uiWidgets,
        // Production Upgrades (V2 + V3 + V3.1)
        airQuality,
        forecastConfidence,
        confidence: {
          forecast: forecastConfidence.overallScore,
          reason: forecastConfidence.description
        },
        conversationContext: conversationContextObject,
        disasterAlerts,
        disaster: disasterAlerts,
        explainWhy,
        communityReports,
        shareCard,
        agri,
        weatherLens,
        rag: ragContext,
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

  async handleMoesBulletin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const locationName = (req.query.location || req.body.locationName || 'Ahmedabad') as string;
      const lang = (req.query.lang || req.body.language || 'en') as string;

      const weatherResult = await weatherService.resolveAndFetchWeather(undefined, locationName);
      if (weatherResult.error || !weatherResult.weatherData) {
        res.status(404).json({
          success: false,
          error: { code: 'WEATHER_FETCH_FAILED', message: 'Could not fetch weather data for bulletin.' }
        });
        return;
      }

      const weatherData = weatherResult.weatherData;
      const rainAnalysis = weatherService.analyzeRainForecast(weatherData, { intent: 'general_forecast', isLocationNeeded: true, language: lang, confidence: 1 });
      const riskScores = riskService.calculateRiskScores(weatherData, rainAnalysis);
      const bulletin = moesService.generateBulletin(weatherData, rainAnalysis, riskScores, lang, `Weather bulletin for ${locationName}`);

      res.json({
        success: true,
        project: 'WeatherGPT: Conversational AI for Weather Forecasting, Alerts, and Climate Information',
        ministry: 'Ministry of Earth Sciences (MoES)',
        location: weatherData.location,
        bulletin,
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  handleGetMeta(req: Request, res: Response): void {
    res.json({
      success: true,
      service: 'WeatherGPT AI Backend API',
      version: '2.5.0',
      project: 'WeatherGPT: Conversational AI for Weather Forecasting, Alerts, and Climate Information',
      ministry: 'Ministry of Earth Sciences (MoES)',
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
        bulletin: 'GET /api/moes/bulletin',
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
