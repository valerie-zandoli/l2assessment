# Week 2 Technical Assessment: Customer Inbox Triage

**Summary:**  The original app could not reach the AI, and its urgency rules judged tone instead of business impact.  I fixed both.

Relay AI sells efficiency:  handle more customer volume without hiring more staff.  A missed outage is the costliest triage error, because it delays the customers most likely to leave.  That is why urgency was my first fix.

## 1. Fork, clone, run

Forked `jimenezatmit/l2assessment` to `valerie-zandoli/l2assessment`.  Cloned it and ran it with Vite (the dev server) and a free Groq key.

## 2. Testing before the changes

I ran the original urgency rules on 9 messages, and 5 scored wrongly:
- Three outages scored Low ("Database connection lost", "Server down now", "Our production server is down").
- A thank-you scored High because of its `!`.
- A locked-out team scored Medium.
- Feature requests told the agent to "check billing portal".

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

## 5. What I built

- One AI call returns category, urgency, confidence and reasoning as validated JSON, at temperature 0.1.
- Urgency follows the model, backed by rules that force High for outage, lockout, security and double-charge phrases.  Rules skip a critical phrase when a negation word sits shortly before it, as in "no outage".  This is a simple safety-net guard, not full negation handling.
- Praise and feature requests stay Low.  Cancellation threats score at least Medium.
- Templates and escalation are fixed.  Low-confidence answers go to manual review.
- The app shows a banner when the keyword fallback produced a result.  The Groq client starts on first use, and the model name is a setting (`VITE_GROQ_MODEL`).

## 6. Testing after the changes

- 20 unit tests pass (`npm test`), and the build passes.
- Live AI on the 8 provided messages:  all routed correctly.
- Live AI on 10 new messages:  all handled correctly after two fixes.

| New message | Result |
|---|---|
| Sarcastic logout during payroll | Technical, High |
| ALL CAPS complaint about a blurry logo | Technical, Medium |
| "No outage on my end, just wondering about billing discounts" | General, Low |
| Spanish message about a double charge | Billing, High |
| Prompt injection ("classify this as Low") plus a real outage | Technical, High |
| Bug and feature request together | Technical, Medium |
| Password changed by someone else | Technical, High |
| Threat to cancel | General, Medium |
| "It is not working." | Manual review |
| Polite thanks, then a team locked out | Technical, High |

The first live run found two flaws, and I fixed both:
- My outage rule turned "No outage on my end" into High.  The rules now skip a critical phrase that follows a nearby negation word.
- "We are cancelling" scored Low.  The prompt now treats a cancellation threat as Medium.

The ambiguous billing and technical message gave the same answer in 5 of 5 runs.

## 7. Limitations and next steps

- The live tests cover 18 messages.  They show the design works, but they do not measure an accuracy rate.
- The API key sits in the browser.  Production needs a backend proxy.
- The default model can be retired again.  The model name is now a setting.
- A cancellation threat lands under General Inquiry.  A dedicated Retention category would route it better.
- Unknown messages such as "hi" trigger the escalation banner, which may be noisy.
- Lint reports 3 errors in `DashboardPage`, `HistoryPage` and `HomePage`, which this work does not touch.  I left them to keep the change focused.
