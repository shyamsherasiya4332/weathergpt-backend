import request from 'supertest';
import { createApp } from '../src/app.js';
import { matchLandmark } from '../src/config/landmarks.js';
import { matchFestival } from '../src/config/festivals.js';
import { advisoryService } from '../src/services/advisory/advisoryService.js';
import { conversationService } from '../src/services/conversation/conversationService.js';
import { geocodingService } from '../src/services/geocoding/geocodingService.js';
import { riskService } from '../src/services/risk/riskService.js';
import { timelineService } from '../src/services/timeline/timelineService.js';
import { openMeteoProvider } from '../src/services/weather/weatherService.js';
import { WeatherData } from '../src/types/weather.js';

const app = createApp();

describe('SIH Innovative Features Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockLocation = {
    name: 'Statue of Unity',
    latitude: 21.8380,
    longitude: 73.7191,
    country: 'India',
    state: 'Gujarat',
    timezone: 'Asia/Kolkata'
  };

  const mockWeatherData: WeatherData = {
    location: mockLocation,
    current: {
      temperature: 34,
      apparentTemperature: 38,
      condition: 'Partly cloudy',
      weatherCode: 2,
      precipitation: 0,
      rainProbability: 35,
      humidity: 60,
      windSpeed: 18,
      windDirection: 180,
      cloudCover: 40,
      visibility: 10000,
      uvIndex: 8,
      isDay: true,
      time: '2026-09-09T12:00:00Z'
    },
    hourly: Array.from({ length: 24 }, (_, i) => ({
      time: `2026-09-09T${i.toString().padStart(2, '0')}:00`,
      temperature: 26 + (i % 8),
      precipitationProbability: i >= 16 && i <= 19 ? 75 : 10,
      precipitationAmount: i >= 16 && i <= 19 ? 2.5 : 0,
      weatherCode: i >= 16 && i <= 19 ? 61 : 2,
      condition: i >= 16 && i <= 19 ? 'Slight rain' : 'Partly cloudy',
      humidity: 65,
      windSpeed: 15,
      uvIndex: i >= 10 && i <= 15 ? 9 : 2
    })),
    daily: [
      {
        date: '2026-09-09',
        temperatureMax: 34,
        temperatureMin: 26,
        precipitationProbabilityMax: 75,
        precipitationSum: 4.5,
        condition: 'Rain showers',
        sunrise: '2026-09-09T06:20',
        sunset: '2026-09-09T18:50',
        uvIndexMax: 9
      }
    ],
    retrievedAt: new Date().toISOString()
  };

  // 1. Landmark Matching
  it('Should match famous landmarks like Statue of Unity and Somnath Temple', () => {
    const landmark1 = matchLandmark('What is the weather at Statue of Unity?');
    expect(landmark1).toBeDefined();
    expect(landmark1?.name).toBe('Statue of Unity');

    const landmark2 = matchLandmark('Somnath temple weather');
    expect(landmark2).toBeDefined();
    expect(landmark2?.name).toBe('Somnath Temple');
  });

  // 2. Festival Date Resolver
  it('Should resolve festival query for Navratri and Diwali', () => {
    const fest1 = matchFestival('Navratri weather forecast in Morbi');
    expect(fest1).toBeDefined();
    expect(fest1?.festival.name).toBe('Navratri');

    const fest2 = matchFestival('Diwali rain chance');
    expect(fest2).toBeDefined();
    expect(fest2?.festival.name).toBe('Diwali');
  });

  // 3. Risk Score Calculation
  it('Should calculate 0-100 risk scores for rain, heat, wind, flood, and UV', () => {
    const rainAnalysis = {
      hasRainRisk: true,
      maxRainProbability: 75,
      totalRainAmountMm: 4.5,
      hourlyRainBreakdown: [],
      summary: 'High rain probability'
    };

    const scores = riskService.calculateRiskScores(mockWeatherData, rainAnalysis);
    expect(scores.overall).toBeGreaterThanOrEqual(0);
    expect(scores.overall).toBeLessThanOrEqual(100);
    expect(scores.rain).toBeGreaterThan(0);
    expect(scores.uv).toBeGreaterThan(0);
    expect(scores.severity).toBeDefined();
  });

  // 4. Advisory Engine & Best Time To Go Outside
  it('Should generate personalized advisories, best time to go outside, and mood', () => {
    const rainAnalysis = {
      hasRainRisk: true,
      maxRainProbability: 75,
      totalRainAmountMm: 4.5,
      hourlyRainBreakdown: [],
      summary: 'High rain probability'
    };
    const riskScores = riskService.calculateRiskScores(mockWeatherData, rainAnalysis);

    const advisories = advisoryService.generateAdvisories(mockWeatherData, rainAnalysis, riskScores);
    expect(advisories.general.length).toBeGreaterThan(0);
    expect(advisories.personalized.length).toBeGreaterThan(0);
    expect(advisories.mood.emoji).toBeDefined();
    expect(advisories.mood.hydrationAdvice).toBeDefined();
  });

  // 5. Timeline Generation
  it('Should generate a structured hourly timeline JSON', () => {
    const timeline = timelineService.generateTimeline(mockWeatherData, '2026-09-09');
    expect(timeline.hours.length).toBeGreaterThan(0);
    expect(timeline.summary.bestHours).toBeDefined();
    expect(timeline.summary.worstHours).toBeDefined();
    expect(timeline.hours[0].conditionEmoji).toBeDefined();
  });

  // 6. Conversation Memory
  it('Should persist location context across conversation turns', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: true,
      location: mockLocation
    });
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValue(mockWeatherData);

    // Turn 1: Ask with location
    const res1 = await request(app)
      .post('/api/ask')
      .send({ question: 'What is the weather in Statue of Unity?' });

    expect(res1.status).toBe(200);
    expect(res1.body.conversationId).toBeDefined();
    const convId = res1.body.conversationId;

    // Turn 2: Follow-up question without location using conversationId
    const res2 = await request(app)
      .post('/api/ask')
      .send({
        question: 'Will it rain tomorrow?',
        conversationId: convId
      });

    expect(res2.status).toBe(200);
    expect(res2.body.location.name).toBe('Statue of Unity');
  });

  // 7. Enriched SIH Endpoint Response
  it('Should return full SIH fields (riskScores, advisories, bestTimeToGoOut, mood, timeline) in POST /api/ask', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: true,
      location: mockLocation
    });
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValue(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({
        question: 'Will it rain today at Statue of Unity?',
        persona: 'farmer'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.riskScores).toBeDefined();
    expect(res.body.advisories).toBeDefined();
    expect(res.body.mood).toBeDefined();
    expect(res.body.timeline).toBeDefined();
  });
});
