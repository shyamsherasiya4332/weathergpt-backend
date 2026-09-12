import { WeatherComparisonItem, WeatherComparisonResult } from '../../types/api.js';
import { weatherService } from '../weather/weatherService.js';
import { riskService } from '../risk/riskService.js';
import { logger } from '../../utils/logger.js';

export class ComparisonService {
  async compareLocations(locationNames: string[], language: string = 'en'): Promise<WeatherComparisonResult> {
    const cleanNames = Array.from(new Set(locationNames.map((n) => n.trim()))).filter(Boolean).slice(0, 5);

    if (cleanNames.length === 0) {
      cleanNames.push('Ahmedabad', 'Mumbai');
    } else if (cleanNames.length === 1) {
      cleanNames.push(cleanNames[0] === 'Mumbai' ? 'Ahmedabad' : 'Mumbai');
    }

    logger.info(`Comparing weather for locations: ${cleanNames.join(', ')}`);

    const weatherResults = await Promise.all(
      cleanNames.map((name) => weatherService.resolveAndFetchWeather(undefined, name))
    );

    const items: WeatherComparisonItem[] = [];

    for (let i = 0; i < cleanNames.length; i++) {
      const name = cleanNames[i];
      const res = weatherResults[i];

      if (res.weatherData) {
        const wd = res.weatherData;
        const rainAnalysis = weatherService.analyzeRainForecast(wd, { intent: 'GENERAL_WEATHER', isLocationNeeded: true, language, confidence: 1, needsPreviousContext: false });
        const risks = riskService.calculateRiskScores(wd, rainAnalysis);

        items.push({
          locationName: wd.location.name,
          temperature: Math.round(wd.current.temperature),
          condition: wd.current.condition,
          rainProbability: rainAnalysis.maxRainProbability,
          humidity: wd.current.humidity,
          windSpeed: wd.current.windSpeed,
          overallRisk: risks.overall,
          rank: 0
        });
      }
    }

    if (items.length === 0) {
      throw new Error('Failed to resolve weather data for comparison locations.');
    }

    // Sort & calculate rankings
    const sortedByTemp = [...items].sort((a, b) => b.temperature - a.temperature);
    const sortedByRain = [...items].sort((a, b) => b.rainProbability - a.rainProbability);
    const sortedByWind = [...items].sort((a, b) => b.windSpeed - a.windSpeed);
    const sortedByBest = [...items].sort((a, b) => a.overallRisk - b.overallRisk);

    // Assign overall rank based on lowest risk / best comfort
    sortedByBest.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    const warmest = sortedByTemp[0].locationName;
    const rainiest = sortedByRain[0].locationName;
    const windiest = sortedByWind[0].locationName;
    const bestWeather = sortedByBest[0].locationName;

    let summary = '';
    const isGu = language === 'gu';
    const isHi = language === 'hi';

    if (isGu) {
      summary = `સરખામણીમાં સૌથી વધુ તાપમાન **${warmest}** (${sortedByTemp[0].temperature}°C) માં છે. સૌથી વધુ વરસાદની શક્યતા **${rainiest}** (${sortedByRain[0].rainProbability}%) માં છે અને હવામાનની દ્રષ્ટિએ સૌથી સાનુકૂળ સ્થળ **${bestWeather}** છે.`;
    } else if (isHi) {
      summary = `तुलना में सबसे अधिक तापमान **${warmest}** (${sortedByTemp[0].temperature}°C) में है। सर्वाधिक बारिश की संभावना **${rainiest}** (${sortedByRain[0].rainProbability}%) में है और सबसे सुहावना मौसम **${bestWeather}** में है।`;
    } else {
      summary = `Among the compared cities, **${warmest}** has the highest temperature (${sortedByTemp[0].temperature}°C), **${rainiest}** has the highest rain chance (${sortedByRain[0].rainProbability}%), and **${bestWeather}** offers the overall most pleasant weather.`;
    }

    return {
      locations: items,
      rankings: {
        warmest,
        rainiest,
        windiest,
        bestWeather
      },
      summary
    };
  }
}

export const comparisonService = new ComparisonService();
