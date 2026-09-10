import request from 'supertest';
import { createApp } from '../src/app.js';
import { openMeteoProvider } from '../src/services/weather/weatherService.js';
import { geocodingService } from '../src/services/geocoding/geocodingService.js';

const app = createApp();

describe('WeatherGPT V3 Upgrade Module Tests', () => {
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

  // A. Community Reports Tests
  it('A1. POST /api/community/report - Should submit crowdsourced weather report', async () => {
    const res = await request(app)
      .post('/api/community/report')
      .send({
        location: 'Rajkot',
        latitude: 22.30,
        longitude: 70.79,
        condition: 'heavy_rain',
        intensity: 'high',
        language: 'gu',
        notes: 'Heavy downpour'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.report.location).toBe('Rajkot');
    expect(res.body.report.condition).toBe('heavy_rain');
    expect(res.body.communityConfidence.totalReports).toBeGreaterThan(0);
  });

  it('A2. GET /api/community/reports - Should fetch community reports and confidence score', async () => {
    const res = await request(app).get('/api/community/reports?location=Rajkot');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reports).toBeDefined();
    expect(res.body.communityConfidence).toBeDefined();
  });

  // B. Route Weather Intelligence Tests
  it('B1. POST /api/route/weather - Should compute route weather between origin & destination', async () => {
    jest.spyOn(geocodingService, 'geocode').mockImplementation(async (name) => ({
      success: true,
      location: {
        name,
        latitude: name === 'Rajkot' ? 22.30 : 23.02,
        longitude: name === 'Rajkot' ? 70.79 : 72.57,
        country: 'India',
        state: 'Gujarat',
        timezone: 'Asia/Kolkata'
      }
    }));

    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValue(mockWeatherData);

    const res = await request(app)
      .post('/api/route/weather')
      .send({ origin: 'Rajkot', destination: 'Ahmedabad' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.routeWeather.totalDistanceKm).toBeGreaterThan(0);
    expect(res.body.routeWeather.originWeather.locationName).toBe('Rajkot');
    expect(res.body.routeWeather.destinationWeather.locationName).toBe('Ahmedabad');
    expect(res.body.routeWeather.etaWeatherSummary).toBeDefined();
  });

  // G. Shareable Social Card Tests
  it('G1. POST /api/share/card - Should generate shareable card JSON payload', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/share/card')
      .send({ location: 'Rajkot' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.shareCard.title).toMatch(/Rajkot/i);
    expect(res.body.shareCard.formattedMessage).toMatch(/WeatherGPT/i);
    expect(res.body.shareCard.tags.length).toBeGreaterThan(0);
  });

  // H. Enriched /api/ask V3 Response Test
  it('H1. POST /api/ask - Should return explainWhy, communityReports, shareCard & confidence in response', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'Will it rain today in Rajkot?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.explainWhy).toBeDefined();
    expect(res.body.explainWhy.title).toBeDefined();
    expect(res.body.communityReports).toBeDefined();
    expect(res.body.shareCard).toBeDefined();
    expect(res.body.confidence).toBeDefined();
    expect(res.body.confidence.forecast).toBeGreaterThanOrEqual(0);
    expect(res.body.disaster).toBeDefined();
    expect(res.body.airQuality).toBeDefined();
  });
});
