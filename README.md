# Live Weather AI / WeatherGPT Pure REST API Backend (MoES Edition)

A production-ready, highly modular Node.js + TypeScript + Express **pure REST API engine** for **Live Weather AI / WeatherGPT**.

This backend API receives weather queries (in all 22 official Indian languages, English, or Hinglish via text or voice), resolves locations & landmarks, retrieves live weather & forecast data, computes AI Weather Risk Scores (0-100), calculates historical climate anomalies, generates smart advisories & SVG weather cards, produces structured hourly timeline JSON, provides voice STT/TTS API endpoints, builds multi-channel emergency notification payloads, supports festival modes & conversation memory, and uses an OpenAI-compatible LLM to return structured, production-ready JSON responses for your frontend application.

---

## Pure Backend API Architecture

```
Your Frontend App (React / Next.js / Vue / React Native / Flutter / iOS / Android)
  │
  ├── GET  /api/meta                (API Discovery & Metadata Engine)
  ├── POST /api/ask                 (Main Weather Query & Analysis API)
  ├── POST /api/voice/transcribe    (Speech-to-Text Audio API)
  ├── POST /api/voice/ask           (Voice Query Handler API)
  ├── POST /api/voice/speak         (Text-to-Speech Synthesis API)
  ├── POST /api/weather             (Direct Live Weather API)
  ├── POST /api/alerts              (Weather Risk & Threshold Alert Check API)
  ├── POST /api/make/webhook        (Make.com Automation Webhook API)
  └── GET  /health                  (Service Status & Health Check API)
  │
  ▼
Backend REST API Server (Node.js + Express.js + TypeScript + Zod)
  │
  ├── 1. Request Validation (Zod Schemas)
  ├── 2. Multilingual Language Engine (languageService)
  │      - Detects all 22 official Indian languages + English + Hinglish
  ├── 3. Conversation Memory Engine (conversationService)
  │      - Persists location & date context across turn-based follow-up queries via conversationId
  ├── 4. Landmark & Festival Resolver (landmarks.ts & festivals.ts)
  │      - Direct coordinate matching for Statue of Unity, Somnath Temple, Gir Forest, Sabarmati, etc.
  │      - Festival date calculation for Navratri, Diwali, IPL, Holi, etc.
  ├── 5. Geocoding Engine (Open-Meteo Geocoding / Cache)
  ├── 6. Live Weather Engine (Open-Meteo Forecast Provider / Cache)
  │      - Fetches Current + Hourly + Daily Weather Data in target timezone
  ├── 7. Offline Cache Fallback (weatherService)
  │      - Serves cached data with explicit notice if live API is temporarily unavailable (zero hallucination)
  ├── 8. Advanced AI Feature Engines:
  │      ├── AI Weather Risk Score Engine (riskService: 0-100 for Rain, Heat, Wind, Flood, UV)
  │      ├── Smart Advisory Engine (advisoryService: Farmer, Student, Traveler, Elderly, Outdoor Worker)
  │      ├── Best Time To Go Outside Engine (advisoryService: Calculates optimal 2-3 hour window)
  │      ├── Weather Mood & Clothing Engine (advisoryService: Emojis, clothing, umbrella, hydration, UV advice)
  │      ├── Weather Timeline Engine (timelineService: Hourly structured JSON for frontend charts)
  │      ├── Historical Climate Anomaly Engine (climateService: Compares live temp/rain vs 30-year baselines)
  │      ├── Multi-Channel Notification Payload Generator (notificationService: FCM / WebPush / WhatsApp)
  │      └── SVG Weather Infographic Generator (imageService: AI SVG forecast card data URI)
  ├── 9. WeatherGPT LLM Synthesis Engine (OpenAI API / System Prompt)
  └── 10. Asynchronous Make Webhook (makeService: Non-blocking alert dispatches when rain >= 70%)
```

---

## Complete API Endpoints Reference

### 1. API Metadata & Discovery (`GET /api/meta`)
Returns all supported 22 Indian languages, persona options, known landmarks, festival dates, and available endpoints so frontends can dynamically populate choices.

### 2. Main Natural Language Weather Query API (`POST /api/ask`)

**Request Body:**
```json
{
  "question": "Will it rain tomorrow in Morbi?",
  "location": {
    "latitude": 22.8173,
    "longitude": 70.8377
  },
  "language": "en",
  "conversationId": "optional_conversation_id_for_followups",
  "persona": "farmer"
}
```

