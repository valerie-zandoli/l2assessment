/**
 * Urgency Scorer
 *
 * Urgency reflects business impact, not tone.  Message length, exclamation marks,
 * politeness and time of day say nothing about impact, so none of them count here.
 * Order of authority:
 *   1. Critical-impact phrases force High (a safety net in case the model misses an outage).
 *   2. Praise and feature requests are never above Low.
 *   3. The model's own urgency call.
 *   4. A category default, used only when the model is unavailable.
 */

const CRITICAL_PATTERNS = [
  /\b(server|site|website|app|dashboard|service|system|api|database|production|checkout)\b.{0,30}\b(down|offline|unreachable|crashed)\b/i,
  /\b(down|offline|outage)\b.{0,20}\b(now|for everyone|for all)\b/i,
  /\boutage\b/i,
  /\bconnection lost\b/i,
  /\b(can'?t|cannot|unable to)\b.{0,15}\b(log ?in|sign ?in|access)\b/i,
  /\blocked out\b/i,
  /\b(data loss|lost (all )?(my |our )?data|deleted (all )?(my |our )?data)\b/i,
  /\b(hacked|breach|compromised|unauthori[sz]ed)\b/i,
  /\b(charged|billed) (me |us )?(twice|two times|again)\b|\bdouble[- ]charged\b/i,
]

// "No outage on my end" must not trigger the outage rule.
const NEGATION_BEFORE = /\b(no|not|never|without|isn'?t|wasn'?t|aren'?t|weren'?t|zero)\b[^.!?,;]{0,20}$/i

// Patterns that already contain their own negation ("can't log in") skip the guard.
const SELF_NEGATED = /can'?t|cannot|unable|locked out/

function hasCriticalPhrase(message) {
  return CRITICAL_PATTERNS.some((pattern) => {
    const match = message.match(pattern)
    if (!match) return false
    if (SELF_NEGATED.test(pattern.source)) return true
    return !NEGATION_BEFORE.test(message.slice(0, match.index + match[0].length))
  })
}

const CATEGORY_DEFAULTS = {
  "Billing Issue": "Medium",
  "Technical Problem": "Medium",
  "General Inquiry": "Low",
  "Feature Request": "Low",
  "Positive Feedback": "Low",
}

/**
 * @param {string} message - The customer message
 * @param {{category?: string, llmUrgency?: string|null}} [context]
 * @returns {"High"|"Medium"|"Low"}
 */
export function calculateUrgency(message, { category, llmUrgency } = {}) {
  const lowStakes = category === "Positive Feedback" || category === "Feature Request"

  if (!lowStakes && hasCriticalPhrase(message)) return "High"
  if (lowStakes) return "Low"
  if (["High", "Medium", "Low"].includes(llmUrgency)) return llmUrgency

  // Unknown or unclassified messages stay Medium so that a human sees them.
  return CATEGORY_DEFAULTS[category] || "Medium"
}
