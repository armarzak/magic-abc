
import { GoogleGenAI, Type } from "@google/genai";
import { TranslationResult } from "../types";
import { commonWords } from "./fallbackDictionary";

// Helper to get AI instance safely. 
// Vercel sometimes has issues with process.env availability at the top level of modules.
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// Tier 2: Free Public API (MyMemory) - Used as a robust fallback
async function translateViaPublicApi(word: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ru`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const data = await response.json();
    
    if (data.responseData && data.responseData.translatedText) {
      const translation = data.responseData.translatedText.toLowerCase();
      if (translation && translation !== word.toLowerCase()) return translation;
    }
    return null;
  } catch (e) {
    console.warn("Public API fallback failed", e);
    return null;
  }
}

export const translateWord = async (word: string): Promise<TranslationResult> => {
  const cleanWord = word.trim().toLowerCase();
  
  // Tier 1: Local Dictionary (Immediate)
  if (commonWords[cleanWord]) {
    return { english: word, russian: commonWords[cleanWord] };
  }

  // Tier 2: Free Public API (No key needed)
  const apiResult = await translateViaPublicApi(cleanWord);
  if (apiResult) {
    return { english: word, russian: apiResult };
  }

  // Tier 3: Gemini (Sophisticated fallback)
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the English word "${word}" into a simple Russian equivalent for a child. Return only JSON: {"english": "...", "russian": "..."}`,
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
        },
      },
    });

    // Access the text property directly (not a function call)
    const text = response.text || "{}";
    const result = JSON.parse(text.trim());
    
    return {
      english: result.english || word,
      russian: result.russian || "Не удалось перевести",
    };
  } catch (error) {
    console.error("Gemini translation failed:", error);
    return { 
      english: word, 
      russian: "Попробуй еще раз" 
    };
  }
};