**JSON Response (`200 OK`):**
```json
{
  "success": true,
  "answer": "Yes, rain is expected tomorrow evening in Morbi with probability reaching up to 78% around 6 PM (4.2 mm rain). Carrying an umbrella is recommended!",
  "language": "en",
  "conversationId": "c8f912a0-4b1c-4903-8d02-8f921a48b111",
  "location": {
    "name": "Morbi",
    "latitude": 22.8173,
    "longitude": 70.8377,
    "country": "India",
    "state": "Gujarat",
    "timezone": "Asia/Kolkata"
  },
  "weather": {
    "temperature": 29,
    "apparentTemperature": 31,
    "condition": "Rain showers",
    "rain_probability": 78,
    "rain_amount_mm": 4.2,
    "humidity": 75,
    "windSpeed": 14,
    "uvIndex": 5
  },
  "riskScores": {
    "overall": 68,
    "rain": 78,
    "heat": 40,
    "wind": 20,
    "flood": 30,
    "uv": 50,
    "severity": "high",
    "alerts": [
      "High Rain Probability (78%)"
    ]
  },
  "advisories": {
    "general": [
      "High rain probability detected. Carrying an umbrella or raincoat is strongly advised."
    ],
    "personalized": [
      {
        "persona": "farmer",
        "advice": [
          "Postpone pesticide and fertilizer spraying due to expected rainfall.",
          "Ensure proper field drainage to prevent waterlogging."
        ],
        "urgency": "warning"
      }
    ]
  },
  "bestTimeToGoOut": {
    "startHour": 7,
    "endHour": 10,
    "reason": "Low precipitation probability, comfortable temperature, and manageable wind.",
    "safetyScore": 88
  },
  "mood": {
    "emoji": "🌧️",
    "summary": "Rainy and wet",
    "clothing": [
      "Light, breathable fabrics"
    ],
    "umbrellaNeeded": true,
    "hydrationAdvice": "Drink normal amount of water.",
    "uvProtection": "No special UV protection needed."
  },
  "timeline": {
    "date": "2026-09-10",
    "timezone": "Asia/Kolkata",
    "hours": [
      {
        "time": "2026-09-10T09:00",
        "hour": 9,
        "hourLabel": "9 AM",
        "temperature": 28,
        "feelsLike": 28,
        "condition": "Partly cloudy",
        "conditionEmoji": "⛅",
        "rainProbability": 10,
        "rainAmount": 0,
        "windSpeed": 12,
        "humidity": 60,
        "uvIndex": 4,
        "isGoodToGoOut": true,
        "riskLevel": "safe"
      }
    ],
    "summary": {
      "bestHours": "7 AM - 9 AM",
      "worstHours": "4 PM - 6 PM",
      "peakTemperature": { "value": 31, "time": "2 PM" },
      "peakRain": { "probability": 78, "time": "6 PM" }
    }
  },
  "climateAnomaly": {
    "locationName": "Morbi",
    "month": "September",
    "currentTemperature": 29,
    "historicalAvgTemperature": 28.5,
    "temperatureAnomaly": 0.5,
    "currentRainProbability": 78,
    "historicalAvgRainfallMm": 95,
    "anomalySummary": "Morbi's current temperature (29°C) is normal for September (historical avg: 28.5°C).",
    "climateTrend": "unusual_rainfall"
  },
  "emergencyNotification": {
    "title": "🌧️ Severe Rain & Flood Risk Alert - Morbi",
    "body": "Heavy rainfall (rain probability 78%) is expected. Carrying an umbrella/raincoat is mandatory.",
    "icon": "🌩️",
    "channels": {
      "fcmPayload": { ... },
      "whatsappPayload": { ... },
      "webPushPayload": { ... }
    }
  },
  "weatherInfographic": {
    "svgDataUri": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0...",
    "locationName": "Morbi",
    "temperature": 29,
    "condition": "Rain showers",
    "rainProbability": 78,
    "riskSeverity": "HIGH"
  },
  "generated_at": "2026-09-09T20:30:00.000Z"
}
```

---

### 5. Reverse Geocoding API (`POST /api/location/reverse-geocode`)
Resolves latitude and longitude coordinates into city name, state, country, and formatted address.

