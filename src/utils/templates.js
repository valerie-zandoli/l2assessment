/**
 * Recommendation Templates - Maps categories to recommended actions
 */

const actionTemplates = {
  "Billing Issue": "Check the customer's invoices and payment status. Fix or refund any wrong charge and reply with the result.",
  "Technical Problem": "Check the status page for a known incident. If none exists, ask for the steps, browser and a screenshot, and pass it to engineering.",
  "General Inquiry": "Reply with the matching FAQ or policy link.",
  "Feature Request": "Thank the customer and log the request in the product feedback backlog.",
  "Positive Feedback": "Send a short thank-you. No further action needed.",
  "Unknown": "Review manually."
}

const HIGH_URGENCY_PREFIX = "URGENT: Route to the on-call team now. "

/**
 * Get recommended action for a given category and urgency
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @returns {string} - Recommended next step
 */
export function getRecommendedAction(category, urgency) {
  const action = actionTemplates[category] || "No recommendation available."
  return urgency === "High" && category !== "Positive Feedback" ? HIGH_URGENCY_PREFIX + action : action
}

/**
 * Get all available categories
 *
 * @returns {string[]} - List of categories
 */
export function getAvailableCategories() {
  return Object.keys(actionTemplates)
}

/**
 * Determines if message should be escalated to a human lead
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @returns {boolean} - Whether to escalate
 */
export function shouldEscalate(category, urgency) {
  return urgency === "High" || category === "Unknown"
}
