import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateUrgency } from '../src/utils/urgencyScorer.js'
import { getRecommendedAction, shouldEscalate } from '../src/utils/templates.js'
import { parseTriageResponse } from '../src/utils/triageParser.js'

// Outages the old length/punctuation rules scored Low
for (const msg of [
  'Database connection lost',
  'Server down now',
  'Our production server is down',
  "I can't log in and my whole team is locked out",
  'We were charged twice this month',
  'I think our account was hacked',
]) {
  test(`critical phrase is High: ${msg}`, () => {
    assert.equal(calculateUrgency(msg, { category: 'Technical Problem', llmUrgency: 'Low' }), 'High')
  })
}

test('exclamation marks do not raise urgency', () => {
  const msg = 'Thank you so much! Your team has been incredibly helpful!'
  assert.equal(calculateUrgency(msg, { category: 'Positive Feedback', llmUrgency: 'Low' }), 'Low')
})

test('praise and feature requests stay Low even if the model overrates them', () => {
  assert.equal(calculateUrgency('Great app!', { category: 'Positive Feedback', llmUrgency: 'High' }), 'Low')
  assert.equal(calculateUrgency('Add CSV export please', { category: 'Feature Request', llmUrgency: 'High' }), 'Low')
})

test('"download" does not count as "down"', () => {
  assert.equal(calculateUrgency('How do I download my invoice app copy?', { category: 'General Inquiry', llmUrgency: 'Low' }), 'Low')
})

test('model urgency is used when no critical phrase matches', () => {
  assert.equal(calculateUrgency('The export button is slow', { category: 'Technical Problem', llmUrgency: 'Medium' }), 'Medium')
})

test('category default applies when the model is unavailable', () => {
  assert.equal(calculateUrgency('What are your hours?', { category: 'General Inquiry', llmUrgency: null }), 'Low')
  assert.equal(calculateUrgency('Something odd', { category: 'Unknown', llmUrgency: null }), 'Medium')
})

test('feature requests no longer route to the billing portal', () => {
  assert.doesNotMatch(getRecommendedAction('Feature Request', 'Low'), /billing/i)
})

test('High urgency adds an on-call prefix, praise never does', () => {
  assert.match(getRecommendedAction('Technical Problem', 'High'), /^URGENT/)
  assert.doesNotMatch(getRecommendedAction('Positive Feedback', 'High'), /URGENT/)
})

test('escalation follows urgency, not message length', () => {
  assert.equal(shouldEscalate('Technical Problem', 'High'), true)
  assert.equal(shouldEscalate('General Inquiry', 'Low'), false)
  assert.equal(shouldEscalate('Unknown', 'Medium'), true)
})

const good = '{"category":"Billing Issue","urgency":"Medium","confidence":0.9,"reasoning":"Card failed."}'

test('parser accepts valid JSON', () => {
  assert.deepEqual(parseTriageResponse(good), { category: 'Billing Issue', urgency: 'Medium', confidence: 0.9, reasoning: 'Card failed.' })
})

test('parser strips code fences and prose', () => {
  assert.equal(parseTriageResponse('Here you go:\n```json\n' + good + '\n```').category, 'Billing Issue')
})

test('parser rejects bad category, bad urgency, bad confidence and non-JSON', () => {
  assert.equal(parseTriageResponse(good.replace('Billing Issue', 'Weather')), null)
  assert.equal(parseTriageResponse(good.replace('Medium', 'Critical')), null)
  assert.equal(parseTriageResponse(good.replace('0.9', '"high"')), null)
  assert.equal(parseTriageResponse('This looks like a billing issue.'), null)
  assert.equal(parseTriageResponse(undefined), null)
})

test('parser clamps confidence to 0-1', () => {
  assert.equal(parseTriageResponse(good.replace('0.9', '7')).confidence, 1)
})

test('negated critical phrases do not force High', () => {
  for (const msg of ['No outage on my end, just wondering about annual billing', 'The server is not down, I am only asking about plans', 'I was not charged twice, thanks']) {
    assert.notEqual(calculateUrgency(msg, { category: 'General Inquiry', llmUrgency: 'Low' }), 'High')
  }
})

test('negation guard does not hide real outages', () => {
  assert.equal(calculateUrgency('No idea why, the server is down now', { category: 'Technical Problem', llmUrgency: 'Low' }), 'High')
  assert.equal(calculateUrgency("We can't log in", { category: 'Technical Problem', llmUrgency: 'Low' }), 'High')
})
