import request from 'supertest';
import { createApp } from '../src/app.js';
import { openMeteoProvider } from '../src/services/weather/weatherService.js';
import { geocodingService } from '../src/services/geocoding/geocodingService.js';

const app = createApp();

describe('WeatherGPT V3.1 Upgrade Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockLocation = {
    name: 'Rajkot',
    latitude: 22.30,
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
      rainProbability: 10,
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

  // 1. Weather Lens (AI Camera Photo & Query Handler) Tests
  it('1. POST /api/weather/lens - Should analyze camera photo & question with live API verification', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/weather/lens')
      .send({
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        question: 'આ વાદળો જોઈને કહો કાલે વરસાદ પડશે?',
        location: 'Rajkot',
        language: 'gu'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.weatherLens.detectedCloudType).toBeDefined();
    expect(res.body.weatherLens.apiVerificationStatus).toBe('VERIFIED_WITH_OPEN_METEO');
    expect(res.body.weatherLens.answer).toMatch(/Rajkot|રાજકોટ/i);
    expect(res.body.weatherLens.aiConfidence).toBeGreaterThanOrEqual(80);
  });

  // 2. Smart Crop / Kisan Intelligence Tests
  it('2a. GET /api/agri/advisory - Should return Kisan advisory in Gujarati', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app).get('/api/agri/advisory?location=Rajkot&language=gu&cropType=cotton');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agri.krishiIndex).toBeGreaterThanOrEqual(0);
    expect(res.body.agri.irrigationAdvice).toBeDefined();
    expect(res.body.agri.pesticideSuitability).toMatch(/SUITABLE|UNSUITABLE|CAUTION/);
    expect(res.body.agri.cropAdviceList.length).toBeGreaterThan(0);
  });

  it('2b. GET /api/agri/advisory - Should return Kisan advisory in English', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app).get('/api/agri/advisory?location=Rajkot&language=en');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agri.krishiIndex).toBeGreaterThan(0);
    expect(res.body.agri.irrigationAdvice).toMatch(/irrigation/i);
  });

  // 3. Enriched /api/ask V3.1 Response Test
  it('3. POST /api/ask - Should return agri and weatherLens in main weather response', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValue(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'Will it rain today in Rajkot?', language: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.agri).toBeDefined();
    expect(res.body.agri.krishiIndex).toBeDefined();
    expect(res.body.weatherLens).toBeDefined();
    expect(res.body.weatherLens.detectedCloudType).toBeDefined();
    expect(res.body.shareCard.branding).toMatch(/Ministry of Earth Sciences|WeatherGPT/i);
  });
});
