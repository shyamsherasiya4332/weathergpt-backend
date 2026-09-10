import { WeatherData } from '../../types/weather.js';
import { ShareCardResponse } from '../../types/api.js';
import { env } from '../../config/env.js';

class ShareService {
  /**
   * Generates a lightweight shareable weather card payload for social media and WhatsApp
   */
  public generateShareCard(locationName: string, weatherData?: WeatherData | any, customQuestion?: string): ShareCardResponse {
    const temp = weatherData?.current?.temperature ?? 30;
    const feelsLike = weatherData?.current?.apparentTemperature ?? temp;
    const condition = weatherData?.current?.condition ?? 'Clear Sky';
    const rainProb = weatherData?.current?.rainProbability ?? 10;
    const humidity = weatherData?.current?.humidity ?? 55;
    const windSpeed = weatherData?.current?.windSpeed ?? 12;

    const emoji = rainProb >= 60 ? '🌧️' : temp >= 35 ? '☀️' : '⛅';
    const title = `${emoji} Weather Forecast for ${locationName} - WeatherGPT`;
    const text = `${locationName}: ${temp}°C (${condition}), Rain Risk: ${rainProb}%. Powered by WeatherGPT (MoES).`;

    const formattedMessage =
      `🌦️ *WeatherGPT Live Report - ${locationName}*\n\n` +
      `🌡️ *Temperature*: ${temp}°C (Feels like ${feelsLike}°C)\n` +
      `☁️ *Condition*: ${condition}\n` +
      `🌧️ *Rain Probability*: ${rainProb}%\n` +
      `💧 *Humidity*: ${humidity}%\n` +
      `🍃 *Wind Speed*: ${windSpeed} km/h\n\n` +
      `💡 *AI Advisory*: ${rainProb >= 50 ? 'Keep an umbrella handy!' : 'Great weather for outdoor activities!'}\n\n` +
      `📲 *Get Live Weather Updates*: https://weathergpt-backend-46or.onrender.com`;

    const encodedLoc = encodeURIComponent(locationName);
    const shareUrl = `https://weathergpt-backend-46or.onrender.com/api/ask?location=${encodedLoc}`;

    const riskColor = rainProb >= 70 ? '#EF4444' : rainProb >= 40 ? '#F59E0B' : '#10B981';

    return {
      city: locationName,
      temperature: temp,
      rainProbability: rainProb,
      weatherIcon: emoji,
      riskColor,
      branding: 'WeatherGPT (Ministry of Earth Sciences)',
      title,
      text,
      formattedMessage,
      shareUrl,
      tags: ['#WeatherGPT', `#${locationName.replace(/\s+/g, '')}Weather`, '#MoES', '#SIH2024']
    };
  }
}

export const shareService = new ShareService();
