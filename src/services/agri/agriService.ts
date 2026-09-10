import { geocodingService } from '../geocoding/geocodingService.js';
import { openMeteoProvider } from '../weather/weatherService.js';
import { AgriAdvisoryResult } from '../../types/api.js';
import { logger } from '../../utils/logger.js';

class AgriService {
  /**
   * Smart Crop / Kisan Advisory Engine
   * Generates tailored agricultural guidance in Gujarati, Hindi, and English based on live weather API forecasts.
   */
  public async generateAgriAdvisory(
    locationName?: string,
    lat?: number,
    lon?: number,
    cropType?: string,
    language: string = 'en'
  ): Promise<AgriAdvisoryResult> {
    const lang = language.toLowerCase();
    let targetLat = lat ?? 22.30;
    let targetLon = lon ?? 70.79;
    let locName = locationName || 'Rajkot';

    if (locationName && (lat === undefined || lon === undefined)) {
      try {
        const geoRes = await geocodingService.geocode(locationName);
        if (geoRes.success && geoRes.location) {
          targetLat = geoRes.location.latitude;
          targetLon = geoRes.location.longitude;
          locName = geoRes.location.name;
        }
      } catch {
        // Fallback
      }
    }

    let rainProb = 15;
    let humidity = 55;
    let windSpeed = 12;
    let temp = 30;

    try {
      const weatherData = await openMeteoProvider.getWeatherData({
        name: locName,
        latitude: targetLat,
        longitude: targetLon,
        timezone: 'Asia/Kolkata'
      });
      rainProb = weatherData.current.rainProbability ?? 15;
      humidity = weatherData.current.humidity ?? 55;
      windSpeed = weatherData.current.windSpeed ?? 12;
      temp = Math.round(weatherData.current.temperature);
    } catch {
      // Fallback defaults
    }

    // Calculate Krishi Index (0-100 score for farming activities)
    let krishiIndex = 90;
    if (rainProb >= 70) krishiIndex -= 40;
    else if (rainProb >= 40) krishiIndex -= 20;

    if (windSpeed >= 25) krishiIndex -= 20;
    else if (windSpeed >= 18) krishiIndex -= 10;

    if (temp >= 40) krishiIndex -= 20;

    krishiIndex = Math.max(20, Math.min(100, krishiIndex));

    // Determine Crop Risk Level
    let cropRiskLevel: AgriAdvisoryResult['cropRiskLevel'] = 'LOW';
    if (rainProb >= 75 || temp >= 42) cropRiskLevel = 'CRITICAL';
    else if (rainProb >= 50 || windSpeed >= 30) cropRiskLevel = 'HIGH';
    else if (rainProb >= 30 || windSpeed >= 20) cropRiskLevel = 'MODERATE';

    // Pesticide Suitability Logic
    let pesticideSuitability: AgriAdvisoryResult['pesticideSuitability'] = 'SUITABLE';
    let pesticideReason = 'Low wind speed and clear conditions ideal for spraying.';

    if (rainProb >= 40) {
      pesticideSuitability = 'UNSUITABLE';
      pesticideReason = 'High chance of rainfall will wash away sprayed chemicals.';
    } else if (windSpeed >= 20) {
      pesticideSuitability = 'CAUTION';
      pesticideReason = 'Wind speed above 20 km/h causes severe chemical drift.';
    }

    // Multilingual Advisory Text
    let irrigationAdvice = '';
    let soilMoistureEstimate = '';
    let nextRainWindow = '';
    const cropAdviceList: string[] = [];

    if (lang.includes('gu')) {
      // Gujarati Language Advisory
      if (rainProb >= 50) {
        irrigationAdvice = `આજે સિંચાઈ મુલતવી રાખવી. સાંજે ${rainProb}% વરસાદની શક્યતા છે.`;
        soilMoistureEstimate = 'ઉચ્ચ ભેજ (વરસાદને કારણે કુદરતી ભેજ પ્રાપ્ત થશે)';
        nextRainWindow = `સાંજના સમયે (${rainProb}% શક્યતા)`;
      } else {
        irrigationAdvice = 'સામાન્ય હળવી સિંચાઈ કરી શકાય છે. વાતાવરણ અનુકૂળ છે.';
        soilMoistureEstimate = 'મધ્યમ (સામાન્ય)';
        nextRainWindow = 'આગામી 24 કલાકમાં વરસાદની શક્યતા નહિવત છે.';
      }

      if (pesticideSuitability === 'UNSUITABLE') {
        pesticideReason = 'વરસાદની શક્યતા હોવાથી દવા છંટકાવ કરશો નહીં, દવા ધોવાઈ જશે.';
      }

      cropAdviceList.push(`પાક: ${cropType || 'કપાસ / મગફળી / ઘઉં'}`);
      cropAdviceList.push(irrigationAdvice);
      cropAdviceList.push(`જંતુનાશક છંટકાવ: ${pesticideSuitability} (${pesticideReason})`);
      cropAdviceList.push('ખેતરમાં પાણીના નિકાલની યોગ્ય વ્યવસ્થા જાળવી રાખવી.');
    } else if (lang.includes('hi')) {
      // Hindi Language Advisory
      if (rainProb >= 50) {
        irrigationAdvice = `आज सिंचाई न करें। शाम को ${rainProb}% बारिश की संभावना है।`;
        soilMoistureEstimate = 'उच्च नमी (वर्षा के कारण पर्याप्त नमी मिलेगी)';
        nextRainWindow = `शाम के समय (${rainProb}% संभावना)`;
      } else {
        irrigationAdvice = 'सामान्य हल्की सिंचाई कर सकते हैं। मौसम अनुकूल है।';
        soilMoistureEstimate = 'मध्यम (सामान्य)';
        nextRainWindow = 'अगले 24 घंटों में बारिश की संभावना कम है।';
      }

      if (pesticideSuitability === 'UNSUITABLE') {
        pesticideReason = 'बारिश की संभावना के कारण कीटनाशक का छिड़काव न करें।';
      }

      cropAdviceList.push(`फसल: ${cropType || 'कपास / मूंगफली / गेहूं'}`);
      cropAdviceList.push(irrigationAdvice);
      cropAdviceList.push(`कीटनाशक छिड़काव: ${pesticideSuitability} (${pesticideReason})`);
      cropAdviceList.push('खेतों में जल निकासी की उचित व्यवस्था रखें।');
    } else {
      // English Language Advisory
      if (rainProb >= 50) {
        irrigationAdvice = `Postpone irrigation today due to ${rainProb}% expected rainfall in the evening.`;
        soilMoistureEstimate = 'High (Natural moisture expected from rain)';
        nextRainWindow = `Evening window (${rainProb}% probability)`;
      } else {
        irrigationAdvice = 'Normal light irrigation recommended. Weather is favorable.';
        soilMoistureEstimate = 'Moderate (Optimal)';
        nextRainWindow = 'No significant rain expected in next 24 hours.';
      }

      cropAdviceList.push(`Target Crop: ${cropType || 'General Crops (Cotton/Groundnut/Wheat)'}`);
      cropAdviceList.push(irrigationAdvice);
      cropAdviceList.push(`Pesticide Suitability: ${pesticideSuitability} - ${pesticideReason}`);
      cropAdviceList.push('Ensure proper drainage channels in field lowlands.');
    }

    return {
      locationName: locName,
      krishiIndex,
      cropRiskLevel,
      irrigationAdvice,
      pesticideSuitability,
      pesticideReason,
      soilMoistureEstimate,
      nextRainWindow,
      language: lang,
      cropAdviceList
    };
  }
}

export const agriService = new AgriService();
