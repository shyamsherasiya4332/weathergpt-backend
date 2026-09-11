import { logger } from '../utils/logger.js';

// ─── Knowledge Chunk Types ───

export type KnowledgeDomain = 'ndma' | 'icar' | 'imd' | 'pmfby';

export interface KnowledgeChunk {
  id: string;
  domain: KnowledgeDomain;
  title: string;
  content: string;
  keywords: string[];
  /** Multilingual keyword variants (Hindi / Gujarati) */
  keywordsHi?: string[];
  keywordsGu?: string[];
  /** Weather conditions that boost relevance */
  weatherTriggers?: {
    minRainProbability?: number;
    minTemperature?: number;
    maxTemperature?: number;
    minWindSpeed?: number;
    conditions?: string[];
  };
  source: string;
  lastUpdated: string;
}

// ─── Curated Knowledge Base ───

const KNOWLEDGE_CHUNKS: KnowledgeChunk[] = [

  // ══════════════════════════════════════════
  //  NDMA — National Disaster Management Authority SOPs
  // ══════════════════════════════════════════

  {
    id: 'ndma-flood-sop',
    domain: 'ndma',
    title: 'NDMA Flood Safety Guidelines',
    content:
      'During floods: Move to higher ground immediately. Do not walk or drive through floodwaters. ' +
      'Turn off electricity and gas supply. Keep emergency kit ready with first-aid, water, torch, and documents. ' +
      'Follow official evacuation orders. After flood: Avoid contaminated water sources, check structures for damage before entering, ' +
      'report broken utilities and downed power lines. Helpline: NDMA 1078, NDRF 011-26107953.',
    keywords: ['flood', 'floods', 'flooding', 'waterlogging', 'inundation', 'evacuation', 'rescue', 'ndma', 'ndrf', 'safety'],
    keywordsHi: ['बाढ़', 'जलप्लावन', 'बचाव', 'निकासी', 'आपदा', 'सुरक्षा'],
    keywordsGu: ['પૂર', 'જળબંબાકાર', 'બચાવ', 'આપત્તિ', 'સુરક્ષા'],
    weatherTriggers: { minRainProbability: 70, conditions: ['heavy rain', 'thunderstorm'] },
    source: 'NDMA Guidelines on Floods (ndma.gov.in)',
    lastUpdated: '2024-06-15'
  },
  {
    id: 'ndma-cyclone-sop',
    domain: 'ndma',
    title: 'NDMA Cyclone Preparedness',
    content:
      'Before cyclone: Secure loose objects, store water and food, charge devices, move to a sturdy building. ' +
      'During cyclone: Stay indoors away from windows, listen to official radio/TV advisories. ' +
      'After cyclone: Check for structural damage, avoid fallen power lines, beware of snakes and insects. ' +
      'Cyclone categories: Very Severe (118-166 km/h), Extremely Severe (166-221 km/h), Super Cyclonic Storm (>221 km/h). ' +
      'IMD issues colour-coded warnings: Green (no action), Yellow (watch), Orange (be prepared), Red (take action).',
    keywords: ['cyclone', 'hurricane', 'storm', 'wind', 'gale', 'cyclonic', 'tropical', 'warning'],
    keywordsHi: ['चक्रवात', 'तूफान', 'आंधी', 'हवा'],
    keywordsGu: ['વાવાઝોડું', 'ચક્રવાત', 'તોફાન', 'પવન'],
    weatherTriggers: { minWindSpeed: 60, conditions: ['storm', 'cyclone'] },
    source: 'NDMA Guidelines on Cyclones (ndma.gov.in)',
    lastUpdated: '2024-05-20'
  },
  {
    id: 'ndma-heatwave-sop',
    domain: 'ndma',
    title: 'NDMA Heatwave Safety Measures',
    content:
      'Heatwave declared when temperature exceeds normal by 4.5°C (departure-based) or plains ≥40°C / hills ≥30°C (actual temperature). ' +
      'Severe heatwave: departure ≥6.5°C or plains ≥47°C. ' +
      'Do: Drink ORS/water frequently, wear light cotton clothes, use wet cloth on head, avoid outdoor work 12-3 PM. ' +
      'Don\'t: Leave children or pets in parked vehicles, consume alcohol/caffeine. ' +
      'Symptoms of heat stroke: body temp >40°C, confusion, no sweating — rush to hospital. ' +
      'Helpline: 108 (medical emergency).',
    keywords: ['heatwave', 'heat wave', 'heat', 'hot', 'temperature', 'sunstroke', 'heat stroke', 'dehydration'],
    keywordsHi: ['लू', 'गर्मी', 'हीटवेव', 'तापमान', 'लूलग'],
    keywordsGu: ['ગરમી', 'લૂ', 'તાપમાન', 'હીટવેવ'],
    weatherTriggers: { minTemperature: 40 },
    source: 'NDMA Guidelines on Heat Waves (ndma.gov.in)',
    lastUpdated: '2024-04-10'
  },
  {
    id: 'ndma-lightning-sop',
    domain: 'ndma',
    title: 'NDMA Lightning & Thunderstorm Safety',
    content:
      'Lightning kills ~2,000 people annually in India. 30-30 rule: If time between flash and thunder is <30 seconds, seek shelter; ' +
      'wait 30 minutes after last thunder before going outdoors. ' +
      'Avoid: Open fields, metal fences, tall isolated trees, water bodies. ' +
      'If caught outside: Crouch low with feet together, do NOT lie flat. ' +
      'Indoors: Stay away from windows, unplug electronics, avoid landline phones.',
    keywords: ['lightning', 'thunder', 'thunderstorm', 'electric', 'storm'],
    keywordsHi: ['बिजली', 'गरज', 'तड़ित', 'आकाशीय बिजली'],
    keywordsGu: ['વીજળી', 'ગર્જના', 'તોફાન'],
    weatherTriggers: { conditions: ['thunderstorm', 'lightning'] },
    source: 'NDMA Guidelines on Thunderstorm & Lightning (ndma.gov.in)',
    lastUpdated: '2024-05-01'
  },
  {
    id: 'ndma-coldwave-sop',
    domain: 'ndma',
    title: 'NDMA Cold Wave Safety',
    content:
      'Cold wave declared when min temperature ≤10°C (plains) with departure ≥4.5°C below normal, or min temp ≤4°C. ' +
      'Severe cold wave: departure ≥6.5°C or min temp ≤2°C. ' +
      'Precautions: Wear layered wool/thermal clothing, keep rooms ventilated when using heaters (prevent CO poisoning), ' +
      'check on elderly neighbors, provide warm shelter for homeless and animals. ' +
      'Avoid: Prolonged outdoor exposure, alcohol consumption for warmth (causes heat loss).',
    keywords: ['cold', 'cold wave', 'freeze', 'frost', 'hypothermia', 'winter'],
    keywordsHi: ['शीतलहर', 'ठंड', 'जाड़ा', 'सर्दी', 'पाला'],
    keywordsGu: ['ઠંડી', 'શીતલહેર', 'હિમ', 'ટાઢ'],
    weatherTriggers: { maxTemperature: 10 },
    source: 'NDMA Guidelines on Cold Wave (ndma.gov.in)',
    lastUpdated: '2024-01-15'
  },

  // ══════════════════════════════════════════
  //  ICAR — Indian Council of Agricultural Research Advisories
  // ══════════════════════════════════════════

  {
    id: 'icar-kharif-rain',
    domain: 'icar',
    title: 'ICAR Kharif Season Rain Advisory',
    content:
      'Kharif season (June-October): If rain probability >60%, postpone pesticide spraying by 48 hours. ' +
      'Pre-monsoon land preparation: Deep ploughing, apply 10-15 tonnes FYM/hectare. ' +
      'Sowing window: Rice — mid-June to mid-July; Groundnut — 15 June to 15 July; Cotton — May-June. ' +
      'Waterlogging management: Ensure field drainage channels are clear. ' +
      'Excess rain: Cover harvested produce, delay urea application, use neem-coated urea. ' +
      'Wind damage: Stake banana plants, provide support to tall crops.',
    keywords: ['agriculture', 'farming', 'crop', 'kharif', 'monsoon', 'sowing', 'rain', 'field', 'farmer'],
    keywordsHi: ['कृषि', 'खेती', 'फसल', 'खरीफ', 'मानसून', 'बुवाई', 'किसान'],
    keywordsGu: ['ખેતી', 'પાક', 'ખરીફ', 'ચોમાસું', 'વાવણી', 'ખેડૂત'],
    weatherTriggers: { minRainProbability: 50 },
    source: 'ICAR-CRIDA Agromet Advisory (icar.org.in)',
    lastUpdated: '2024-06-01'
  },
  {
    id: 'icar-rabi-advisory',
    domain: 'icar',
    title: 'ICAR Rabi Season Advisory',
    content:
      'Rabi season (October-March): Major crops — Wheat, Mustard, Chickpea, Potato. ' +
      'Wheat sowing: Mid-November (North India); irrigate at Crown Root Initiation (21 days after sowing). ' +
      'Frost protection: Light irrigation on frost-expected nights, avoid nitrogen top dressing during cold spells. ' +
      'Fog management: Delay harvesting until dew dries, use sulphur-based fungicides for powdery mildew. ' +
      'Temperature <5°C for 3+ days: Risk of chilling injury to mustard flowers — spray 0.1% boric acid.',
    keywords: ['rabi', 'wheat', 'mustard', 'chickpea', 'winter crop', 'frost', 'irrigation', 'sowing'],
    keywordsHi: ['रबी', 'गेहूं', 'सरसों', 'चना', 'पाला', 'सिंचाई'],
    keywordsGu: ['રવિ', 'ઘઉં', 'રાઈ', 'ચણા', 'હિમ', 'સિંચાઈ'],
    weatherTriggers: { maxTemperature: 15 },
    source: 'ICAR-CRIDA Rabi Advisory (icar.org.in)',
    lastUpdated: '2024-10-15'
  },
  {
    id: 'icar-pest-weather',
    domain: 'icar',
    title: 'ICAR Weather-Based Pest Advisory',
    content:
      'Humidity >80% + Temperature 25-30°C: High risk of fungal diseases — blast in rice, late blight in potato. ' +
      'Preventive spray: Tricyclazole 75% WP for rice blast, Mancozeb 75% WP for potato late blight. ' +
      'Continuous cloudy weather (3+ days): Increased aphid and whitefly activity — use yellow sticky traps. ' +
      'After heavy rain: Check for stem borer damage in paddy, inspect for root rot in cotton. ' +
      'High wind + rain: Increased locust swarm risk in western Rajasthan and Gujarat — report sightings to 1800-180-1551.',
    keywords: ['pest', 'disease', 'fungal', 'spray', 'insect', 'blight', 'aphid', 'locust', 'pesticide'],
    keywordsHi: ['कीट', 'रोग', 'कवक', 'छिड़काव', 'टिड्डी'],
    keywordsGu: ['જીવાત', 'રોગ', 'ફૂગ', 'છંટકાવ', 'તીડ'],
    weatherTriggers: { minRainProbability: 60 },
    source: 'ICAR Integrated Pest Management (icar.org.in)',
    lastUpdated: '2024-07-20'
  },

  // ══════════════════════════════════════════
  //  IMD — India Meteorological Department Warning Protocols
  // ══════════════════════════════════════════

  {
    id: 'imd-colour-code-warnings',
    domain: 'imd',
    title: 'IMD Colour-Coded Weather Warning System',
    content:
      'GREEN: No severe weather expected, no advisory needed. ' +
      'YELLOW: Severe weather possible, be aware and keep updated. ' +
      'ORANGE: Severe weather expected, be prepared for disruption to travel and outdoor activities. ' +
      'RED: Extremely severe weather expected, take action to protect life and property. ' +
      'Rainfall thresholds: Light (<7.5 mm/day), Moderate (7.5-35.5 mm), Heavy (35.5-64.4 mm), ' +
      'Very Heavy (64.5-115.5 mm), Extremely Heavy (115.6-204.4 mm), Exceptionally Heavy (>204.4 mm). ' +
      'IMD issues warnings at district level up to 5 days in advance via mausam.imd.gov.in.',
    keywords: ['imd', 'warning', 'alert', 'colour code', 'color code', 'green', 'yellow', 'orange', 'red', 'rainfall'],
    keywordsHi: ['चेतावनी', 'अलर्ट', 'रंग कोड', 'भारी वर्षा', 'मौसम विभाग'],
    keywordsGu: ['ચેતવણી', 'એલર્ટ', 'રંગ કોડ', 'ભારે વરસાદ', 'હવામાન વિભાગ'],
    source: 'IMD Standard Operating Procedure (mausam.imd.gov.in)',
    lastUpdated: '2024-06-01'
  },
  {
    id: 'imd-monsoon-forecast',
    domain: 'imd',
    title: 'IMD Monsoon Forecasting & Terminology',
    content:
      'Normal monsoon: 96-104% of Long Period Average (LPA = 87 cm for all-India June-September rainfall). ' +
      'Below normal: 90-96% LPA. Deficient: <90% LPA. Above normal: 104-110% LPA. Excess: >110% LPA. ' +
      'Monsoon onset: Kerala ~1st June (±7 days). Advance rate: ~1° latitude per 2 days. ' +
      'Monsoon withdrawal: Begins from NW India ~1st September, completes by mid-October from southern peninsula. ' +
      'Active monsoon spell: Widespread rain across monsoon trough. Break monsoon: Monsoon trough shifts northward, ' +
      'dry spell over central India but heavy rain in Himalayan foothills.',
    keywords: ['monsoon', 'lpa', 'rainfall', 'onset', 'withdrawal', 'forecast', 'imd', 'season'],
    keywordsHi: ['मानसून', 'वर्षा', 'पूर्वानुमान', 'मौसम'],
    keywordsGu: ['ચોમાસું', 'વરસાદ', 'આગાહી', 'હવામાન'],
    source: 'IMD Long Range Forecast Methodology (mausam.imd.gov.in)',
    lastUpdated: '2024-05-15'
  },

  // ══════════════════════════════════════════
  //  PMFBY — Pradhan Mantri Fasal Bima Yojana
  // ══════════════════════════════════════════

  {
    id: 'pmfby-crop-insurance',
    domain: 'pmfby',
    title: 'PM Fasal Bima Yojana — Crop Insurance Scheme',
    content:
      'PMFBY provides crop insurance to farmers at subsidised premiums: ' +
      'Kharif crops: 2% of sum insured, Rabi crops: 1.5% of sum insured, Horticultural/Commercial crops: 5%. ' +
      'Coverage: Pre-sowing to post-harvest (up to 14 days for cut and spread crops). ' +
      'Claim triggers: Yield loss (area-approach), prevented sowing (>75% area unplanted due to deficit rain), ' +
      'mid-season adversity (flood, drought, hailstorm), localised calamity (hailstorm, landslide, inundation within 24 hours), ' +
      'post-harvest loss (unseasonal rain/cyclone within 14 days of harvest). ' +
      'Claim process: Intimate within 72 hours via crop insurance app, toll-free 14447, or nearest bank/CSC. ' +
      'Portal: pmfby.gov.in. Government pays difference between farmer premium and actuarial premium.',
    keywords: ['insurance', 'pmfby', 'fasal bima', 'crop insurance', 'claim', 'premium', 'subsidy', 'farmer', 'yield'],
    keywordsHi: ['फसल बीमा', 'प्रीमियम', 'दावा', 'सब्सिडी', 'किसान', 'बीमा'],
    keywordsGu: ['પાક વીમો', 'પ્રીમિયમ', 'દાવો', 'સબસિડી', 'ખેડૂત', 'વીમો'],
    weatherTriggers: { minRainProbability: 70 },
    source: 'PMFBY Operational Guidelines 2024 (pmfby.gov.in)',
    lastUpdated: '2024-04-01'
  },
  {
    id: 'pmfby-claim-weather',
    domain: 'pmfby',
    title: 'PMFBY Weather-Triggered Claim Scenarios',
    content:
      'Claim scenario 1 — PREVENTED SOWING: If >75% of normal area in a notified insurance unit cannot be sown ' +
      'due to deficit rainfall or adverse seasonal conditions, farmers get 25% of sum insured. ' +
      'Claim scenario 2 — MID-SEASON ADVERSITY: Flood, drought, or severe pest attack expected to reduce yield by >50%. ' +
      'On-account payment: 25% of likely claim, settled later based on final yield data. ' +
      'Claim scenario 3 — LOCALIZED CALAMITY: Hailstorm, landslide, or waterlogging on an individual farm. ' +
      'Farmers must report within 72 hours with geotagged photos via pmfby.gov.in or crop insurance app. ' +
      'Claim scenario 4 — POST-HARVEST LOSS: Unseasonal rain or cyclone within 14 days of harvest. ' +
      'Assessment: Individual farm-level using remote sensing and ground truth.',
    keywords: ['claim', 'sowing', 'adversity', 'hailstorm', 'drought', 'yield', 'crop loss', 'insurance'],
    keywordsHi: ['दावा', 'बुवाई', 'ओलावृष्टि', 'सूखा', 'फसल नुकसान'],
    keywordsGu: ['દાવો', 'વાવણી', 'કરા', 'દુકાળ', 'પાક નુકસાન'],
    weatherTriggers: { minRainProbability: 70, conditions: ['hailstorm'] },
    source: 'PMFBY Claim Process Guidelines (pmfby.gov.in)',
    lastUpdated: '2024-04-01'
  }
];

// ─── Knowledge Base Access ───

class KnowledgeBase {
  private chunks: KnowledgeChunk[];

  constructor() {
    this.chunks = KNOWLEDGE_CHUNKS;
    logger.info(`Knowledge base loaded with ${this.chunks.length} chunks across ${this.getDomains().length} domains`);
  }

  /** Get all knowledge chunks */
  getAllChunks(): KnowledgeChunk[] {
    return this.chunks;
  }

  /** Get chunks by domain */
  getChunksByDomain(domain: KnowledgeDomain): KnowledgeChunk[] {
    return this.chunks.filter(c => c.domain === domain);
  }

  /** Get a single chunk by ID */
  getChunkById(id: string): KnowledgeChunk | undefined {
    return this.chunks.find(c => c.id === id);
  }

  /** Get all unique domains */
  getDomains(): KnowledgeDomain[] {
    return [...new Set(this.chunks.map(c => c.domain))];
  }

  /** Get total chunk count */
  get size(): number {
    return this.chunks.length;
  }
}

export const knowledgeBase = new KnowledgeBase();