**Request Body:**
```json
{
  "latitude": 22.8173,
  "longitude": 70.8377
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "location": {
    "name": "Morbi",
    "latitude": 22.8173,
    "longitude": 70.8377,
    "country": "India",
    "state": "Gujarat",
    "timezone": "Asia/Kolkata"
  },
  "formattedAddress": "Morbi, Gujarat, India"
}
```

---

### 6. Disaster Intelligence Alerts API (`GET /api/disaster/alerts`)
Fetches real-time disaster warnings (cyclones, floods, severe rain, heatwaves, high UV, lightning) for a location.

**Query Parameters:**
`location=Morbi` or `lat=22.8173&lon=70.8377`

**Response (`200 OK`):**
```json
{
  "success": true,
  "location": "Morbi",
  "alerts": [
    {
      "id": "alert-1725950000000-rain",
      "type": "heavy_rain",
      "severity": "warning",
      "title": "Severe Rain Alert",
      "description": "78% chance of heavy precipitation expected.",
      "precautions": ["Avoid low-lying areas", "Carry rain gear"],
      "affectedAreas": ["Morbi"],
      "issuedAt": "2026-09-10T10:00:00.000Z"
    }
  ]
}
```

---

### 7. Emergency Safety Guidance API (`GET /api/disaster/emergency-guide`)
Provides localized emergency safety protocols and step-by-step guidance for extreme weather disasters.

**Query Parameters:**
`disasterType=cyclone` & `language=gu`

**Response (`200 OK`):**
```json
{
  "success": true,
  "guidance": {
    "disasterType": "cyclone",
    "title": "વાવાઝોડા (Cyclone) સુરક્ષા માર્ગદર્શિકા",
    "dos": [
      "મજબૂત મકાનમાં આશ્રય લો.",
      "ઇમરજન્સી કિટ તૈયાર રાખો."
    ],
    "donts": [
      "દરિયા કિનારે કે ક્ષતિગ્રસ્ત મકાનો પાસે ન જાઓ."
    ],
    "emergencyContacts": [
      { "name": "રાજ્ય આપત્તિ મોનિટરિંગ (SDMA)", "number": "1070" },
      { "name": "રાષ્ટ્રીય આપત્તિ પ્રતિભાવ બળ (NDRF)", "number": "1078" }
    ]
  }
}
```

---

### 8. Weather Comparison API (`POST /api/weather/compare`)
Compares current weather, precipitation, air quality, and risk levels across multiple cities simultaneously.

**Request Body:**
```json
{
  "locations": ["Ahmedabad", "Mumbai", "Morbi"]
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "comparison": {
    "locations": [
      {
        "location": { "name": "Ahmedabad" },
        "temperature": 32,
        "condition": "Sunny",
        "rainProbability": 10,
        "humidity": 50,
        "windSpeed": 15,
        "uvIndex": 7,
        "airQuality": { "aqi": 65, "category": "Moderate" },
        "riskSeverity": "low"
      }
    ],
    "rankings": {
      "hottest": "Ahmedabad",
      "coolest": "Morbi",
      "rainiest": "Morbi",
      "bestWeather": "Ahmedabad"
    }
  }
}
```

---

### 9. Interactive Weather Map Overlay API (`GET /api/maps/weather`)
Provides map layer tile configurations and color legends for weather map visualizers.

**Query Parameters:**
`layer=rain` (options: `rain`, `temperature`, `wind`, `clouds`), `lat=23.0225`, `lon=72.5714`, `zoom=7`

**Response (`200 OK`):**
```json
{
  "success": true,
  "map": {
    "layer": "rain",
    "tileUrlTemplate": "https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=...",
    "attribution": "Map data © OpenWeatherMap / Open-Meteo",
    "center": { "lat": 23.0225, "lon": 72.5714, "zoom": 7 },
    "legend": [
      { "label": "Light Rain", "color": "#80C5DE" },
      { "label": "Heavy Rain", "color": "#000080" }
    ]
  }
}
```

---

