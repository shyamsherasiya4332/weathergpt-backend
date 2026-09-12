import { LocationType } from '../types/nlu.js';

export interface GazetteerEntry {
  name: string;
  type: LocationType;
  state?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  aliases: string[];
  representativeCity?: string;
  exampleCities?: string[];
  preferIndia?: boolean;
}

function inCity(
  name: string,
  lat: number,
  lon: number,
  state: string,
  aliases: string[] = []
): GazetteerEntry {
  return {
    name,
    type: 'city',
    state,
    country: 'India',
    latitude: lat,
    longitude: lon,
    timezone: 'Asia/Kolkata',
    aliases: [name, ...aliases].map((a) => a.toLowerCase()),
    preferIndia: true
  };
}

function inState(
  name: string,
  lat: number,
  lon: number,
  capital: string,
  exampleCities: string[],
  aliases: string[] = []
): GazetteerEntry {
  return {
    name,
    type: 'state',
    country: 'India',
    latitude: lat,
    longitude: lon,
    timezone: 'Asia/Kolkata',
    aliases: [name, ...aliases].map((a) => a.toLowerCase()),
    representativeCity: capital,
    exampleCities,
    preferIndia: true
  };
}

/** Canonical places used before any geocoding API call. */
export const LOCATION_GAZETTEER: GazetteerEntry[] = [
  // Indian states / UTs (representative point = capital)
  inState('Rajasthan', 26.9124, 75.7873, 'Jaipur', ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'], ['rajastan', 'rajastahn', 'rajasthan state']),
  inState('Gujarat', 23.2156, 72.6369, 'Gandhinagar', ['Ahmedabad', 'Surat', 'Rajkot', 'Vadodara'], ['gujrat', 'gujrat state']),
  inState('Maharashtra', 19.076, 72.8777, 'Mumbai', ['Mumbai', 'Pune', 'Nagpur', 'Nashik'], ['maharastra']),
  inState('Goa', 15.4909, 73.8278, 'Panaji', ['Panaji', 'Margao', 'Vasco'], ['goa state']),
  inState('Kerala', 8.5241, 76.9366, 'Thiruvananthapuram', ['Kochi', 'Kozhikode', 'Thiruvananthapuram']),
  inState('Punjab', 30.7333, 76.7794, 'Chandigarh', ['Amritsar', 'Ludhiana', 'Jalandhar']),
  inState('Haryana', 30.7333, 76.7794, 'Chandigarh', ['Gurugram', 'Faridabad', 'Panipat']),
  inState('Karnataka', 12.9716, 77.5946, 'Bengaluru', ['Bengaluru', 'Mysuru', 'Mangaluru'], ['karnatak']),
  inState('Tamil Nadu', 13.0827, 80.2707, 'Chennai', ['Chennai', 'Coimbatore', 'Madurai'], ['tamilnadu', 'tamil nadu']),
  inState('Uttar Pradesh', 26.8467, 80.9462, 'Lucknow', ['Lucknow', 'Kanpur', 'Varanasi', 'Agra'], ['uttar pradesh']),
  inState('Madhya Pradesh', 23.2599, 77.4126, 'Bhopal', ['Bhopal', 'Indore', 'Jabalpur'], ['madhya pradesh']),
  inState('West Bengal', 22.5726, 88.3639, 'Kolkata', ['Kolkata', 'Howrah', 'Siliguri'], ['bengal', 'west bengal']),
  inState('Bihar', 25.5941, 85.1376, 'Patna', ['Patna', 'Gaya', 'Muzaffarpur']),
  inState('Odisha', 20.2961, 85.8245, 'Bhubaneswar', ['Bhubaneswar', 'Cuttack', 'Puri'], ['orissa']),
  inState('Telangana', 17.385, 78.4867, 'Hyderabad', ['Hyderabad', 'Warangal']),
  inState('Andhra Pradesh', 16.5062, 80.648, 'Amaravati', ['Visakhapatnam', 'Vijayawada', 'Amaravati'], ['andhra']),
  inState('Assam', 26.1445, 91.7362, 'Guwahati', ['Guwahati', 'Dibrugarh']),
  inState('Jharkhand', 23.3441, 85.3096, 'Ranchi', ['Ranchi', 'Jamshedpur', 'Dhanbad']),
  inState('Chhattisgarh', 21.2514, 81.6296, 'Raipur', ['Raipur', 'Bilaspur']),
  inState('Uttarakhand', 30.3165, 78.0322, 'Dehradun', ['Dehradun', 'Haridwar', 'Nainital'], ['uttaranchal']),
  inState('Himachal Pradesh', 31.1048, 77.1734, 'Shimla', ['Shimla', 'Manali', 'Dharamshala'], ['himachal']),
  inState('Meghalaya', 25.5788, 91.8933, 'Shillong', ['Shillong']),
  inState('Manipur', 24.817, 93.9368, 'Imphal', ['Imphal']),
  inState('Mizoram', 23.7271, 92.7176, 'Aizawl', ['Aizawl']),
  inState('Nagaland', 25.6751, 94.1086, 'Kohima', ['Kohima', 'Dimapur']),
  inState('Tripura', 23.8315, 91.2868, 'Agartala', ['Agartala']),
  inState('Sikkim', 27.3314, 88.6138, 'Gangtok', ['Gangtok']),
  inState('Arunachal Pradesh', 27.0844, 93.6053, 'Itanagar', ['Itanagar'], ['arunachal']),
  inState('Jammu and Kashmir', 34.0837, 74.7973, 'Srinagar', ['Srinagar', 'Jammu'], ['j&k', 'jammu kashmir', 'kashmir']),
  {
    name: 'Delhi',
    type: 'city',
    state: 'Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    timezone: 'Asia/Kolkata',
    aliases: ['delhi', 'new delhi', 'दिल्ली', 'नई दिल्ली', 'દિલ્હી'],
    preferIndia: true
  },
  {
    name: 'Chandigarh',
    type: 'city',
    state: 'Chandigarh',
    country: 'India',
    latitude: 30.7333,
    longitude: 76.7794,
    timezone: 'Asia/Kolkata',
    aliases: ['chandigarh', 'चंडीगढ़'],
    preferIndia: true
  },
  {
    name: 'Puducherry',
    type: 'city',
    state: 'Puducherry',
    country: 'India',
    latitude: 11.9416,
    longitude: 79.8083,
    timezone: 'Asia/Kolkata',
    aliases: ['puducherry', 'pondicherry', 'pondy'],
    preferIndia: true
  },

  // Gujarat / India cities
  inCity('Rajkot', 22.3039, 70.8022, 'Gujarat', ['rajkot gujarat', 'rajkott', 'राजकोट', 'રાજકોટ']),
  inCity('Ahmedabad', 23.0225, 72.5714, 'Gujarat', ['amdavad', 'ahemdabad', 'ahmedabad gujarat', 'अहमदाबाद', 'અમદાવાદ']),
  inCity('Surat', 21.1702, 72.8311, 'Gujarat', ['surat gujarat', 'suratt', 'सूरत', 'સુરત']),
  inCity('Vadodara', 22.3072, 73.1812, 'Gujarat', ['baroda', 'vadodra', 'वडोदरा', 'વડોદરા']),
  inCity('Morbi', 22.8173, 70.8377, 'Gujarat', ['morvi', 'morbii', 'morby', 'मोरबी', 'મોરબી']),
  inCity('Mumbai', 19.076, 72.8777, 'Maharashtra', ['bombay', 'मुंबई', 'मुम्बई', 'મુંબઈ']),
  inCity('Pune', 18.5204, 73.8567, 'Maharashtra', ['poona', 'पुणे', 'પૂણે']),
  inCity('Jaipur', 26.9124, 75.7873, 'Rajasthan', ['जयपुर', 'જયપુર']),
  inCity('Jodhpur', 26.2389, 73.0243, 'Rajasthan', ['जोधपुर']),
  inCity('Udaipur', 24.5854, 73.7125, 'Rajasthan'),
  inCity('Kota', 25.2138, 75.8648, 'Rajasthan'),
  inCity('Bengaluru', 12.9716, 77.5946, 'Karnataka', ['bangalore', 'bengalooru', 'बैंगलोर', 'બેંગ્લોર']),
  inCity('Hyderabad', 17.385, 78.4867, 'Telangana', ['हैदराबाद', 'હૈદરાબાદ']),
  inCity('Chennai', 13.0827, 80.2707, 'Tamil Nadu', ['madras', 'चेन्नई', 'ચેન્નાઈ']),
  inCity('Kolkata', 22.5726, 88.3639, 'West Bengal', ['calcutta', 'कोलकाता', 'કોલકાતા']),
  inCity('Lucknow', 26.8467, 80.9462, 'Uttar Pradesh', ['लखनऊ']),
  inCity('Kanpur', 26.4499, 80.3319, 'Uttar Pradesh', ['कानपुर']),
  inCity('Nagpur', 21.1458, 79.0882, 'Maharashtra', ['नागपुर', 'नागपूर']),
  inCity('Indore', 22.7196, 75.8577, 'Madhya Pradesh', ['इंदौर']),
  inCity('Bhopal', 23.2599, 77.4126, 'Madhya Pradesh', ['भोपाल']),
  inCity('Patna', 25.5941, 85.1376, 'Bihar', ['पटना']),
  inCity('Gandhinagar', 23.2156, 72.6369, 'Gujarat', ['gandhinagr', 'गांधीनगर', 'ગાંધીનગર']),
  inCity('Jamnagar', 22.4707, 70.0577, 'Gujarat', ['जामनगर', 'જામનગર']),
  inCity('Junagadh', 21.5222, 70.4579, 'Gujarat', ['जूनागढ़', 'જૂનાગઢ']),
  inCity('Bhavnagar', 21.7645, 72.1519, 'Gujarat', ['भावनगर', 'ભાવનગર']),
  inCity('Bhuj', 23.242, 69.6669, 'Gujarat'),
  inCity('Porbandar', 21.6417, 69.6293, 'Gujarat'),
  inCity('Anand', 22.5645, 72.9289, 'Gujarat'),
  inCity('Nadiad', 22.6916, 72.8634, 'Gujarat'),
  inCity('Mehsana', 23.588, 72.3693, 'Gujarat'),
  inCity('Navsari', 20.9467, 72.952, 'Gujarat'),
  inCity('Valsad', 20.5992, 72.9342, 'Gujarat'),
  inCity('Vapi', 20.3893, 72.9106, 'Gujarat'),
  inCity('Bharuch', 21.7051, 72.9959, 'Gujarat'),
  inCity('Palanpur', 24.171, 72.438, 'Gujarat'),
  inCity('Patan', 23.8493, 72.1266, 'Gujarat'),
  inCity('Godhra', 22.7755, 73.6149, 'Gujarat'),
  inCity('Amreli', 21.6032, 71.2216, 'Gujarat'),
  inCity('Botad', 22.1704, 71.6684, 'Gujarat', ['બોટાદ']),
  inCity('Surendranagar', 22.7274, 71.637, 'Gujarat'),
  inCity('Veraval', 20.907, 70.3679, 'Gujarat'),
  inCity('Dwarka', 22.2394, 68.9678, 'Gujarat'),
  inCity('Nashik', 19.9975, 73.7898, 'Maharashtra', ['नाशिक']),
  inCity('Thane', 19.2183, 72.9781, 'Maharashtra'),
  inCity('Navi Mumbai', 19.033, 73.0297, 'Maharashtra'),
  inCity('Aurangabad', 19.8762, 75.3433, 'Maharashtra', ['chhatrapati sambhajinagar']),
  inCity('Solapur', 17.6599, 75.9064, 'Maharashtra'),
  inCity('Agra', 27.1767, 78.0081, 'Uttar Pradesh', ['आगरा']),
  inCity('Varanasi', 25.3176, 82.9739, 'Uttar Pradesh', ['banaras', 'kashi', 'वाराणसी']),
  inCity('Prayagraj', 25.4358, 81.8463, 'Uttar Pradesh', ['allahabad', 'प्रयागराज']),
  inCity('Meerut', 28.9845, 77.7064, 'Uttar Pradesh'),
  inCity('Ghaziabad', 28.6692, 77.4538, 'Uttar Pradesh'),
  inCity('Noida', 28.5355, 77.391, 'Uttar Pradesh'),
  inCity('Gurugram', 28.4595, 77.0266, 'Haryana', ['gurgaon']),
  inCity('Faridabad', 28.4089, 77.3178, 'Haryana'),
  inCity('Amritsar', 31.634, 74.8723, 'Punjab', ['अमृतसर']),
  inCity('Ludhiana', 30.901, 75.8573, 'Punjab'),
  inCity('Srinagar', 34.0837, 74.7973, 'Jammu and Kashmir', ['श्रीनगर']),
  inCity('Jammu', 32.7266, 74.857, 'Jammu and Kashmir'),
  inCity('Shimla', 31.1048, 77.1734, 'Himachal Pradesh', ['शिमला']),
  inCity('Dehradun', 30.3165, 78.0322, 'Uttarakhand', ['देहरादून']),
  inCity('Ranchi', 23.3441, 85.3096, 'Jharkhand'),
  inCity('Jamshedpur', 22.8046, 86.2029, 'Jharkhand'),
  inCity('Dhanbad', 23.7957, 86.4304, 'Jharkhand'),
  inCity('Raipur', 21.2514, 81.6296, 'Chhattisgarh'),
  inCity('Guwahati', 26.1445, 91.7362, 'Assam'),
  inCity('Bhubaneswar', 20.2961, 85.8245, 'Odisha'),
  inCity('Cuttack', 20.4625, 85.883, 'Odisha'),
  inCity('Kochi', 9.9312, 76.2673, 'Kerala', ['cochin']),
  inCity('Thiruvananthapuram', 8.5241, 76.9366, 'Kerala', ['trivandrum']),
  inCity('Coimbatore', 11.0168, 76.9558, 'Tamil Nadu'),
  inCity('Madurai', 9.9252, 78.1198, 'Tamil Nadu'),
  inCity('Mysuru', 12.2958, 76.6394, 'Karnataka', ['mysore']),
  inCity('Visakhapatnam', 17.6868, 83.2185, 'Andhra Pradesh', ['vizag']),
  inCity('Vijayawada', 16.5062, 80.648, 'Andhra Pradesh'),
  inCity('Gwalior', 26.2183, 78.1828, 'Madhya Pradesh'),
  inCity('Jabalpur', 23.1815, 79.9864, 'Madhya Pradesh'),
  inCity('Panaji', 15.4909, 73.8278, 'Goa'),
  inCity('Moga', 30.8165, 75.1742, 'Punjab'),

  // International (exact names that must not fuzzy-match weaker places)
  {
    name: 'Florida',
    type: 'state',
    country: 'United States',
    latitude: 30.4383,
    longitude: -84.2807,
    timezone: 'America/New_York',
    aliases: ['florida', 'florida usa', 'florida us', 'florida united states'],
    representativeCity: 'Tallahassee',
    exampleCities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville']
  },
  {
    name: 'California',
    type: 'state',
    country: 'United States',
    latitude: 38.5816,
    longitude: -121.4944,
    timezone: 'America/Los_Angeles',
    aliases: ['california', 'california usa', 'california us'],
    representativeCity: 'Sacramento',
    exampleCities: ['Los Angeles', 'San Francisco', 'San Diego']
  },
  {
    name: 'Texas',
    type: 'state',
    country: 'United States',
    latitude: 30.2672,
    longitude: -97.7431,
    timezone: 'America/Chicago',
    aliases: ['texas', 'texas usa'],
    representativeCity: 'Austin',
    exampleCities: ['Houston', 'Dallas', 'Austin']
  },
  {
    name: 'New York',
    type: 'city',
    state: 'New York',
    country: 'United States',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
    aliases: ['new york', 'nyc', 'new york city', 'new york usa']
  },
  {
    name: 'London',
    type: 'city',
    state: 'England',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    aliases: ['london', 'london uk', 'london england', 'london united kingdom']
  },
  {
    name: 'Paris',
    type: 'city',
    country: 'France',
    latitude: 48.8566,
    longitude: 2.3522,
    timezone: 'Europe/Paris',
    aliases: ['paris', 'paris france']
  },
  {
    name: 'Tokyo',
    type: 'city',
    country: 'Japan',
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: 'Asia/Tokyo',
    aliases: ['tokyo']
  },
  {
    name: 'Dubai',
    type: 'city',
    country: 'United Arab Emirates',
    latitude: 25.2048,
    longitude: 55.2708,
    timezone: 'Asia/Dubai',
    aliases: ['dubai']
  },
  {
    name: 'Singapore',
    type: 'city',
    country: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
    timezone: 'Asia/Singapore',
    aliases: ['singapore']
  },
  {
    name: 'Sydney',
    type: 'city',
    country: 'Australia',
    latitude: -33.8688,
    longitude: 151.2093,
    timezone: 'Australia/Sydney',
    aliases: ['sydney']
  },
  {
    name: 'Toronto',
    type: 'city',
    country: 'Canada',
    latitude: 43.6532,
    longitude: -79.3832,
    timezone: 'America/Toronto',
    aliases: ['toronto']
  },
  {
    name: 'Los Angeles',
    type: 'city',
    state: 'California',
    country: 'United States',
    latitude: 34.0522,
    longitude: -118.2437,
    timezone: 'America/Los_Angeles',
    aliases: ['los angeles']
  },
  {
    name: 'San Francisco',
    type: 'city',
    state: 'California',
    country: 'United States',
    latitude: 37.7749,
    longitude: -122.4194,
    timezone: 'America/Los_Angeles',
    aliases: ['san francisco']
  },
  {
    name: 'Chicago',
    type: 'city',
    state: 'Illinois',
    country: 'United States',
    latitude: 41.8781,
    longitude: -87.6298,
    timezone: 'America/Chicago',
    aliases: ['chicago']
  },
  {
    name: 'Seattle',
    type: 'city',
    state: 'Washington',
    country: 'United States',
    latitude: 47.6062,
    longitude: -122.3321,
    timezone: 'America/Los_Angeles',
    aliases: ['seattle']
  },
  {
    name: 'Berlin',
    type: 'city',
    country: 'Germany',
    latitude: 52.52,
    longitude: 13.405,
    timezone: 'Europe/Berlin',
    aliases: ['berlin']
  },
  {
    name: 'Rome',
    type: 'city',
    country: 'Italy',
    latitude: 41.9028,
    longitude: 12.4964,
    timezone: 'Europe/Rome',
    aliases: ['rome']
  },
  {
    name: 'Madrid',
    type: 'city',
    country: 'Spain',
    latitude: 40.4168,
    longitude: -3.7038,
    timezone: 'Europe/Madrid',
    aliases: ['madrid']
  },
  {
    name: 'Moscow',
    type: 'city',
    country: 'Russia',
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: 'Europe/Moscow',
    aliases: ['moscow']
  },
  {
    name: 'Bangkok',
    type: 'city',
    country: 'Thailand',
    latitude: 13.7563,
    longitude: 100.5018,
    timezone: 'Asia/Bangkok',
    aliases: ['bangkok']
  }
];

export const LANGUAGE_NAME_TOKENS = new Set([
  'english',
  'hindi',
  'gujarati',
  'marathi',
  'bengali',
  'tamil',
  'telugu',
  'kannada',
  'malayalam',
  'punjabi',
  'odia',
  'oriya',
  'assamese',
  'urdu',
  'sanskrit',
  'hinglish',
  'gujlish',
  'ગુજરાતી',
  'हिंदी',
  'हिन्दी',
  'मराठी',
  'language',
  'bhasha',
  'bhasa'
]);

export const NON_LOCATION_TOKENS = new Set([
  ...LANGUAGE_NAME_TOKENS,
  'this',
  'that',
  'it',
  'there',
  'here',
  'today',
  'tomorrow',
  'yesterday',
  'tonight',
  'simple',
  'please',
  'weather',
  'rain',
  'forecast',
  'temperature',
  'temp',
  'humidity',
  'wind',
  'current',
  'condition',
  'conditions'
]);

const byAlias = new Map<string, GazetteerEntry>();
for (const entry of LOCATION_GAZETTEER) {
  for (const alias of entry.aliases) {
    const key = alias.toLowerCase().trim();
    const existing = byAlias.get(key);
    if (!existing || alias === entry.name.toLowerCase()) {
      byAlias.set(key, entry);
    }
  }
}

export function lookupGazetteer(raw: string): GazetteerEntry | undefined {
  const key = raw.toLowerCase().trim().replace(/[.,?!]+$/g, '');
  if (!key) return undefined;
  return byAlias.get(key);
}

export function findGazetteerInText(text: string): GazetteerEntry | undefined {
  const lower = text.toLowerCase();
  const sorted = [...LOCATION_GAZETTEER].sort((a, b) => {
    const aLen = Math.max(...a.aliases.map((x) => x.length));
    const bLen = Math.max(...b.aliases.map((x) => x.length));
    return bLen - aLen;
  });
  for (const entry of sorted) {
    for (const alias of entry.aliases) {
      if (alias.length < 2) continue;
      if (/[\u0900-\u0D7F]/.test(alias)) {
        if (text.includes(alias)) return entry;
      } else {
        const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(lower)) return entry;
      }
    }
  }
  return undefined;
}
