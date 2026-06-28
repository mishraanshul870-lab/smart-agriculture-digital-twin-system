import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

/**
 * Centralized Gemini model name.
 * gemini-2.0-flash has significantly higher free-tier rate limits than gemini-3.5-flash.
 * Change this single constant to switch all AI modules at once.
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function maskKey(key: string | undefined): string {
  if (!key) return 'NOT_SET';
  return `${key.substring(0, 6)}...${key.substring(Math.max(0, key.length - 4))} (len=${key.length})`;
}

export interface IDiseaseResponse {
  diseaseName: string;
  confidence: number;
  treatment: string;
  cropType?: string;
  // Rich Gemini-powered fields
  severity?: string;
  symptoms?: string;
  causes?: string;
  prevention?: string;
  estimatedRecovery?: string;
  irrigation?: string;
  fertilizer?: string;
}

export interface ISoilAnalysisResult {
  soilHealth: number;
  deficiencies: string[];
  fertilizerRecommendation: string;
  irrigationRecommendation: string;
  suitableCrops: string[];
  riskLevel: 'Low' | 'Moderate' | 'High';
  recommendations: string[];
}

export interface IYieldResponse {
  expectedYield: string;
  accuracy: string;
  confidenceLevel: 'High' | 'Moderate' | 'Low';
  revenue: string;
  cost: string;
  profit: string;
  weatherImpact: 'Positive' | 'Negative' | 'Neutral';
  diseaseRisk: 'Low' | 'Moderate' | 'High';
  fertilizerImpact: 'Optimal' | 'Sub-optimal' | 'Deficient';
  waterRequirement: 'Efficient' | 'High Usage' | 'Deficient';
  marketOutlook: 'Bullish' | 'Stable' | 'Bearish';
  riskAnalysis: string;
  recommendations: {
    increaseYield: string;
    waterOpt: string;
    nutrient: string;
    disease: string;
    harvest: string;
  };
}

let openaiClient: OpenAI | null = null;

const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY;
    const len = key ? key.length : 0;
    const prefix = key ? key.substring(0, 6) : "N/A";
    const suffix = key ? key.substring(Math.max(0, len - 4)) : "N/A";
    console.log(`[AI Init] Initializing OpenAI Client. Key Length: ${len}, Key Preview: ${prefix}...${suffix}`);
    openaiClient = new OpenAI({
      apiKey: key || "MOCK_KEY"
    });
  }
  return openaiClient;
};

export const getAIProvider = (): 'openai' | 'gemini' | 'mock' => {
  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase().trim();
  const openAIKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (provider === 'openai') {
    if (openAIKey && openAIKey !== 'MOCK_KEY' && openAIKey.trim().length > 0) {
      return 'openai';
    }
    console.warn("⚠️ OpenAI requested but OPENAI_API_KEY is missing. Falling back to mock.");
    return 'mock';
  }

  if (provider === 'gemini') {
    if (geminiKey && geminiKey !== 'MOCK_KEY' && geminiKey.trim().length > 0) {
      return 'gemini';
    }
    console.warn(`⚠️ Gemini requested but GEMINI_API_KEY is missing or invalid. Key Length: ${geminiKey ? geminiKey.length : 0}. Falling back to mock.`);
    return 'mock';
  }

  return 'mock';
};

/**
 * Perform a direct REST API call to Gemini Generative Language API.
 * This bypasses SDK authentication checks which misclassify the new AQ. API key prefixes.
 * Includes automatic retry with exponential backoff for 429 RESOURCE_EXHAUSTED errors.
 */