### 10. Integrated Air Quality, Forecast Confidence & Conversation Context in `/api/ask`
The main query endpoint `/api/ask` automatically includes:
- **`airQuality`**: AQI, PM2.5, PM10, CO, NO2, O3, SO2 values, AQI category, and persona-specific health advice.
- **`forecastConfidence`**: Confidence score (0-100), rating (`HIGH` | `MODERATE` | `LOW`), horizon in days, and factor breakdowns.
- **`confidence`**: `{ forecast: 92, reason: "High quality hourly forecast available." }`
- **`explainWhy`**: `{ title: "...", summary: "...", factors: [...] }` empirical explanation object based strictly on live weather API metrics.
- **`communityReports`**: Crowdsourced weather reports & community confidence score.
- **`shareCard`**: Pre-formatted WhatsApp & social media card payload.
- **`conversationContext`**: Resolved location, target date (`today`, `tomorrow`, etc.), recognized intent, and active language.

---

### 11. Hyperlocal Community Weather Reports API (`POST /api/community/report` & `GET /api/community/reports`)
Allows crowdsourced user weather reporting with location clustering and Community Confidence Score generation.

**Submit Report (`POST /api/community/report`):**
```json
{
  "location": "Rajkot",
  "latitude": 22.30,
  "longitude": 70.79,
  "condition": "heavy_rain",
  "intensity": "high",
  "photo": "optional_data_url",
  "language": "gu"
}
```

**Get Reports & Confidence (`GET /api/community/reports?location=Rajkot`):**
```json
{
  "success": true,
  "reports": [...],
  "communityConfidence": {
    "totalReports": 3,
    "confidenceScore": 95,
    "clusterSummary": "3 crowdsourced report(s) in this area. 3 user(s) confirm rainfall activity."
  }
}
```

---

### 12. Route Weather Intelligence API (`POST /api/route/weather`)
Calculates distance, mid-route weather, rain zones, safe travel window, and ETA weather summary along a driving route between origin and destination.

**Request Body:**
```json
{
  "origin": "Rajkot",
  "destination": "Ahmedabad"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "routeWeather": {
    "origin": "Rajkot",
    "destination": "Ahmedabad",
    "totalDistanceKm": 215,
    "estimatedDurationHours": 3.3,
    "originWeather": { "temperature": 31, "condition": "Sunny", "rainProbability": 10 },
    "midRouteWeather": { "temperature": 30, "condition": "Sunny", "rainProbability": 15 },
    "destinationWeather": { "temperature": 33, "condition": "Partly Cloudy", "rainProbability": 10 },
    "rainZones": [],
    "safeTravelWindow": {
      "recommendedDeparture": "Immediate (Within next 1 hour)",
      "reason": "Favorable travel conditions with low precipitation risk along the route.",
      "safetyScore": 90
    },
    "etaWeatherSummary": "Driving route from Rajkot to Ahmedabad is ~215 km (approx 3.3 hrs)..."
  }
}
```

---

### 13. Shareable Social Weather Card API (`POST /api/share/card`)
Generates lightweight JSON payloads pre-formatted for WhatsApp, X (Twitter), and social sharing.

**Request Body:**
```json
{
  "location": "Rajkot"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "shareCard": {
    "title": "☀️ Weather Forecast for Rajkot - WeatherGPT",
    "text": "Rajkot: 31°C (Sunny), Rain Risk: 10%. Powered by WeatherGPT (MoES).",
    "formattedMessage": "🌦️ *WeatherGPT Live Report - Rajkot*\n\n🌡️ *Temperature*: 31°C...",
    "shareUrl": "https://weathergpt-backend-46or.onrender.com/api/ask?location=Rajkot",
    "tags": ["#WeatherGPT", "#RajkotWeather", "#MoES", "#SIH2024"]
  }
}
```

---

### 14. Weather Lens AI Camera API (`POST /api/weather/lens`) ⭐
Allows users to take a photo of the sky/clouds using their device camera, upload the image with an optional question, and receive visual cloud classification cross-verified with live Open-Meteo API data.

