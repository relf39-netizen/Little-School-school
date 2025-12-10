
import { GoogleGenAI, Type } from "@google/genai";

export interface GeneratedQuestion {
  text: string;
  c1: string;
  c2: string;
  c3: string;
  c4: string;
  correct: string;
  explanation: string;
  image?: string; 
}

const generateImageUrl = (description: string): string => {
  if (!description || description.trim().length === 0 || description.toLowerCase() === 'none') return '';
  const encodedPrompt = encodeURIComponent(description + " cartoon style, for kids, educational, white background, simple, clear, high quality");
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true`;
};

// ฟังก์ชันหน่วงเวลา (Helper)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateQuestionWithAI = async (
  subject: string,
  grade: string,
  topic: string,
  apiKey: string,
  count: number = 1,
  style: 'normal' | 'onet' = 'normal' 
): Promise<GeneratedQuestion[] | null> => {
  if (!apiKey) {
    throw new Error("กรุณาระบุ API Key");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const model = "gemini-2.5-flash";
  
  let systemInstruction = "";
  
  if (style === 'onet') {
    // 🟢 O-NET Specific Instruction
    systemInstruction = `
      You are an expert exam creator for Thailand's O-NET (Ordinary National Educational Test) for Grade 6 (Prathom 6).
      Your task is to generate standardized exam questions by analyzing and simulating the style, difficulty, and format of past O-NET exam papers (ข้อสอบเก่า) from B.E. 2560-2567 (A.D. 2017-2024).
      
      Key Requirements for O-NET Style:
      - Reference: Mimic the style of actual past O-NET exams (ปี 2560-2567) rigorously.
      - Difficulty: Challenging, requiring critical thinking (คิดวิเคราะห์), integration of knowledge, application skills, not just rote memory.
      - Language: Formal Academic Thai (ภาษาทางการแบบข้อสอบจริง).
      - Subject Context: Strictly aligns with the Thai Basic Education Curriculum B.E. 2551 (Updated 2560).
      - Question Types: Situation-based questions, reading comprehension, charts/graphs interpretation, or problem-solving scenarios often found in O-NET exams.
    `;
  } else {
    // 🟢 Normal Instruction
    systemInstruction = `
      You are a helpful teacher assistant creating multiple-choice questions for ${grade} grade students.
      Language: Thai (Natural, age-appropriate, and encouraging).
    `;
  }

  const prompt = `
    ${systemInstruction}
    
    Task: Create ${count} multiple-choice question(s).
    Subject: ${subject}
    Topic/Strand: ${topic}
    
    Requirements:
    - Return an array of objects.
    - Each object must have 4 choices (c1, c2, c3, c4).
    - Indicate the correct choice number (1, 2, 3, or 4).
    - Provide a clear and educational explanation for the correct answer (in Thai).
    - If the question involves a visual scenario (e.g., geometry, animal characteristics, map) provide a concise English description in 'image_description'. If no image is needed, use "none".
  `;

  // 🔄 Retry Logic (ลองใหม่สูงสุด 3 ครั้ง)
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY, 
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "The question text" },
                c1: { type: Type.STRING, description: "Choice 1" },
                c2: { type: Type.STRING, description: "Choice 2" },
                c3: { type: Type.STRING, description: "Choice 3" },
                c4: { type: Type.STRING, description: "Choice 4" },
                correct: { type: Type.STRING, description: "The correct choice number '1', '2', '3', or '4'" },
                explanation: { type: Type.STRING, description: "Explanation of the answer" },
                image_description: { type: Type.STRING, description: "Visual description in English for image generation (or 'none')" }
              },
              required: ["text", "c1", "c2", "c3", "c4", "correct", "explanation"],
            },
          },
        },
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        const rawArray = Array.isArray(data) ? data : [data];
        
        return rawArray.map((item: any) => ({
          text: item.text,
          c1: item.c1,
          c2: item.c2,
          c3: item.c3,
          c4: item.c4,
          correct: item.correct,
          explanation: item.explanation,
          image: item.image_description ? generateImageUrl(item.image_description) : ''
        }));
      }
      
      return null; // ถ้าไม่มี text ตอบกลับ (แต่ไม่ error) ให้ return null

    } catch (error: any) {
      attempts++;
      console.warn(`AI Generation Attempt ${attempts} failed:`, error);

      // เช็คว่าเป็น Error 503 (Overloaded) หรือไม่
      const isOverloaded = error?.status === 503 || error?.code === 503 || (error?.message && error.message.includes('overloaded'));

      if (isOverloaded && attempts < maxAttempts) {
        const waitTime = 2000 * attempts; // รอ 2วิ, 4วิ, ...
        console.log(`Model overloaded. Retrying in ${waitTime/1000} seconds...`);
        await delay(waitTime);
        continue; // วนรอบใหม่
      } else {
        // ถ้าไม่ใช่ 503 หรือครบจำนวนครั้งแล้ว ให้โยน Error ออกไป
        console.error("AI Generation Fatal Error:", error);
        throw error;
      }
    }
  }
  
  return null;
};
