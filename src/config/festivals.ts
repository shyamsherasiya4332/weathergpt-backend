/**
 * Festival and event date resolver for WeatherGPT.
 * Maps festival names to approximate date ranges for the current year.
 */

export interface FestivalInfo {
  name: string;
  aliases: string[];
  getDateRange: (year: number) => { start: string; end: string } | null;
  location?: string;
}

/**
 * Major Indian festivals with approximate date logic.
 * Lunar calendar dates vary yearly; these are reasonable approximations.
 * In production, these would be fetched from a calendar API.
 */
export const FESTIVALS: FestivalInfo[] = [
  {
    name: 'Navratri',
    aliases: ['navratri', 'navaratri', 'નવરાત્રી', 'नवरात्रि', 'garba', 'dandiya'],
    getDateRange: (year: number) => {
      // Navratri is typically in October
      return { start: `${year}-10-02`, end: `${year}-10-12` };
    }
  },
  {
    name: 'Diwali',
    aliases: ['diwali', 'deepavali', 'દિવાળી', 'दीपावली', 'દીવાળી'],
    getDateRange: (year: number) => {
      return { start: `${year}-10-28`, end: `${year}-11-03` };
    }
  },
  {
    name: 'Holi',
    aliases: ['holi', 'હોળી', 'होली', 'dhuleti'],
    getDateRange: (year: number) => {
      return { start: `${year}-03-13`, end: `${year}-03-15` };
    }
  },
  {
    name: 'Uttarayan / Makar Sankranti',
    aliases: ['uttarayan', 'makar sankranti', 'ઉત્તરાયણ', 'મકરસંક્રાંતિ', 'kite festival', 'patang'],
    getDateRange: (year: number) => {
      return { start: `${year}-01-14`, end: `${year}-01-15` };
    }
  },
  {
    name: 'Rath Yatra',
    aliases: ['rath yatra', 'રથયાત્રા', 'rathyatra', 'jagannath yatra'],
    getDateRange: (year: number) => {
      return { start: `${year}-07-07`, end: `${year}-07-08` };
    }
  },
  {
    name: 'Ganesh Chaturthi',
    aliases: ['ganesh chaturthi', 'ગણેશ ચતુર્થી', 'गणेश चतुर्थी', 'ganpati'],
    getDateRange: (year: number) => {
      return { start: `${year}-09-05`, end: `${year}-09-15` };
    }
  },
  {
    name: 'Janmashtami',
    aliases: ['janmashtami', 'krishna janmashtami', 'જન્માષ્ટમી', 'जन्माष्टमी'],
    getDateRange: (year: number) => {
      return { start: `${year}-08-25`, end: `${year}-08-26` };
    }
  },
  {
    name: 'Republic Day',
    aliases: ['republic day', 'गणतंत्र दिवस', 'પ્રજાસત્તાક દિવસ', '26 january'],
    getDateRange: (year: number) => {
      return { start: `${year}-01-26`, end: `${year}-01-26` };
    }
  },
  {
    name: 'Independence Day',
    aliases: ['independence day', 'स्वतंत्रता दिवस', 'સ્વાતંત્ર્ય દિવસ', '15 august'],
    getDateRange: (year: number) => {
      return { start: `${year}-08-15`, end: `${year}-08-15` };
    }
  },
  {
    name: 'IPL Cricket Match',
    aliases: ['ipl', 'cricket match', 'ipl match', 'ક્રિકેટ', 'क्रिकेट'],
    getDateRange: (year: number) => {
      // IPL season is typically March-May
      return { start: `${year}-03-22`, end: `${year}-05-26` };
    }
  },
  {
    name: 'Eid',
    aliases: ['eid', 'eid ul fitr', 'eid al adha', 'ईद', 'ઈદ'],
    getDateRange: (year: number) => {
      return { start: `${year}-04-10`, end: `${year}-04-12` };
    }
  },
  {
    name: 'Christmas',
    aliases: ['christmas', 'xmas', 'ક્રિસમસ', 'क्रिसमस'],
    getDateRange: (year: number) => {
      return { start: `${year}-12-24`, end: `${year}-12-26` };
    }
  }
];

/**
 * Try to match user query against known festivals/events.
 * Returns festival info + date range for the given year.
 */
export function matchFestival(query: string, year?: number): {
  festival: FestivalInfo;
  dateRange: { start: string; end: string };
} | null {
  const normalized = query.toLowerCase();
  const targetYear = year || new Date().getFullYear();

  for (const festival of FESTIVALS) {
    for (const alias of festival.aliases) {
      if (normalized.includes(alias)) {
        const range = festival.getDateRange(targetYear);
        if (range) {
          return { festival, dateRange: range };
        }
      }
    }
  }
  return null;
}
