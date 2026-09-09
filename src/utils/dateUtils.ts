export function getFormattedDateInTimezone(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date); // YYYY-MM-DD
  } catch {
    // Fallback if timezone string is invalid
    return date.toISOString().split('T')[0];
  }
}

export function getCurrentTimeInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'medium'
    }).format(new Date());
  } catch {
    return new Date().toLocaleString();
  }
}

export function getRelativeDateString(
  targetDate: 'today' | 'tomorrow' | 'day_after_tomorrow' | 'day_after_next' | 'specific_date' | 'next_3_days' | string,
  timezone: string,
  specificDate?: string
): string {
  const now = new Date();
  const todayStr = getFormattedDateInTimezone(now, timezone);

  if (targetDate === 'today') {
    return todayStr;
  }

  if (targetDate === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getFormattedDateInTimezone(tomorrow, timezone);
  }

  if (targetDate === 'day_after_tomorrow') {
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return getFormattedDateInTimezone(dayAfter, timezone);
  }

  if (targetDate === 'day_after_next') {
    const dayAfterNext = new Date(now);
    dayAfterNext.setDate(dayAfterNext.getDate() + 3);
    return getFormattedDateInTimezone(dayAfterNext, timezone);
  }

  if (targetDate === 'specific_date' && specificDate) {
    return specificDate;
  }

  return todayStr;
}

export function parseHourFromIso(isoString: string): number {
  const date = new Date(isoString);
  return date.getHours();
}

export function isHourInTimeRange(hour: number, timeRange?: 'current' | 'morning' | 'afternoon' | 'evening' | 'night' | 'specific_hours' | 'all_day', specificRange?: { startHour: number; endHour: number }): boolean {
  if (!timeRange || timeRange === 'all_day' || timeRange === 'current') return true;

  if (timeRange === 'morning') return hour >= 5 && hour <= 11;
  if (timeRange === 'afternoon') return hour >= 12 && hour <= 16;
  if (timeRange === 'evening') return hour >= 17 && hour <= 21;
  if (timeRange === 'night') return hour >= 22 || hour <= 4;

  if (timeRange === 'specific_hours' && specificRange) {
    const { startHour, endHour } = specificRange;
    if (startHour <= endHour) {
      return hour >= startHour && hour <= endHour;
    } else {
      // Overnight range, e.g., 22 to 4
      return hour >= startHour || hour <= endHour;
    }
  }

  return true;
}

export function weatherCodeToCondition(code: number): string {
  // WMO Weather interpretation codes (WW)
  switch (code) {
    case 0: return 'Clear sky';
    case 1: return 'Mainly clear';
    case 2: return 'Partly cloudy';
    case 3: return 'Overcast';
    case 45: return 'Fog';
    case 48: return 'Depositing rime fog';
    case 51: return 'Light drizzle';
    case 53: return 'Moderate drizzle';
    case 55: return 'Dense drizzle';
    case 56: return 'Light freezing drizzle';
    case 57: return 'Dense freezing drizzle';
    case 61: return 'Slight rain';
    case 63: return 'Moderate rain';
    case 65: return 'Heavy rain';
    case 66: return 'Light freezing rain';
    case 67: return 'Heavy freezing rain';
    case 71: return 'Slight snow fall';
    case 73: return 'Moderate snow fall';
    case 75: return 'Heavy snow fall';
    case 77: return 'Snow grains';
    case 80: return 'Slight rain showers';
    case 81: return 'Moderate rain showers';
    case 82: return 'Violent rain showers';
    case 85: return 'Slight snow showers';
    case 86: return 'Heavy snow showers';
    case 95: return 'Thunderstorm';
    case 96: return 'Thunderstorm with slight hail';
    case 99: return 'Thunderstorm with heavy hail';
    default: return 'Cloudy';
  }
}
