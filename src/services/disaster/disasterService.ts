import { DisasterAlert, EmergencyGuidance } from '../../types/api.js';
import { WeatherData, RainAnalysisResult } from '../../types/weather.js';
import { WeatherRiskScores } from '../risk/riskService.js';
import { randomUUID } from 'crypto';

export class DisasterService {
  public generateDisasterAlerts(
    weatherData: WeatherData,
    rainAnalysis: RainAnalysisResult,
    riskScores: WeatherRiskScores
  ): DisasterAlert[] {
    const alerts: DisasterAlert[] = [];
    const nowIso = new Date().toISOString();
    const locName = weatherData.location.name;

    // 1. Flood Alert
    if (rainAnalysis.totalRainAmountMm > 35 || rainAnalysis.maxRainProbability > 75 || riskScores.flood > 65) {
      alerts.push({
        id: randomUUID(),
        type: 'flood',
        severity: riskScores.flood > 80 ? 'CRITICAL' : 'WARNING',
        title: `🌊 Flood Risk Warning for ${locName}`,
        description: `Heavy rainfall up to ${rainAnalysis.totalRainAmountMm} mm expected with high risk of urban waterlogging and river overflow.`,
        advice: [
          'Move valuable items to higher ground.',
          'Avoid driving through flooded underpasses.',
          'Keep emergency contact numbers handy.'
        ],
        affectedZone: `${locName} low-lying areas and surrounding basins`,
        issuedAt: nowIso
      });
    }

    // 2. Cyclone / Strong Wind Alert
    if (weatherData.current.windSpeed > 50 || riskScores.wind > 70) {
      alerts.push({
        id: randomUUID(),
        type: 'cyclone',
        severity: weatherData.current.windSpeed > 70 ? 'CRITICAL' : 'WARNING',
        title: `🌀 High Wind / Cyclonic Gust Alert for ${locName}`,
        description: `Severe wind speeds of ~${weatherData.current.windSpeed} km/h detected. Threat to weak structures and falling trees.`,
        advice: [
          'Stay away from glass windows and loose billboard structures.',
          'Secure loose outdoor objects.',
          'Fishermen must strictly avoid venturing into open waters.'
        ],
        affectedZone: `${locName} & coastal/open plains`,
        issuedAt: nowIso
      });
    }

    // 3. Lightning / Thunderstorm Alert
    if (weatherData.current.weatherCode >= 95 || riskScores.rain > 85) {
      alerts.push({
        id: randomUUID(),
        type: 'lightning',
        severity: 'CRITICAL',
        title: `⚡ Severe Thunderstorm & Lightning Hazard for ${locName}`,
        description: `Active cloud-to-ground lightning activity and localized hailstorms detected.`,
        advice: [
          'Do NOT take shelter under tall trees or metal poles.',
          'Unplug sensitive electronic appliances.',
          'Stay inside enclosed brick buildings or vehicles.'
        ],
        affectedZone: `${locName} sub-districts`,
        issuedAt: nowIso
      });
    }

    // 4. Extreme Heatwave Alert
    if (weatherData.current.temperature >= 40 || riskScores.heat > 75) {
      alerts.push({
        id: randomUUID(),
        type: 'extreme_heat',
        severity: weatherData.current.temperature >= 43 ? 'CRITICAL' : 'WARNING',
        title: `🔥 Severe Heatwave Warning for ${locName}`,
        description: `Peak temperature reaching ${weatherData.current.temperature}°C with severe heat stress.`,
        advice: [
          'Avoid direct sunlight between 12:00 PM and 4:00 PM.',
          'Drink ORS, lemon water, and stay hydrated.',
          'Never leave children or pets inside parked vehicles.'
        ],
        affectedZone: `${locName} metro & rural areas`,
        issuedAt: nowIso
      });
    }

    return alerts;
  }

