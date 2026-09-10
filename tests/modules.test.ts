import request from 'supertest';
import { createApp } from '../src/app.js';
import { geocodingService } from '../src/services/geocoding/geocodingService.js';
import { openMeteoProvider } from '../src/services/weather/weatherService.js';
import { confidenceService } from '../src/services/confidence/confidenceService.js';

const app = createApp();

describe('Production-Ready WeatherGPT Module Upgrades', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockLocation = {
    name: 'Morbi',
    latitude: 22.8173,
    longitude: 70.8377,
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

  // 1. Reverse Geocoding Endpoint
  it('1. POST /api/location/reverse-geocode - Should resolve coordinates to place name', async () => {
    jest.spyOn(geocodingService, 'reverseGeocode').mockResolvedValueOnce(mockLocation);

    const res = await request(app)
      .post('/api/location/reverse-geocode')
      .send({ latitude: 22.8173, longitude: 70.8377 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.location.name).toBe('Morbi');
    expect(res.body.formattedAddress).toMatch(/Morbi/i);
  });

  // 2. Air Quality & Production Fields in /api/ask
  it('2. POST /api/ask - Should return Air Quality, Confidence, ConversationContext & DisasterAlerts', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'What is the weather and AQI in Morbi?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.airQuality).toBeDefined();
    expect(res.body.airQuality.aqi).toBeGreaterThanOrEqual(0);
    expect(res.body.forecastConfidence).toBeDefined();
    expect(res.body.forecastConfidence.rating).toMatch(/HIGH|MODERATE|LOW/);
    expect(res.body.conversationContext).toBeDefined();
    expect(res.body.conversationContext.targetDate).toBe('today');
  });

  // 3. Disaster Intelligence Alerts & Emergency Guide
  it('3. GET /api/disaster/alerts - Should return active disaster warnings', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app).get('/api/disaster/alerts?location=Morbi');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.alerts).toBeDefined();
  });

  it('3b. GET /api/disaster/emergency-guide - Should return cyclone safety guidance in Gujarati', async () => {
    const res = await request(app).get('/api/disaster/emergency-guide?disasterType=cyclone&language=gu');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.guidance.title).toMatch(/વાવાઝોડા/i);
    expect(res.body.guidance.dos.length).toBeGreaterThan(0);
  });

  // 4. Weather Comparison Endpoint
  it('4. POST /api/weather/compare - Should compare multiple locations', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValue(mockWeatherData);

    const res = await request(app)
      .post('/api/weather/compare')
      .send({ locations: ['Ahmedabad', 'Mumbai'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.comparison.locations.length).toBeGreaterThanOrEqual(1);
    expect(res.body.comparison.rankings.bestWeather).toBeDefined();
  });

  // 5. Interactive Weather Map Overlay
  it('5. GET /api/maps/weather - Should return layer tile config for rain and temperature', async () => {
    const res = await request(app).get('/api/maps/weather?layer=rain&lat=23.0225&lon=72.5714');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.map.tileUrlTemplate).toMatch(/openweathermap|open-meteo/i);
    expect(res.body.map.legend.length).toBeGreaterThan(0);
  });

  // 6. Forecast Confidence Score Service
  it('6. ConfidenceService - Should decrease confidence score as horizon increases', () => {
    const day0 = confidenceService.calculateConfidence(mockWeatherData, 0);
    const day5 = confidenceService.calculateConfidence(mockWeatherData, 5);

    expect(day0.overallScore).toBeGreaterThan(day5.overallScore);
  });
});
