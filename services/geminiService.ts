
import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from "../types";
import { commonWords } from "./fallbackDictionary";

// Initialize the Gemini API client using the recommended approach
// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Tier 2: Free Public API (MyMemory)
async function translateViaPublicApi(word: string): Promise<string | null> {
  try {
    // Adding timeout and headers to improve reliability
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ru`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const data = await response.json();
    
    if (data.responseData && data.responseData.translatedText) {
      const translation = data.responseData.translatedText.toLowerCase();
      // Ensure it didn't just return the source word or an empty result
      if (translation && translation !== word.toLowerCase()) return translation;
    }
    return null;
  } catch (e) {
    console.warn("Public API failed or timed out", e);
    return null;
  }
}

export const translateWord = async (word: string): Promise<TranslationResult> => {
  const cleanWord = word.trim().toLowerCase();
  
  // Tier 1: Local Dictionary (Instant & No Limits)
  if (commonWords[cleanWord]) {
    return { english: word, russian: commonWords[cleanWord] };
  }

  // Tier 2: Free Public API
  const apiResult = await translateViaPublicApi(cleanWord);
  if (apiResult) {
    return { english: word, russian: apiResult };
  }

  // Tier 3: Gemini (As fallback)
  try {
    // Using ai.models.generateContent directly as per guidelines
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the English word "${word}" into a simple Russian equivalent for an 8-year-old child. Return only JSON format: {"english": "...", "russian": "..."}`,
      config: {
        systemInstruction: "You are a simple English-Russian dictionary for kids. You translate one word at a time. Return JSON only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            russian: { type: Type.STRING },
          },
          required: ["english", "russian"],
          propertyOrdering: ["english", "russian"],
        },
      },
    });

    // Access text property directly without calling it as a function
    const text = response.text || "{}";
    const result = JSON.parse(text.trim());
    
    return {
      english: result.english || word,
      russian: result.russian || "Не удалось перевести",
    };
  } catch (error) {
    console.error("All translation tiers failed for:", word, error);
    // Final emergency fallback if even Gemini fails
    return { 
      english: word, 
      russian: "Попробуй еще раз" 
    };
  }
};
