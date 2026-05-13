import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function findNearbyCompanies(
  latitude: number,
  longitude: number,
  city: string,
  province: string,
  degree: string
) {
  const location = province ? `${city}, ${province}` : city;
  const prompt = `I am a student pursuing a ${degree} degree based in ${location}, South Africa (coordinates: lat ${latitude}, lon ${longitude}).

Find 5 real companies in or near ${location} that are known to offer internships, graduate programmes, or entry-level jobs relevant to someone studying ${degree}. 

Prioritise well-known South African companies, local businesses, and organisations that actively recruit students or graduates in this field.

For each company provide:
- name: the real company name
- description: a one-sentence description of what they do
- fitScore: a specific explanation of why this company is a good fit for a ${degree} student, including any known graduate or internship programmes
- website: their official website URL if known (omit if unsure)

Return the results as a JSON array.`;

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
              fitScore: { type: Type.STRING, description: "Why this company fits the student's degree" },
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

export async function draftApplicationLetter(companyName: string | number, role: string, degree: string, goals: string) {
  const prompt = `Draft a professional cover letter (or email) for a ${role} position at ${companyName}. 

The applicant is a South African student pursuing a ${degree} degree.
Their background and goals: ${goals}

The letter should:
- Be professional, genuine, and tailored to ${companyName}
- Highlight how the student's degree and goals align with the company
- Be concise (3–4 paragraphs)
- Use placeholders like [Date], [Hiring Manager Name] where information is unknown
- Reference South African context where appropriate (e.g. SETA programmes, NQF level, WIL requirements if relevant)`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert career coach helping South African students find internships and jobs. Write genuine, tailored cover letters that stand out.",
      }
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Drafting Error:", error);
    return "Error drafting letter. Please try again.";
  }
}

export async function researchCompany(companyName: string) {
  const prompt = `Research ${companyName}. Provide:
1. What they do and their industry
2. Their presence in South Africa (offices, size, reputation)
3. Whether they offer internships, graduate programmes, or learnerships
4. Company culture and what they look for in candidates
5. Any recent news relevant to a job applicant

Keep it concise and practical — written for a student preparing to apply.`;

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
    return "Could not find detailed information for this company.";
  }
}
