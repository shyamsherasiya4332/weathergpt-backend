import request from 'supertest';
import { createApp } from '../src/app.js';
import { openMeteoProvider } from '../src/services/weather/weatherService.js';
import { makeService } from '../src/services/make/makeService.js';

const app = createApp();

describe('WeatherGPT V3.2 Upgrade Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockLocation = {
    name: 'Rajkot',
    latitude: 22.3,
    longitude: 70.79,
    country: 'India',
    state: 'Gujarat',
    timezone: 'Asia/Kolkata'
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const mockWeatherData = {
    location: mockLocation,
    retrievedAt: new Date().toISOString(),
    current: {
      temperature: 31,
      apparentTemperature: 34,
      condition: 'Sunny',
      weatherCode: 0,
      precipitation: 0,
      rainProbability: 15,
      humidity: 55,
      windSpeed: 18,
      windDirection: 180,
      cloudCover: 10,
      visibility: 10000,
      uvIndex: 7,
      isDay: true,
      time: `${todayStr}T12:00:00Z`
    },
    hourly: Array.from({ length: 24 }, (_, i) => ({
      time: `${todayStr}T${i.toString().padStart(2, '0')}:00`,
      temperature: 30,
      precipitationProbability: 10,
      precipitationAmount: 0,
      weatherCode: 0,
      condition: 'Sunny',
      humidity: 55,
      windSpeed: 15,
      uvIndex: 6
    })),
    daily: [
      {
        date: todayStr,
        temperatureMax: 35,
        temperatureMin: 25,
        precipitationProbabilityMax: 10,
        precipitationSum: 0,
        condition: 'Sunny',
        sunrise: `${todayStr}T06:20`,
        sunset: `${todayStr}T18:50`,
        uvIndexMax: 8
      }
    ]
  };

  // 1. Weather Copilot Tests
  describe('Weather Copilot Endpoint (POST /api/copilot/plan)', () => {
    it('1a. Should generate outdoor wedding plan in Gujarati', async () => {
      jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

      const res = await request(app)
        .post('/api/copilot/plan')
        .send({
          activityType: 'wedding',
          location: 'Rajkot',
          language: 'gu'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.copilot.activityType).toBe('wedding');
      expect(res.body.copilot.recommendation).toBeDefined();
      expect(res.body.copilot.bestTimeWindow).toBeDefined();
      expect(res.body.copilot.confidence).toBeGreaterThan(50);
      expect(res.body.copilot.guidance.length).toBeGreaterThan(0);
    });

    it('1b. Should generate sports activity plan in English', async () => {
      jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

      const res = await request(app)
        .post('/api/copilot/plan')
        .send({
          activityType: 'sports',
          location: 'Ahmedabad',
          language: 'en'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.copilot.recommendation).toMatch(/Favorable|Caution Advised|Not Recommended/);
    });
  });

  // 2. Smart Notification AI Tests
  describe('Smart Notification AI Endpoints', () => {
    it('2a. POST /api/notifications/schedule - Should schedule a rain trigger notification', async () => {
      const res = await request(app)
        .post('/api/notifications/schedule')
        .send({
          location: 'Rajkot',
          triggerType: 'rain',
          threshold: 40,
          frequency: 'realtime',
          channel: 'make'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rule.id).toBeDefined();
      expect(res.body.rule.triggerType).toBe('rain');
    });

    it('2b. GET /api/notifications/rules - Should fetch scheduled notification rules', async () => {
      const res = await request(app).get('/api/notifications/rules?location=Rajkot');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.rules)).toBe(true);
    });

    it('2c. POST /api/notifications/evaluate - Should evaluate rules & dispatch Make Webhook', async () => {
      jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);
      jest.spyOn(makeService, 'triggerWebhook').mockResolvedValueOnce({ success: true, message: 'OK' });

      const res = await request(app)
        .post('/api/notifications/evaluate')
        .send({ location: 'Rajkot' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.evaluations)).toBe(true);
    });
  });

  // 3. Accessibility Service Tests
  describe('Accessibility Service Endpoints', () => {
    it('3a. POST /api/accessibility/format - Should format voice-first and high contrast UI options', async () => {
      const res = await request(app)
        .post('/api/accessibility/format')
        .send({
          location: 'Rajkot',
          language: 'gu',
          voiceFirst: true,
          highContrast: true,
          largeText: true,
          weatherData: { temperature: 32, condition: 'Sunny', rainProbability: 10 }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessibility.voiceFirst.audioScript).toMatch(/Rajkot|રાજકોટ/i);
      expect(res.body.accessibility.voiceFirst.language).toBe('gu-IN');
      expect(res.body.accessibility.uiTheme.highContrast.enabled).toBe(true);
      expect(res.body.accessibility.uiTheme.largeText.enabled).toBe(true);
    });

    it('3b. GET /api/accessibility/offline-phrases - Should return multilingual emergency phrases', async () => {
      const res = await request(app).get('/api/accessibility/offline-phrases?category=cyclone');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThan(0);
      expect(res.body.phrases[0].gujarati).toBeDefined();
      expect(res.body.phrases[0].hindi).toBeDefined();
      expect(res.body.phrases[0].english).toBeDefined();
    });
  });
});
