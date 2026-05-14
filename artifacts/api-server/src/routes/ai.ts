import { Router } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  DiscoverCompaniesBody,
  DraftLetterBody,
  ResearchCompanyBody,
  StarFeedbackBody,
  InterviewQuestionsBody,
  ProfileChatBody,
  FindNetworkingEventsBody,
} from "@workspace/api-zod";

const router = Router();

// ─── External search helpers ──────────────────────────────────────────────────

async function fetchSerperEvents(query: string): Promise<string> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return "";
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "za", hl: "en", num: 10 }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { organic?: { title: string; link: string; snippet: string; date?: string }[] };
  return (data.organic ?? [])
    .map((r, i) => `[Serper ${i + 1}] ${r.title}\nURL: ${r.link}\n${r.date ? "Date: " + r.date + "\n" : ""}${r.snippet}`)
    .join("\n---\n");
}

async function fetchEventbriteEvents(city: string, query: string): Promise<string> {
  const key = process.env.EVENTBRITE_API_KEY;
  if (!key) return "";
  const today = new Date().toISOString().split("T")[0];
  const locationParam = city && city.toLowerCase() !== "south africa"
    ? `${city}, South Africa`
    : "South Africa";
  const url = new URL("https://www.eventbriteapi.com/v3/events/search/");
  url.searchParams.set("q", query);
  url.searchParams.set("location.address", locationParam);
  url.searchParams.set("start_date.range_start", `${today}T00:00:00`);
  url.searchParams.set("expand", "venue");
  url.searchParams.set("page_size", "15");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as {
    events?: {
      name: { text: string };
      description?: { text: string };
      url: string;
      start: { local: string };
      venue?: { name: string; address?: { city: string; country: string } };
      is_online_event: boolean;
    }[];
  };
  return (data.events ?? [])
    .map((e, i) => {
      const loc = e.is_online_event
        ? "Online"
        : [e.venue?.name, e.venue?.address?.city, e.venue?.address?.country].filter(Boolean).join(", ");
      return `[Eventbrite ${i + 1}] ${e.name.text}\nDate: ${e.start.local}\nLocation: ${loc}\nURL: ${e.url}\n${e.description?.text?.slice(0, 200) ?? ""}`;
    })
    .join("\n---\n");
}

