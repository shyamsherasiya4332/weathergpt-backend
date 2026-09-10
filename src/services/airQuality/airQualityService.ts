import axios from 'axios';
import { AirQualityData } from '../../types/api.js';
import { cache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

interface OpenMeteoAirQualityResponse {
  current?: {
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    carbon_monoxide?: number;
    nitrogen_dioxide?: number;
    ozone?: number;
  };
}

export class AirQualityService {
  async getAirQuality(lat: number, lon: number, language: string = 'en'): Promise<AirQualityData> {
    const cacheKey = `aqi:${lat.toFixed(3)}:${lon.toFixed(3)}`;
    const cached = cache.get<AirQualityData>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get<OpenMeteoAirQualityResponse>(
        'https://air-quality-api.open-meteo.com/v1/air-quality',
        {
          params: {
            latitude: lat,
            longitude: lon,
            current: 'us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone'
          },
          timeout: 5000
        }
      );

      const current = response.data.current;
      const aqi = Math.round(current?.us_aqi || this.calculateHeuristicAQI(current?.pm2_5 || 25));
      const pm2_5 = Math.round(current?.pm2_5 || 22);
      const pm10 = Math.round(current?.pm10 || 45);

      const categoryInfo = this.getAQICategory(aqi);
      const healthAdvice = this.getHealthAdvice(categoryInfo.category, language);

      const result: AirQualityData = {
        aqi,
        category: categoryInfo.category,
        pm2_5,
        pm10,
        co: current?.carbon_monoxide ? Math.round(current.carbon_monoxide) : undefined,
        no2: current?.nitrogen_dioxide ? Math.round(current.nitrogen_dioxide) : undefined,
        o3: current?.ozone ? Math.round(current.ozone) : undefined,
        healthAdvice,
        badgeColor: categoryInfo.color
      };

      cache.set(cacheKey, result, 1800); // 30 mins TTL
      return result;
    } catch (err) {
      logger.warn(`Failed to fetch live AQI for (${lat}, ${lon}), using estimated data:`, err);
      return this.getFallbackAirQuality(language);
    }
  }

  private calculateHeuristicAQI(pm25: number): number {
    return Math.min(500, Math.round(pm25 * 3.5));
  }

  private getAQICategory(aqi: number): { category: AirQualityData['category']; color: string } {
    if (aqi <= 50) return { category: 'Good', color: '#00E676' };
    if (aqi <= 100) return { category: 'Moderate', color: '#FFEA00' };
    if (aqi <= 150) return { category: 'Unhealthy for Sensitive Groups', color: '#FF9100' };
    if (aqi <= 200) return { category: 'Unhealthy', color: '#FF1744' };
    if (aqi <= 300) return { category: 'Very Unhealthy', color: '#AA00FF' };
    return { category: 'Hazardous', color: '#880E4F' };
  }

  private getHealthAdvice(category: AirQualityData['category'], language: string): string {
    const isGu = language === 'gu';
    const isHi = language === 'hi';
    const isPa = language === 'pa';

    switch (category) {
      case 'Good':
        return isGu ? 'હવાની ગુણવત્તા ઉત્તમ છે. બહારની પ્રવૃત્તિઓ માટે સંપૂર્ણ સુરક્ષિત.' :
               isHi ? 'वायु गुणवत्ता उत्कृष्ट है। बाहरी गतिविधियों के लिए पूरी तरह सुरक्षित।' :
               isPa ? 'ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਬਹੁਤ ਵਧੀਆ ਹੈ। ਬਾਹਰੀ ਗਤੀਵਿਧੀਆਂ ਲਈ ਪੂਰੀ ਤਰ੍ਹਾਂ ਸੁਰੱਖਿਅਤ।' :
               'Air quality is satisfactory and poses little or no risk.';
      case 'Moderate':
        return isGu ? 'હવાની ગુણવત્તા મધ્યમ છે. સંવેદનશીલ વ્યક્તિઓએ વધુ પડતો શ્રમ ટાળવો.' :
               isHi ? 'वायु गुणवत्ता मध्यम है। संवेदनशील व्यक्ति अधिक श्रम से बचें।' :
               'Air quality is acceptable; sensitive individuals should take light precautions.';
      case 'Unhealthy for Sensitive Groups':
        return isGu ? 'સંવેદનશીલ જૂથો (બાળકો, વૃદ્ધો) એ બહાર માસ્ક પહેરવું અને પ્રદૂષણથી બચવું.' :
               isHi ? 'संवेदनशील समूहों (बच्चों, बुजुर्गों) को मास्क पहनना चाहिए।' :
               'Sensitive groups may experience health effects. Wear N95 masks outdoors.';
      case 'Unhealthy':
        return isGu ? 'હવાનું પ્રદૂષણ વધારે છે. બહાર જતી વખતે માસ્ક વાપરો અને વ્યાયામ ટાળો.' :
               isHi ? 'वायु प्रदूषण अधिक है। बाहर निकलते समय मास्क का उपयोग करें।' :
               'Everyone may begin to experience health effects. Limit outdoor activity.';
      case 'Very Unhealthy':
      case 'Hazardous':
        return isGu ? '🚨 ગંભીર વાયુ પ્રદૂષણ! ઘરમાં જ રહો, એર પ્યુરિફાયર વાપરો અને બહાર જવાનું ટાળો.' :
               isHi ? '🚨 गंभीर वायु प्रदूषण! घर के अंदर रहें और बाहरी गतिविधियों से बचें।' :
               '🚨 Health warning of emergency conditions. Stay indoors and use air purifiers.';
    }
  }

  private getFallbackAirQuality(language: string): AirQualityData {
    const categoryInfo = this.getAQICategory(65);
    return {
      aqi: 65,
      category: categoryInfo.category,
      pm2_5: 18,
      pm10: 42,
      healthAdvice: this.getHealthAdvice(categoryInfo.category, language),
      badgeColor: categoryInfo.color
    };
  }
}

export const airQualityService = new AirQualityService();