**Request Body:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "question": "આ વાદળો જોઈને કહો કાલે વરસાદ પડશે?",
  "location": "Rajkot",
  "language": "gu"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "weatherLens": {
    "detectedCloudType": "Cumulonimbus",
    "skyCondition": "Dark Cumulonimbus Rain/Thunderstorm Clouds",
    "estimatedCloudCoverPercentage": 85,
    "liveRainProbability": 78,
    "aiConfidence": 93,
    "apiVerificationStatus": "VERIFIED_WITH_OPEN_METEO",
    "answer": "📸 કેમેરા ફોટો વિશ્લેષણ મુજબ, આકાશમાં Dark Cumulonimbus Rain/Thunderstorm Clouds દર્શાય છે. live satellite અને IMD ડેટા મુજબ રાજકોટ માં વરસાદની શક્યતા 78% છે.",
    "advisory": "⚠️ ભારે વાદળો અને વરસાદની શક્યતા હોવાથી બહાર જતી વખતે છત્રી અથવા રેઈનકોટ સાથે રાખવો."
  }
}
```

---

### 15. Smart Crop / Kisan Intelligence API (`GET /api/agri/advisory`) ⭐
Generates agricultural weather advisories and **Krishi Index (0–100)** for farmers in **Gujarati (`gu`)**, **Hindi (`hi`)**, and **English (`en`)**.

**Query Parameters:**
`location=Rajkot` & `cropType=cotton` & `language=gu`

**Response (`200 OK`):**
```json
{
  "success": true,
  "agri": {
    "locationName": "Rajkot",
    "krishiIndex": 88,
    "cropRiskLevel": "LOW",
    "irrigationAdvice": "સામાન્ય હળવી સિંચાઈ કરી શકાય છે. વાતાવરણ અનુકૂળ છે.",
    "pesticideSuitability": "SUITABLE",
    "pesticideReason": "Low wind speed and clear conditions ideal for spraying.",
    "soilMoistureEstimate": "મધ્યમ (સામાન્ય)",
    "nextRainWindow": "આગામી 24 કલાકમાં વરસાદની શક્યતા નહિવત છે.",
    "language": "gu",
    "cropAdviceList": [
      "પાક: cotton",
      "સામાન્ય હળવી સિંચાઈ કરી શકાય છે. વાતાવરણ અનુકૂળ છે.",
      "જંતુનાશક છંટકાવ: SUITABLE (Low wind speed and clear conditions ideal for spraying.)",
      "ખેતરમાં પાણીના નિકાલની યોગ્ય વ્યવસ્થા જાળવી રાખવી."
    ]
  }
}
```

---

### 16. Weather Copilot API (`POST /api/copilot/plan`) ⭐
AI planner for outdoor activities (wedding, sports, travel, farming, outdoor events, daily activities) with confidence score, best time window, and multi-language guidance.

**Request Body:**
```json
{
  "activityType": "wedding",
  "location": "Rajkot",
  "language": "gu"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "copilot": {
    "activityType": "wedding",
    "location": "Rajkot",
    "recommendation": "Favorable",
    "bestTimeWindow": "09:00 - 12:00",
    "confidence": 94,
    "reasoning": "વાતાવરણ ચોખ્ખું અને આઉટડોર પ્રસંગ માટે ઉત્તમ છે.",
    "weatherFactors": {
      "temperature": 31,
      "feelsLike": 34,
      "rainProbability": 15,
      "rainAmountMm": 0,
      "windSpeed": 18,
      "humidity": 55,
      "uvIndex": 7,
      "condition": "Sunny"
    },
    "guidance": [
      "આઉટડોર ફોટોગ્રાફી અને પ્રસંગ માટે સાનુકૂળ સમય."
    ]
  }
}
```

---

### 17. Smart Notification AI API (`POST /api/notifications/schedule`, `POST /api/notifications/evaluate`) ⭐
Allows users to schedule weather trigger rules (`rain`, `heat`, `flood`, `wind`) and evaluates live triggers with Make.com webhook dispatching.

**Schedule Rule (`POST /api/notifications/schedule`):**
```json
{
  "location": "Rajkot",
  "triggerType": "rain",
  "threshold": 60,
  "frequency": "realtime",
  "channel": "make"
}
```

---

### 18. Accessibility Service API (`POST /api/accessibility/format`, `GET /api/accessibility/offline-phrases`) ⭐
Provides voice-first screen reader scripts, high-contrast, large-text UI metadata, and offline emergency phrasebooks in Gujarati, Hindi, and English.

**Format Accessibility Request (`POST /api/accessibility/format`):**
```json
{
  "location": "Rajkot",
  "language": "gu",
  "voiceFirst": true,
  "highContrast": true,
  "largeText": true
}
```

**Offline Emergency Phrases (`GET /api/accessibility/offline-phrases?category=cyclone`):**
Returns pre-packaged safety guidance phrases for offline PWA caching in Gujarati, Hindi, and English.

---

## Installation & Running API Server

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript project
npm run build

# 3. Run automated test suite (60 tests passing across 9 test suites)
npm test

# 4. Start production REST API server
npm start
```

