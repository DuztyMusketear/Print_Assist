# Judging readiness

Source: the user-supplied hackathon rubric. Each category is scored 1-5.
Weighted score on the same scale is `0.30*T + 0.20*P + 0.20*M + 0.20*I + 0.10*D`.
Weights guide evidence preparation; they do not predict the judges' scores.

See the [business validation brief](business-validation.md) for competitor
references, interview questions, pricing experiments, illustrative economics,
and the proposed demo script. Assumptions remain labeled until validated.

## Rubric and evidence

| Category | Weight | Evidence to prepare | Current gap / delivery checkpoint |
| --- | --- | --- | --- |
| Technical execution and functionality | 30% | Running order-to-print-completion demo, injected fault and reviewed recovery, repeatable reset, actual test results, clear weekend contribution | No implementation yet. Tasks 1-6 deliver this. Record what was built during the event versus beforehand. |
| Problem clarity and solution fit | 20% | One small filament-print business persona, deadline/supervision/waste problem, and direct mapping from each demo action to customer value | Persona is defined; pain and willingness to adopt are hypotheses. Gather seller evidence when available; do not invent interviews. |
| Market viability and financial logic | 20% | Who pays, printer-capacity subscription hypothesis, cost model, break-even logic, and a sourced bottom-up market estimate | No validated prices, market size, or unit economics yet. Prepare a transparent assumptions worksheet alongside tasks 1-6. |
| Impact and growth potential | 20% | Matched simulated baseline/assisted outcomes, realistic customer expansion path, and technical/commercial limits | Simulation can demonstrate metrics, not prove real savings. Task 6 supplies comparisons; real pilots remain future validation. |
| Presentation and professionalism | 10% | Timed story, legible UI, practiced reset, offline fallback, concise answers about limitations | Prepare and rehearse during task 6. Confirm actual pitch duration with organizers before locking timings. |

## The story to demonstrate

An owner-operated filament-printing shop has several orders due soon. A printer
fault threatens one order. The operator sees the risk, reviews a compatible
recovery proposal, and keeps production moving with a clear view of remaining
deadlines and waste. Printing is simulated; finishing, packing, and shipping are
human steps. Etsy figures illustrate the workflow without restricting the market.

Explain the division of work: deterministic code owns scheduling constraints,
equipment state, validation and safety. Agents can interpret changing operator
intent and propose context-aware actions through typed tools. Demonstrate that
specific added value before claiming the agents outperform a rules-only system.
If only scripted fakes are shown, explicitly call them scripted framework demos.
The optional live demo still requires all readiness and budget gates.

## Business evidence worksheet to prepare

No customer interviews or outreach are planned. Use attributed desk research
and internal workflow comparisons; direct customer validation and willingness
to pay remain unknown and are not prerequisites for building the MVP.

- Buyer: small filament-print business owner. Record how they work today, what
  fails, time spent monitoring, alternatives used, and willingness to pay.
- Pricing: printer-capacity subscription plus included bounded AI usage; exact
  prices and limits are unvalidated. Billing implementation is outside the MVP.
- Monthly variable cost per account = provider usage + hosting/storage share +
  variable support/payment costs. Separate fixed development/operating costs.
- Contribution per account = monthly revenue minus monthly variable cost.
  Break-even accounts = fixed monthly costs divided by positive contribution,
  rounded up. If contribution is zero/negative, more customers do not solve it.
- Model low/typical/heavy usage using explicit assumed calls, input/output token
  volumes and current verified provider rates when a provider is selected.
  Show budget caps and sensitivity, not an unsupported margin claim.
- Estimate the reachable initial market bottom-up: eligible small print sellers
  in a named geography/channel, plausibly reachable share, and assumed annual
  revenue per account. Research and cite numbers before presenting them as facts;
  do not substitute the entire additive-manufacturing market for our buyer base.

No external customer outreach is authorized by this checklist. Record research,
interviews, and financial assumptions as separate evidence when actually obtained.

## Impact and expansion

Start with print-ready filament workflows for small sellers. Next validate
physical printer connectors and customer pilots, then broader print-farm/team
workflows and marketplace adapters. Industrial/resin/metal opportunities require
separate discovery, integration, safety and process validation.

The local single-process SQLite prototype is not proof of fleet/cloud scale.
Growth requires authentication/tenant isolation, production persistence,
observability, secure connectors, and measured capacity tests. Browser access
reduces customer installation needs once hosted; hosting is not in this MVP.

## Demo and pitch checklist

- [ ] Open with customer, problem, and business outcome before architecture.
- [ ] Show one order, deadline risk, three printers, fault, reviewed recovery,
  and print completion. Keep all states and actions legible.
- [ ] Show matched scenario outcomes with simulated labels and assumptions;
  report actual operator effort only if it was measured.
- [ ] Explain buyer, proposed pricing, cost assumptions, and next validation step.
- [ ] Show a realistic expansion path and distinguish future work from delivered work.
- [ ] Record setup instructions, actual test results, and event contribution.
- [ ] Rehearse to the confirmed time limit; prepare a shorter demo and a local
  recording/screenshots from the actual build as fallback, clearly identified.
- [ ] Be ready to explain why agents help, how token spend is bounded, what
  happens offline, and why simulation does not prove physical-printer reliability.

Current status: preparation plan only. No category has been independently scored
and no business/technical outcome has been verified by this document.
