/**
 * Landmark locations for WeatherGPT - famous Indian landmarks and tourist spots.
 * These are resolved directly without geocoding API calls.
 */

import { ResolvedLocation } from '../types/weather.js';

export interface LandmarkEntry {
  aliases: string[];
  location: ResolvedLocation;
}

export const LANDMARKS: LandmarkEntry[] = [
  {
    aliases: ['statue of unity', 'sardar patel statue', 'unity statue'],
    location: {
      name: 'Statue of Unity',
      latitude: 21.8380,
      longitude: 73.7191,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['somnath temple', 'somnath mandir', 'somnath'],
    location: {
      name: 'Somnath Temple',
      latitude: 20.8880,
      longitude: 70.4013,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['gir national park', 'gir forest', 'sasan gir', 'gir'],
    location: {
      name: 'Gir National Park',
      latitude: 21.1243,
      longitude: 70.7939,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['sabarmati riverfront', 'sabarmati ashram', 'sabarmati'],
    location: {
      name: 'Sabarmati Riverfront',
      latitude: 23.0469,
      longitude: 72.5802,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['taj mahal', 'agra fort'],
    location: {
      name: 'Taj Mahal, Agra',
      latitude: 27.1751,
      longitude: 78.0421,
      state: 'Uttar Pradesh',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['india gate'],
    location: {
      name: 'India Gate, New Delhi',
      latitude: 28.6129,
      longitude: 77.2295,
      state: 'Delhi',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['gateway of india', 'gateway mumbai'],
    location: {
      name: 'Gateway of India, Mumbai',
      latitude: 18.9220,
      longitude: 72.8347,
      state: 'Maharashtra',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['red fort', 'lal qila'],
    location: {
      name: 'Red Fort, Delhi',
      latitude: 28.6562,
      longitude: 77.2410,
      state: 'Delhi',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['rann of kutch', 'white rann', 'kutch desert', 'rann utsav'],
    location: {
      name: 'Rann of Kutch',
      latitude: 23.7337,
      longitude: 69.8597,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['morbi', 'morbi gujarat', 'morvi'],
    location: {
      name: 'Morbi',
      latitude: 22.8173,
      longitude: 70.8377,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['rajkot', 'rajkot gujarat'],
    location: {
      name: 'Rajkot',
      latitude: 22.3039,
      longitude: 70.8022,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['ahmedabad', 'ahmedabad gujarat', 'amdavad'],
    location: {
      name: 'Ahmedabad',
      latitude: 23.0225,
      longitude: 72.5714,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['surat', 'surat gujarat'],
    location: {
      name: 'Surat',
      latitude: 21.1702,
      longitude: 72.8311,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['vadodara', 'baroda', 'vadodara gujarat'],
    location: {
      name: 'Vadodara',
      latitude: 22.3072,
      longitude: 73.1812,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['jamnagar', 'jamnagar gujarat'],
    location: {
      name: 'Jamnagar',
      latitude: 22.4707,
      longitude: 70.0577,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['junagadh', 'junagadh gujarat'],
    location: {
      name: 'Junagadh',
      latitude: 21.5222,
      longitude: 70.4579,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['bhavnagar', 'bhavnagar gujarat'],
    location: {
      name: 'Bhavnagar',
      latitude: 21.7645,
      longitude: 72.1519,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['gandhinagar', 'gandhinagar gujarat'],
    location: {
      name: 'Gandhinagar',
      latitude: 23.2156,
      longitude: 72.6369,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['porbandar', 'porbandar gujarat'],
    location: {
      name: 'Porbandar',
      latitude: 21.6417,
      longitude: 69.6293,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['bhuj', 'bhuj gujarat'],
    location: {
      name: 'Bhuj',
      latitude: 23.2420,
      longitude: 69.6669,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['botad', 'botad gujarat'],
    location: {
      name: 'Botad',
      latitude: 22.1704,
      longitude: 71.6684,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['amreli', 'amreli gujarat'],
    location: {
      name: 'Amreli',
      latitude: 21.6032,
      longitude: 71.2216,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['surendranagar', 'surendranagar gujarat'],
    location: {
      name: 'Surendranagar',
      latitude: 22.7274,
      longitude: 71.6370,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['anand', 'anand gujarat'],
    location: {
      name: 'Anand',
      latitude: 22.5645,
      longitude: 72.9289,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['nadiad', 'nadiad gujarat'],
    location: {
      name: 'Nadiad',
      latitude: 22.6916,
      longitude: 72.8634,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['bharuch', 'bharuch gujarat'],
    location: {
      name: 'Bharuch',
      latitude: 21.7051,
      longitude: 72.9959,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['mehsana', 'mehsana gujarat'],
    location: {
      name: 'Mehsana',
      latitude: 23.5880,
      longitude: 72.3693,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['patan', 'patan gujarat'],
    location: {
      name: 'Patan',
      latitude: 23.8493,
      longitude: 72.1266,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['navsari', 'navsari gujarat'],
    location: {
      name: 'Navsari',
      latitude: 20.9467,
      longitude: 72.9520,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['valsad', 'valsad gujarat'],
    location: {
      name: 'Valsad',
      latitude: 20.5992,
      longitude: 72.9342,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  },
  {
    aliases: ['dwarkadhish temple', 'dwarka temple', 'dwarka'],
    location: {
      name: 'Dwarkadhish Temple',
      latitude: 22.2376,
      longitude: 68.9674,
      state: 'Gujarat',
      country: 'India',
      timezone: 'Asia/Kolkata'
    }
  }
];

/**
 * Try to match a query string against known landmarks.
 * Returns the resolved location if matched, or undefined.
 */
export function matchLandmark(query: string): ResolvedLocation | undefined {
  const normalized = query.toLowerCase().trim();
  for (const entry of LANDMARKS) {
    for (const alias of entry.aliases) {
      if (normalized.includes(alias)) {
        return entry.location;
      }
    }
  }
  return undefined;
}
