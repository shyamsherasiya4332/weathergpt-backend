import { WeatherRiskScores } from '../risk/riskService.js';
import { WeatherData } from '../../types/weather.js';
import { logger } from '../../utils/logger.js';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon: string;
  badge: string;
  tag: string;
  data: {
    location: string;
    riskSeverity: string;
    rainProbability: number;
    urgencyLevel: 'info' | 'warning' | 'critical';
    timestamp: string;
  };
  channels: {
    fcmPayload: Record<string, unknown>;
    whatsappPayload: { recipientPhone?: string; message: string };
    webPushPayload: Record<string, unknown>;
  };
}

export class NotificationService {
  public generateNotificationPayload(
    weatherData: WeatherData,
    riskScores: WeatherRiskScores
  ): PushNotificationPayload | null {
    const locName = weatherData.location.name;
    const rainProb = weatherData.current.rainProbability || 0;
    const temp = weatherData.current.temperature;
    const isExtreme = riskScores.severity === 'extreme' || riskScores.severity === 'high' || rainProb >= 70;

    if (!isExtreme) {
      return null; // No emergency notification needed for low/normal risk
    }

    let urgencyLevel: PushNotificationPayload['data']['urgencyLevel'] = 'info';
    let title = `⚠️ Weather Alert: ${locName}`;
    let body = `High rain probability (${rainProb}%) detected in ${locName}. Temperature: ${temp}°C.`;
    let icon = '🌧️';

    if (riskScores.rain >= 80) {
      urgencyLevel = 'critical';
      title = `🌧️ Severe Rain & Flood Risk Alert - ${locName}`;
      body = `Heavy rainfall (rain probability ${rainProb}%) is expected. Carrying an umbrella/raincoat is mandatory.`;
      icon = '🌩️';
    } else if (riskScores.heat >= 80) {
      urgencyLevel = 'warning';
      title = `🥵 Heatwave Warning - ${locName}`;
      body = `Extreme heat (${temp}°C) detected in ${locName}. Stay hydrated and avoid outdoor exposure.`;
      icon = '☀️';
    }

    const timestamp = new Date().toISOString();

    const payload: PushNotificationPayload = {
      title,
      body,
      icon,
      badge: '/badge-icon.png',
      tag: `weather-alert-${locName.toLowerCase()}`,
      data: {
        location: locName,
        riskSeverity: riskScores.severity,
        rainProbability: rainProb,
        urgencyLevel,
        timestamp
      },
      channels: {
        fcmPayload: {
          notification: { title, body, icon },
          data: { location: locName, urgency: urgencyLevel }
        },
        whatsappPayload: {
          message: `*MoES WeatherGPT Alert*\n\n${title}\n${body}\n\nLocation: ${locName}\nTime: ${timestamp}`
        },
        webPushPayload: {
          title,
          body,
          icon,
          tag: `weather-alert-${locName.toLowerCase()}`
        }
      }
    };

    logger.info(`Generated emergency notification payload for ${locName} (${urgencyLevel.toUpperCase()})`);
    return payload;
  }
}

export const notificationService = new NotificationService();