async function fetchTavilyEvents(query: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return "";
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "advanced",
      max_results: 10,
      include_domains: [
        "eventbrite.co.za", "eventbrite.com", "meetup.com", "bizcommunity.com",
        "saica.co.za", "ecsa.co.za", "iitpsa.org.za", "africarena.com",
        "africa.comworldseries.com", "careerjunction.co.za", "siliconcape.com",
        "theinnovationhub.com", "bandwidthbarn.com", "launchlab.co.za",
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { results?: { title: string; url: string; content: string; published_date?: string }[] };
  return (data.results ?? [])
    .map((r, i) => `[Tavily ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.published_date ? "Published: " + r.published_date + "\n" : ""}${r.content.slice(0, 300)}`)
    .join("\n---\n");
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/ai/discover-companies", async (req, res) => {
  const parsed = DiscoverCompaniesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { latitude, longitude, degree, institution, yearOfStudy, skills, city, preferredIndustries, goals } = parsed.data;

  const profileLines = [
    institution && `Institution: ${institution}`,
    yearOfStudy && `Year of study: ${yearOfStudy}`,
    skills && `Key skills: ${skills}`,
    city && `Home city: ${city}`,
    preferredIndustries && `Preferred industries/sectors: ${preferredIndustries}`,
    goals && `Career goals: ${goals}`,
  ].filter(Boolean).join('\n');

  const prompt = `You are a South African career advisor helping a student find Work-Integrated Learning (WIL) placement opportunities.

Student profile:
Degree: ${degree}
${profileLines}
Current location: latitude ${latitude}, longitude ${longitude}

List 8 real South African companies that are known to offer WIL placements, graduate programmes, or internships relevant to this student's degree and goals. Prioritise companies that align with the student's preferred industries if provided. Focus on companies actually operating in South Africa — include both large corporates and reputable SMEs. Where relevant, mention alignment with South African professional bodies such as ECSA (Engineering Council of South Africa), SAICA (South African Institute of Chartered Accountants), IITPSA (Institute of IT Professionals South Africa), or BUSA (Business Unity South Africa).

Return ONLY a valid JSON array with no markdown, no code fences, no explanation. Each object must have:
- name: string (company name)
- description: string (2–3 sentences: what the company does, why it suits this student's profile, and any WIL/graduate programme details)
- fitScore: string (one of: "Excellent Fit", "Strong Fit", "Good Fit")
- website: string | null (official website URL, or null if unknown)

Example format:
[{"name":"Deloitte South Africa","description":"...","fitScore":"Excellent Fit","website":"https://www2.deloitte.com/za"}]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = response.text ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      req.log.error({ text }, "Gemini returned no JSON array for discover-companies");
      res.status(500).json({ error: "AI returned an unexpected format" });
      return;
    }
    const companies = JSON.parse(jsonMatch[0]);
    res.json(companies);
  } catch (err) {
    req.log.error({ err }, "discover-companies failed");
    res.status(500).json({ error: "Failed to discover companies" });
  }
});

router.post("/ai/draft-letter", async (req, res) => {
  const parsed = DraftLetterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { companyName, role, degree, goals, institution, yearOfStudy, skills, portfolioUrl, userDraft } = parsed.data;

  const profileLines = [
    institution && `Institution: ${institution}`,
    yearOfStudy && `Year of study: ${yearOfStudy}`,
    skills && `Key skills and strengths: ${skills}`,
  ].filter(Boolean).join('\n');

  const portfolioLine = portfolioUrl
    ? `The student has a digital portfolio / GitHub at: ${portfolioUrl} — include a mention of this naturally in the letter.`
    : "";

  const draftLine = userDraft
    ? `The student has written an initial draft below. Polish it, keeping their voice, but improve structure, clarity, and professional tone:\n\n${userDraft}`
    : "Write a complete cover letter from scratch.";

  const prompt = `You are a South African career counsellor helping a student write a professional cover letter for a Work-Integrated Learning (WIL) placement.

Company: ${companyName}
Role applied for: ${role}
Degree: ${degree}
${profileLines}
Career goals: ${goals}
${portfolioLine}

South African professional standards to follow:
- Use "Dear Sir/Madam" as the salutation (standard in South African corporate correspondence)
- Use British English spelling (e.g. "organisation", "programme", "favour")
- Keep the tone formal but warm — not stiff
- Reference WIL or Work-Integrated Learning where appropriate
- The letter should be 3–4 paragraphs: introduction, why the student, why this company, closing
- Where the student has listed key skills, weave the most relevant ones naturally into the letter

${draftLine}

Return ONLY the letter text — no subject line, no JSON, no markdown formatting. Start directly with "Dear Sir/Madam,"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    res.json({ letter: response.text ?? "" });
  } catch (err) {
    req.log.error({ err }, "draft-letter failed");
    res.status(500).json({ error: "Failed to draft letter" });
  }
});

router.post("/ai/research-company", async (req, res) => {
  const parsed = ResearchCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { companyName } = parsed.data;

  const prompt = `You are a South African career advisor. Write a concise research summary about "${companyName}" specifically in the South African context.

Cover these sections (use plain text headings, no markdown symbols):

Overview
What the company does, its size, and its presence in South Africa.

Industry & Sector
The industry they operate in and any relevant South African regulatory bodies or sector bodies.

Culture & Values
Known workplace culture, values, and what they look for in candidates.

WIL / Graduate Programmes
Any known Work-Integrated Learning placements, graduate programmes, bursaries, or internships offered in South Africa.

Interview Tips
2–3 specific tips for someone interviewing at this company in South Africa.

Keep the summary practical and useful for a student applying for a WIL placement. Write in plain paragraphs — no bullet points, no markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    res.json({ summary: response.text ?? "" });
  } catch (err) {
    req.log.error({ err }, "research-company failed");
    res.status(500).json({ error: "Failed to research company" });
  }
});

router.post("/ai/star-feedback", async (req, res) => {
  const parsed = StarFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { question, situation, task, action, result } = parsed.data;

  const prompt = `You are an experienced South African interview coach evaluating a STAR-format interview answer.

Interview question: "${question}"

The candidate's answer:
Situation: ${situation}
Task: ${task}
Action: ${action}
Result: ${result}

Provide structured, honest feedback covering:
1. Overall impression (1–2 sentences)
2. What worked well (be specific)
3. What to improve (be specific and constructive)
4. A suggested stronger version of the Result, showing impact with numbers or concrete outcomes where possible
5. A score out of 10 with brief justification

Keep your tone encouraging but direct. This is for a South African student preparing for WIL placement interviews.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    res.json({ feedback: response.text ?? "" });
  } catch (err) {
    req.log.error({ err }, "star-feedback failed");
    res.status(500).json({ error: "Failed to get STAR feedback" });
  }
});

