import crypto from 'crypto';
import { geocodingService } from '../geocoding/geocodingService.js';
import { openMeteoProvider } from '../weather/weatherService.js';
import { ResolvedLocation, WeatherData } from '../../types/weather.js';
import { WeatherRiskScores } from '../risk/riskService.js';
import { makeService } from '../make/makeService.js';
import { logger } from '../../utils/logger.js';

// ─── Push Notification Payload (merged from notifications/notificationService) ───

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

export type TriggerType = 'rain' | 'heat' | 'flood' | 'wind';

export interface NotificationRule {
  id: string;
  location: string;
  triggerType: TriggerType;
  threshold: number; // e.g. rain probability (%), temperature (°C), wind speed (km/h), or flood risk score
  frequency: 'daily' | 'hourly' | 'realtime';
  channel: 'make' | 'webhook';
  webhookUrl?: string;
  createdAt: string;
  lastTriggeredAt?: string;
  active: boolean;
}

export interface ScheduleNotificationInput {
  location: string;
  triggerType: TriggerType;
  threshold: number;
  frequency?: 'daily' | 'hourly' | 'realtime';
  channel?: 'make' | 'webhook';
  webhookUrl?: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  location: string;
  triggerType: TriggerType;
  threshold: number;
  currentValue: number;
  triggered: boolean;
  message: string;
  webhookDispatched: boolean;
}

export class NotificationService {
  private rules: Map<string, NotificationRule> = new Map();

  constructor() {
    // Seed default smart rules for major cities
    this.scheduleNotificationRule({
      location: 'Rajkot',
      triggerType: 'rain',
      threshold: 60,
      frequency: 'realtime',
      channel: 'make'
    });
    this.scheduleNotificationRule({
      location: 'Ahmedabad',
      triggerType: 'heat',
      threshold: 40,
      frequency: 'daily',
      channel: 'make'
    });
  }

  // ─── Emergency Push Notification Generator (merged from notifications/) ───

  public generateNotificationPayload(
    weatherData: WeatherData,
    riskScores: WeatherRiskScores
  ): PushNotificationPayload | null {
    const locName = weatherData.location.name;
    const rainProb = weatherData.current.rainProbability || 0;
    const temp = weatherData.current.temperature;
    const isExtreme = riskScores.severity === 'extreme' || riskScores.severity === 'high' || rainProb >= 70;

    if (!isExtreme) {
      return null;
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

  // ─── Rule-Based Smart Notification Scheduling ───

  scheduleNotificationRule(input: ScheduleNotificationInput): NotificationRule {
    const id = `rule_${crypto.randomUUID().slice(0, 8)}`;
    const rule: NotificationRule = {
      id,
      location: input.location,
      triggerType: input.triggerType,
      threshold: input.threshold,
      frequency: input.frequency || 'realtime',
      channel: input.channel || 'make',
      webhookUrl: input.webhookUrl,
      createdAt: new Date().toISOString(),
      active: true
    };

    this.rules.set(id, rule);
    logger.info(`Scheduled notification rule ${id} for ${rule.location} (${rule.triggerType} > ${rule.threshold})`);
    return rule;
  }

  getNotificationRules(location?: string): NotificationRule[] {
    const list = Array.from(this.rules.values());
    if (location) {
      return list.filter((r) => r.location.toLowerCase() === location.toLowerCase());
    }
    return list;
  }

  async evaluateRulesForLocation(locationName: string): Promise<RuleEvaluationResult[]> {
    let resolvedLocation: ResolvedLocation = {
      name: locationName,
      latitude: 22.3,
      longitude: 70.79,
      country: 'India',
      timezone: 'Asia/Kolkata'
    };

    try {
      const geoResult = await geocodingService.geocode(locationName);
      if (geoResult.success && geoResult.location) {
        resolvedLocation = geoResult.location;
      }
    } catch (err) {
      logger.warn(`Geocoding failed during notification evaluation: ${err}`);
    }

    const weatherData = await openMeteoProvider.getWeatherData(resolvedLocation);
    const current = weatherData.current;

    const rainProb = current.rainProbability ?? 0;
    const temp = current.temperature ?? 0;
    const wind = current.windSpeed ?? 0;
    const precip = current.precipitation ?? 0;

    const matchingRules = Array.from(this.rules.values()).filter(
      (r) => r.active && r.location.toLowerCase() === resolvedLocation.name.toLowerCase()
    );

    const rulesToEvaluate: NotificationRule[] = matchingRules.length > 0 ? matchingRules : [
      {
        id: `auto_${crypto.randomUUID().slice(0, 8)}`,
        location: resolvedLocation.name,
        triggerType: 'rain' as TriggerType,
        threshold: 50,
        frequency: 'realtime' as const,
        channel: 'make' as const,
        createdAt: new Date().toISOString(),
        active: true
      }
    ];

    const results: RuleEvaluationResult[] = [];

    for (const rule of rulesToEvaluate) {
      let currentValue = 0;
      let triggered = false;
      let alertMsg = '';

      switch (rule.triggerType) {
        case 'rain':
          currentValue = rainProb;
          triggered = currentValue >= rule.threshold;
          alertMsg = `Rain trigger alert for ${rule.location}: Current rain probability is ${currentValue}% (Threshold: ${rule.threshold}%).`;
          break;
        case 'heat':
          currentValue = temp;
          triggered = currentValue >= rule.threshold;
          alertMsg = `Extreme heat trigger alert for ${rule.location}: Temperature reached ${currentValue}°C (Threshold: ${rule.threshold}°C).`;
          break;
        case 'wind':
          currentValue = wind;
          triggered = currentValue >= rule.threshold;
          alertMsg = `High wind speed alert for ${rule.location}: Wind speed at ${currentValue} km/h (Threshold: ${rule.threshold} km/h).`;
          break;
        case 'flood':
          currentValue = precip > 0 ? precip * 2.5 : rainProb * 0.8;
          triggered = currentValue >= rule.threshold;
          alertMsg = `Flood risk alert for ${rule.location}: Computed flood risk index is ${Math.round(currentValue)} (Threshold: ${rule.threshold}).`;
          break;
      }

      let webhookDispatched = false;
      if (triggered) {
        rule.lastTriggeredAt = new Date().toISOString();
        const dispatchRes = await makeService.triggerWebhook({
          event: `smart_notification_${rule.triggerType}`,
          location: rule.location,
          rain_probability: rainProb,
          rain_amount_mm: precip,
          forecast_time: current.time || new Date().toISOString(),
          message: alertMsg,
          timestamp: new Date().toISOString()
        });
        webhookDispatched = dispatchRes.success;
      }

      results.push({
        ruleId: rule.id,
        location: rule.location,
        triggerType: rule.triggerType,
        threshold: rule.threshold,
        currentValue,
        triggered,
        message: alertMsg,
        webhookDispatched
      });
    }

    return results;
  }
}

export const notificationService = new NotificationService();
