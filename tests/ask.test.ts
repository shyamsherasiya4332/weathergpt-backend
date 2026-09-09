import request from 'supertest';
import { createApp } from '../src/app.js';
import { geocodingService } from '../src/services/geocoding/geocodingService.js';
import { openAIClient } from '../src/services/llm/openaiClient.js';
import { openMeteoProvider } from '../src/services/weather/weatherService.js';

const app = createApp();

describe('POST /api/ask - Natural Language Weather Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Mock geocoding provider
  const mockLocation = {
    name: 'Morbi',
    latitude: 22.8173,
    longitude: 70.8377,
    country: 'India',
    state: 'Gujarat',
    timezone: 'Asia/Kolkata'
  };

  const mockWeatherData = {
    location: mockLocation,
    current: {
      temperature: 29,
      apparentTemperature: 31,
      condition: 'Partly cloudy',
      weatherCode: 2,
      precipitation: 0,
      rainProbability: 20,
      humidity: 65,
      windSpeed: 12,
      windDirection: 180,
      cloudCover: 40,
      visibility: 10000,
      uvIndex: 5,
      isDay: true,
      time: '2026-09-09T12:00:00Z'
    },
    hourly: Array.from({ length: 48 }, (_, i) => ({
      time: `2026-09-${i < 24 ? '09' : '10'}T${(i % 24).toString().padStart(2, '0')}:00`,
      temperature: 28 + (i % 5),
      precipitationProbability: i >= 40 && i <= 44 ? 78 : 10,
      precipitationAmount: i >= 40 && i <= 44 ? 1.5 : 0,
      weatherCode: i >= 40 ? 61 : 2,
      condition: i >= 40 ? 'Slight rain' : 'Partly cloudy',
      humidity: 70,
      windSpeed: 10,
      uvIndex: 4
    })),
    daily: [
      {
        date: '2026-09-09',
        temperatureMax: 33,
        temperatureMin: 25,
        precipitationProbabilityMax: 20,
        precipitationSum: 0,
        condition: 'Partly cloudy',
        sunrise: '2026-09-09T06:20',
        sunset: '2026-09-09T18:50',
        uvIndexMax: 8
      },
      {
        date: '2026-09-10',
        temperatureMax: 31,
        temperatureMin: 24,
        precipitationProbabilityMax: 78,
        precipitationSum: 4.2,
        condition: 'Moderate rain',
        sunrise: '2026-09-10T06:21',
        sunset: '2026-09-10T18:49',
        uvIndexMax: 6
      }
    ],
    retrievedAt: new Date().toISOString()
  };

  // Test 1: Current weather question
  it('1. Should return current weather for "What is the weather like right now in Morbi?"', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: true,
      location: mockLocation
    });
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'What is the weather like right now in Morbi?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.location.name).toBe('Morbi');
    expect(res.body.weather.temperature).toBe(29);
    expect(res.body.answer).toBeDefined();
  });

  // Test 2: Tomorrow rain question
  it('2. Should analyze hourly forecast for "Will it rain tomorrow in Morbi?"', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: true,
      location: mockLocation
    });
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'Will it rain tomorrow in Morbi?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.weather.rain_probability).toBe(78);
    expect(res.body.answer).toMatch(/rain/i);
  });

  // Test 3: Gujarati question
  it('3. Should respond in Gujarati when question is "કાલે વરસાદ પડશે?" with location', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: true,
      location: mockLocation
    });
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({
        question: 'કાલે વરસાદ પડશે?',
        location: { name: 'Morbi' }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.language).toBe('gu');
    expect(res.body.answer).toBeDefined();
  });

  // Test 4: English question
  it('4. Should respond in English for "Should I carry an umbrella in Morbi?"', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: true,
      location: mockLocation
    });
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'Should I carry an umbrella in Morbi?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer).toBeDefined();
  });

  // Test 5: Question without location
  it('5. Should return prompt asking for location when no location is provided or extracted', async () => {
    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'Will it rain tomorrow?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.location).toBeUndefined();
    expect(res.body.answer).toMatch(/location/i);
  });

  // Test 6: Invalid location
  it('6. Should return 404 error response when location is invalid or not found', async () => {
    jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
      success: false,
      errorMessage: "Location 'NonExistentCityXYZ123' not found."
    });

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'What is the weather in NonExistentCityXYZ123?' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('LOCATION_NOT_FOUND');
  });

    const mockRajkotData = {
      ...mockWeatherData,
      location: {
        name: 'Rajkot',
        latitude: 22.3039,
        longitude: 70.8022,
        country: 'India',
        state: 'Gujarat',
        timezone: 'Asia/Kolkata'
      }
    };

    it('Should correctly parse Gujarati/Hinglish query "Kale Rajkot Varsad Hase ke Nai" without ambiguity', async () => {
      jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
        success: true,
        location: mockRajkotData.location,
        isAmbiguous: false
      });
      jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockRajkotData);

      const res = await request(app)
        .post('/api/ask')
        .send({ question: 'Kale Rajkot Varsad Hase ke Nai' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.location.name).toMatch(/Rajkot/i);
    });

    it('Should correctly parse Gujarati/Hinglish query with "ma" post-position "Kale Rajkot Gujarat ma Varsad Hase ke Nai"', async () => {
      jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
        success: true,
        location: mockRajkotData.location,
        isAmbiguous: false
      });
      jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockRajkotData);

      const res = await request(app)
        .post('/api/ask')
        .send({ question: 'Kale Rajkot Gujarat ma Varsad Hase ke Nai' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.location.name).toMatch(/Rajkot/i);
    });

    it('Should correctly parse Gujarati query with "paramdivas" (day after tomorrow)', async () => {
      jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
        success: true,
        location: mockRajkotData.location,
        isAmbiguous: false
      });
      jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockRajkotData);

      const res = await request(app)
        .post('/api/ask')
        .send({ question: 'Rajkot ma paramdivas varsad hase ke nai' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.answer).toMatch(/પરમદિવસે|પરમ દિવસનું/);
    });

  // Test 10: Explicit latitude/longitude request
  it('10. Should accept explicit latitude and longitude coordinates in request body', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({
        question: 'What is the weather right now?',
        location: {
          latitude: 22.8173,
          longitude: 70.8377,
          name: 'Morbi Custom Coords'
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.location.latitude).toBe(22.8173);
    expect(res.body.location.longitude).toBe(70.8377);
  });
});

