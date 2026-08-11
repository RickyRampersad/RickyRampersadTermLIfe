/**
 * RIA — the assistant inside the pension application wizard (/pension/).
 *
 * The browser posts { context, messages } here and receives newline-delimited
 * JSON back: {"t":"..."} for each chunk of the answer, {"error":"..."} if
 * something goes wrong. The wizard falls back to its built-in answers whenever
 * this endpoint is unavailable, so the application never depends on it.
 *
 * Requires one environment variable in Netlify (Site settings → Environment
 * variables): ANTHROPIC_API_KEY. Optional: PENSION_AI_ALLOWED_ORIGINS,
 * PENSION_AI_MODEL, PENSION_AI_EFFORT.
 */

import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.PENSION_AI_MODEL || 'claude-opus-5';
const EFFORT = process.env.PENSION_AI_EFFORT || 'low';
const MAX_TOKENS = 2000;

/* Input caps — this endpoint is public, so it must not become an open,
   general-purpose model proxy paid for by the branch. */
const MAX_CONTEXT_CHARS = 24000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;

/* Best-effort rate limit. Each function instance keeps its own counters, so
   this throttles casual abuse rather than a determined attacker. */
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 25;
const hits = new Map();

/* The branch's own instructions live here, not in the page, so they are stable
   across requests (which lets the prompt cache do its job) and cannot be
   rewritten from the browser. */
const SYSTEM_PROMPT = `You are RIA (Rampersad Intelligent Assistant), the guide built into the pension application wizard of the Ricky Rampersad Branch — a Guardian Life of the Caribbean agency in Trinidad & Tobago, led by Ricky Rampersad (CFD, MFA, Branch Manager, 23x MDRT).

WHO YOU ARE TALKING TO
Usually the agent completing a company-owned (Section 134) pension application for a client, sometimes the client themselves. Write for a smart person who is not a tax specialist: short paragraphs, plain Caribbean-friendly English, no jargon you do not immediately explain. Keep answers under 120 words unless detail is explicitly requested. Never open with "Certainly" or restate the question.

THE LAW AND ARITHMETIC YOU MUST RESPECT (Income Tax Act, Chapter 75:01, Trinidad & Tobago)
- Section 134 governs a pension the COMPANY owns on the life of an employee. The company deducts its contribution; the employee is the annuitant/life assured.
- Only the company's 134(6) contribution (the 6(a) annual premium plus any 6(b) lump sum) is ADDED to the employee's emolument income. Personally-owned deferred annuities and other approved pensions are Line 6 DEDUCTIONS only — never added.
- The maximum permitted contribution is the GREATER of one-third of chargeable income (Line 9) or 20% of total emolument income (Line 11).
- Line 10 asks whether the total exceeds one-third of chargeable income; Line 12 asks whether it exceeds 20% of emolument. They are independent checks. Exactly one may be "Yes" — both being "Yes" means the contribution is over the maximum and the BIR will not approve it.
- The NIS 70% deduction is looked up from the base salary, never from the contribution-inclusive total.
- The employee's own contribution is deductible to the employee at Line 6(a)(iii) and has a $200/month minimum.
- The BIR request must go with an original or certified pay slip and a copy of the approved TD1.
- Section 119 makes a false declaration an offence: a fine of $8,000 and up to three years' imprisonment.

DOCUMENTS IN THE PACKAGE
BIR Section 134 approval form; Declaration 1 (the employee's declaration); Declaration 2 (the third-party declaration, used because the COMPANY owns the policy — company signs and stamps on top, employee signs underneath); the Salary Deduction form (built automatically from the entered data); and KYC — a valid government photo ID plus a utility bill in the client's name under six months old, plus certified formation documents and ID for every director and any shareholder holding 10% or more when the proposer is a company. A named beneficiary needs photo ID too, and beneficiary shares must total exactly 100%.

HOW TO ANSWER
- Answer the question that was asked, for the step the user is on.
- Use ONLY figures supplied in the case context. Never invent, estimate, or extrapolate a premium, a rate, a value, or a tax result — if a number is not in the context, say what the user should check or enter instead.
- Recommend concretely when asked which plan or which option, and say why in one line.
- You explain and guide. You do not promise approval, quote binding premiums, or give legal or tax advice — for anything that turns on a client's full tax position, tell them the branch will confirm it.
- If a question is outside this pension application (general chit-chat, other insurance lines, anything unrelated), say briefly that you only cover this application and point them to the branch at support@rickyrampersadbranch.com.`;

const json = (obj, status) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

function originAllowed(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser or same-origin request without the header
  let host;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const allowed = new Set(
    (process.env.PENSION_AI_ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  allowed.add(new URL(req.url).host.toLowerCase());
  allowed.add('rickyrampersadbranch.com');
  allowed.add('www.rickyrampersadbranch.com');
  return allowed.has(host) || host.endsWith('.netlify.app');
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // keep the map from growing unbounded
  return recent.length > RATE_MAX;
}

/** Accept only what the wizard actually sends, at a size we are willing to pay for. */
function readBody(body) {
  const context = typeof body?.context === 'string' ? body.context.slice(0, MAX_CONTEXT_CHARS) : '';
  const raw = Array.isArray(body?.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  const messages = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

  // The conversation must start with a user turn and end with the new question.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  return { context, messages };
}

export default async (req, ctx) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!originAllowed(req)) return json({ error: 'Origin not allowed.' }, 403);

  if (!process.env.ANTHROPIC_API_KEY) {
    // Not configured — the wizard quietly uses its built-in answers.
    return json({ error: 'RIA is not configured on this deployment.' }, 503);
  }

  const ip = ctx?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  if (rateLimited(ip)) return json({ error: 'Too many questions in a short time. Try again shortly.' }, 429);

  let payload;
  try {
    payload = readBody(await req.json());
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }
  if (!payload) return json({ error: 'No question to answer.' }, 400);

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      try {
        const answer = client.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          output_config: { effort: EFFORT },
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' }, // stable prefix — cached across questions
            },
          ],
          messages: [
            {
              role: 'user',
              content:
                'Here is the live state of the application the user is looking at. Use it as the only source of case facts.\n\n<case_context>\n' +
                payload.context +
                '\n</case_context>\n\nThe conversation follows. Answer the latest question.',
            },
            ...payload.messages,
          ],
        });

        answer.on('text', (delta) => send({ t: delta }));

        const final = await answer.finalMessage();
        if (final.stop_reason === 'refusal') {
          send({ error: 'RIA could not answer that one.' });
        }
      } catch (err) {
        // Typed SDK errors, most specific first.
        let message = 'RIA is unavailable right now.';
        if (err instanceof Anthropic.AuthenticationError) {
          message = 'RIA is not configured correctly (check ANTHROPIC_API_KEY).';
        } else if (err instanceof Anthropic.RateLimitError) {
          message = 'RIA is busy right now — try again in a moment.';
        } else if (err instanceof Anthropic.APIConnectionError) {
          message = 'RIA could not be reached — check the connection.';
        } else if (err instanceof Anthropic.APIError) {
          message = `RIA error (${err.status ?? 'unknown'}).`;
        }
        console.error('pension-ai:', err);
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
};

export const config = { path: '/api/pension-ai' };
