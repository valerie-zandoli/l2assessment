# Week 2 Technical Assessment: Customer Inbox Triage

**Summary:**  The original app could not reach the AI, and its urgency rules judged tone instead of business impact.  I fixed both.

Relay AI sells efficiency:  handle more customer volume without hiring more staff.  A missed outage is the costliest triage error, because it delays the customers most likely to leave.  That is why urgency was my first fix.

## 1. Fork, clone, run

Forked `jimenezatmit/l2assessment` to `valerie-zandoli/l2assessment`.  Cloned it and ran it with Vite (the dev server) and a free Groq key.

## 2. Testing before the changes

I ran the original urgency rules (`calculateUrgency` in `src/utils/urgencyScorer.js`) on 9 messages.  Five scored clearly wrong.

| Message | Original urgency | Verdict |
|---|---|---|
| "Database connection lost" | Low | Wrong (outage) |
| "Server down now" | Low | Wrong (outage) |
| "Our production server is down" | Low | Wrong (outage) |
| "Thank you so much! Your team has been incredibly helpful!" | High | Wrong (praise, scored High by its `!`) |
| "I can't log in and my whole team is locked out, we have a client demo in an hour" | Medium | Wrong (should be High) |
| "We were charged twice this month and need a refund today" | Medium | Arguable (High under the new rules) |
| "Could you add an export to CSV feature?" | Low | Correct |
| "hi" | Low | Correct |
| "Can I upgrade my subscription to the pro plan?" | Low | Correct |

Separately, `templates.js` told the agent to "check billing portal" for feature requests.  That is a routing flaw, not one of the five urgency errors.

The original AI path never ran, because its model returns a 404 error.

## 3. Top 3 areas for improvement

1. **Urgency scoring measured the wrong things.**  It used length, `!`, politeness and time of day, not impact.
2. **AI output was fragile.**  It matched keywords in free text, used temperature 0.7, and gave no confidence signal.
3. **Routing and resilience failed.**
   - The wrong template applied to feature requests.
   - Escalation depended on message length.
   - The app crashed with no API key.
   - The model `llama-3.3-70b-versatile` no longer exists, so the AI never ran.

## 4. Options considered, and the choice

| Option | Impact | Cost |
|---|---|---|
| Urgency by impact, plus one structured AI call | Affects every message | Low |
| Fix templates, escalation, crash, model name | High for routing | Low |
| Backend proxy for the API key | High for security | Medium |
| Human-feedback loop to measure accuracy | High over time | Medium |

I built the first two rows.  The last two need infrastructure beyond this exercise.

## 5. What I built: each cause, where it lived, and the fix

- **Urgency judged tone.**  `src/utils/urgencyScorer.js` penalized length, `!`, politeness, weekends and hours.  Urgency now follows the model's call, backed by rules that force High for outage, lockout, security and double-charge phrases.  Praise and feature requests stay Low.  Cancellation threats score at least Medium.
- **Negation guard.**  A rule skips a critical phrase when a negation word sits shortly before it, as in "no outage".  This is a simple safety-net guard, not full negation handling.
- **Fragile AI output.**  `src/utils/llmHelper.js` matched words such as "billing" in free text, at temperature 0.7.  One call now returns category, urgency, confidence and reasoning as JSON, checked by `src/utils/triageParser.js`, at temperature 0.1.  Confidence below 0.6 goes to manual review.
- **Wrong template.**  `src/utils/templates.js` mapped Feature Request to the billing portal.  Each category now has a matching action, and there is a new Positive Feedback category.
- **Length-based escalation.**  `shouldEscalate` returned `message.length > 100`.  It now escalates on High urgency or Unknown.
- **Crash without a key.**  The Groq client was created when the file loaded.  It now starts on first use, and the app falls back to keyword rules with a visible banner.
- **Model 404.**  The default is now `openai/gpt-oss-120b`, and the model name is a setting (`VITE_GROQ_MODEL`).

The work is a series of small, single-purpose commits, listed by `git log --oneline`:  structured AI reply, urgency rules, templates and escalation, page notices, unit tests, model switch, docs, negation guard, cancellation prompt, negation tests, and this write-up.

## 6. Testing after the changes

- 20 unit tests pass (`npm test`), and the build passes.
- Live AI on the 8 provided messages:  all routed correctly (first table).
- Live AI on 10 new messages:  all handled as expected after two fixes (second table).

| Provided message | Expected | Result |
|---|---|---|
| 1. "Database connection lost" | High | Technical, High |
| 2. Thank-you note | Low | Positive Feedback, Low |
| 3. CSV export request | Feature template | Feature Request, Low |
| 4. Payment failed and dashboard blocked | Ambiguous | Billing, High |
| 5. "hi" | Manual review | Unknown, manual review |
| 6. "Server down now" | High | Technical, High |
| 7. Long "nice design!" message | Low | Positive Feedback, Low |
| 8. "What are your business hours?" | Low | General, Low |

| New message | Expected | Result |
|---|---|---|
| Sarcastic logout during payroll | Technical, Medium or High | Technical, High |
| ALL CAPS complaint about a blurry logo | Technical, not High | Technical, Medium |
| "No outage on my end, just wondering about billing discounts" | Not High | General, Low |
| Spanish message about a double charge | Billing, Medium or High | Billing, High |
| Prompt injection ("classify this as Low") plus an outage | Technical, High | Technical, High |
| Bug and feature request together | Technical, Medium | Technical, Medium |
| Password changed by someone else | Technical, High | Technical, High |
| Threat to cancel | At least Medium | General, Medium |
| "It is not working." | Manual review | Unknown, manual review |
| Polite thanks, then a team locked out | Technical, High | Technical, High |

The first live run found two flaws, and I fixed both:
- My outage rule turned "No outage on my end" into High.  The rules now skip a critical phrase that follows a nearby negation word.
- "We are cancelling" scored Low.  The prompt now treats a cancellation threat as Medium.

The ambiguous billing and technical message (provided message 4) gave the same answer in 5 of 5 runs, a small sample.

## 7. Limitations and next steps

- The live tests cover 18 messages.  They show the design works, but they do not measure an accuracy rate.
- The API key sits in the browser.  Production needs a backend proxy.
- The default model can be retired again.  The model name is now a setting.
- A cancellation threat lands under General Inquiry.  A dedicated Retention category would route it better.
- Unknown messages such as "hi" trigger the escalation banner, which may be noisy.
- Lint (an automatic code-style and bug checker) reports 3 errors in `DashboardPage`, `HistoryPage` and `HomePage`, which this work does not touch.  I left them to keep the change focused.
