import request from 'supertest';
import { createApp } from '../src/app.js';
import { geocodingService } from '../src/services/geocoding/geocodingService.js';
import { openMeteoProvider } from '../src/services/weather/weatherService.js';

const app = createApp();

describe('Weather API Failure & Direct Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 7: Weather API Failure
  it('7. Should handle Weather API failure gracefully returning clean JSON error', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: true,
      location: {
        name: 'Morbi',
        latitude: 22.8173,
        longitude: 70.8377,
        timezone: 'Asia/Kolkata'
      }
    });

    jest.spyOn(openMeteoProvider, 'getWeatherData').mockRejectedValueOnce(
      new Error('WEATHER_API_ERROR: Connection timed out')
    );

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'Weather in Morbi?' });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('WEATHER_API_ERROR');
    expect(res.body.error.message).toMatch(/live weather data/i);
  });

  it('Should fetch direct weather data via POST /api/weather', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: true,
      location: {
        name: 'Rajkot',
        latitude: 22.3039,
        longitude: 70.8022,
        timezone: 'Asia/Kolkata'
      }
    });

    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce({
      location: {
        name: 'Rajkot',
        latitude: 22.3039,
        longitude: 70.8022,
        timezone: 'Asia/Kolkata'
      },
      current: {
        temperature: 30,
        apparentTemperature: 32,
        condition: 'Clear sky',
        weatherCode: 0,
        precipitation: 0,
        rainProbability: 5,
        humidity: 50,
        windSpeed: 8,
        windDirection: 90,
        cloudCover: 10,
        visibility: 10000,
        uvIndex: 7,
        isDay: true,
        time: '2026-09-09T12:00:00Z'
      },
      hourly: [],
      daily: [],
      retrievedAt: new Date().toISOString()
    });

    const res = await request(app)
      .post('/api/weather')
      .send({ locationName: 'Rajkot' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.location.name).toBe('Rajkot');
    expect(res.body.data.current.temperature).toBe(30);
  });
});
