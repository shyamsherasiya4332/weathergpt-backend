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

### 3. Speech-to-Text Transcription API (`POST /api/voice/transcribe`)
- **Headers**: `Content-Type: audio/wav` (or `audio/webm`, `audio/mp3`)
- **Body**: Binary audio buffer
- **Response**: `{ "success": true, "transcription": "...", "detectedLanguage": "en" }`

---

### 4. Text-to-Speech Synthesis API (`POST /api/voice/speak`)
- **Request Body**: `{ "text": "કાલે મોરબીમાં વરસાદની શક્યતા 78% છે.", "language": "gu" }`
- **Response**: Binary MP3 audio buffer (`Content-Type: audio/mp3`)

---

## Installation & Running API Server

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript project
npm run build

# 3. Run automated test suite (35 tests passing)
npm test

# 4. Start production REST API server
npm start
```
