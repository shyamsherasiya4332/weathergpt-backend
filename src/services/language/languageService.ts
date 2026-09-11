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
    } else if (isLatin) {
      const gujScore = this.getGujlishScore(text);
      const hinScore = this.getHinglishScore(text);

      if (hinScore > gujScore && hinScore > 0) {
        primaryCode = 'hinglish'; primaryName = 'Hinglish'; script = 'Latin';
      } else if (gujScore > 0) {
        primaryCode = 'gu'; primaryName = 'Gujarati'; script = 'Latin';
      }
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
      mni: 'Manipuri', brx: 'Bodo', doi: 'Dogri', hinglish: 'Hinglish (Hindi in Roman script)'
    };
    return names[code.toLowerCase()] || code;
  }

  public getCodeFromName(nameOrCode: string): string {
    if (!nameOrCode) return 'en';
    const clean = nameOrCode.trim().toLowerCase();

    // Direct code matches
    const codeMap: Record<string, string> = {
      en: 'en', english: 'en',
      hi: 'hi', hindi: 'hi', 'हिंदी': 'hi', 'हिन्दी': 'hi',
      gu: 'gu', gujarati: 'gu', 'ગુજરાતી': 'gu',
      mr: 'mr', marathi: 'mr', 'मराठी': 'mr',
      bn: 'bn', bengali: 'bn', bangla: 'bn', 'বাংলা': 'bn',
      ta: 'ta', tamil: 'ta', 'தமிழ்': 'ta',
      te: 'te', telugu: 'te', 'తెలుగు': 'te',
      kn: 'kn', kannada: 'kn', 'ಕನ್ನಡ': 'kn',
      ml: 'ml', malayalam: 'ml', 'മലയാളം': 'ml',
      pa: 'pa', punjabi: 'pa', 'ਪੰਜਾਬੀ': 'pa',
      or: 'or', odia: 'or', oriya: 'or', 'ଓଡ଼ିଆ': 'or',
      as: 'as', assamese: 'as', 'অসমীয়া': 'as',
      ur: 'ur', urdu: 'ur', 'اردو': 'ur',
      sa: 'sa', sanskrit: 'sa', 'संस्कृतम्': 'sa',
      kok: 'kok', konkani: 'kok', 'कोंकणी': 'kok',
      mai: 'mai', maithili: 'mai', 'मैथिली': 'mai',
      sd: 'sd', sindhi: 'sd',
      ks: 'ks', kashmiri: 'ks',
      mni: 'mni', manipuri: 'mni',
      brx: 'brx', bodo: 'brx',
      doi: 'doi', dogri: 'doi',
      hinglish: 'hinglish'
    };

    if (codeMap[clean]) return codeMap[clean];

    for (const [key, val] of Object.entries(codeMap)) {
      if (clean.includes(key)) return val;
    }

    return 'en';
  }

  public isIndicScript(text: string): boolean {
    return /[\u0900-\u0D7F\uABC0-\uABFF]/.test(text);
  }

  private getGujlishScore(text: string): number {
    const uniqueGujlish = [
      'varsad', 'padse', 'hase', 'kevi', 'kevo', 'kevu', 'chhe', 'bapore', 'savare', 'sanje', 'aaje',
      'vatavaran', 'ketlu', 'ketli', 'ketla', 'kem', 'cho', 'weatherkevu', 'puchhu', 'puchhune', 'puchhu',
      'joiae', 'aapu', 'aapi', 'thase', 'thashe', 'nakhine', 'toy', 'karyu', 'karyo', 'pelethi', 'kaisu',
      'tapman', 'hawaaman'
    ];
    const commonGujlish = [
      'che', 'nai', 'ke', 'paramdivas', 'thandi', 'garmi', 'uper', 'par', 'per', 'su', 'tamari', 'halo',
      'hu', 'je', 'ma', 'ne', 'te', 'j', 'tyare', 'ema', 'pan', 'kaik', 'lidhe', 'vandho', 'avto', 'hoi',
      'kar', 'apde', 'badhu', 'dye', 'tena', 'nu', 'ni', 'no', 'na', 'chhe', 'kero'
    ];

    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    let score = 0;
    for (const w of words) {
      if (uniqueGujlish.includes(w)) score += 2;
      else if (commonGujlish.includes(w)) score += 1;
    }
    return score;
  }
  
  private getHinglishScore(text: string): number {
    const uniqueHinglish = ['hoga', 'hogi', 'batao', 'kaisa', 'kaisi', 'kab', 'hai', 'mein', 'nahi', 'karo', 'main', 'tum', 'chahiye', 'bataye', 'hoga'];
    const commonHinglish = ['kya', 'kal', 'aur', 'bhai', 'haan', 'chalo', 'me', 'ho', 'bhi', 'toh', 'par', 'per', 'aaj', 'din', 'yeh', 'woh'];

    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    let score = 0;
    for (const w of words) {
      if (uniqueHinglish.includes(w)) score += 2;
      else if (commonHinglish.includes(w)) score += 1;
    }
    return score;
  }
}

export const languageService = new LanguageService();
