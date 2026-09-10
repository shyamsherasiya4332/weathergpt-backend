import { WeatherData, RainAnalysisResult } from '../../types/weather.js';
import { WeatherRiskScores } from '../risk/riskService.js';
import { languageService } from '../language/languageService.js';

export interface MoESAgriBulletin {
  kisanIndex: number;            // 0-100 Suitability Index
  sprayingCondition: 'Ideal' | 'Moderate' | 'Unfavorable';
  irrigationAdvice: string;
  cropProtection: string;
  badgeEmoji: string;
}

export interface MoESMarineBulletin {
  seaVentureStatus: 'SAFE' | 'CAUTION' | 'DANGER_DO_NOT_VENTURE';
  coastalWindKmh: number;
  waveCondition: 'Normal' | 'Moderate Waves' | 'High Swell Risk';
  fishermenWarning: string;
  badgeEmoji: string;
}

export interface MoESExtremeAlert {
  alertLevel: 'RED_ALERT' | 'ORANGE_ALERT' | 'YELLOW_ALERT' | 'GREEN_NORMAL';
  title: string;
  protocol: string;
  badgeColor: string;
}

export interface MoESBulletin {
  agri: MoESAgriBulletin;
  marine: MoESMarineBulletin;
  alert: MoESExtremeAlert;
  climateFact: string;
  suggestedFollowups: string[];
  uiWidgets: Array<{
    type: string;
    title: string;
    data: any;
  }>;
}

export class MoESService {
  public generateBulletin(
    weatherData: WeatherData,
    rainAnalysis: RainAnalysisResult,
    riskScores: WeatherRiskScores,
    language: string,
    question: string
  ): MoESBulletin {
    const agri = this.generateAgriBulletin(weatherData, rainAnalysis, riskScores, language);
    const marine = this.generateMarineBulletin(weatherData, riskScores, language);
    const alert = this.generateExtremeAlert(weatherData, riskScores, language);
    const climateFact = this.getClimateFact(language);
    const suggestedFollowups = this.generateSuggestedFollowups(question, language);

    const uiWidgets = [
      {
        type: 'extreme_alert_badge',
        title: alert.title,
        data: { alertLevel: alert.alertLevel, protocol: alert.protocol, color: alert.badgeColor }
      },
      {
        type: 'kisan_advisory_card',
        title: '🌱 MoES Kisan Krishi Weather Bulletin',
        data: agri
      },
      {
        type: 'samudra_marine_card',
        title: '🌊 MoES Coastal & Fishermen Advisory',
        data: marine
      },
      {
        type: 'suggested_chips',
        title: '💡 Smart Interactive Follow-ups',
        data: suggestedFollowups
      }
    ];

    return {
      agri,
      marine,
      alert,
      climateFact,
      suggestedFollowups,
      uiWidgets
    };
  }

