export const config = { runtime: "edge" };

type Payload = { template: string; count?: number };

const MALER: Record<string,string> = {
  kaffe: "Dagens kaffeprat",
  nyefunksjoner: "Nye funksjoner",
  tips: "Tips og triks i Runwell",
  funfact: "Fun fact fra serveringsbransjen",
  faq: "FAQ",
  nykunde: "Ny kunde",
  nypartner: "Ny partner"
};

const SYSTEM_PROMPT = `
Du er en kreativ SoMe-idegenerator for Runwell (SaaS for internkontroll/operasjoner i serveringsbransjen).
Returnér KUN JSON: { "ideas": string[] }.
- Norske, korte, konkrete ideer klare til innlegg.
- Variasjon i vinkler (tips, sjekkliste, myte/fakta, før/etter, Q&A, tall).
- Diskré Runwell-kontekst, ikke hardt salgsfokus.
`;

function userPromptFor(template: string, count: number){
  const navn = MALER[template] ?? "Uspesifisert mal";
  return `
Mal: ${navn}
Mål: Lag ${count} friske ideer for denne serien – egnet for LinkedIn/Instagram/Facebook/YouTube-short.
Gi kun JSON som { "ideas": ["...", "..."] }.
`;
}

export default async function handler(req: Request){
  try{
    if(req.method !== "POST"){
      return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { "content-type":"application/json" }});
    }
    const { template, count = 5 } = await req.json() as Payload;
    const key = process.env.OPENAI_API_KEY;
    if(!key){
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY mangler i miljøvariabler" }), { status: 500, headers: { "content-type":"application/json" }});
    }

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT.trim() },
        { role: "user",   content: userPromptFor(template, count).trim() }
      ],
      temperature: 0.9
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type":"application/json", "authorization": `Bearer ${key}` },
      body: JSON.stringify(body)
    });

    if(!r.ok){
      const t = await r.text();
      return new Response(JSON.stringify({ error: t }), { status: r.status, headers: { "content-type":"application/json" }});
    }

    const data = await r.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    let ideas: string[] = [];
    try{
      const start = content.indexOf("{");
      const end   = content.lastIndexOf("}");
      const raw   = content.slice(start, end+1);
      const parsed = JSON.parse(raw);
      ideas = Array.isArray(parsed?.ideas) ? parsed.ideas : [];
    }catch{
      ideas = content.split("\n").map(s => s.replace(/^[-•\d.\s]+/, "").trim()).filter(Boolean).slice(0, count);
    }

    return new Response(JSON.stringify({ ideas }), { status: 200, headers: { "content-type":"application/json" }});
  }catch(e:any){
    return new Response(JSON.stringify({ error: e?.message || "Ukjent feil" }), { status: 500, headers: { "content-type":"application/json" }});
  }
}
