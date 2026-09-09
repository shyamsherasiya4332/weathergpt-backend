import request from 'supertest';
import { createApp } from '../src/app.js';
import { geocodingService } from '../src/services/geocoding/geocodingService.js';
import { openAIClient } from '../src/services/llm/openaiClient.js';
import { makeService } from '../src/services/make/makeService.js';
import { openMeteoProvider } from '../src/services/weather/weatherService.js';

const app = createApp();

describe('LLM Fallback & Make Integration Resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockLocation = {
    name: 'Morbi',
    latitude: 22.8173,
    longitude: 70.8377,
    timezone: 'Asia/Kolkata'
  };

  const mockWeatherData = {
    location: mockLocation,
    current: {
      temperature: 29,
      apparentTemperature: 31,
      condition: 'Cloudy',
      weatherCode: 3,
      precipitation: 0,
      rainProbability: 75,
      humidity: 80,
      windSpeed: 15,
      windDirection: 200,
      cloudCover: 90,
      visibility: 10000,
      uvIndex: 4,
      isDay: true,
      time: '2026-09-09T12:00:00Z'
    },
    hourly: [],
    daily: [
      {
        date: '2026-09-09',
        temperatureMax: 30,
        temperatureMin: 24,
        precipitationProbabilityMax: 85,
        precipitationSum: 5.4,
        condition: 'Heavy rain showers',
        sunrise: '06:20',
        sunset: '18:50',
        uvIndexMax: 5
      }
    ],
    retrievedAt: new Date().toISOString()
  };

  // Test 8: LLM Failure / Fallback handling
  it('8. Should fall back seamlessly to rule-based generator if LLM client fails', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: true,
      location: mockLocation
    });
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    // Force LLM error
    jest.spyOn(openAIClient, 'isConfigured').mockReturnValue(true);
    jest.spyOn(openAIClient, 'generateChatCompletion').mockRejectedValue(new Error('LLM Rate limit exceeded'));

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'Will it rain today in Morbi?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer).toBeDefined();
    expect(res.body.answer.length).toBeGreaterThan(0);
  });

  // Test 9: Make Failure non-blocking
  it('9. Should continue working cleanly if Make Webhook fails', async () => {
    jest.spyOn(makeService, 'triggerWebhook').mockResolvedValueOnce({
      success: false,
      message: 'Make Webhook timeout'
    });

    const res = await request(app)
      .post('/api/make/webhook')
      .send({
        event: 'weather_alert',
        location: 'Morbi',
        message: 'Test alert'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Make Webhook timeout/i);
  });

  it('Should handle POST /api/alerts and trigger webhook when threshold crossed', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: true,
      location: mockLocation
    });
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);
    jest.spyOn(makeService, 'triggerWebhook').mockResolvedValueOnce({
      success: true,
      message: 'Webhook triggered successfully'
    });

    const res = await request(app)
      .post('/api/alerts')
      .send({
        location: 'Morbi',
        condition: 'rain',
        threshold: 70,
        notification: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.currentStatus.thresholdCrossed).toBe(true);
    expect(res.body.makeWebhookResult.triggered).toBe(true);
  });
});