  private generateAgriBulletin(
    weatherData: WeatherData,
    rainAnalysis: RainAnalysisResult,
    riskScores: WeatherRiskScores,
    language: string
  ): MoESAgriBulletin {
    const temp = weatherData.current.temperature;
    const rainProb = rainAnalysis.maxRainProbability;
    const wind = weatherData.current.windSpeed;

    let kisanIndex = 85;
    let sprayingCondition: MoESAgriBulletin['sprayingCondition'] = 'Ideal';
    let irrigationAdvice = '';
    let cropProtection = '';

    if (rainProb > 60) {
      kisanIndex = 40;
      sprayingCondition = 'Unfavorable';
      irrigationAdvice = language === 'gu' ? 'વરસાદની ઊંચી શક્યતાને લીધે પાકને પાણી આપવાનું મોકૂફ રાખો.' :
                         language === 'hi' ? 'उच्च बारिश की संभावना के कारण सिंचाई स्थगित रखें।' :
                         language === 'pa' ? 'ਮੀਂਹ ਦੀ ਵਧੇਰੇ ਸੰਭਾਵਨਾ ਕਾਰਨ ਸਿੰਚਾਈ ਮੁਲਤਵੀ ਰੱਖੋ।' :
                         'Postpone irrigation due to high rain probability.';
      cropProtection = language === 'gu' ? 'ખેતરમાંથી વધારાના પાણીના નિકાલની વ્યવસ્થા કરો.' :
                       language === 'hi' ? 'खेत में जलभराव रोकने के लिए जल निकासी सुनिश्चित करें।' :
                       language === 'pa' ? 'ਖੇਤਾਂ ਵਿੱਚੋਂ ਵਾਧੂ ਪਾਣੀ ਦੇ ਨਿਕਾਸ ਦਾ ਪ੍ਰਬੰਧ ਕਰੋ।' :
                       'Ensure field drainage to prevent waterlogging.';
    } else if (temp > 36) {
      kisanIndex = 60;
      sprayingCondition = wind > 20 ? 'Unfavorable' : 'Moderate';
      irrigationAdvice = language === 'gu' ? 'તીવ્ર ગરમીથી બચાવવા માટે વહેલી સવારે અથવા સાંજે સિંચાઈ કરો.' :
                         language === 'hi' ? 'कड़ी धूप से बचाव के लिए सुबह या शाम के समय सिंचाई करें।' :
                         language === 'pa' ? 'ਗਰਮੀ ਤੋਂ ਬਚਾਅ ਲਈ ਸਵੇਰੇ ਜਾਂ ਸ਼ਾਮ ਨੂੰ ਸਿੰਚਾਈ ਕਰੋ।' :
                         'Irrigate during early morning or evening to reduce heat stress.';
      cropProtection = language === 'gu' ? 'પાકને હળવું મલ્ચિંગ આપો.' :
                       language === 'hi' ? 'फसलों में नमी बनाए रखने हेतु मलचिंग का प्रयोग करें।' :
                       'Use mulching to preserve soil moisture.';
    } else {
      irrigationAdvice = language === 'gu' ? 'સામાન્ય સિંચાઈ શિડ્યુલ ચાલુ રાખો.' :
                         language === 'hi' ? 'सामान्य सिंचाई दिनचर्या बनाए रखें।' :
                         'Maintain normal irrigation routine.';
      cropProtection = language === 'gu' ? 'પાક અને વાતાવરણ સાનુકૂળ છે.' :
                       language === 'hi' ? 'फसल विकास के लिए मौसम अनुकूल है।' :
                       'Weather is optimal for crop growth.';
    }

    return {
      kisanIndex,
      sprayingCondition,
      irrigationAdvice,
      cropProtection,
      badgeEmoji: '🌾'
    };
  }

  private generateMarineBulletin(
    weatherData: WeatherData,
    riskScores: WeatherRiskScores,
    language: string
  ): MoESMarineBulletin {
    const wind = weatherData.current.windSpeed;
    const isStormy = weatherData.current.weatherCode >= 80 || riskScores.wind > 60;

    let seaVentureStatus: MoESMarineBulletin['seaVentureStatus'] = 'SAFE';
    let waveCondition: MoESMarineBulletin['waveCondition'] = 'Normal';
    let fishermenWarning = '';

    if (wind > 45 || isStormy) {
      seaVentureStatus = 'DANGER_DO_NOT_VENTURE';
      waveCondition = 'High Swell Risk';
      fishermenWarning = language === 'gu' ? '🚨 MoES ચેતવણી: દરિયામાં ઊંચા મોજા અને ભારે પવનની શક્યતા! માછીમારોએ દરિયામાં ન જવું.' :
                         language === 'hi' ? '🚨 MoES चेतावनी: समुद्र में ऊंची लहरें और तेज हवाएं! मछुआरे समुद्र में न जाएं।' :
                         language === 'pa' ? '🚨 MoES ਚੇਤਾਵਨੀ: ਸਮੁੰਦਰ ਵਿੱਚ ਉੱਚੀਆਂ ਲਹਿਰਾਂ ਅਤੇ ਤੇਜ਼ ਹਵਾਵਾਂ! ਮਛਿਆਰੇ ਸਮੁੰਦਰ ਵਿੱਚ ਨਾ ਜਾਣ।' :
                         '🚨 MoES ALERT: High waves & strong winds! Fishermen strictly advised NOT to venture into the sea.';
    } else if (wind > 25) {
      seaVentureStatus = 'CAUTION';
      waveCondition = 'Moderate Waves';
      fishermenWarning = language === 'gu' ? '⚠️ MoES સાવધાની: દરિયામાં પવનની ઝડપ મધ્યમ રહેશે. સાવચેતીપૂર્વક કામગીરી કરવી.' :
                         language === 'hi' ? '⚠️ MoES सावधानी: समुद्र में हवा मध्यम रहेगी। सावधानी बरतें।' :
                         '⚠️ MoES CAUTION: Moderate sea waves expected. Venture with caution.';
    } else {
      fishermenWarning = language === 'gu' ? '✅ MoES અપડેટ: દરિયાઈ વાતાવરણ શાંત અને અનુકૂળ છે.' :
                         language === 'hi' ? '✅ MoES अपडेट: समुद्री स्थिति सामान्य एवं अनुकूल है।' :
                         '✅ MoES UPDATE: Coastal weather is calm and normal for marine activities.';
    }

    return {
      seaVentureStatus,
      coastalWindKmh: wind,
      waveCondition,
      fishermenWarning,
      badgeEmoji: '🌊'
    };
  }