router.post("/ai/interview-questions", async (req, res) => {
  const parsed = InterviewQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { companyName, role, degree, goals, institution, yearOfStudy, skills, researchSummary } = parsed.data;

  const profileLines = [
    institution && `Institution: ${institution}`,
    yearOfStudy && `Year of study: ${yearOfStudy}`,
    skills && `Key skills: ${skills}`,
  ].filter(Boolean).join('\n');

  const researchContext = researchSummary
    ? `Company research summary:\n${researchSummary}\n\n`
    : "";

  const prompt = `You are a South African interview coach preparing a student for a WIL placement interview.

Company: ${companyName}
Role: ${role}
Student profile:
Degree: ${degree}
${profileLines}
Goals: ${goals}
${researchContext}
Generate 15 realistic interview questions this student is likely to face, split into three categories. Where skills are provided, include questions that specifically probe those skills in the experience category.

Return ONLY a valid JSON object with no markdown, no code fences. Format:
{
  "personal": ["question 1", "question 2", "question 3", "question 4", "question 5"],
  "company": ["question 1", "question 2", "question 3", "question 4", "question 5"],
  "experience": ["question 1", "question 2", "question 3", "question 4", "question 5"]
}

personal: questions about the student's background, motivation, strengths, weaknesses, and goals (include at least one about why they want a WIL placement specifically)
company: questions about their knowledge of ${companyName} and the South African industry context
experience: questions about their academic projects, teamwork, problem-solving, and relevant technical skills for the ${role} role`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    const text = response.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ text }, "Gemini returned no JSON for interview-questions");
      res.status(500).json({ error: "AI returned an unexpected format" });
      return;
    }
    const questions = JSON.parse(jsonMatch[0]);
    res.json(questions);
  } catch (err) {
    req.log.error({ err }, "interview-questions failed");
    res.status(500).json({ error: "Failed to generate interview questions" });
  }
});

