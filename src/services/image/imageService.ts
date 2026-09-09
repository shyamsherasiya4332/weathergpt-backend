import { WeatherData } from '../../types/weather.js';
import { WeatherRiskScores } from '../risk/riskService.js';

export interface WeatherInfographicCard {
  svgDataUri: string;
  locationName: string;
  temperature: number;
  condition: string;
  rainProbability: number;
  riskSeverity: string;
  generatedAt: string;
}

export class ImageService {
  public generateWeatherCardSvg(
    weatherData: WeatherData,
    riskScores: WeatherRiskScores
  ): WeatherInfographicCard {
    const locName = weatherData.location.name;
    const temp = Math.round(weatherData.current.temperature);
    const cond = weatherData.current.condition;
    const rainProb = weatherData.current.rainProbability || 0;
    const severity = riskScores.severity.toUpperCase();

    let bgGradient = '#0f172a, #1e293b';
    if (rainProb >= 70) bgGradient = '#0284c7, #0f172a';
    else if (temp >= 38) bgGradient = '#ea580c, #7c2d12';

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
        <defs>
          <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${bgGradient.split(',')[0].trim()}" />
            <stop offset="100%" stop-color="${bgGradient.split(',')[1].trim()}" />
          </linearGradient>
        </defs>
        <rect width="600" height="320" rx="24" fill="url(#cardBg)" />
        <text x="40" y="55" font-family="sans-serif" font-size="22" font-weight="bold" fill="#ffffff">${locName}</text>
        <text x="40" y="80" font-family="sans-serif" font-size="14" fill="#94a3b8">MoES WeatherGPT Live Forecast Card</text>
        
        <text x="40" y="160" font-family="sans-serif" font-size="64" font-weight="extrabold" fill="#ffffff">${temp}°C</text>
        <text x="40" y="195" font-family="sans-serif" font-size="18" fill="#e2e8f0">${cond}</text>
        
        <rect x="420" y="40" width="140" height="32" rx="16" fill="rgba(255,255,255,0.15)" />
        <text x="490" y="61" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">${severity} RISK</text>

        <line x1="40" y1="230" x2="560" y2="230" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
        
        <text x="40" y="270" font-family="sans-serif" font-size="14" fill="#cbd5e1">Rain Prob: ${rainProb}%</text>
        <text x="220" y="270" font-family="sans-serif" font-size="14" fill="#cbd5e1">Humidity: ${weatherData.current.humidity}%</text>
        <text x="400" y="270" font-family="sans-serif" font-size="14" fill="#cbd5e1">Wind: ${weatherData.current.windSpeed} km/h</text>
      </svg>
    `.trim();

    const encodedSvg = Buffer.from(svgContent).toString('base64');
    const svgDataUri = `data:image/svg+xml;base64,${encodedSvg}`;

    return {
      svgDataUri,
      locationName: locName,
      temperature: temp,
      condition: cond,
      rainProbability: rainProb,
      riskSeverity: severity,
      generatedAt: new Date().toISOString()
    };
  }
}

export const imageService = new ImageService();