async function callGeminiRest(model: string, payload: any, apiKey: string, moduleName: string, maxRetries: number = 3): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const maskedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=MASKED`;
  console.log(`\n[Gemini Request] Module: ${moduleName}`);
  console.log(`  Key:   ${maskKey(apiKey)}`);
  console.log(`  Model: ${model}`);
  console.log(`  URL:   ${maskedUrl}`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log(`[Gemini Response] Module: ${moduleName} | Attempt: ${attempt}/${maxRetries} | HTTP Status: ${res.status} ${res.statusText}`);

      // On ANY non-OK response, log the FULL error body before deciding what to do
      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[Gemini FULL Error Body] Module: ${moduleName} | Status: ${res.status} | Body:\n${errBody}`);

        // Only retry on 429; all other errors are fatal
        if (res.status === 429 && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`[Gemini Retry] ${delay}ms backoff before attempt ${attempt + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Final failure — include the real status code in the error message
        throw new Error(`Gemini API Error (HTTP ${res.status}): ${errBody.substring(0, 500)}`);
      }

      // SUCCESS path
      const data = await res.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        console.error(`[Gemini REST Error] Invalid response structure:`, JSON.stringify(data).substring(0, 500));
        throw new Error("Gemini API response structure is missing generated text content candidates.");
      }

      console.log(`[Gemini Success] Module: ${moduleName} | Response length: ${candidateText.length} chars`);
      return candidateText;
    } catch (err: any) {
      if (err.message?.includes('Gemini API Error') || attempt >= maxRetries) {
        console.error(`[Gemini FATAL] Module: ${moduleName} | ${err.message}`);
        throw err;
      }
      // Network error on non-final attempt
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[Gemini Network Error] Module: ${moduleName} | attempt ${attempt}/${maxRetries} | ${err.message} | Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('callGeminiRest: exhausted all retries');
}

/**
 * Hindi language instruction appended to AI prompts when language is 'hi'.
 */
const HINDI_PROMPT_INSTRUCTION = `
IMPORTANT: You MUST respond entirely in simple, natural Hindi (Devanagari script, UTF-8 encoded).
Use easy Hindi that Indian farmers can easily understand.
Do not use English except for technical/scientific terms like pH, NPK, mg/kg, etc.
Provide complete, detailed responses — not short summaries.`;

export const aiService = {
  /**
   * Leaf Disease Diagnostics Analysis
   * @param language - 'en' for English (default), 'hi' for Hindi
   */
  async detectDisease(base64Image: string, mimeType: string, cropType: string, language: 'en' | 'hi' = 'en'): Promise<IDiseaseResponse> {
    const provider = getAIProvider();
    console.log(`[AI Disease Scan] Active Provider: ${provider}, cropType: "${cropType}", language: "${language}"`);

    if (provider === 'openai') {
      console.log(`[Backend Request] Provider: openai, Model: gpt-4o-mini, Crop: "${cropType}", Language: "${language}"`);
      const client = getOpenAIClient();
      const promptText = `You are an expert plant pathologist. Analyze this crop leaf image of crop type: "${cropType}".
Return JSON object matching exactly this schema: {"diseaseName": "Disease Name", "confidence": 0.92, "treatment": "Step-by-step treatment."}${language === 'hi' ? HINDI_PROMPT_INSTRUCTION : ''}`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' }
      });

      const resultText = response.choices[0]?.message?.content || '{}';
      console.log(`[Gemini/OpenAI Response] Raw: ${resultText}`);
      const parsed = JSON.parse(resultText);
      console.log(`[AI Disease Success] OpenAI result:`, parsed);
      return {
        diseaseName: parsed.diseaseName || 'Healthy',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : parseFloat(parsed.confidence || '0.90'),
        treatment: parsed.treatment || 'No specific treatment required.'
      };
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY || "";
      console.log(`[Backend Request] Provider: gemini, Model: ${GEMINI_MODEL}, API Key: ${maskKey(apiKey)}, Crop: "${cropType}", Language: "${language}"`);
      const promptText = `You are an expert plant pathologist. Analyze this crop leaf image of crop type: "${cropType}".
Return a JSON object matching EXACTLY this schema (no extra fields, no markdown):
{
  "diseaseName": "string — name of disease or 'Healthy' if no disease found",
  "confidence": 0.00,
  "treatment": "string — step-by-step treatment instructions",
  "severity": "None|Low|Moderate|High|Critical",
  "symptoms": "string — visible symptoms description",
  "causes": "string — biological or environmental causes",
  "prevention": "string — prevention measures",
  "estimatedRecovery": "string — e.g. '7-10 days' or 'N/A'",
  "irrigation": "string — specific watering advice to manage or prevent the disease",
  "fertilizer": "string — specific fertilizing advice to strengthen plant defenses against the disease"
}${language === 'hi' ? HINDI_PROMPT_INSTRUCTION : ''}`;

      const payload = {
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64Image } },
              { text: promptText }
            ]
          }
        ],
        generationConfig: { responseMimeType: "application/json" }
      };

      const resultText = await callGeminiRest(GEMINI_MODEL, payload, apiKey, "Leaf Diagnostics");
      console.log(`[Gemini Response] Disease Raw: ${resultText.substring(0, 300)}`);
      const parsed = JSON.parse(resultText || '{}');
      return {
        diseaseName: parsed.diseaseName || 'Healthy',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : parseFloat(parsed.confidence || '0.90'),
        treatment: parsed.treatment || 'No specific treatment required.',
        severity: parsed.severity || 'None',
        symptoms: parsed.symptoms || '',
        causes: parsed.causes || '',
        prevention: parsed.prevention || '',
        estimatedRecovery: parsed.estimatedRecovery || 'N/A',
        irrigation: parsed.irrigation || 'Maintain normal irrigation schedule.',
        fertilizer: parsed.fertilizer || 'Maintain standard fertilization regimen.'
      };
    }

    // --- Mock Fallback Mode ---
    console.log(`[AI Disease Scan] Running mock fallback logic (language: ${language})...`);
    const lowerCrop = cropType?.toLowerCase() || '';
    const isHealthy = lowerCrop.includes('healthy');

    if (language === 'hi') {
      // Hindi mock responses
      if (isHealthy) {
        return {
          diseaseName: 'स्वस्थ पत्ती संरचना', confidence: 0.95, treatment: 'कोई उपचार आवश्यक नहीं है।',
          severity: 'None', symptoms: 'कोई दृश्य लक्षण नहीं हैं।', causes: 'सर्वोत्तम उगाने की स्थितियाँ।',
          prevention: 'वर्तमान अनुसूची बनाए रखें।', estimatedRecovery: 'लागू नहीं',
          irrigation: 'सामान्य सिंचाई अनुसूची बनाए रखें।', fertilizer: 'मानक उर्वरक व्यवस्था जारी रखें।'
        };
      }
      return {
        diseaseName: 'अगेती झुलसा रोग (अल्टरनेरिया सोलानी)', confidence: 0.87,
        treatment: 'निचली पत्तियों की छँटाई करें और ताँबा-आधारित फफूंदनाशक का छिड़काव करें। प्रभावित पत्तियों को हटाकर नष्ट करें। 7-10 दिन के अंतराल पर मैन्कोज़ेब या क्लोरोथालोनिल का छिड़काव करें।',
        severity: 'Moderate', symptoms: 'निचली पत्तियों पर पीले घेरे वाले गहरे भूरे धब्बे। पत्तियाँ किनारों से सूखने लगती हैं और गिर जाती हैं।',
        causes: 'लंबे समय तक पत्तियों पर नमी बने रहने से फफूंद संक्रमण। गर्म और नम मौसम इस रोग को बढ़ावा देता है।',
        prevention: 'हवा का प्रवाह बेहतर बनाएँ, ऊपर से पानी देने से बचें। फसल चक्र अपनाएँ। प्रतिरोधी किस्मों का उपयोग करें।',
        estimatedRecovery: '7-14 दिन',
        irrigation: 'ऊपर से पानी देने से बचें। सुबह के समय पौधे की जड़ में ही पानी दें। ड्रिप सिंचाई का उपयोग करें।',
        fertilizer: 'नाइट्रोजन अस्थायी रूप से कम करें। पोटैशियम बढ़ाएँ जिससे कोशिका भित्ति मजबूत हो। संतुलित NPK उर्वरक का उपयोग करें।'
      };
    }

    // English mock responses (original)
    if (isHealthy) {
      return {
        diseaseName: 'Healthy Leaf Structure', confidence: 0.95, treatment: 'No treatment required.',
        severity: 'None', symptoms: 'No visible symptoms.', causes: 'Optimal growing conditions.',
        prevention: 'Maintain current schedule.', estimatedRecovery: 'N/A',
        irrigation: 'Maintain normal irrigation schedule.', fertilizer: 'Maintain standard fertilization regimen.'
      };
    }
    return {
      diseaseName: 'Early Blight (Alternaria solani)', confidence: 0.87,
      treatment: 'Prune lower leaves and apply copper-based fungicide.',
      severity: 'Moderate', symptoms: 'Dark lesions with yellow halos on lower leaves.',
      causes: 'Fungal infection from prolonged leaf wetness.',
      prevention: 'Improve air circulation, avoid overhead watering.',
      estimatedRecovery: '7-14 days',
      irrigation: 'Avoid overhead watering. Water strictly at the base during morning hours.',
      fertilizer: 'Reduce Nitrogen temporarily. Apply Potassium to strengthen cell walls.'
    };
  },

  /**
   * Soil Analysis recommendations
   * @param language - 'en' for English (default), 'hi' for Hindi
   */
  async getSoilRecommendations(params: {
    cropType: string;
    moisture: number;
    pH: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    organicCarbon: number;
    temperature: number;
    humidity: number;
    language?: 'en' | 'hi';
  }): Promise<ISoilAnalysisResult> {
    const provider = getAIProvider();
    const language = params.language || 'en';
    console.log(`[AI Soil Recs] Provider: ${provider}, crop: "${params.cropType}", pH: ${params.pH}, moisture: ${params.moisture}%, language: "${language}"`);
    
    const prompt = `You are an expert agronomist AI. Analyze these real soil test parameters for a ${params.cropType} farm:
- Soil Moisture: ${params.moisture}%
- Soil pH: ${params.pH}
- Nitrogen (N): ${params.nitrogen} mg/kg
- Phosphorus (P): ${params.phosphorus} mg/kg
- Potassium (K): ${params.potassium} mg/kg
- Organic Carbon: ${params.organicCarbon}%
- Temperature: ${params.temperature}°C
- Humidity: ${params.humidity}%

Return a JSON object matching EXACTLY this schema (no markdown, no extra text):
{
  "soilHealth": 7.5,
  "deficiencies": ["Nitrogen", "Phosphorus"],
  "fertilizerRecommendation": "string — specific NPK advice",
  "irrigationRecommendation": "string — watering schedule advice",
  "suitableCrops": ["Tomato", "Maize", "Potato"],
  "riskLevel": "Low",
  "recommendations": [
    "Bullet point 1",
    "Bullet point 2",
    "Bullet point 3",
    "Bullet point 4",
    "Bullet point 5"
  ]
}
soilHealth must be a number from 1 to 10. riskLevel must be "Low", "Moderate", or "High".${language === 'hi' ? HINDI_PROMPT_INSTRUCTION : ''}`;

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY || "";
      console.log(`[Backend Request] Provider: gemini, Model: ${GEMINI_MODEL}, API Key: ${maskKey(apiKey)}`);
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };
      const text = await callGeminiRest(GEMINI_MODEL, payload, apiKey, "Soil Analysis");
      console.log(`[Gemini Response] Soil Raw: ${text.substring(0, 300)}`);
      const parsed = JSON.parse(text || '{}');
      return {
        soilHealth: typeof parsed.soilHealth === 'number' ? parsed.soilHealth : 5.0,
        deficiencies: Array.isArray(parsed.deficiencies) ? parsed.deficiencies : [],
        fertilizerRecommendation: parsed.fertilizerRecommendation || '',
        irrigationRecommendation: parsed.irrigationRecommendation || '',
        suitableCrops: Array.isArray(parsed.suitableCrops) ? parsed.suitableCrops : [],
        riskLevel: (['Low','Moderate','High'].includes(parsed.riskLevel) ? parsed.riskLevel : 'Low') as 'Low'|'Moderate'|'High',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
      };
    }

    if (provider === 'openai') {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      const text = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(text);
      return {
        soilHealth: typeof parsed.soilHealth === 'number' ? parsed.soilHealth : 5.0,
        deficiencies: Array.isArray(parsed.deficiencies) ? parsed.deficiencies : [],
        fertilizerRecommendation: parsed.fertilizerRecommendation || '',
        irrigationRecommendation: parsed.irrigationRecommendation || '',
        suitableCrops: Array.isArray(parsed.suitableCrops) ? parsed.suitableCrops : [],
        riskLevel: (['Low','Moderate','High'].includes(parsed.riskLevel) ? parsed.riskLevel : 'Low') as 'Low'|'Moderate'|'High',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
      };
    }

    // --- Mock Fallback Mode ---
    console.log(`[AI Soil Recs] Running mock fallback logic (language: ${language})...`);
    const phOk = params.pH >= 6.0 && params.pH <= 7.2;

    if (language === 'hi') {
      // Hindi mock responses
      return {
        soilHealth: phOk && params.moisture > 35 ? 7.2 : 5.0,
        deficiencies: params.nitrogen < 50 ? ['नाइट्रोजन'] : params.phosphorus < 30 ? ['फास्फोरस'] : [],
        fertilizerRecommendation: `${params.nitrogen < 50 ? 'नाइट्रोजन युक्त खाद डालें जैसे यूरिया या DAP। प्रति एकड़ 50 किलो नाइट्रोजन दें।' : 'संतुलित NPK 19-19-19 उर्वरक डालें। प्रति एकड़ 25 किलो दें। मिट्टी का पोषण संतुलित है।'}`,
        irrigationRecommendation: `नमी ${params.moisture}% है। ${params.moisture < 35 ? 'तुरंत सिंचाई करें। पौधों को पानी की तत्काल आवश्यकता है। ड्रिप सिंचाई सबसे अच्छी है।' : 'सामान्य सिंचाई अनुसूची जारी रखें। नमी का स्तर सही है।'}`,
        suitableCrops: [params.cropType, 'मक्का', 'सोयाबीन'],
        riskLevel: params.humidity > 80 ? 'High' : phOk ? 'Low' : 'Moderate',
        recommendations: [
          `मिट्टी का pH ${params.pH} ${params.cropType} के लिए ${phOk ? 'उपयुक्त है। यह फसल के लिए अच्छा है।' : 'अनुपयुक्त है। चूना या जिप्सम डालकर सुधारें।'}`,
          `नाइट्रोजन ${params.nitrogen} mg/kg — ${params.nitrogen < 50 ? 'बूस्टर खाद डालें। यूरिया या अमोनियम सल्फेट का उपयोग करें।' : 'पर्याप्त है। वर्तमान स्तर बनाए रखें।'}`,
          `नमी ${params.moisture}% — ${params.moisture < 35 ? 'अभी सिंचाई करें। पौधे मुरझा सकते हैं।' : 'सामान्य अनुसूची। नमी सही है।'}`,
          `तापमान ${params.temperature}°C सक्रिय विकास के लिए उपयुक्त है। फसल अच्छी तरह बढ़ेगी।`,
          `आर्द्रता ${params.humidity}% — ${params.humidity > 80 ? 'फयूंद रोग का खतरा है। नियमित जाँच करें। फयूंदनाशक तैयार रखें।' : 'फयूंद का खतरा कम है। अच्छी स्थिति है।'}`
        ]
      };
    }

    // English mock responses (original)
    return {
      soilHealth: phOk && params.moisture > 35 ? 7.2 : 5.0,
      deficiencies: params.nitrogen < 50 ? ['Nitrogen'] : params.phosphorus < 30 ? ['Phosphorus'] : [],
      fertilizerRecommendation: `Apply ${params.nitrogen < 50 ? 'nitrogen-rich' : 'balanced NPK 19-19-19'} fertilizer.`,
      irrigationRecommendation: `Moisture at ${params.moisture}%. ${params.moisture < 35 ? 'Irrigate immediately.' : 'Maintain normal schedule.'}`,
      suitableCrops: [params.cropType, 'Maize', 'Soybean'],
      riskLevel: params.humidity > 80 ? 'High' : phOk ? 'Low' : 'Moderate',
      recommendations: [
        `Soil pH ${params.pH} is ${phOk ? 'optimal' : 'sub-optimal'} for ${params.cropType}.`,
        `Nitrogen at ${params.nitrogen} mg/kg — ${params.nitrogen < 50 ? 'apply booster' : 'adequate'}.`,
        `Moisture ${params.moisture}% — ${params.moisture < 35 ? 'irrigate now' : 'normal schedule'}.`,
        `Temperature ${params.temperature}°C suitable for active growth.`,
        `Humidity ${params.humidity}% — ${params.humidity > 80 ? 'monitor for fungal risk' : 'low fungal risk'}.`
      ]
    };
  },

  /**
   * Yield prediction model calculations
   * @param language - 'en' for English (default), 'hi' for Hindi
   */
  async predictYield(params: {
    cropType: string;
    area: number;
    season: string;
    soilType: string;
    weather: string;
    irrigation: string;
    fertilizer: string;
    historicalYield: number;
    language?: 'en' | 'hi';
  }): Promise<IYieldResponse> {
    const provider = getAIProvider();
    const language = params.language || 'en';
    const apiKeyPreview = maskKey(process.env.GEMINI_API_KEY);
    console.log(`[AI Yield Predict] Active Provider: ${provider}, API Key: ${apiKeyPreview}, Model: ${GEMINI_MODEL}, Language: ${language}`);
    console.log(`[AI Yield Predict] Params:`, JSON.stringify({ cropType: params.cropType, area: params.area, season: params.season }));
    const prompt = `You are an expert agronomist AI. Using the ACTUAL farm data provided below, generate a precise yield prediction.

FARM DATA:
- Crop Type: ${params.cropType}
- Planted Area: ${params.area} acres
- Season: ${params.season}
- Soil Type: ${params.soilType}
- Latest Soil pH: ${(params as any).soilPH ?? 'N/A'}
- Soil Moisture: ${(params as any).soilMoisture ?? 'N/A'}%
- Soil Nitrogen: ${(params as any).soilNitrogen ?? 'N/A'} mg/kg
- Soil Phosphorus: ${(params as any).soilPhosphorus ?? 'N/A'} mg/kg
- Soil Potassium: ${(params as any).soilPotassium ?? 'N/A'} mg/kg
- Active Crops: ${(params as any).activeCrops ?? 'N/A'}
- Latest Weather: ${params.weather}
- Latest Temperature: ${(params as any).weatherTemp ?? 'N/A'}°C
- Latest Humidity: ${(params as any).weatherHumidity ?? 'N/A'}%
- Irrigation Type: ${params.irrigation}
- Irrigation Sessions (last 5): ${(params as any).irrigationSummary ?? 'N/A'}
- Fertilizer Applications (last 5): ${(params as any).fertilizerSummary ?? 'N/A'}
- Historical Yield: ${params.historicalYield} tons

Return ONLY a valid JSON object (no markdown) matching this exact schema:
{
  "expectedYield": "numeric yield in tons as string",
  "accuracy": "predicted accuracy percentage 85-99 as string",
  "confidenceLevel": "High",
  "revenue": "estimated revenue USD as string",
  "cost": "estimated cost USD as string",
  "profit": "estimated net profit USD as string",
  "weatherImpact": "Positive",
  "diseaseRisk": "Low",
  "fertilizerImpact": "Optimal",
  "waterRequirement": "Efficient",
  "marketOutlook": "Bullish",
  "riskAnalysis": "detailed risk analysis",
  "recommendations": {
    "increaseYield": "recommendation",
    "waterOpt": "recommendation",
    "nutrient": "recommendation",
    "disease": "recommendation",
    "harvest": "recommendation"
  }
}${language === 'hi' ? HINDI_PROMPT_INSTRUCTION : ''}`;

    if (provider === 'openai') {
      console.log(`[Backend Request] Provider: openai, Model: gpt-4o-mini`);
      console.log(`[Backend Request Prompt]: ${prompt}`);
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      const text = response.choices[0]?.message?.content || '{}';
      console.log(`[Gemini/OpenAI Response] Raw: ${text}`);
      return JSON.parse(text);
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY || "";
      console.log(`[Backend Request] Provider: gemini, Model: ${GEMINI_MODEL}, API Key: ${maskKey(apiKey)}`);
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };
      const text = await callGeminiRest(GEMINI_MODEL, payload, apiKey, "Yield Prediction");
      console.log(`[Gemini Response] Raw: ${text}`);
      return JSON.parse(text || '{}');
    }

    // --- Mock Fallback Mode ---
    console.log(`[AI Yield Predict] Running mock fallback logic (language: ${language})...`);
    const { cropType, area, fertilizer, season } = params;
    const yieldMap: Record<string, number> = { Wheat: 2.8, Corn: 4.5, Rice: 3.8, Tomato: 22.0, Soybean: 1.6, Cotton: 1.1, Sugarcane: 36.5, Potato: 12.0, Apple: 18.0, 'Green Chilli': 8.0 };
    const baseYield = area * (yieldMap[cropType] || 2.5) * (season === 'Winter' ? 0.4 : 1.0) * (fertilizer === 'None' ? 0.7 : 1.0);
    const priceMap: Record<string, number> = { Wheat: 280, Rice: 450, Tomato: 600, Cotton: 800, Sugarcane: 120, 'Green Chilli': 500 };
    const revenue = baseYield * (priceMap[cropType] || 350);
    const cost = area * 480;

    if (language === 'hi') {
      // Hindi mock responses
      return {
        expectedYield: baseYield.toFixed(1), accuracy: '92.0', confidenceLevel: 'High',
        revenue: Math.max(0, revenue).toFixed(0), cost: cost.toFixed(0), profit: (revenue - cost).toFixed(0),
        weatherImpact: 'Neutral', diseaseRisk: 'Low', fertilizerImpact: fertilizer === 'None' ? 'Deficient' : 'Optimal',
        waterRequirement: 'Efficient', marketOutlook: revenue > cost ? 'Bullish' : 'Stable',
        riskAnalysis: 'मानक कृषि मॉडल पर आधारित। वर्तमान मौसम और मिट्टी की स्थिति के अनुसार फसल का अनुमान लगाया गया है। बाजार की कीमतें स्थिर हैं। रोग का खतरा कम है। लाइव Gemini विश्लेषण मॉक मोड में उपलब्ध नहीं है।',
        recommendations: {
          increaseYield: 'वनस्पति अवस्था में टॉप-ड्रेसिंग खाद डालें। यूरिया का छिड़काव करें। फसल की नियमित जाँच करें।',
          waterOpt: 'ड्रिप सिंचाई का उपयोग करें जिससे 30% पानी की बचत होगी। सुबह या शाम को सिंचाई करें।',
          nutrient: fertilizer === 'None' ? 'तुरंत NPK उर्वरक डालें। फसल को पोषण की जरूरत है।' : 'सूक्ष्म पोषक तत्व जैसे जिंक, बोरॉन और लोहा भी डालें। जैविक खाद का उपयोग करें।',
          disease: 'हर हफ्ते कीड़ों और रोगों की जाँच करें। नीम का तेल का छिड़काव करें।',
          harvest: '45-60 दिनों में सही समय पर कटाई करें। फसल पकने पर तुरंत तोड़ें।'
        }
      };
    }

    // English mock responses (original)
    return {
      expectedYield: baseYield.toFixed(1), accuracy: '92.0', confidenceLevel: 'High',
      revenue: Math.max(0, revenue).toFixed(0), cost: cost.toFixed(0), profit: (revenue - cost).toFixed(0),
      weatherImpact: 'Neutral', diseaseRisk: 'Low', fertilizerImpact: fertilizer === 'None' ? 'Deficient' : 'Optimal',
      waterRequirement: 'Efficient', marketOutlook: revenue > cost ? 'Bullish' : 'Stable',
      riskAnalysis: 'Based on standard agronomic models. Actual live Gemini analysis unavailable in mock mode.',
      recommendations: {
        increaseYield: 'Apply top-dressing during vegetative stage.',
        waterOpt: 'Use drip irrigation to save 30% water.',
        nutrient: fertilizer === 'None' ? 'Apply NPK immediately.' : 'Supplement with micronutrients.',
        disease: 'Monitor weekly for pests.',
        harvest: 'Target optimal harvest in 45-60 days.'
      }
    };
  },

  /**
   * Conversational Agronomist Chat AI
   */
  async chat(message: string, farmContext: string): Promise<string> {
    const provider = getAIProvider();
    
    const key = process.env.GEMINI_API_KEY;
    const keyLength = key ? key.length : 0;
    const keyPrefix = key ? key.substring(0, 6) : "N/A";
    const keySuffix = key ? key.substring(Math.max(0, keyLength - 4)) : "N/A";
    console.log(`[AI Chat Request] Provider: ${provider}, GEMINI_API_KEY present: ${!!key} (Length: ${keyLength}, Prefix: ${keyPrefix}..., Suffix: ...${keySuffix})`);

    if (provider === 'openai') {
      console.log(`[Backend Request] Provider: openai, Model: gpt-4o-mini, Message: "${message}"`);
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an AI agricultural assistant. Use the user\'s farm data for context. Respond concisely and helpfully as an agronomist.'
          },
          {
            role: 'user',
            content: `Farm Context: [${farmContext}]. User Question: "${message}"`
          }
        ]
      });
      const replyText = response.choices[0]?.message?.content || '';
      console.log(`[AI Chat Success] OpenAI Response: "${replyText.substring(0, 100)}..."`);
      return replyText;
    }

    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY || "";
      console.log(`[Backend Request] Provider: gemini, Model: ${GEMINI_MODEL}, API Key: ${maskKey(apiKey)}, Message: "${message}"`);
      
      const prompt = `You are a professional agronomist and AI agricultural assistant. 
Your goal is to help the farmer using the actual farm telemetry, sensor records, and history provided below.
Prioritize using the details in the Farm Context to answer the user's question, rather than generic agricultural knowledge.

FARM CONTEXT:
${farmContext}

USER QUESTION:
"${message}"

CONSTRAINTS & INSTRUCTIONS:
1. Keep the AI strictly focused on agriculture, farming, crops, soil, weather, irrigation, pests, and agricultural operations. If the user's question is not related to these topics, politely decline to answer.
2. You must return your response in a structured format with the following exact Markdown headings (do not change or omit these headers):

### Summary
[Provide a concise summary of the issue or topic]

### Analysis
[Analyze the situation using the provided farm context, sensor data, and crop details]

### Recommendation
[Provide actionable recommendations customized to this farm's records]

### Next Action
[Specify the immediate next steps the farmer should take]`;

      console.log(`[AI Chat Flow] Prompt Context Length: ${farmContext.length}, Message: "${message}"`);

      const payload = {
        contents: [{ parts: [{ text: prompt }] }]
      };
      
      const replyText = await callGeminiRest(GEMINI_MODEL, payload, apiKey, "AI Assistant");
      console.log(`[Gemini Response]: "${replyText}"`);
      return replyText;
    }

    // --- Mock Fallback Mode (Only runs when AI_PROVIDER === 'mock') ---
    console.log(`[AI Chat Flow] Running mock fallback logic...`);
    return `### Summary
The AI Assistant is currently in simulation mode.

### Analysis
Mock mode is active. In-memory data shows stable moisture levels and healthy crop indicators.

### Recommendation
Set up a valid GEMINI_API_KEY to activate live, context-rich analysis of your farm twin.

### Next Action
Add your API credentials to the environment file.`;
  }
};
