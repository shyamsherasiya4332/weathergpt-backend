import { logger } from '../../utils/logger.js';
import { WeatherData, RainAnalysisResult } from '../../types/weather.js';
import { WeatherRiskScores } from '../risk/riskService.js';

export type AdvisoryPersona = 'farmer' | 'student' | 'traveler' | 'elderly' | 'outdoor_worker' | 'general';

export interface PersonalizedAdvisory {
  persona: AdvisoryPersona;
  advice: string[];
  urgency: 'info' | 'caution' | 'warning' | 'danger';
}

export interface WeatherAdvisories {
  general: string[];
  personalized: PersonalizedAdvisory[];
  bestTimeToGoOut: {
    startHour: number;
    endHour: number;
    reason: string;
    safetyScore: number;  // 0-100
  } | null;
  mood: {
    emoji: string;
    summary: string;
    clothing: string[];
    umbrellaNeeded: boolean;
    hydrationAdvice: string;
    uvProtection: string;
  };
}

export class AdvisoryService {
  public generateAdvisories(
    weatherData: WeatherData,
    rainAnalysis: RainAnalysisResult,
    riskScores: WeatherRiskScores
  ): WeatherAdvisories {
    const generalAdvisories = this.generateGeneralAdvice(riskScores);
    const personalizedAdvisories = this.generatePersonalizedAdvice(weatherData, riskScores);
    const bestTime = this.calculateBestTimeToGoOut(weatherData);
    const mood = this.generateMood(weatherData, riskScores, rainAnalysis);

    return {
      general: generalAdvisories,
      personalized: personalizedAdvisories,
      bestTimeToGoOut: bestTime,
      mood: mood
    };
  }

  private generateGeneralAdvice(riskScores: WeatherRiskScores): string[] {
    const advice: string[] = [];
    if (riskScores.severity === 'extreme') advice.push('Extreme weather conditions. Avoid going out unless strictly necessary.');
    else if (riskScores.severity === 'high') advice.push('High weather risks present. Exercise significant caution.');
    else if (riskScores.severity === 'moderate') advice.push('Moderate weather conditions. Keep an eye on local updates.');
    else advice.push('Pleasant weather conditions overall.');
    
    return advice.concat(riskScores.alerts);
  }

  private generatePersonalizedAdvice(weatherData: WeatherData, riskScores: WeatherRiskScores): PersonalizedAdvisory[] {
    const advisories: PersonalizedAdvisory[] = [];
    
    // Farmer
    const farmerAdvice: string[] = [];
    let farmerUrgency: PersonalizedAdvisory['urgency'] = 'info';
    if (riskScores.rain > 70) {
      farmerAdvice.push('Delay irrigation due to high probability of rain.');
      farmerAdvice.push('Ensure proper drainage for crops to prevent waterlogging.');
      farmerUrgency = 'warning';
    } else if (riskScores.heat > 70) {
      farmerAdvice.push('High heat expected. Irrigate crops during early morning or late evening.');
      farmerUrgency = 'caution';
    } else {
      farmerAdvice.push('Good weather for regular field work.');
    }
    advisories.push({ persona: 'farmer', advice: farmerAdvice, urgency: farmerUrgency });

    // Student
    const studentAdvice: string[] = [];
    let studentUrgency: PersonalizedAdvisory['urgency'] = 'info';
    if (riskScores.rain > 50) {
      studentAdvice.push('Carry an umbrella or raincoat to school/college.');
    }
    if (riskScores.severity === 'high' || riskScores.severity === 'extreme') {
      studentAdvice.push('Consider avoiding non-essential commute if weather worsens.');
      studentUrgency = 'warning';
    } else {
      studentAdvice.push('Favorable conditions for commute and outdoor sports.');
    }
    advisories.push({ persona: 'student', advice: studentAdvice, urgency: studentUrgency });

    // Traveler
    const travelerAdvice: string[] = [];
    let travelerUrgency: PersonalizedAdvisory['urgency'] = 'info';
    if (riskScores.wind > 60 || riskScores.rain > 60) {
      travelerAdvice.push('Travel conditions may be hazardous. Check transport schedules for delays.');
      travelerUrgency = 'caution';
    } else {
      travelerAdvice.push('Good weather for travel. Enjoy your trip.');
    }
    advisories.push({ persona: 'traveler', advice: travelerAdvice, urgency: travelerUrgency });

    // Elderly
    const elderlyAdvice: string[] = [];
    let elderlyUrgency: PersonalizedAdvisory['urgency'] = 'info';
    if (riskScores.heat > 50 || riskScores.uv > 50) {
      elderlyAdvice.push('Avoid going outside during peak sun hours (10 AM to 4 PM).');
      elderlyUrgency = 'caution';
    }
    if (riskScores.severity === 'high' || riskScores.severity === 'extreme') {
      elderlyAdvice.push('Stay indoors to remain safe from harsh weather.');
      elderlyUrgency = 'warning';
    } else if (elderlyAdvice.length === 0) {
      elderlyAdvice.push('Weather is comfortable for a walk outside.');
    }
    advisories.push({ persona: 'elderly', advice: elderlyAdvice, urgency: elderlyUrgency });

    // Outdoor Worker
    const workerAdvice: string[] = [];
    let workerUrgency: PersonalizedAdvisory['urgency'] = 'info';
    if (riskScores.heat > 60 || riskScores.uv > 60) {
      workerAdvice.push('Take frequent shade breaks to avoid heat stress.');
      workerAdvice.push('Apply sunscreen and wear protective gear against UV exposure.');
      workerUrgency = 'warning';
    }
    if (riskScores.rain > 60) {
      workerAdvice.push('Keep rain gear handy and watch for slippery surfaces.');
    }
    if (workerAdvice.length === 0) {
      workerAdvice.push('Optimal conditions for outdoor work.');
    }
    advisories.push({ persona: 'outdoor_worker', advice: workerAdvice, urgency: workerUrgency });

    return advisories;
  }

