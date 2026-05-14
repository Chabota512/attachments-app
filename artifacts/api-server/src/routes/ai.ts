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
- profileFields captures everything — it is the complete profile record`;

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
    const text = response.text ?? "";

    const marker = "PROFILE_COMPLETE:";
    const markerIndex = text.indexOf(marker);
    if (markerIndex !== -1) {
      const reply = text.slice(0, markerIndex).trim();
      const jsonStr = text.slice(markerIndex + marker.length).trim();
      try {
        const profileData = JSON.parse(jsonStr);
        res.json({ reply, isComplete: true, profileData });
        return;
      } catch {
        req.log.warn({ jsonStr }, "Failed to parse PROFILE_COMPLETE JSON");
      }
    }

    res.json({ reply: text, isComplete: false });
  } catch (err) {
    req.log.error({ err }, "profile-chat failed");
    res.status(500).json({ error: "Failed to get AI response" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NETWORKING EVENTS — API & DATA SOURCE REFERENCE
//
// PRIMARY (already active):
//   • Gemini 2.5 Flash + Google Search Grounding
//     How it works: Gemini searches the live internet via Google's index, which
//     covers Facebook Events, LinkedIn Events, Eventbrite, Meetup.com, company
//     websites, university portals, and government/chamber sites.
//     Setup: AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY
//     are set automatically via the Replit Gemini integration.
//     Note: pass config.tools: [{ googleSearch: {} }] to enable live search.
//
// RECOMMENDED ADDITIONS (add as environment secrets to improve coverage):
//
//   1. Eventbrite API — eventbrite.com/platform/api
//      What: Real event listings, free tier available (1,000 req/day).
//      South Africa coverage: strong — Eventbrite is widely used in SA.
//      Secret to add: EVENTBRITE_API_KEY
//      Endpoint: GET https://www.eventbriteapi.com/v3/events/search/
//        ?location.address=Johannesburg,South+Africa&q={query}&token={key}
//
//   2. Serper.dev — serper.dev
//      What: Google Search API wrapper (fast, 2,500 free searches/month).
//      Advantage: Broader coverage; can target SA sites
//        (e.g. site:bizcommunity.com OR site:careers24.com events).
//      Secret to add: SERPER_API_KEY
//      Endpoint: POST https://google.serper.dev/search
//        { q: "networking events South Africa", gl: "za", hl: "en", num: 10 }
//
//   3. Tavily — tavily.com
//      What: AI-powered web search designed for LLM pipelines (1,000 free/month).
//      Secret to add: TAVILY_API_KEY
//      Endpoint: POST https://api.tavily.com/search
//        { query: "...", search_depth: "advanced", include_domains: ["eventbrite.com","meetup.com","bizcommunity.com"] }
//
//   4. Meetup.com API — meetup.com/api/guide
//      What: Networking meetups specifically. Free read-only tier.
//      Secret to add: MEETUP_API_KEY
//      Endpoint: GET https://api.meetup.com/find/upcoming_events
//        ?lat=-26.2041&lon=28.0473&radius=100&text={query}
//        (Johannesburg coordinates; adjust per city)
//
//   5. Google Custom Search API — developers.google.com/custom-search
//      What: Programmable Google Search; 100 free queries/day, then $5/1000.
//      Secret to add: GOOGLE_SEARCH_API_KEY + GOOGLE_CSE_ID
//      Endpoint: GET https://www.googleapis.com/customsearch/v1
//        ?key={key}&cx={cse_id}&q=networking+events+South+Africa+2025
//
// SOUTH AFRICA-SPECIFIC SOURCES (no API — use Gemini/Serper to scrape):
//   • Bizcommunity           — bizcommunity.com (events section)
//   • Careers24 events       — careers24.com
//   • CareerJunction         — careerjunction.co.za
//   • Innovation Hub         — theinnovationhub.com (Pretoria)
//   • Silicon Cape           — siliconcape.com (Cape Town tech)
//   • Bandwidth Barn         — bandwidthbarn.com (Cape Town)
//   • LaunchLab Stellenbosch — launchlab.co.za
//   • SAICA events           — saica.co.za
//   • ECSA events            — ecsa.co.za
//   • IITPSA events          — iitpsa.org.za
//   • UCT career portal      — uct.ac.za
//   • Wits career portal     — wits.ac.za
//   • UP career portal       — up.ac.za
//   • AfricaCom              — africa.comworldseries.com
//   • AfricArena             — africarena.com
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
    : `Primary location: South Africa (Johannesburg, Cape Town, Durban, Pretoria, Port Elizabeth/Gqeberha, Bloemfontein, East London, and other cities). Also include relevant international events accessible online.`;

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

IMPORTANT INSTRUCTIONS:
- Search the internet RIGHT NOW for real events and opportunities.
- Prioritise South Africa (Johannesburg, Cape Town, Durban, Pretoria, Port Elizabeth/Gqeberha, Bloemfontein, East London, Stellenbosch, etc.) but include any African or international events that are valuable.
- Cast a WIDE net — do not limit results to only what matches the student's exact degree. Many career paths cross industries, and students benefit from diverse exposure.
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
- location: full venue + city (e.g. "BongoHive, Lusaka" or "Online / Zoom")
- description: 1–2 sentences explaining what it is and why it matters for the student
- url: a direct, working URL to the event page or registration (must be a real URL, not a homepage)
- source: platform where you found it (e.g. "Eventbrite", "Facebook Events", "BongoHive", "LinkedIn")
- tags: array of 3–5 keyword strings (e.g. ["technology", "networking", "Zambia", "startups"])
- isOnline: true if virtual, false if in-person

Only include events happening AFTER today (${today}). Return 8–15 diverse results. If events in Zambia are limited, supplement with high-value African or international online events. Return [] only if absolutely nothing real is found.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
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
