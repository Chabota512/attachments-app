import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function findNearbyCompanies(latitude: number, longitude: number, degree: string) {
  const prompt = `I am a student pursuing a ${degree} degree. My location is lat: ${latitude}, long: ${longitude}. Find 5 relevant companies nearby that might offer internships or jobs for someone in my field. For each company, provide: name, description, and why it's a good fit for my background. Return the data as a list of objects.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              fitScore: { type: Type.STRING, description: "Detailed explanation of why it fits the degree" },
              website: { type: Type.STRING },
            },
            required: ["name", "description", "fitScore"],
          },
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [];
  }
}

export async function draftApplicationLetter(companyName: number | string, role: string, degree: string, goals: string) {
  const prompt = `Draft a professional application letter (or email) for a ${role} position at ${companyName}. The applicant is pursuing a ${degree} degree. 
  Career goals: ${goals}. 
  The letter should be tailored, professional, and highlight how the degree degree aligns with the company's presumed needs. 
  Include placeholders like [Date], [Hiring Manager Name] if unknown.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert career coach and professional writer. Create highly tailored, persuasive application letters.",
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Drafting Error:", error);
    return "Error drafting letter. Please try again.";
  }
}

export async function researchCompany(companyName: string) {
  const prompt = `Research ${companyName}. Provide a summary of what they do, their company culture, and any recent news or projects that would be relevant for a potential job applicant to mention in an interview.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Research Error:", error);
    return "Could not find detailed research for this company.";
  }
}