  private generateExtremeAlert(
    weatherData: WeatherData,
    riskScores: WeatherRiskScores,
    language: string
  ): MoESExtremeAlert {
    const overall = riskScores.overall;

    if (overall >= 75) {
      return {
        alertLevel: 'RED_ALERT',
        title: language === 'gu' ? '🚨 MoES રેડ એલર્ટ - અતિ ગંભીર હવામાન' :
               language === 'hi' ? '🚨 MoES रेड अलर्ट - अत्यंत गंभीर मौसम' :
               '🚨 MoES CRITICAL RED ALERT',
        protocol: language === 'gu' ? 'ઘરમાં સુરક્ષિત રહો. બિનજરૂરી પ્રવાસ ટાળો અને ઈમરજન્સી હેલ્પલાઈન તૈયાર રાખો.' :
                  language === 'hi' ? 'सुरक्षित स्थान पर रहें। अनावश्यक यात्रा से बचें और आपातकालीन नंबर संभालें।' :
                  'Stay indoors immediately. Avoid non-essential travel and stay tuned to official MoES/IMD bulletins.',
        badgeColor: '#FF1744'
      };
    }

    if (overall >= 50) {
      return {
        alertLevel: 'ORANGE_ALERT',
        title: language === 'gu' ? '🟧 MoES ઓરેન્જ એલર્ટ - સાવચેતી જરૂરી' :
               language === 'hi' ? '🟧 MoES ऑरेंज अलर्ट - सतर्क रहें' :
               '🟧 MoES ORANGE ALERT - BE PREPARED',
        protocol: language === 'gu' ? 'વરસાદ અથવા ગરમી સામે તૈયારી રાખો. બહાર નીકળતી વખતે હવામાન અપડેટ ચકાસો.' :
                  language === 'hi' ? 'बारिश या धूप से बचाव की तैयारी रखें। बाहर निकलते समय मौसम अपडेट देखें।' :
                  'Be prepared. Carry umbrella or hydration supplies and follow local weather warnings.',
        badgeColor: '#FF9100'
      };
    }

    if (overall >= 25) {
      return {
        alertLevel: 'YELLOW_ALERT',
        title: language === 'gu' ? '🟨 MoES યલો એલર્ટ - હવામાનમાં ફેરફાર' :
               language === 'hi' ? '🟨 MoES येलो अलर्ट - सचेत रहें' :
               '🟨 MoES YELLOW ALERT - BE AWARE',
        protocol: language === 'gu' ? 'હવામાનમાં ફેરફાર પર નજર રાખો.' :
                  language === 'hi' ? 'मौसम के बदलावों पर नजर रखें।' :
                  'Be aware of changing local weather conditions.',
        badgeColor: '#FFEA00'
      };
    }

    return {
      alertLevel: 'GREEN_NORMAL',
      title: language === 'gu' ? '🟩 MoES ગ્રીન - વાતાવરણ સામાન્ય' :
             language === 'hi' ? '🟩 MoES ग्रीन - सामान्य मौसम' :
             '🟩 MoES GREEN - NORMAL WEATHER',
      protocol: language === 'gu' ? 'વાતાવરણ સુરક્ષિત અને સાનુકૂળ છે.' :
                language === 'hi' ? 'मौसम पूरी तरह सुरक्षित है।' :
                'Weather conditions are safe and pleasant.',
      badgeColor: '#00E676'
    };
  }

