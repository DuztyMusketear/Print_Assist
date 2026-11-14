# Customer, pricing, and demo evidence brief

Prepared 2026-11-13. This brief contains public competitor observations and
explicit hypotheses, not customer validation. No interviews or outreach have
been conducted for this document. It supplements the
[judging checklist](judging-readiness.md) without expanding product scope.

## 1. Buyer and differentiation hypothesis

Initial recruiting profile: an owner-operated filament-print business with
roughly 2-10 printers, repeat products, print-ready files, and customer deadlines.
This fleet range is a recruiting hypothesis, not a measured market segment.

Job to be done: when priorities change or a printer fails, work out what to print
next, which orders are at risk, and which recovery actions are feasible without
continually coordinating everything by hand.

Proposed differentiation: deadline-aware replanning from operator intent, with
reviewable explanations and deterministic enforcement of material, printer, and
quantity constraints. A conversational interface alone is not differentiation.

### Competitive reference points

Public vendor pages retrieved 2026-11-13; USD monthly prices unless specified.
Recheck before pitching. These are vendor claims, not independent evaluations.

| Product | Public offering / price reference | Implication |
| --- | --- | --- |
| [SimplyPrint](https://simplyprint.io/pricing) | Pro lists $9.99/month including five printers, queue/multiprint; Print Farm lists $39.99/month including ten printers. | Fleet dashboards and queues are established offerings; we cannot claim novelty there. |
| [Printago](https://docs.printago.io/docs/settings/subscription-management) | Commercial first production slot free, additional simultaneous production slots $4/month; lists orders/SKUs and store integrations. | Direct workflow overlap. Compare capacity pricing against connected-printer pricing in interviews. |
| [Obico](https://www.obico.io/docs/user-guides/upgrade-to-pro/) | AI Premium documentation lists $8.99 monthly or $6.99/month billed annually for the base plan, with AI detection allowances. | Monitoring is already available at low entry prices; production coordination needs its own value case. |

Do not claim these products lack agent reasoning or deadline features without
deeper verification. Discovery must establish whether sellers have an unsolved
problem despite existing tools. A future integration with existing management
software may be more attractive than replacing it; no integration is added to MVP.

## 2. Interview guide and decision rules

Suggested first round: five qualified sellers, recruited by the team after
explicit authorization for any assistant-sent messages. Five interviews can
reveal patterns, not establish market prevalence. Avoid leading with our pitch.

Ask about actual recent behavior:

1. Walk through your last customer order from purchase to packing.
2. Tell me about the last printer failure or priority change while orders were due.
3. How did you decide what to do next, and how long did it take?
4. What was delayed or wasted? What records could help estimate the impact?
5. What tools do you use and pay for today? What remains manual?
6. Which actions would you trust software to suggest versus perform?
7. What would stop you connecting this to your workflow: setup, reliability,
   printer support, privacy, price, or something else?

Only then show the demo, ask them to perform a realistic replanning task, and
ask what was useful, confusing, or unnecessary. Test price concepts after value:
ask which existing tool/budget it would replace, compare printer capacity with
simultaneous-production-slot billing, and ask whether they would take a concrete
next step toward a pilot. Compliments are not purchase commitments.

Record one row per interview: anonymous ID, qualification, current tools/cost,
recent incident, frequency, operator effort, waste/deadline effects, evidence
source, observed task result, price reaction, objections, pilot commitment, and
permission to quote. Keep personal data out of the repository.

Proposed first-round decisions (team heuristics, not statistical validation):

- Continue the hypothesis if at least three of five describe a recent material
  coordination/recovery problem and at least two agree to a specific pilot step.
- If sellers are satisfied with existing tools, revisit differentiation or an
  integration-first approach before adding features.
- If task observation shows no benefit over manual/rules-only controls, do not
  claim agent value. Change the interaction or narrow the use case.
- A paid pilot or purchase is stronger evidence than a stated acceptable price;
  do not equate interest, pilot participation, and revenue.

## 3. Pricing experiment and unit economics

**Test concepts only, not a launch price or a billing implementation:**

| Concept | Monthly price hypothesis | Capacity hypothesis | Included provider-spend ceiling |
| --- | --- | --- | --- |
| Starter business | $19 | Up to 3 connected printers | $2/account/month |
| Growing business | $39 | Up to 10 connected printers | $5/account/month |

These prices face lower-priced, more mature competitors. Customers must show a
reason to pay; the prototype cannot justify a premium merely by using agents.
Validate printer-count fairness versus active slots. Avoid launching a free tier
until onboarding/support costs are understood. Additional usage requires explicit
opt-in to a capped pack; a ceiling is not guaranteed token capacity or a charge.

### Illustrative $19 plan sensitivity

All numbers below are invented planning inputs, not supplier quotes or measured
costs. Payment assumption is 3% + $0.30 per monthly payment; hosting/storage
allocation is $2/account/month. Support is valued at an assumed $30/hour.
Provider allocation is bounded at $2; demand above this must be capped or paid
separately, not silently served as unlimited usage.

| Per account per month | Light | Typical | Heavy support |
| --- | ---: | ---: | ---: |
| Revenue | $19.00 | $19.00 | $19.00 |
| Provider inference | $0.25 | $1.00 | $2.00 |
| Hosting/storage allocation | $2.00 | $2.00 | $2.00 |
| Support minutes | 2 | 10 | 30 |
| Support cost | $1.00 | $5.00 | $15.00 |
| Payment processing | $0.87 | $0.87 | $0.87 |
| Contribution after modeled costs | $14.88 | $10.13 | -$0.87 |
| Contribution / revenue | 78.3% | 53.3% | -4.6% |

Example fixed monthly overhead assumption: $1,000, excluding anything already
allocated above. Break-even is 68 light-use accounts or 99 typical accounts;
there is no break-even by adding heavy-support accounts with negative
contribution. This is not net profit: taxes, acquisition, refunds, annual-price
discounts, and founder compensation are not fully modeled. Do not double-count
allocated hosting/support in the fixed-cost input.

Provider formula when a model is selected:
`calls * ((mean_input_tokens * input_price_per_million + mean_output_tokens *
output_price_per_million) / 1_000_000)`, summed across models, specialists and
retries. Replace placeholders with current official rates and measured traces;
include other billable usage when applicable. Development uses fakes and has
zero application inference cost. No provider choice or live call is authorized.

### Customer value and acquisition tests

Illustrative value threshold: at the seller's own assumed $20/hour value of
time, a $19 subscription needs 57 minutes of monthly time savings to offset its
price before considering other benefits. This is a value hypothesis, not a wage
fact or a savings claim. Avoid double-counting time, material, and lost revenue.

With typical modeled contribution of $10.13, an assumed $50 customer acquisition
cost has a simple contribution payback of about 4.94 months, excluding churn.
Record actual acquisition effort and retention before claiming sustainable growth.

## 4. Initial market evidence still needed

Do not use all Etsy sellers or the global additive manufacturing market as our
addressable buyer count. Neither establishes the number of filament businesses
with an unsolved coordination problem.

Next research deliverable: a dated, deduplicated count/sample of qualified
businesses in a named channel/geography, the qualification method, reachable
channels, and uncertainty. Use it to estimate buyers, then reachable adoption
and annual revenue. No credible qualified seller count has been established here.

For pitch arithmetic only: 100 paying accounts at an assumed $19/month equals
$22,800 annual recurring revenue; 1,000 equals $228,000. These are scenarios,
not market size, forecasts, demand evidence, or an acquisition plan. A larger
fleet/team opportunity remains conditional on customer discovery and integrations.

## 5. Demo script: show the decision that matters

Proposed three-minute structure; adjust after confirming the actual time limit.
This is a target script, not a record of delivered functionality.

| Time | Show | Judge takeaway |
| --- | --- | --- |
| 0:00-0:25 | A small seller, three filament printers, orders due soon | A concrete buyer and costly coordination problem |
| 0:25-0:55 | Manually enter an order and show deadline/capacity risk | The core workflow works without inference |
| 0:55-1:35 | Inject a fault; operator asks to protect urgent orders while preserving a material constraint | Changing intent creates a replanning task; safety stops equipment deterministically |
| 1:35-2:10 | Review a proposal identifying affected orders, compatible printer, material use and remaining risk; apply once | Reasoning is inspectable and actions are validated |
| 2:10-2:35 | Show completion and matched scenario results, labeled simulated | Benefits have measurable definitions; no invented savings |
| 2:35-3:00 | Pricing hypothesis, bounded costs, pilot plan and realistic next step | A business hypothesis with an evidence-based validation path |

Agent-value comparison: compare manual controls, deterministic scheduling, and
assisted intent entry on the same task. Capture operator actions/time in an
observed trial separately from simulated production outcomes. Prefer using the
same validated scheduler beneath both modes so advantages cannot be manufactured
by weakening the baseline. Report when outcomes are equal.

Development rehearsals use labeled scripted fakes. An eventual live reasoning
demo requires framework readiness and separate operator enablement. Keep an
offline framework demo/actual-build recording as fallback; never pass it off as
live reasoning. Explain that physical printing remains unvalidated.

## 6. Evidence status and next actions

| Deliverable | Current status | Next evidence needed |
| --- | --- | --- |
| Buyer/problem | Specific hypothesis and interview guide | Actual seller incident accounts and observed workflow |
| Competitive context | Three public vendor reference points | Deeper feature comparison and seller switching objections |
| Pricing/cost logic | Two test concepts and sensitivity calculation | Willingness to pay, measured usage, actual supplier/support costs |
| Market size | Not established | Qualified buyer count and realistic acquisition channel |
| Agent differentiation | Defined test and honest baseline | Implemented workflow and observed comparison |
| Impact/demo | Script and measurable outcomes defined | Passing build, matched scenario results and rehearsal |

Prepare artifacts now; do not score these as validated outcomes. Keep application
development focused on the existing six milestones.
