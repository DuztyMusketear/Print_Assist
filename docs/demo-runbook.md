# Offline demo runbook

Open the running dashboard at http://127.0.0.1:5173. All marketplace and equipment
events below are simulated. No real shop, physical printer or LLM is contacted.
The application currently demonstrates deterministic tool coordination; live agent
orchestration remains planned. Production activity and recorded tool calls describe
operations that actually ran, not scripted agent replies.

## Preparation

1. Open Overview > Scenario controls > Demo scenarios in the right-hand sidebar.
2. For a clean rehearsal, use the adjacent Reset simulation scenario > Empty workshop.
   Check the reset acknowledgement and choose Reset scenario. Reset replaces current
   simulation work/history, keeps repository assets, stops the clock and disables agents.
3. Expand Demo scenarios again after a reset. Event inputs are configurable. The
   model profile supplies runtime/material estimates; no model generation is needed.

## Manual marketplace intake

1. Keep Incoming marketplace order, select a saved model and set a product identifier,
   quantity, material/color and deadline. Keep Order processing = Manual inbox review.
2. Trigger simulated event. The notification and history show receipt of a simulated
   Etsy-style request. It creates no print jobs and consumes no inference calls.
3. Go to Orders, inspect the incoming request, confirm its saved model and accept it.
   Continue to Schedule, review the proposal and confirm manual printing.
4. Go to Overview/Printers, select an assigned printer and choose Start print. Run
   the clock to show live simulated progress. Existing workflow controls guide the tabs.

## Fully automatic order and restored backlog

1. On a clean workshop, select Incoming marketplace order and Fully automated
   simulated order-to-print. Set quantity 15, deadline 24 simulated hours and speed 1x.
2. Trigger. Matching, full feasibility validation, schedule approval, printer starts
   and the clock use the ordinary production workflow. Pause the clock while talking
   through the floor and timeline. Three active prints have future work queued.
3. Pause or take one printer offline using its floor controls. The unfinished work
   moves to healthy equipment and the timeline/ETAs update. Active healthy parts stay put.
4. Resume/bring it online, or use Printer restored in Demo scenarios. A resumed printer
   receives an active part AND a balanced future queue. The queue respects earliest
   production deadlines, compatibility, existing filament commitments and manual holds.

## Urgent order, faults, refill and recovery

These events can follow one another in the same workshop without reset.

1. With the 15-part workload active and clock paused, select Urgent order, quantity 1,
   deadline 5 hours, automatic processing and speed 1x. Trigger, then pause the clock.
   The new feasible urgent part moves ahead of approved future work; active prints
   keep running. Compare actual before/after completion estimates in event history.
2. Select Printer thermal fault and an active printer. Choose automatic recovery only
   if you want to authorize feasible compatible parts, including work that will finish late. Trigger the fault. The
   equipment isolates immediately; the ordinary recovery planner redistributes work
   if policy/feasibility permit. Late production or shipping estimates produce warnings while compatible work continues; blocked parts remain held. Operator-review mode still requires approving the feasible plan.
3. Inspect Incidents & Schedule Impact for diagnosis, original/revised assignments,
   waste and affected orders. Deadline risks appear red. To demonstrate a blocked
   or late case, use an infeasible incoming deadline or restrictive material/capacity;
   the application reports the actual result rather than forcing recovery success.
4. Select Printer restored and the isolated printer. Acknowledge simulated inspection
   and trigger. Clearing equipment does not bypass held recovery approvals. Compatible
   approved queues rebalance onto restored capacity.
5. Select Insufficient filament, a printer and available grams = 0. Trigger. Unsafe
   equipment cannot start; real fault/recovery logic evaluates alternative printers.
6. Restore the affected printer with inspection acknowledgement and known positive
   refill, for example 1000 g. The scheduler reevaluates its capacity and backlog.
7. Run the clock at 300x/3600x to show exact completion, then inspect history. Reset
   explicitly to repeat. Triggering a new event creates a new identity; retrying an
   uncertain command reuses the original identity to avoid duplicate jobs/orders.

## Evidence and limitations

Use the floor, timeline, current deadline warnings, incident reports and Production
activity as authoritative state. Event history retains before/after order estimates
and actual deterministic tool calls, including indirectly affected orders. Cached
product mappings reuse saved manufacturing artifacts. Physical fault resolution is
an explicit simulated operator acknowledgement. Recovery review settings are never
silently replaced by a panel's old settings. Tests run offline; real marketplace
integration, live agent reasoning and physical device control remain outside this demo.


## Optional signed-in advisor

The Orchestrator panel is a separate, explicit read-only assistant within the same
sidebar, above Scenario controls. It requires configured registered OpenAI sign-in;
see [account setup](openai-assistant-setup.md). Demo events do not require this connection
and do not invoke models. Never present deterministic event/tool history as LLM reasoning.
The Agent network labels unavailable specialists and ordinary deterministic tools.


## Quick fault demonstration with every station printing

1. In Scenario controls > Reset workshop, choose **Active printers + automatic
   recovery**. Read the replacement warning, acknowledge reset and press Reset scenario.
   This replaces current workshop data; do not use it to preserve an existing run.
2. Every compatible registered FFF printer starts a real sample job with future jobs
   queued. The clock is paused so the presenter can inspect the whole floor first.
   Sample profiles are simulated estimates. Non-compatible printers are reported.
3. Inject a fault into any active target. The ordinary fault/recovery services choose
   redistribution; the demo does not hardcode assignments or success.
4. For filament runout, open that printer's **Load filament** controls. Keep the
   default **Add filament**, enter measured grams, acknowledge matching loaded
   material and Add filament. This works even while the printer is faulted or running.
5. The matching refill automatically clears the filament fault and reevaluates
   eligible work; no separate Mark resolved click is needed and stock is added once.
   Inspect the incident for the recorded refill and equipment-clearance actions.
   Thermal/clog/connection faults still require their relevant repair confirmation.
6. Restored compatible capacity receives normal approved work/backlog. Run the clock
   to demonstrate exact completion. Refill may also be performed during an active
   print without changing the part or its material; type/color replacement remains
   blocked until the printer is uncommitted and safe.
