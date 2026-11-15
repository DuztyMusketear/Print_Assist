# Healthy workload transfer and automated orders

Pause/offline redistributes unfinished approved work to compatible healthy idle
printers or future slots on running printers. Never send it to paused/offline/faulted
equipment. Preserve healthy active/completed output. Interrupted parts restart at
full cost elsewhere, retaining lineage and consumed-material waste; unstarted parts
move without waste. Blocked work remains explicit and cannot duplicate fulfillment.

Persist workload_transfers before/after part/order impacts and update forecasts.
Identify late/unavailable orders and specific parts in red with deadline and ETA;
retain order hues and text warnings. Consider stock, capabilities, priority/deadlines
and future capacity without implicitly approving held/incident-owned quantities.

Add an explicit end_to_end local order mode: intake, saved-model match, feasibility,
schedule application, accelerated dispatch/printing and completion. This option is
explicit simulated start authorization. Manual and match/review modes remain held.
Infeasible/unmatched automatic requests stop with needs_attention and a reason.

The application baseline is already healthy. Its preview currently retains an old
fault-demo database; switch to a separate healthy baseline without deleting user
history or silently clearing real persisted incidents on every reload. Faults remain
explicit simulator actions. No hardware, live shop or inference is introduced.


### Follow-up: returning capacity and earliest deadlines

The scheduler must fill healthy idle printers from already-approved automatic
planned queues, including when resume/online or a completion returns capacity.
Move only unstarted queued attempts; preserve identities, running progress, parts,
manual starts and incident ownership. Exclude faulted/unhealthy or incompatible
capacity and validate unreserved filament. Record zero-waste rebalance impacts
and updated queue ETAs through existing transfer reports/activity.

Use production deadline first, priority as a tie-breaker, then deterministic
identity/start ordering throughout initial dispatch, reviewed proposals, ordinary
transfers, recovery, estimates and timeline/warnings. A printer may remain idle
when all eligible work is already printing or no compatible approved queue exists.
