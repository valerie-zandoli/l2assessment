/**
 * Parsing and validation for the LLM's structured triage reply.
 * Kept free of network and browser code so it can be unit tested with plain Node.
 */

export const CATEGORIES = [
  "Billing Issue",
  "Technical Problem",
  "Feature Request",
  "General Inquiry",
  "Positive Feedback",
]

export const URGENCY_LEVELS = ["High", "Medium", "Low"]

// Below this confidence the message goes to a human instead of an automatic route.
export const MIN_CONFIDENCE = 0.6

export const SYSTEM_PROMPT = `You triage customer support messages for a small business.
Reply with one JSON object and nothing else, using exactly these keys:
{
  "category": one of ${JSON.stringify(CATEGORIES)},
  "urgency": one of ${JSON.stringify(URGENCY_LEVELS)},
  "confidence": a number from 0 to 1 for how sure you are of the category,
  "reasoning": one or two plain sentences explaining both choices
}
Category rules:
- Choose the category of the customer's main problem when a message mixes topics.
- Positive Feedback is praise or thanks with no request.
- Feature Request asks for something the product does not do yet.
- General Inquiry is a question about hours, plans, policies or how something works.
Urgency rules (judge by business impact, never by message length, punctuation or politeness):
- High: outage, data loss, security problem, customer fully blocked, or money taken wrongly.
- Medium: a feature is broken or a billing problem exists, but the customer can still work,
  or the customer says they will cancel or leave.
- Low: questions, praise, feature requests and anything with no time pressure.
Use a low confidence when the message is too short or vague to classify.`

/**
 * Turn the model's raw text into a validated triage object.
 * Returns null when the reply cannot be trusted, so the caller can fall back.
 *
 * @param {string} content - Raw text from the model
 * @returns {{category: string, urgency: string, confidence: number, reasoning: string} | null}
 */
export function parseTriageResponse(content) {
  if (typeof content !== "string") return null

  // Some models wrap JSON in prose or a code fence; take the outermost braces.
  const start = content.indexOf("{")
  const end = content.lastIndexOf("}")
  if (start === -1 || end <= start) return null

  let data
  try {
    data = JSON.parse(content.slice(start, end + 1))
  } catch {
    return null
  }

  if (!CATEGORIES.includes(data.category)) return null
  if (!URGENCY_LEVELS.includes(data.urgency)) return null

  const confidence = Number(data.confidence)
  if (!Number.isFinite(confidence)) return null

  return {
    category: data.category,
    urgency: data.urgency,
    confidence: Math.min(1, Math.max(0, confidence)),
    reasoning: typeof data.reasoning === "string" ? data.reasoning.trim() : "",
  }
}
