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

// ✅ Helper to map short grade to full name for AI context
const getFullGradeName = (grade: string): string => {
  const map: Record<string, string> = {
    'P1': 'Prathom 1 (Grade 1)',
    'P2': 'Prathom 2 (Grade 2)',
    'P3': 'Prathom 3 (Grade 3)',
    'P4': 'Prathom 4 (Grade 4)',
    'P5': 'Prathom 5 (Grade 5)',
    'P6': 'Prathom 6 (Grade 6)',
    'M1': 'Matthayom 1 (Grade 7)',
    'M2': 'Matthayom 2 (Grade 8)',
    'M3': 'Matthayom 3 (Grade 9)',
    'ALL': 'Elementary to Junior High School level'
  };
  return map[grade] || grade;
};

export const generateQuestionWithAI = async (
  subject: string,
  grade: string,
  topic: string,
  apiKey: string,
  count: number = 1,
  style: 'normal' | 'onet' = 'normal' 
): Promise<GeneratedQuestion[] | null> => {
  try {
    if (!apiKey) {
      throw new Error("กรุณาระบุ API Key");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = "gemini-2.5-flash";
    
    // ✅ Use full grade name for better AI context
    const targetGrade = getFullGradeName(grade);
    let systemInstruction = "";
    
    if (style === 'onet') {
      // 🟢 O-NET Specific Instruction (Updated for P1-M3 support)
      systemInstruction = `
        You are an expert exam creator for Thailand's O-NET (Ordinary National Educational Test) style assessments.
        Target Audience: Students in ${targetGrade}.
        
        Your task is to generate standardized exam questions by analyzing and simulating the style, difficulty, and format of past O-NET exam papers (ข้อสอบเก่า) from B.E. 2560-2567 (A.D. 2017-2024), specifically tailored for ${targetGrade}.
        
        Key Requirements for O-NET Style:
        - Reference: Mimic the style of actual past O-NET exams (ปี 2560-2567).
        - Difficulty: Challenging and appropriate for the specific grade level (${targetGrade}), requiring critical thinking (คิดวิเคราะห์), integration of knowledge, application skills, not just rote memory.
        - Language: Formal Academic Thai (ภาษาทางการแบบข้อสอบจริง).
        - Subject Context: Strictly aligns with the Thai Basic Education Curriculum B.E. 2551 (Updated 2560) for ${targetGrade}.
        - Question Types: Situation-based questions, reading comprehension, charts/graphs interpretation, or problem-solving scenarios often found in O-NET exams.
      `;
    } else {
      // 🟢 Normal Instruction
      systemInstruction = `
        You are a helpful teacher assistant creating multiple-choice questions for ${targetGrade} grade students.
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
    
    return null;
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
};