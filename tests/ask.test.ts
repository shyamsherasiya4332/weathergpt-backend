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

  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0];

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const dayAfterDate = new Date();
  dayAfterDate.setDate(dayAfterDate.getDate() + 2);
  const dayAfterStr = dayAfterDate.toISOString().split('T')[0];

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
      time: `${todayStr}T12:00:00Z`
    },
    hourly: Array.from({ length: 72 }, (_, i) => {
      const hDate = new Date();
      hDate.setHours(hDate.getHours() + i);
      const isoStr = hDate.toISOString().substring(0, 16);
      const hDateStr = isoStr.split('T')[0];
      const isTomorrow = hDateStr === tomorrowStr || hDateStr === dayAfterStr;
      return {
        time: isoStr,
        temperature: 28 + (i % 5),
        precipitationProbability: isTomorrow ? 78 : 10,
        precipitationAmount: isTomorrow ? 1.5 : 0,
        weatherCode: isTomorrow ? 61 : 2,
        condition: isTomorrow ? 'Slight rain' : 'Partly cloudy',
        humidity: 70,
        windSpeed: 10,
        uvIndex: 4
      };
    }),
    daily: [
      {
        date: todayStr,
        temperatureMax: 33,
        temperatureMin: 25,
        precipitationProbabilityMax: 20,
        precipitationSum: 0,
        condition: 'Partly cloudy',
        sunrise: `${todayStr}T06:20`,
        sunset: `${todayStr}T18:50`,
        uvIndexMax: 8
      },
      {
        date: tomorrowStr,
        temperatureMax: 31,
        temperatureMin: 24,
        precipitationProbabilityMax: 78,
        precipitationSum: 4.2,
        condition: 'Moderate rain',
        sunrise: `${tomorrowStr}T06:21`,
        sunset: `${tomorrowStr}T18:49`,
        uvIndexMax: 6
      },
      {
        date: dayAfterStr,
        temperatureMax: 32,
        temperatureMin: 24,
        precipitationProbabilityMax: 78,
        precipitationSum: 4.2,
        condition: 'Moderate rain',
        sunrise: `${dayAfterStr}T06:21`,
        sunset: `${dayAfterStr}T18:49`,
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

    it('Should correctly handle Garmi (heat/temperature) query "MORBI MA KALE GARMI KEVI HASE?"', async () => {
      jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
        success: true,
        location: mockLocation,
        isAmbiguous: false
      });
      jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

      const res = await request(app)
        .post('/api/ask')
        .send({ question: 'MORBI MA KALE GARMI KEVI HASE?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.answer).toMatch(/ગરમી|તાપમાન/);
    });

    const mockMumbaiLocation = {
      name: 'Mumbai',
      latitude: 19.076,
      longitude: 72.877,
      state: 'Maharashtra',
      country: 'India',
      timezone: 'Asia/Kolkata'
    };
    const mockMumbaiData = {
      ...mockWeatherData,
      location: mockMumbaiLocation
    };

    it('Should correctly parse Marathi query "मुंबईमध्ये आज हवामान कसे आहे?" and resolve Mumbai', async () => {
      jest.spyOn(geocodingService, 'geocode').mockResolvedValueOnce({
        success: true,
        location: mockMumbaiLocation,
        isAmbiguous: false
      });
      jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockMumbaiData);

      const res = await request(app)
        .post('/api/ask')
        .send({ question: 'मुंबईमध्ये आज हवामान कसे आहे?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.location.name).toMatch(/Mumbai|मुंबई/i);
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

  // Test 11: Off-topic / non-weather query handling
  it('11. Should gracefully handle off-topic non-weather queries like "what is my name"', async () => {
    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'what is my name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer).toMatch(/WeatherGPT|weather/i);
  });

  it('12. Should handle Gujarati off-topic query "મારું નામ શું છે?"', async () => {
    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'મારું નામ શું છે?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer).toMatch(/WeatherGPT|હવામાન/i);
  });

  it('13. Should handle Punjabi weather query and respond in Punjabi language', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'ਅੱਜ ਮੋਗਾ ਵਿੱਚ ਮੌਸਮ ਕਿਹੋ ਜਿਹਾ ਹੈ?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.language).toBe('pa');
    expect(res.body.answer).toMatch(/ਮੌਸਮ|ਤਾਪਮਾਨ|ਸਾਫ਼/i);
  });

  it('14. Should return official MoES Bulletin endpoint response', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .get('/api/moes/bulletin?location=Ahmedabad');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ministry).toMatch(/Ministry of Earth Sciences/i);
    expect(res.body.bulletin.agri).toBeDefined();
    expect(res.body.bulletin.marine).toBeDefined();
    expect(res.body.bulletin.suggestedFollowups).toBeDefined();
  });

  // Test 15: Specific intent queries (laundry, travel, humidity)
  it('15a. Should return intent-specific answer for laundry query "આજે મોરબીમાં કપડાં સુકવી શકાય?"', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'આજે મોરબીમાં કપડાં સુકવી શકાય?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer).toMatch(/કપડાં|સુકવવા/i);
  });

  it('15b. Should return intent-specific answer for travel query "આજે મુસાફરી કરી શકાય?"', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'આજે મુસાફરી કરી શકાય?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer).toMatch(/મુસાફરી|હવામાન|અનુકૂળ|રસ્તા/i);
  });

  it('15c. Should return intent-specific answer for humidity query "મોરબીમાં બફારો કેવો રહેશે?"', async () => {
    jest.spyOn(openMeteoProvider, 'getWeatherData').mockResolvedValueOnce(mockWeatherData);

    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'મોરબીમાં બફારો કેવો રહેશે?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer).toMatch(/ભેજ|બફારો/i);
  });
});

