// Vercel Serverless / Edge-funksjon for å generere ideer
// Krever env: OPENAI_API_KEY
import type { VercelRequest, VercelResponse } from '@vercel/node';

const MODEL = 'gpt-4o-mini'; // rask og rimelig, bra til ideer

type Body = {
  template: string;
  count: number;
  context?: string;
  tone?: string;
  lang?: 'no' | 'en' | string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Use POST');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).send('OPENAI_API_KEY mangler i miljøvariabler');

  const { template, count = 5, context = '', tone = '', lang = 'no' } = (req.body || {}) as Body;

  const languageLine = lang === 'en' ? 'Write in concise, natural English.' : 'Skriv på norsk (bokmål).';
  const toneLine =
    tone === 'witty' ? 'Tone: witty, lett og smart – men ikke klisjé.' :
    tone === 'professional' ? 'Tone: profesjonell og troverdig.' :
    tone === 'technical' ? 'Tone: teknisk og presis, men lettlest.' :
    tone === 'relatable' ? 'Tone: jordnær og relaterbar.' : 'Bruk en nøytral, vennlig tone.';

  // Små templates (kan utvides)
  const templateHints: Record<string,string> = {
    'Dagens kaffeprat': 'Gi korte, konkrete tema-forslag som kan diskuteres på 5 minutter i et teammøte.',
    'Tips og triks i Runwell': 'Gi tips som hjelper praktisk bruk av Runwell i daglig drift.',
    'Fakta fredag': 'Gi små, “visste du at?”-fakta relatert til internkontroll/horeca som engasjerer.',
    'Behind the scenes': 'Gi idéer som viser ekte innsikt i drift, mennesker og prosesser.',
    'Riktig rutine – uke': 'Gi forslag til ukens rutiner/oppgaver som bør fremheves for teamet.',
    'FAQ / Myteknuser': 'Gi forslag til spørsmål/myter kunder/ansatte ofte har, med vinkling til å oppklare.'
  };

  const hint = templateHints[template] || 'Gi gode, varierte idéforslag knyttet til temaet.';

  const systemPrompt = [
    'Du er en innholds-idéassistent for et SaaS-selskap i hospitality (Runwell).',
    'Oppgave: Lag en liste med kreative, tydelige og handlingsbare idé-titler (1 linje hver).',
    'Unngå markedsførings-floskler, gjør dem konkrete og relevante.',
    languageLine,
    toneLine
  ].join('\n');

  const userPrompt = [
    `Mal: ${template}`,
    `Antall forslag: ${count}`,
    `Retningslinje for malen: ${hint}`,
    context ? `Runwell-kontekst (frivillig): ${context}` : '',
    'Format: Returner KUN en JSON med { "ideas": string[] } uten forklaring.'
  ].filter(Boolean).join('\n');

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(500).send(`OpenAI error: ${resp.status} ${txt}`);
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    // Prøv å parse en JSON-payload { ideas: string[] }
    let ideas: string[] = [];
    try {
      const parsed = JSON.parse(text);
      ideas = Array.isArray(parsed?.ideas) ? parsed.ideas.slice(0, count) : [];
    } catch {
      // fallback: del på linjer om modellen ikke holdt formatet 100%
      ideas = text.split('\n').map(l => l.replace(/^\s*[-*\d.\)]\s*/,'').trim()).filter(Boolean).slice(0, count);
    }

    if (ideas.length === 0) ideas = ['Kunne ikke hente forslag – prøv igjen, eller juster prompt.'];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ ideas });
  } catch (err: any) {
    return res.status(500).send(`Server error: ${err?.message || err}`);
  }
}
