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
      const engScore = this.getEnglishScore(text);
      const gujScore = this.getGujlishScore(text);
      const hinScore = this.getHinglishScore(text);

      // If user asks in Gujlish or Hinglish (even mixed with words like weather, in, at, today)
      if (gujScore > 0 && gujScore >= hinScore && (gujScore >= engScore || gujScore >= 3)) {
        primaryCode = 'gu'; primaryName = 'Gujarati (Gujlish)'; script = 'Latin';
      } else if (hinScore > 0 && hinScore > gujScore && (hinScore >= engScore || hinScore >= 3)) {
        primaryCode = 'hinglish'; primaryName = 'Hinglish'; script = 'Latin';
      } else if (gujScore > 0 && gujScore > hinScore) {
        primaryCode = 'gu'; primaryName = 'Gujarati (Gujlish)'; script = 'Latin';
      } else if (hinScore > 0 && hinScore > gujScore) {
        primaryCode = 'hinglish'; primaryName = 'Hinglish'; script = 'Latin';
      } else {
        primaryCode = 'en'; primaryName = 'English'; script = 'Latin';
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
      en: 'English', hi: 'Hindi', gu: 'Gujarati (or Gujlish if asked in Roman English script)',
      bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
      kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', or: 'Odia', as: 'Assamese', mr: 'Marathi',
      ur: 'Urdu', sa: 'Sanskrit', kok: 'Konkani', mai: 'Maithili', sd: 'Sindhi', ks: 'Kashmiri',
      mni: 'Manipuri', brx: 'Bodo', doi: 'Dogri', hinglish: 'Hinglish (Hindi in Roman script)',
      gujlish: 'Gujlish (Gujarati in Roman script)'
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

  private getEnglishScore(text: string): number {
    const englishKeywords = [
      'what', 'is', 'the', 'weather', 'how', 'will', 'it', 'rain', 'today', 'tomorrow',
      'tell', 'show', 'give', 'forecast', 'temperature', 'temp', 'wind', 'humidity',
      'degrees', 'in', 'at', 'for', 'like', 'can', 'you', 'please', 'now', 'current',
      'hot', 'cold', 'sunny', 'cloudy', 'chance', 'of', 'any', 'there', 'here', 'my',
      'location', 'city', 'outside', 'feels', 'going', 'to', 'let', 'know', 'good',
      'morning', 'afternoon', 'evening', 'night', 'umbrella', 'climate', 'condition',
      'about', 'check', 'would', 'could', 'should', 'need', 'expect', 'heavy', 'light'
    ];

    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    let score = 0;
    for (const w of words) {
      if (englishKeywords.includes(w)) score++;
    }
    return score;
  }

  private getGujlishScore(text: string): number {
    const uniqueGujlish = [
      'varsad', 'padse', 'hase', 'kevi', 'kevo', 'kevu', 'chhe', 'bapore', 'savare', 'sanje', 'aaje',
      'vatavaran', 'ketlu', 'ketli', 'ketla', 'kem', 'cho', 'weatherkevu', 'puchhu', 'puchhune',
      'joiae', 'aapu', 'aapi', 'thase', 'thashe', 'nakhine', 'toy', 'karyu', 'karyo', 'pelethi',
      'tapman', 'hawaaman', 'tamaru', 'tamaro', 'tamari', 'maru', 'maro', 'mari', 'apdu', 'apda',
      'kemcho', 'kyare', 'kyathi', 'kone', 'kashu', 'nathi', 'haju', 'barishchhe', 'bapor', 'sanjo',
      'raat', 'rate', 'kaho', 'bato', 'havaman', 'aavse', 'aavshe', 'rehshe', 'rehse', 'rehvano',
      'rehvani', 'javanu', 'javay', 'karvu', 'karshe', 'karse'
    ];
    const commonGujlish = [
      'che', 'nai', 'paramdivas', 'halo', 'su', 'shu',
      'tyare', 'ema', 'kaik', 'lidhe', 'vandho', 'avto', 'hoi',
      'apde', 'badhu', 'dye', 'tena', 'kero', 'kale', 'kaley',
      'parso', 'divas', 'divase', 'saathe', 'saathei', 'mate', 'maate',
      'thodu', 'ghano', 'ghani', 'ghanu', 'pan', 'pn'
    ];

    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    let uniqueCount = 0;
    let commonCount = 0;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (uniqueGujlish.includes(w)) {
        uniqueCount++;
      } else if (commonGujlish.includes(w)) {
        commonCount++;
      } else if (w === 'ma') {
        const prev = i > 0 ? words[i - 1] : '';
        if (prev && !['the', 'a', 'an'].includes(prev)) {
          commonCount++;
        }
      }
    }

    if (uniqueCount === 0 && commonCount < 1) {
      return 0;
    }
    return uniqueCount * 4 + commonCount * 2;
  }
  
  private getHinglishScore(text: string): number {
    const uniqueHinglish = [
      'barish', 'baarish', 'mausam', 'hoga', 'hogi', 'hoge', 'kaisa', 'kaisi', 'kaise',
      'batao', 'bataye', 'kab', 'hai', 'hain', 'mein', 'nahi', 'nahin', 'karo', 'kare',
      'chahiye', 'taapman', 'dhoop', 'hawa', 'badal', 'aayegi', 'ayegi', 'aayega', 'ayega',
      'rahega', 'rahegi', 'kitna', 'kitni', 'kitne'
    ];
    const commonHinglish = ['kya', 'kal', 'aur', 'bhai', 'haan', 'chalo', 'ho', 'bhi', 'toh', 'aaj', 'yeh', 'woh'];

    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    let uniqueCount = 0;
    let commonCount = 0;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (uniqueHinglish.includes(w)) {
        uniqueCount++;
      } else if (commonHinglish.includes(w)) {
        commonCount++;
      } else if (w === 'me') {
        // Only count 'me' as Hinglish if NOT preceded by English verbs like tell, show, give, let, etc.
        const prev = i > 0 ? words[i - 1] : '';
        if (!['tell', 'show', 'give', 'let', 'help', 'for', 'with', 'to', 'ask', 'guide', 'teach', 'send', 'remind', 'call'].includes(prev)) {
          commonCount++;
        }
      }
    }

    if (uniqueCount === 0 && commonCount < 2) {
      return 0;
    }
    return uniqueCount * 3 + commonCount;
  }
}

export const languageService = new LanguageService();
