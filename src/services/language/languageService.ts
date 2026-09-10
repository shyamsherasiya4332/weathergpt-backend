import { logger } from '../../utils/logger.js';

export interface LanguageInfo {
  code: string;        // ISO code
  name: string;        // Full name
  script: string;      // Script name
  confidence: number;  // 0-1
  isMixed: boolean;    // true if mixed languages detected
  secondaryLanguage?: string;
}

export class LanguageService {
  private readonly devanagariKeywords: Record<string, string[]> = {
    hi: ['hai', 'aur', 'main', 'ho', 'ki', 'ka', 'ko', 'mein', 'ne', 'par', 'है', 'और', 'मैं', 'हो', 'की', 'का', 'को', 'में', 'ने', 'पर'],
    mr: ['ahe', 'ani', 'mi', 'aahe', 'आहे', 'आणि', 'मी', 'माझे', 'तुझे', 'होते', 'कसे', 'हवामान', 'मध्ये', 'आज', 'कसा', 'कशी', 'झाले', 'काय', 'नाही', 'पुणे', 'मुंबई', 'kase', 'hawaman', 'ahe', 'madhye', 'aaj', 'kasa', 'kashi'],
    sa: ['api', 'ca', 'iti', 'tat', 'अस्ति', 'च', 'अपि', 'इति', 'तत्'],
    kok: ['asa', 'ani', 'hav', 'आसा', 'आणि', 'हांव'],
    mai: ['chhi', 'rahal', 'kaha', 'अछि', 'रहल', 'कहल'],
    brx: ['gwzwn', 'jwng', 'ni', 'गोजोन', 'जों', 'नि'],
    doi: ['aey', 'karan', 'ai', 'ऐ', 'करन'],
  };

  public detect(text: string): LanguageInfo {
    const isDevanagari = /[\u0900-\u097F]/.test(text);
    const isLatin = /[a-zA-Z]/.test(text);
    const isGujarati = /[\u0A80-\u0AFF]/.test(text);
    const isBengaliAssamese = /[\u0980-\u09FF]/.test(text); // Bengali or Assamese
    const isTamil = /[\u0B80-\u0BFF]/.test(text);
    const isTelugu = /[\u0C00-\u0C7F]/.test(text);
    const isKannada = /[\u0C80-\u0CFF]/.test(text);
    const isMalayalam = /[\u0D00-\u0D7F]/.test(text);
    const isGurmukhi = /[\u0A00-\u0A7F]/.test(text);
    const isOdia = /[\u0B00-\u0B7F]/.test(text);
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const isMeetei = /[\uABC0-\uABFF]/.test(text);

    let primaryCode = 'en';
    let primaryName = 'English';
    let script = 'Latin';
    let secondaryLanguage = undefined;
    
    if (isDevanagari) {
      primaryCode = 'hi';
      primaryName = 'Hindi';
      script = 'Devanagari';
      
      const words = text.split(/\s+/);
      const scores: Record<string, number> = { hi: 0, mr: 0, sa: 0, kok: 0, mai: 0, brx: 0, doi: 0 };
      
      for (const word of words) {
        const w = word.toLowerCase();
        for (const [lang, keywords] of Object.entries(this.devanagariKeywords)) {
          if (keywords.includes(w)) {
            scores[lang]++;
          }
        }
      }
      
      let bestLang = 'hi';
      let maxScore = 0;
      for (const [lang, score] of Object.entries(scores)) {
        if (score > maxScore) {
          maxScore = score;
          bestLang = lang;
        }
      }
      
      if (maxScore > 0) {
        const langMap: Record<string, string> = { hi: 'Hindi', mr: 'Marathi', sa: 'Sanskrit', kok: 'Konkani', mai: 'Maithili', brx: 'Bodo', doi: 'Dogri' };
        primaryCode = bestLang;
        primaryName = langMap[bestLang] || 'Hindi';
      }
    } else if (isGujarati) {
      primaryCode = 'gu'; primaryName = 'Gujarati'; script = 'Gujarati';
    } else if (isBengaliAssamese) {
      primaryCode = 'bn'; primaryName = 'Bengali'; script = 'Bengali';
    } else if (isTamil) {
      primaryCode = 'ta'; primaryName = 'Tamil'; script = 'Tamil';
    } else if (isTelugu) {
      primaryCode = 'te'; primaryName = 'Telugu'; script = 'Telugu';
    } else if (isKannada) {
      primaryCode = 'kn'; primaryName = 'Kannada'; script = 'Kannada';
    } else if (isMalayalam) {
      primaryCode = 'ml'; primaryName = 'Malayalam'; script = 'Malayalam';
    } else if (isGurmukhi) {
      primaryCode = 'pa'; primaryName = 'Punjabi'; script = 'Gurmukhi';
    } else if (isOdia) {
      primaryCode = 'or'; primaryName = 'Odia'; script = 'Odia';
    } else if (isArabic) {
      primaryCode = 'ur'; primaryName = 'Urdu'; script = 'Arabic';
    } else if (isMeetei) {
      primaryCode = 'mni'; primaryName = 'Manipuri'; script = 'Meetei Mayek';
    } else if (isLatin && this.isHinglish(text)) {
      primaryCode = 'hinglish'; primaryName = 'Hinglish'; script = 'Latin';
    }

    const scriptsPresent = [isDevanagari, isLatin, isGujarati, isBengaliAssamese, isTamil, isTelugu, isKannada, isMalayalam, isGurmukhi, isOdia, isArabic, isMeetei].filter(Boolean).length;
    const isMixed = scriptsPresent > 1 || (isLatin && primaryCode !== 'en' && primaryCode !== 'hinglish');

    if (isMixed && primaryCode !== 'en' && isLatin) {
      secondaryLanguage = 'en';
    }

    return {
      code: primaryCode,
      name: primaryName,
      script,
      confidence: 0.85,
      isMixed,
      secondaryLanguage,
    };
  }

  public getLanguageName(code: string): string {
    const names: Record<string, string> = {
      en: 'English', hi: 'Hindi', gu: 'Gujarati', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
      kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', or: 'Odia', as: 'Assamese', mr: 'Marathi',
      ur: 'Urdu', sa: 'Sanskrit', kok: 'Konkani', mai: 'Maithili', sd: 'Sindhi', ks: 'Kashmiri',
      mni: 'Manipuri', brx: 'Bodo', doi: 'Dogri', hinglish: 'Hinglish'
    };
    return names[code.toLowerCase()] || 'Unknown';
  }

  public isIndicScript(text: string): boolean {
    return /[\u0900-\u0D7F\uABC0-\uABFF]/.test(text);
  }
  
  private isHinglish(text: string): boolean {
    const hinglishWords = ['hai', 'kya', 'aur', 'bhai', 'haan', 'nahi', 'karo', 'chalo', 'main', 'tum', 'me', 'mein', 'kal', 'hoga', 'hogi', 'aaje', 'varsad', 'padse', 'kab', 'ho', 'bhi', 'toh', 'par', 'per', 'batao', 'kaisa', 'kaisi'];
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    return words.some(w => hinglishWords.includes(w));
  }
}

export const languageService = new LanguageService();
