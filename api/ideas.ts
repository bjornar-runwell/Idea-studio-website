import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

// Sett MODEL i Vercel env hvis du vil bytte modell.
// Standard: rimelig og kjapp.
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// NB: Legg OPENAI_API_KEY i Vercel → Settings → Environment Variables
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse){
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST is allowed" });
  }

  try{
    const { templateId, templateLabel, n = 5, fields } = req.body || {};
    if(!process.env.OPENAI_API_KEY){
      return res.status(400).json({ error: "OPENAI_API_KEY mangler i miljøvariabler" });
    }
    if(!fields?.runwellContext){
      return res.status(400).json({ error: "Mangler Runwell-kontekst" });
    }

    const { purpose, audience, tone, runwellContext } = fields;

    const system = `
Du er en senior innholdsstrateg som skriver ultrakorte, skarpe ideer til SoMe/innhold.
Skriv på norsk. Unngå floskler. Maks 1 setning pr. idé. Ingen emojis.
Konstruér ideer som kan stå som overskrifter eller emner på kort-format.
`.trim();

    const brandContext = `
BRAND-KONTEXT (Runwell)
${runwellContext}
`.trim();

    const templateContext = `
MAL: ${templateLabel}
MENING/FORMÅL: ${purpose}
MÅLGRUPPE: ${audience}
TONE/STIL: ${tone}
`.trim();

    const userPrompt = `
Oppgave: Foreslå ${n} konkrete ideer (punktliste, hver på egen linje) for «${templateLabel}».

Krav:
- Skreddersy til målgruppen over.
- Inkluder faglig vinkling som viser Runwell sin verdi (internkontroll, mattrygghet, opplæring, avvik, sensorer, chat, kalender, inspeksjonsknapp) der det gir mening.
- Unngå å gjenta samme vinkel.
- Ikke bruk kolon inne i overskriften—skriv rett på.
- Ingen hashtags, ingen emojis, ingen «Klikk her»-språk.

Lever kun punktene, én idé per linje.
`.trim();

    const resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        { role: "system", content: system },
        { role: "user", content: brandContext },
        { role: "user", content: templateContext },
        { role: "user", content: userPrompt }
      ]
    });

    const text = resp.choices?.[0]?.message?.content || "";
    // Del på linjer og rens opp evt «- »/nummerering
    const ideas = text
      .split("\n")
      .map(s => s.trim().replace(/^[-•\d\.\)]\s*/, ""))
      .filter(Boolean)
      .slice(0, n);

    return res.status(200).json({ ideas });

  }catch(err:any){
    console.error(err);
    return res.status(500).json({ error: err?.message || "Ukjent feil" });
  }
}