  private calculateBestTimeToGoOut(weatherData: WeatherData): WeatherAdvisories['bestTimeToGoOut'] {
    if (!weatherData.hourly || weatherData.hourly.length === 0) {
      return null;
    }

    let bestScore = -1;
    let bestStart = 0;

    for (let i = 0; i < Math.min(weatherData.hourly.length, 24) - 2; i++) {
      let currentWindowScore = 0;
      
      for (let j = 0; j < 3; j++) {
        const h = weatherData.hourly[i + j];
        // Calculate a basic safety score per hour
        let score = 100;
        if (h.precipitationProbability && h.precipitationProbability > 50) score -= 30;
        if (h.temperature > 35) score -= 20;
        else if (h.temperature < 15) score -= 10;
        else if (h.temperature >= 22 && h.temperature <= 32) score += 10; // ideal temp
        if (h.windSpeed > 40) score -= 15;
        
        currentWindowScore += Math.max(0, score);
      }

      currentWindowScore = currentWindowScore / 3;

      if (currentWindowScore > bestScore) {
        bestScore = currentWindowScore;
        bestStart = i;
      }
    }

    if (bestScore === -1) return null;

    return {
      startHour: bestStart,
      endHour: bestStart + 3,
      reason: 'Low precipitation probability, comfortable temperature, and manageable wind.',
      safetyScore: Math.round(bestScore)
    };
  }

  private generateMood(weatherData: WeatherData, riskScores: WeatherRiskScores, rainAnalysis: RainAnalysisResult): WeatherAdvisories['mood'] {
    const temp = weatherData.current?.temperature ?? 20;
    
    let emoji = '🌤️';
    let summary = 'Clear and pleasant';
    if (riskScores.rain > 50) {
      emoji = '🌧️';
      summary = 'Rainy and wet';
      if (riskScores.wind > 50 || riskScores.rain > 80) emoji = '⛈️';
    } else if (riskScores.heat > 80) {
      emoji = '🥵';
      summary = 'Scorching hot';
    } else if (temp < 15) {
      emoji = '🥶';
      summary = 'Cold and chilly';
    } else if ((weatherData.current?.cloudCover ?? 0) > 50) {
      emoji = '☁️';
      summary = 'Cloudy skies';
    } else {
      emoji = '☀️';
      summary = 'Bright and sunny';
    }

    const clothing: string[] = [];
    if (temp > 30) clothing.push('Light, breathable fabrics');
    else if (temp < 15) clothing.push('Warm layers and jackets');
    else clothing.push('Comfortable casual wear');

    const umbrellaNeeded = riskScores.rain > 40 || (rainAnalysis.maxRainProbability ?? 0) > 40;
    
    let hydrationAdvice = 'Drink a normal amount of water.';
    if (temp > 30 || riskScores.heat > 50) hydrationAdvice = 'Drink plenty of water. Keep a water bottle handy.';
    
    let uvProtection = 'No special UV protection needed.';
    if (riskScores.uv > 50) uvProtection = 'Wear sunscreen, sunglasses, and a hat.';

    return {
      emoji,
      summary,
      clothing,
      umbrellaNeeded,
      hydrationAdvice,
      uvProtection
    };
  }
}

export const advisoryService = new AdvisoryService();