router.post("/ai/profile-chat", async (req, res) => {
  const parsed = ProfileChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { messages } = parsed.data;

  const systemPrompt = `You are Career Compass AI, a warm, curious, and encouraging career assistant. Your job is to have a natural conversation and learn as much as possible about the person — their background, qualifications, experience, skills, and goals — so you can help them find the best WIL placements and career opportunities in South Africa.

Be genuinely curious. Don't stick to a rigid script. Based on what the person shares, ask thoughtful follow-up questions. The goal is to build a rich, personalised profile that captures who they really are.

Topics to explore naturally (not as a checklist — weave them into genuine conversation):
- Their full name
- Whether they're a student, working professional, recent graduate, or something else
- Their current degree or highest qualification and field of study
- Their university, college, or training institution
- Their current year of study (if applicable)
- Any previous qualifications, diplomas, certificates, or short courses
- Work experience, internships, learnerships, or volunteer work (encourage details)
- Technical skills — software, tools, programming languages, equipment, systems
- Soft skills and personal strengths — leadership, teamwork, communication, etc.
- Languages they speak (very relevant in South Africa's multilingual context)
- Extracurricular activities, clubs, societies, or community involvement
- Academic projects or research they're proud of
- Awards, bursaries, achievements, or recognition they've received
- Industry sectors and company types they're most interested in
- Career goals — what kind of WIL placement or job they're looking for and why
- Their location / home city
- Online presence — GitHub, LinkedIn, portfolio, or personal website URL

Rules:
- Ask ONE question at a time
- Never number questions or show a list of topics
- Be warm, specific, and encouraging in your questions
- If someone gives a short answer, follow up to get more detail
- Use South African context naturally (WIL, NQF levels, NSFAS, ECSA, SAICA, specific universities, industries, etc.)
- Accept all forms of natural language and interpret correctly (e.g. "second year mech eng at Wits" → Year of Study: 2nd Year, Degree: BEng Mechanical Engineering, Institution: University of the Witwatersrand)
- Continue the conversation until you have a good, well-rounded picture of the person

When you feel you have gathered enough information (typically after 10–16 exchanges), write a warm, personalised closing message that summarises a key strength or insight about the person. Then, on its OWN LINE at the very end of your response, output exactly:
PROFILE_COMPLETE:{"displayName":"...","currentDegree":"...","institution":"...","yearOfStudy":"...","skills":"...","city":"...","preferredIndustries":"...","careerGoals":"...","portfolioUrl":"...","profileFields":[{"label":"...","value":"..."},...]}

The profileFields array must contain ALL information collected from the conversation as label-value pairs. Be thorough — include every detail they shared. Use clear, readable labels. Examples of good labels:
"Full Name", "City", "Current Degree", "Institution", "Year of Study", "Previous Qualification", "Work Experience", "Internship at [Company]", "Technical Skills", "Soft Skills", "Languages", "Extracurriculars", "Academic Project", "Awards & Achievements", "Career Goals", "Preferred Industries", "Portfolio / GitHub", "LinkedIn", "Certifications"

If a person held multiple jobs or internships, create one profileField entry per position with a descriptive label like "Internship at Deloitte" or "Part-time Work: Retail".

Make sure:
- The JSON is valid with double quotes throughout
- All values are strings (never null or arrays in the JSON)
- displayName, currentDegree, institution, yearOfStudy, skills, city, preferredIndustries, careerGoals, portfolioUrl are always included (use "" if not provided)
- profileFields captures everything — it is the complete profile record

AFTER EVERY SINGLE RESPONSE (including partial ones before the conversation is complete), also output on a SEPARATE LINE:
PARTIAL_PROFILE:{"displayName":"...","currentDegree":"...","institution":"...","yearOfStudy":"...","skills":"...","city":"...","preferredIndustries":"...","careerGoals":"...","portfolioUrl":"...","profileFields":[{"label":"...","value":"..."},...]}

This must appear after every response — it is a live snapshot of everything collected so far. Use "" for fields not yet gathered. Keep the JSON on ONE LINE.`;

  const FIRST_AI_MESSAGE = `Hi! I'm Career Compass AI. I'll ask you a few quick questions to set up your profile — it only takes 2 minutes, and the more I know about you, the better I can match you with WIL opportunities.\n\nLet's start — what's your full name?`;

  const conversationLines: string[] = [];
  for (const msg of messages) {
    if (msg.role === "assistant") {
      conversationLines.push(`Career Compass AI: ${msg.content}`);
    } else {
      conversationLines.push(`Student: ${msg.content}`);
    }
  }

  const prompt = `${systemPrompt}

CONVERSATION SO FAR:
Career Compass AI: ${FIRST_AI_MESSAGE}
${conversationLines.join("\n")}

Continue as Career Compass AI (write only your next response, nothing else):`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    let text = response.text ?? "";

    // Extract PARTIAL_PROFILE (present in every response)
    let partialProfile: Record<string, unknown> | null = null;
    const partialMarker = "PARTIAL_PROFILE:";
    const partialIdx = text.indexOf(partialMarker);
    if (partialIdx !== -1) {
      const partialJsonStr = text.slice(partialIdx + partialMarker.length).split("\n")[0].trim();
      try {
        partialProfile = JSON.parse(partialJsonStr);
      } catch {
        req.log.warn({ partialJsonStr }, "Failed to parse PARTIAL_PROFILE JSON");
      }
      // Strip the PARTIAL_PROFILE line from the visible text
      text = text.slice(0, partialIdx).trim();
    }

    // Check for PROFILE_COMPLETE
    const marker = "PROFILE_COMPLETE:";
    const markerIndex = text.indexOf(marker);
    if (markerIndex !== -1) {
      const reply = text.slice(0, markerIndex).trim();
      const jsonStr = text.slice(markerIndex + marker.length).split("\n")[0].trim();
      try {
        const profileData = JSON.parse(jsonStr);
        res.json({ reply, isComplete: true, profileData, partialProfile: profileData });
        return;
      } catch {
        req.log.warn({ jsonStr }, "Failed to parse PROFILE_COMPLETE JSON");
      }
    }

    res.json({ reply: text, isComplete: false, partialProfile });
  } catch (err) {
    req.log.error({ err }, "profile-chat failed");
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

// ─── NETWORKING EVENTS ────────────────────────────────────────────────────────
// Data sources (in priority order):
//   1. Eventbrite API     — real structured SA event listings
//   2. Serper.dev         — live Google Search results for SA events
//   3. Tavily             — AI-powered deep search across SA-specific domains
//   4. Gemini grounding   — fallback; Gemini searches the web via Google Search
// All external calls run in parallel. Failures are silent — Gemini grounding
// handles the load if the other sources are unavailable.
// ─────────────────────────────────────────────────────────────────────────────

router.post("/ai/networking-events", async (req, res) => {
  const parsed = FindNetworkingEventsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { city, degree, preferredIndustries, goals } = parsed.data;
  const today = new Date().toISOString().split("T")[0];

  const profileContext = [
    degree && `Field of study / degree: ${degree}`,
    preferredIndustries && `Industries of interest: ${preferredIndustries}`,
    goals && `Career goals: ${goals}`,
  ].filter(Boolean).join("\n");

  const locationContext = city && city.toLowerCase() !== "south africa"
    ? `Primary location: ${city}, South Africa. Also include events elsewhere in South Africa and relevant African or international events the student could attend or join online.`
    : `Primary location: South Africa (Johannesburg, Cape Town, Durban, Pretoria, Port Elizabeth/Gqeberha, Bloemfontein, East London, Stellenbosch, and other cities). Also include relevant international events accessible online.`;

  const searchQuery = [
    "career networking events",
    city && city.toLowerCase() !== "south africa" ? city : "South Africa",
    degree ? degree.split(" ").slice(-2).join(" ") : "",
    "2025 2026",
  ].filter(Boolean).join(" ");

  // Fetch from all external APIs in parallel — failures are silently ignored
  const [serperResult, eventbriteResult, tavilyResult] = await Promise.allSettled([
    fetchSerperEvents(searchQuery),
    fetchEventbriteEvents(city ?? "", "career networking professional development"),
    fetchTavilyEvents(`career networking events South Africa ${city ?? ""} 2025 2026`),
  ]);

  const serperData = serperResult.status === "fulfilled" ? serperResult.value : "";
  const eventbriteData = eventbriteResult.status === "fulfilled" ? eventbriteResult.value : "";
  const tavilyData = tavilyResult.status === "fulfilled" ? tavilyResult.value : "";

  const externalContext = [
    eventbriteData && `=== EVENTBRITE LISTINGS ===\n${eventbriteData}`,
    serperData && `=== GOOGLE SEARCH RESULTS (Serper) ===\n${serperData}`,
    tavilyData && `=== WEB SEARCH RESULTS (Tavily) ===\n${tavilyData}`,
  ].filter(Boolean).join("\n\n");

  const eventTypes = [
    "career-expo (Career Expos & Job Fairs)",
    "conference (Conferences & Summits)",
    "workshop (Workshops & Short Courses)",
    "meetup (Networking Meetups & Socials)",
    "trade-fair (Trade Fairs & Business Exhibitions)",
    "seminar (Seminars & Talks)",
    "hackathon (Hackathons & Innovation Competitions)",
    "alumni (Alumni Events & Reunions)",
    "webinar (Webinars & Virtual Events)",
    "panel (Panel Discussions & Industry Forums)",
    "open-day (Open Days & Company Site Visits)",
    "pitch (Pitch Competitions & Startup Demo Days)",
    "mentorship (Mentorship Sessions & Coaching)",
    "association (Professional & Industry Association Events)",
    "community (Community, CSR & Volunteer Events)",
    "awards (Awards Ceremonies & Gala Dinners)",
    "training (Professional Training & Certification Programmes)",
    "sport (Sports & Social Networking Events)",
    "cultural (Cultural, Arts & Social Events)",
    "other (Any opportunity not listed above)",
  ].join("\n");

  const prompt = `Today is ${today}. You are a career opportunities assistant helping a South African student find REAL, upcoming networking and professional development opportunities.

Student profile:
${profileContext || "General student seeking WIL placement or graduate opportunities in South Africa"}
${locationContext}
${externalContext ? `\nREAL EVENT DATA FROM LIVE SEARCHES (use this as your primary source — prefer these over your training data):\n${externalContext}\n` : ""}
IMPORTANT INSTRUCTIONS:
- Use the real event data above as your PRIMARY source. Fill in any missing details from your knowledge.
- If no real data was provided above, search the internet NOW for real events and opportunities.
- Prioritise South Africa (Johannesburg, Cape Town, Durban, Pretoria, Port Elizabeth/Gqeberha, Bloemfontein, East London, Stellenbosch, etc.) but include any African or international events that are valuable.
- Cast a WIDE net — do not limit results to only what matches the student's exact degree.
- Search across: Facebook Events SA, LinkedIn Events, Eventbrite South Africa, Meetup.com, Bizcommunity (bizcommunity.com), Innovation Hub Pretoria, Silicon Cape, CareerJunction, SAICA (saica.co.za), ECSA (ecsa.co.za), IITPSA (iitpsa.org.za), university career portals (UCT, Wits, UP, Stellenbosch, UJ, DUT, CPUT, TUT, UKZN), AfricArena, AfricaCom, company career pages, and any other relevant South African or African platform.
- Include opportunities the student may not have thought to look for: hackathons, alumni events, webinars, startup pitch competitions, professional association meetings, mentorship programmes, open days, awards dinners, trade fairs, volunteer/community events, training courses, bursary info sessions, and more.
- For online/virtual events, mark isOnline as true.

Return ONLY a valid JSON array (no markdown, no code fences, no explanation). Each object must have exactly these fields:
- id: unique lowercase slug string derived from title
- title: exact official name of the event/opportunity
- eventType: one of the following strings only — ${eventTypes.split("\n").map(t => '"' + t.split(" ")[0] + '"').join(", ")}
- organizer: name of the hosting organisation, company, or institution
- dateLabel: human-readable date (e.g. "Sat, 17 May 2025" or "15–17 May 2025" or "Ongoing" for programmes)
- dateIso: ISO 8601 string (e.g. "2025-05-17T09:00:00") or "" if unknown
- location: full venue + city (e.g. "Sandton Convention Centre, Johannesburg" or "Online / Zoom")
- description: 1–2 sentences explaining what it is and why it matters for the student
- url: a direct, working URL to the event page or registration (must be a real URL, not a homepage)
- source: platform where you found it (e.g. "Eventbrite", "Serper", "Bizcommunity", "LinkedIn")
- tags: array of 3–5 keyword strings relevant to South Africa and the event (e.g. ["technology", "networking", "Johannesburg", "startups"])
- isOnline: true if virtual, false if in-person

Only include events happening AFTER today (${today}). Return 8–15 diverse results. If local events are limited, supplement with high-value African or international online events. Return [] only if absolutely nothing real is found.`;

  try {
    const useGrounding = !externalContext;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      ...(useGrounding && { config: { tools: [{ googleSearch: {} }] } }),
    });
    const text = response.text ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      req.log.warn({ text: text.slice(0, 300) }, "networking-events: no JSON array in response");
      res.json([]);
      return;
    }
    const events = JSON.parse(jsonMatch[0]);
    res.json(Array.isArray(events) ? events : []);
  } catch (err) {
    req.log.error({ err }, "networking-events failed");
    res.status(500).json({ error: "Failed to load networking events" });
  }
});

export default router;
