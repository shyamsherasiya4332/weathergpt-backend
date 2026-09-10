import { logger } from '../../utils/logger.js';

export interface AccessibilityFormatInput {
  text?: string;
  location?: string;
  language?: string;
  voiceFirst?: boolean;
  highContrast?: boolean;
  largeText?: boolean;
  weatherData?: {
    temperature?: number;
    condition?: string;
    rainProbability?: number;
    windSpeed?: number;
  };
}

export interface VoiceFirstMetadata {
  audioScript: string;
  language: string;
  voiceConfig: {
    preferredVoice: string;
    rate: number;
    pitch: number;
  };
}

export interface UIThemeAccessibility {
  highContrast: {
    enabled: boolean;
    contrastRatio: string;
    themeClass: string;
    backgroundHex: string;
    textHex: string;
    accentHex: string;
  };
  largeText: {
    enabled: boolean;
    scaleFactor: string;
    baseFontSizePx: number;
    lineHeightRatio: number;
  };
  screenReaderOptimized: boolean;
}

export interface AccessibilityFormatResult {
  voiceFirst: VoiceFirstMetadata;
  uiTheme: UIThemeAccessibility;
  formattedText: string;
}

export interface OfflineEmergencyPhrase {
  id: string;
  category: 'cyclone' | 'flood' | 'lightning' | 'heavy_rain' | 'extreme_heat';
  english: string;
  gujarati: string;
  hindi: string;
  audioPromptKey: string;
}

export class AccessibilityService {
  formatAccessibility(input: AccessibilityFormatInput): AccessibilityFormatResult {
    const lang = (input.language || 'en').toLowerCase();
    const isGu = lang === 'gu' || lang.startsWith('gu');
    const isHi = lang === 'hi' || lang.startsWith('hi');

    const temp = input.weatherData?.temperature ?? 30;
    const cond = input.weatherData?.condition || 'Sunny';
    const rain = input.weatherData?.rainProbability ?? 10;
    const location = input.location || 'Rajkot';

    let audioScript = input.text || '';
    if (!audioScript) {
      if (isGu) {
        audioScript = `${location} માં હાલનું તાપમાન ${temp} અંશ સેલ્સિયસ છે અને વાતાવરણ ${cond} છે. વરસાદની શક્યતા ${rain} ટકા છે.`;
      } else if (isHi) {
        audioScript = `${location} में वर्तमान तापमान ${temp} डिग्री सेल्सियस है और मौसम ${cond} है। बारिश की संभावना ${rain} प्रतिशत है।`;
      } else {
        audioScript = `Current weather in ${location}: ${temp} degrees Celsius, ${cond}. Rain probability is ${rain} percent.`;
      }
    }

    const preferredVoice = isGu ? 'gu-IN-Standard-A' : isHi ? 'hi-IN-Neural2-A' : 'en-US-Neural2-F';

    const voiceFirst: VoiceFirstMetadata = {
      audioScript,
      language: isGu ? 'gu-IN' : isHi ? 'hi-IN' : 'en-US',
      voiceConfig: {
        preferredVoice,
        rate: 0.9, // slightly slower for maximum accessibility speech clarity
        pitch: 1.0
      }
    };

    const uiTheme: UIThemeAccessibility = {
      highContrast: {
        enabled: Boolean(input.highContrast),
        contrastRatio: input.highContrast ? '15.5:1 (AAA Pass)' : '4.5:1 (AA Standard)',
        themeClass: input.highContrast ? 'theme-high-contrast-dark' : 'theme-standard',
        backgroundHex: input.highContrast ? '#000000' : '#FFFFFF',
        textHex: input.highContrast ? '#FFFF00' : '#1F2937',
        accentHex: input.highContrast ? '#00FFFF' : '#3B82F6'
      },
      largeText: {
        enabled: Boolean(input.largeText),
        scaleFactor: input.largeText ? '1.40x' : '1.00x',
        baseFontSizePx: input.largeText ? 24 : 16,
        lineHeightRatio: input.largeText ? 1.7 : 1.5
      },
      screenReaderOptimized: true
    };

    return {
      voiceFirst,
      uiTheme,
      formattedText: audioScript
    };
  }

  getOfflineEmergencyPhrases(category?: string): OfflineEmergencyPhrase[] {
    const phrases: OfflineEmergencyPhrase[] = [
      {
        id: 'phrase_cyclone_1',
        category: 'cyclone',
        english: 'Severe Cyclone Alert: Stay inside sturdy shelter immediately. Avoid coastal areas.',
        gujarati: 'વાવાઝોડાની ચેતવણી: તુરંત મજબૂત આશ્રયસ્થાને રહો. દરિયાકિનારા વિસ્તારથી દૂર રહો.',
        hindi: 'चक्रवात अलर्ट: तुरंत मजबूत पक्के आश्रय में रहें। तटीय क्षेत्रों से दूर रहें।',
        audioPromptKey: 'cyclone_shelter_alert'
      },
      {
        id: 'phrase_flood_1',
        category: 'flood',
        english: 'Flood Warning: Move to higher ground. Do not walk or drive through floodwaters.',
        gujarati: 'પૂરની ચેતવણી: ઊંચાઈવાળા વિસ્તાર તરફ જાઓ. પૂરના પાણીમાંથી ડ્રાઇવિંગ કરશો નહીં.',
        hindi: 'बाढ़ की चेतावनी: ऊंचे स्थानों पर जाएं। बहते पानी में गाड़ी न चलाएं।',
        audioPromptKey: 'flood_higher_ground'
      },
      {
        id: 'phrase_lightning_1',
        category: 'lightning',
        english: 'Lightning Threat: Take cover in a safe building or car. Stay away from tall trees and electric poles.',
        gujarati: 'વીજળીનો ભય: સુરક્ષિત મકાન અથવા કારમાં આશ્રય લો. ઊંચા વૃક્ષો અને વીજળીના થાંભલાથી દૂર રહો.',
        hindi: 'बिजली का खतरा: सुरक्षित पक्के मकान में आश्रय लें। ऊंचे पेड़ों और बिजली के खंभों से दूर रहें।',
        audioPromptKey: 'lightning_safety_building'
      },
      {
        id: 'phrase_heavy_rain_1',
        category: 'heavy_rain',
        english: 'Heavy Rainfall Warning: Expect localized waterlogging and low visibility.',
        gujarati: 'ભારે વરસાદની ચેતવણી: પાણી ભરાવાની અને દ્રશ્યતા ઘટવાની શક્યતા છે.',
        hindi: 'भारी बारिश की चेतावनी: जलभराव और कम दृश्यता की संभावना है।',
        audioPromptKey: 'heavy_rain_waterlogging'
      },
      {
        id: 'phrase_heat_1',
        category: 'extreme_heat',
        english: 'Extreme Heatwave Warning: Drink plenty of water and stay indoors during peak hours (12 PM - 4 PM).',
        gujarati: 'કાળઝાળ ગરમીની ચેતવણી: પુષ્કળ પાણી પીવો અને બપોરે ૧૨ થી ૪ ઘરની અંદર રહો.',
        hindi: 'भीषण लू की चेतावनी: प्रचुर मात्रा में पानी पीएं और दोपहर 12 से 4 बजे तक घर के अंदर रहें।',
        audioPromptKey: 'heatwave_hydration_stay_indoor'
      }
    ];

    if (category) {
      return phrases.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    return phrases;
  }
}

export const accessibilityService = new AccessibilityService();
