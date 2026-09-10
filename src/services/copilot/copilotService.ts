import { geocodingService } from '../geocoding/geocodingService.js';
import { openMeteoProvider } from '../weather/weatherService.js';
import { ResolvedLocation } from '../../types/weather.js';
import { logger } from '../../utils/logger.js';

export type ActivityType = 'wedding' | 'sports' | 'travel' | 'farming' | 'outdoor_event' | 'daily_activity';

export interface CopilotPlanInput {
  activityType: ActivityType;
  location: string;
  latitude?: number;
  longitude?: number;
  date?: string;
  timeRange?: string;
  language?: string;
}

export interface WeatherFactorSummary {
  temperature: number;
  feelsLike: number;
  rainProbability: number;
  rainAmountMm: number;
  windSpeed: number;
  humidity: number;
  uvIndex: number;
  condition: string;
}

export interface CopilotPlanResult {
  activityType: ActivityType;
  location: string;
  recommendation: 'Favorable' | 'Caution Advised' | 'Not Recommended';
  bestTimeWindow: string;
  confidence: number;
  reasoning: string;
  weatherFactors: WeatherFactorSummary;
  guidance: string[];
}

export class CopilotService {
  async generatePlan(input: CopilotPlanInput): Promise<CopilotPlanResult> {
    const lang = (input.language || 'en').toLowerCase();
    const isGu = lang === 'gu' || lang.startsWith('gu');
    const isHi = lang === 'hi' || lang.startsWith('hi');

    let resolvedLocation: ResolvedLocation = {
      name: input.location || 'Rajkot',
      latitude: 22.3,
      longitude: 70.79,
      country: 'India',
      timezone: 'Asia/Kolkata'
    };

    if (input.latitude !== undefined && input.longitude !== undefined) {
      resolvedLocation = {
        name: input.location || 'Custom Location',
        latitude: input.latitude,
        longitude: input.longitude,
        country: 'India',
        timezone: 'Asia/Kolkata'
      };
    } else {
      try {
        const geoResult = await geocodingService.geocode(input.location || 'Rajkot');
        if (geoResult.success && geoResult.location) {
          resolvedLocation = geoResult.location;
        }
      } catch (err) {
        logger.warn(`Geocoding fallback used for copilot plan: ${err}`);
      }
    }

    const weatherData = await openMeteoProvider.getWeatherData(resolvedLocation);
    const current = weatherData.current;
    const hourly = weatherData.hourly || [];

    const weatherFactors: WeatherFactorSummary = {
      temperature: current.temperature ?? 30,
      feelsLike: current.apparentTemperature ?? 32,
      rainProbability: current.rainProbability ?? 10,
      rainAmountMm: current.precipitation ?? 0,
      windSpeed: current.windSpeed ?? 15,
      humidity: current.humidity ?? 55,
      uvIndex: current.uvIndex ?? 6,
      condition: current.condition || 'Sunny'
    };

    // Calculate best 3-hour window
    let bestTimeWindow = '09:00 - 12:00';
    if (hourly.length >= 24) {
      let minScore = 999;
      let bestStartHour = 9;
      for (let h = 6; h <= 18; h++) {
        const windowHours = hourly.slice(h, h + 3);
        const avgRainProb = windowHours.reduce((acc, x) => acc + (x.precipitationProbability || 0), 0) / windowHours.length;
        const avgWind = windowHours.reduce((acc, x) => acc + (x.windSpeed || 0), 0) / windowHours.length;
        const score = avgRainProb * 2 + avgWind;
        if (score < minScore) {
          minScore = score;
          bestStartHour = h;
        }
      }
      const endHour = Math.min(bestStartHour + 3, 23);
      bestTimeWindow = `${bestStartHour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:00`;
    }

    // Recommendation logic & confidence calculation
    let recommendation: 'Favorable' | 'Caution Advised' | 'Not Recommended' = 'Favorable';
    let confidence = 92;
    const guidance: string[] = [];
    let reasoning = '';

    const { rainProbability, windSpeed, temperature, humidity } = weatherFactors;

    if (rainProbability > 60 || windSpeed > 40 || temperature > 42) {
      recommendation = 'Not Recommended';
      confidence = 88;
    } else if (rainProbability > 30 || windSpeed > 25 || temperature > 37 || humidity > 85) {
      recommendation = 'Caution Advised';
      confidence = 85;
    } else {
      recommendation = 'Favorable';
      confidence = 94;
    }

    // Activity specific guidance & reasoning
    switch (input.activityType) {
      case 'wedding':
        if (recommendation === 'Not Recommended') {
          reasoning = isGu
            ? `ઉંચો વરસાદી ચાન્સ (${rainProbability}%) અને પવનની ગતિ (${windSpeed} km/h) ને લીધે ખુલ્લા મંડપ માટે વાતાવરણ સાનુકૂળ નથી.`
            : isHi
            ? `उच्च वर्षा की संभावना (${rainProbability}%) और तेज हवा (${windSpeed} km/h) के कारण बाहरी शादी समारोह के लिए मौसम अनुकूल नहीं है।`
            : `High rain probability (${rainProbability}%) and strong winds (${windSpeed} km/h) make outdoor wedding setups vulnerable.`;
          guidance.push(
            isGu ? 'વોટરપ્રૂફ શેડ અથવા ઇન્ડોર હોલ નક્કી રાખવો.' : isHi ? 'वाटरप्रूफ शेड या इंडोर हॉल आरक्षित रखें।' : 'Secure a waterproof backup indoor venue.',
            isGu ? 'ઇલેક્ટ્રિકલ સાધનો કવર્ડ વિસ્તારમાં રાખવા.' : isHi ? 'बिजली के उपकरण कवर क्षेत्र में रखें।' : 'Keep sound and lighting equipment in sheltered areas.'
          );
        } else if (recommendation === 'Caution Advised') {
          reasoning = isGu
            ? `સાંજે વાદળછાયું વાતાવરણ અને ${rainProbability}% વરસાદની શક્યતા રહેલી છે.`
            : isHi
            ? `शाम को बादल छाए रहने और ${rainProbability}% वर्षा की संभावना है।`
            : `Moderate cloudiness and ${rainProbability}% rain chance expected.`;
          guidance.push(
            isGu ? 'મહેમાનો માટે છત્રી અને કવર સાઈડ ટેન્ટ રાખવા.' : isHi ? 'छतरियों और शेड का इंतजाम रखें।' : 'Keep umbrella stations and side canopy walls ready.',
            isGu ? 'બપોરે ગરમી માટે કૂલિંગ ફેન મૂકવા.' : isHi ? 'कूलिंग फैन की व्यवस्था करें।' : 'Deploy evaporative cooling fans for guest comfort.'
          );
        } else {
          reasoning = isGu
            ? `વાતાવરણ ચોખ્ખું અને આઉટડોર પ્રસંગ માટે ઉત્તમ છે.`
            : isHi
            ? `मौसम साफ और बाहरी कार्यक्रम के लिए उत्तम है।`
            : `Weather conditions are ideal for outdoor celebrations.`;
          guidance.push(
            isGu ? 'આઉટડોર ફોટોગ્રાફી અને પ્રસંગ માટે સાનુકૂળ સમય.' : isHi ? 'बाहरी फोटोग्राफी के लिए बेहतरीन समय।' : 'Optimal conditions for outdoor dining and photography.'
          );
        }
        break;

      case 'sports':
        if (recommendation === 'Not Recommended') {
          reasoning = isGu
            ? `વરસાદ અને ભીના મેદાનને કારણે રમત રમી શકાય તેમ નથી.`
            : isHi
            ? `बारिश और गीले मैदान के कारण खेल खेलना सुरक्षित नहीं है।`
            : `Rain probability (${rainProbability}%) and wet ground pose slipping hazards.`;
          guidance.push(
            isGu ? 'ઇન્ડોર કોર્ટ અથવા આગામી દિવસે મેચ રિશેડ્યુલ કરવી.' : isHi ? 'मैच रीशेड्यूल करें।' : 'Reschedule or move to an indoor arena.'
          );
        } else {
          reasoning = isGu
            ? `રમતગમત માટે તાપમાન (${temperature}°C) અને પવન અનુકૂળ છે.`
            : isHi
            ? `खेल के लिए तापमान और हवा अनुकूल है।`
            : `Favorable thermal comfort for athletic activities.`;
          guidance.push(
            isGu ? 'ખેલાડીઓ માટે પૂરતું પાણી અને ORS રાખવું.' : isHi ? 'पर्याप्त पानी और इलेक्ट्रोलाइट्स रखें।' : 'Maintain adequate hydration and electrolyte intake.',
            isGu ? `શ્રેષ્ઠ સમયગાળો: ${bestTimeWindow}` : isHi ? `सर्वोत्तम समय: ${bestTimeWindow}` : `Best activity window: ${bestTimeWindow}`
          );
        }
        break;

      case 'travel':
        if (recommendation === 'Not Recommended') {
          reasoning = isGu
            ? `ભારે વરસાદ/પવનને લીધે મુસાફરીમાં વિલંબ થઈ શકે છે.`
            : isHi
            ? `भारी बारिश/हवा के कारण यात्रा में देरी हो सकती है।`
            : `Adverse conditions with elevated rain/wind risks.`;
          guidance.push(
            isGu ? 'હાઇવે પર ડ્રાઇવિંગ કરતી વખતે ઝડપ નિયંત્રણમાં રાખવી.' : isHi ? 'हाईवे पर गति नियंत्रित रखें।' : 'Postpone high-speed highway transit if possible.'
          );
        } else {
          reasoning = isGu
            ? `મુસાફરી અને રોડ ટ્રીપ માટે વાતાવરણ સુરક્ષિત છે.`
            : isHi
            ? `यात्रा और रोड ट्रिप के लिए मौसम सुरक्षित है।`
            : `Clear visibility and smooth transit expected.`;
          guidance.push(
            isGu ? 'આનંદદાયક મુસાફરી માટે સવારનો સમય પસંદ કરવો.' : isHi ? 'सुबह का समय यात्रा के लिए सर्वश्रेष्ठ है।' : 'Morning departure provides the best road condition.'
          );
        }
        break;

      case 'farming':
        if (rainProbability > 50) {
          reasoning = isGu
            ? `વરસાદી શક્યતા (${rainProbability}%) હોવાથી દવા છંટકાવ કરવો નહીં.`
            : isHi
            ? `वर्षा की संभावना (${rainProbability}%) के कारण कीटनाशक छिड़काव न करें।`
            : `High rain probability (${rainProbability}%) makes pesticide spraying ineffective.`;
          guidance.push(
            isGu ? 'પિયત આપવાનું બંધ રાખવું.' : isHi ? 'सिंचाई रोक दें।' : 'Defer irrigation and chemical application.',
            isGu ? 'તૈયાર પાકને સુરક્ષિત જગ્યાએ ઢાંકીને રાખવો.' : isHi ? 'फसल को सुरक्षित ढककर रखें।' : 'Cover harvested produce with tarpaulins.'
          );
        } else {
          reasoning = isGu
            ? `ખેતકાર્યો અને જંતુનાશક છંટકાવ માટે યોગ્ય હવામાન.`
            : isHi
            ? `खेत के कामों और छिड़काव के लिए उपयुक्त मौसम।`
            : `Good window for field operations and chemical spraying.`;
          guidance.push(
            isGu ? `હળવા પિયત માટે સવારનો સમય (${bestTimeWindow}) ઉત્તમ.` : isHi ? `सिंचाई के लिए सुबह का समय उत्तम।` : `Morning hours (${bestTimeWindow}) optimal for irrigation.`
          );
        }
        break;

      default:
        reasoning = isGu
          ? `આઉટડોર પ્રવૃત્તિઓ માટે વાતાવરણ સ્ક્રીનિંગ પૂર્ણ થયેલ છે.`
          : isHi
          ? `बाहरी गतिविधियों के लिए मौसम जांच पूर्ण।`
          : `General outdoor event conditions evaluated successfully.`;
        guidance.push(
          isGu ? `શ્રેષ્ઠ સમયગાળો: ${bestTimeWindow}` : isHi ? `सर्वोत्तम समय: ${bestTimeWindow}` : `Recommended outdoor window: ${bestTimeWindow}`
        );
        break;
    }

    return {
      activityType: input.activityType,
      location: resolvedLocation.name,
      recommendation,
      bestTimeWindow,
      confidence,
      reasoning,
      weatherFactors,
      guidance
    };
  }
}

export const copilotService = new CopilotService();