  public getEmergencyGuidance(type: EmergencyGuidance['disasterType'], language: string = 'en'): EmergencyGuidance {
    const isGu = language === 'gu';
    const isHi = language === 'hi';

    const helplines = [
      { name: 'National Emergency Response (NDRF)', number: '112' },
      { name: 'State Disaster Management Authority (SDMA)', number: '1070' },
      { name: 'District Emergency Center', number: '1077' },
      { name: 'Ambulance Medical Support', number: '108' }
    ];

    if (type === 'cyclone') {
      return {
        disasterType: 'cyclone',
        title: isGu ? '🌀 વાવાઝોડા (Cyclone) સમયના ઈમરજન્સી સુરક્ષા પ્રોટોકોલ' :
               isHi ? '🌀 चक्रवात (Cyclone) के लिए आपातकालीन सुरक्षा दिशानिर्देश' :
               '🌀 Cyclone Emergency Safety Protocols',
        summary: isGu ? 'વાવાઝોડા અને ભારે પવન સામે રક્ષણ મેળવવા માટે તાત્કાલિક ઘરમાં જ રહો.' :
                 isHi ? 'चक्रवात और तेज हवाओं से बचाव के लिए तुरंत सुरक्षित भवन में रहें।' :
                 'Emergency safety rules during severe cyclonic wind gusts.',
        dos: [
          isGu ? 'ઘરની બારીઓ અને દરવાજા ચુસ્ત બંધ રાખો.' : 'घर के दरवाजे और खिड़कियां कसकर बंद रखें।',
          isGu ? 'ઈમરજન્સી લાઈટ, રેડિયો અને પીવાનું પાણી તૈયાર રાખો.' : 'टॉर्च, इमरजेंसी लाइट और पीने का पानी स्टोर रखें।',
          isGu ? 'સુરક્ષિત પાકા મકાનમાં જ રહો.' : 'केवल पक्के मकान में ही शरण लें।'
        ],
        donts: [
          isGu ? 'ઝાડ અથવા વીજળીના થાંભલા નીચે ઊભા રહેશો નહીં.' : 'पेड़ों या बिजली के खंभों के नीचे खड़े न हों।',
          isGu ? 'જૂના કે જર્જરીત કાચા મકાનમાં ન રહો.' : 'कच्चे या जर्जर मकान में न रहें।',
          isGu ? 'દરિયાકિનારે જવાનું સખત મનાઈ છે.' : 'समुद्र तट की ओर जाने की भूल न करें।'
        ],
        helplines
      };
    }

    if (type === 'flood') {
      return {
        disasterType: 'flood',
        title: isGu ? '🌊 પૂર (Flood) સામે ઈમરજન્સી સુરક્ષા માર્ગદર્શિકા' :
               isHi ? '🌊 बाढ़ (Flood) के लिए आपातकालीन सुरक्षा निर्देश' :
               '🌊 Flood Emergency Safety Protocols',
        summary: isGu ? 'પૂરના પાણીથી બચવા ઊંચાઈવાળા વિસ્તારમાં આશ્રય લો.' :
                 isHi ? 'बाढ़ के पानी से बचने के लिए ऊंचे स्थानों पर शरण लें।' :
                 'Essential rules during heavy downpour and urban flooding.',
        dos: [
          isGu ? 'મહત્વની વસ્તુઓ અને પીવાનું પાણી ઊંચા સ્થળે ખસેડો.' : 'कीमती सामान और पीने का पानी ऊपर शिफ्ट करें।',
          isGu ? 'રેડિયો અને સ્થાનિક વહીવટીતંત્રની સૂચનાઓ અનુસરો.' : 'प्रशासन की आधिकारिक घोषणाएं सुनें।'
        ],
        donts: [
          isGu ? 'પૂરના પાણીમાં ચાલવાનો કે વાહન ચલાવવાનો પ્રયાસ ન કરો.' : 'बाढ़ के बहते पानी में गाड़ी न चलाएं।',
          isGu ? 'વીજળીના વાયરોને સ્પર્શ કરશો નહીં.' : 'पानी में डूबे बिजली के तारों को न छुएं।'
        ],
        helplines
      };
    }

    if (type === 'lightning') {
      return {
        disasterType: 'lightning',
        title: isGu ? '⚡ વીજળી અને વાવાઝોડા સમયની સુરક્ષા માર્ગદર્શિકા' :
               isHi ? '⚡ बिजली चमकने और तड़पने पर सुरक्षा दिशानिर्देश' :
               '⚡ Lightning & Thunderstorm Safety Protocols',
        summary: isGu ? 'વીજળીના કડાકા વખતે ખુલ્લા મેદાન કે ઝાડ નીચે ન રહેવું.' :
                 isHi ? 'बिजली कड़कने के समय खुले मैदान या पेड़ के नीचे न रहें।' :
                 'Emergency actions during active lightning strikes.',
        dos: [
          isGu ? 'તરત જ બંધ મકાન અથવા કારમાં જતા રહો.' : 'तुरंत बंद पक्के मकान या कार के अंदर जाएं।',
          isGu ? 'ઈલેક્ટ્રોનિક વસ્તુઓના પ્લગ કાઢી નાખો.' : 'बिजली के उपकरणों के प्लग निकाल दें।'
        ],
        donts: [
          isGu ? 'ઊંચા ઝાડ કે ધાતુના થાંભલા નીચે આશ્રય ન લો.' : 'पेड़ों या लोहे के खंभों के नीचे शरण न लें।',
          isGu ? 'ખુલ્લા મેદાનમાં છત્રી લાઈને ઊભા ન રહો.' : 'खुले खेत में छाता लेकर खड़े न हों।'
        ],
        helplines
      };
    }

    return {
      disasterType: 'general',
      title: isGu ? '⚠️ આપત્તિ વ્યવસ્થાપન જનરલ ગાઈડલાઈન' :
             isHi ? '⚠️ आपदा प्रबंधन सामान्य दिशानिर्देश' :
             '⚠️ General Disaster Safety Protocols',
      summary: 'General emergency survival and alert guidelines.',
      dos: [
        'Stay calm and follow official advisory warnings.',
        'Keep emergency supplies and power banks charged.'
      ],
      donts: [
        'Do not spread unverified rumors.',
        'Do not ignore Red/Orange weather alerts.'
      ],
      helplines
    };
  }
}

export const disasterService = new DisasterService();