  private getClimateFact(language: string): string {
    const factsGu = [
      '💡 MoES અને IMD સમગ્ર ભારતમાં 24x7 ડોપ્લર વેધર રડાર અને INSAT સેટેલાઇટ નેટવર્કથી લાઈવ હવામાન મોનિટર કરે છે.',
      '💡 IMD ની સ્થાપના 1875 માં થઈ હતી અને તે વિશ્વની સૌથી જૂની વેધર સાયન્સ એજન્સીઓ પૈકીની એક છે.',
      '💡 યોગ્ય હવામાન આગાહી દ્વારા ભારતમાં દર વર્ષે હજારો ખેડૂતો અને માછીમારોના જીવન અને પાકનું રક્ષણ થાય છે.'
    ];

    const factsHi = [
      '💡 MoES और IMD डोपलर वेदर रडार एवं INSAT उपग्रहों के माध्यम से 24x7 मौसम की निगरानी करते हैं।',
      '💡 भारतीय मौसम विज्ञान विभाग (IMD) की स्थापना 1875 में हुई थी और यह विश्व की सबसे पुरानी एजेंसियों में से एक है।',
      '💡 सटीक मौसम पूर्वानुमान से हर साल लाखों किसानों एवं मछुआरों को सुरक्षा मिलती है।'
    ];

    const factsEn = [
      '💡 MoES & IMD monitor weather 24/7 using Doppler Weather Radar networks and INSAT satellites across India.',
      '💡 Did you know? India Meteorological Department (IMD) was established in 1875 and is one of the oldest weather institutes globally!',
      '💡 Early weather alerts provided by MoES safeguard millions of agricultural crops and coastal livelihoods annually.'
    ];

    const pool = language === 'gu' ? factsGu : language === 'hi' ? factsHi : factsEn;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private generateSuggestedFollowups(question: string, language: string): string[] {
    const isGu = language === 'gu' || /[\u0A80-\u0AFF]/.test(question);
    const isHi = language === 'hi' || /[\u0900-\u097F]/.test(question);
    const isHinglish = language === 'hinglish';
    const isPa = language === 'pa' || /[\u0A00-\u0A7F]/.test(question);

    if (isGu) {
      return [
        '🌱 ખેડૂત પાક અને સિંચાઈ સલાહ (Kisan Weather Advisory)',
        '🕒 કલાકવાર તાપમાન અને વરસાદ ચાર્ટ (Hourly Forecast)',
        '⚠️ પૂર અને વાવાઝોડાનું રિસ્ક સ્કોર (Disaster Risk Score)',
        '🌊 માછીમારો માટે દરિયાઈ ચેતવણી (Fishermen Coastal Alert)'
      ];
    }

    if (isHi) {
      return [
        '🌱 किसान कृषि एवं फसल सलाह (Kisan Weather Advisory)',
        '🕒 प्रति घंटा मौसम विवरण (Hourly Forecast)',
        '⚠️ आपदा एवं बारिश जोखिम स्कोर (Disaster Risk Score)',
        '🌊 मछुआरों के लिए समुद्री चेतावनी (Fishermen Coastal Alert)'
      ];
    }

    if (isPa) {
      return [
        '🌱 ਕਿਸਾਨ ਖੇਤੀ ਮੌਸਮ ਸਲਾਹ (Kisan Weather Advisory)',
        '🕒 ਹਰ ਘੰਟੇ ਦਾ ਮੌਸਮ ਬਿਓਰਾ (Hourly Forecast)',
        '⚠️ ਹੜ੍ਹ ਅਤੇ ਤੂਫ਼ਾਨ ਦਾ ਖ਼ਤਰਾ (Disaster Risk Score)',
        '🌊 ਮਛਿਆਰਿਆਂ ਲਈ ਸਮੁੰਦਰੀ ਚੇਤਾਵਨੀ (Fishermen Coastal Alert)'
      ];
    }

    if (isHinglish) {
      return [
        '🌱 Kisan Kheti Weather Advisory',
        '🕒 Hourly Temperature & Rain Chart',
        '⚠️ Disaster & Flood Risk Score',
        '🌊 Fishermen Coastal Marine Alert'
      ];
    }

    return [
      '🌱 Farmer Crop & Irrigation Advisory',
      '🕒 Hourly Weather Breakdown Chart',
      '⚠️ Disaster & Climate Risk Assessment',
      '🌊 Fishermen Coastal Marine Warning'
    ];
  }
}

export const moesService = new MoESService();
