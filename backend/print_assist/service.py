"""Serialized, transactional order intake; one application owner per database."""
import json
import threading
from uuid import uuid4

from .contracts import CommandEnvelope, ScheduleCommand
from .scheduling import schedule, start_job
from .simulation import advance
from .scenarios import initial_state
from .store import Store
from .modeling import create_task, move_task, initialize_support_tasks
from .controls import control_printer
from .scenarios import scenario_state
from .activity import record


class FactoryService:
    def __init__(self, path):
        self.store = Store(path)
        self.lock = threading.RLock()
        with self.store.transaction() as db:
            state = self.store.load(db) or initial_state()
            if "printer_schema_version" not in state:
                state["printers"] = initial_state()["printers"]
                state["printer_schema_version"] = 1
            initialize_support_tasks(state)
            for job in state["jobs"]:
                if job["status"] == "running":
                    job["status"] = "paused"
                    next(printer for printer in state["printers"] if printer["id"] == job["printer_id"])["status"] = "paused"
            state["session_id"] = str(uuid4())
            state["running"] = False
            state['recovery_policy']='review'
            state["controls"] = {"agents_enabled": False, "automatic_triggers": False}
            db.execute("DELETE FROM commands")
            self.store.save(db, state)

    def snapshot(self) -> dict:
        with self.lock, self.store.transaction() as db:
            return self.store.load(db)

    def proposal(self,mode):
        from .proposals import propose
        return propose(self.snapshot(),mode)

    def inject_fault(self,command):
        from .incidents import inject_fault
        return self._transition(command,'inject-fault',lambda state:inject_fault(state,command.payload.model_dump(mode='json')))

    def recovery_proposal(self,incident_id):
        from .recovery import propose_recovery
        return propose_recovery(self.snapshot(),incident_id)

    def recover(self,command):
        from .recovery import apply_recovery
        return self._transition(command,'recover',lambda state:apply_recovery(state,command.payload.model_dump(mode='json')))

    def reject_recovery(self,command):
        from .recovery import reject_recovery
        return self._transition(command,'reject-recovery',lambda state:reject_recovery(state,command.payload.model_dump(mode='json')))

    def clear_fault(self,command):
        from .recovery import clear_fault
        return self._transition(command,'clear-fault',lambda state:clear_fault(state,command.payload.model_dump(mode='json')))

    def recovery_policy(self,command):
        from .recovery import set_recovery_policy
        return self._transition(command,'recovery-policy',lambda state:set_recovery_policy(state,command.payload.model_dump(mode='json')))

    def incident_telemetry(self,command):
        from .recovery import update_incident_telemetry
        return self._transition(command,'incident-telemetry',lambda state:update_incident_telemetry(state,command.payload.model_dump(mode='json')))

    def apply_schedule(self,command):
        from .proposals import apply_proposal
        return self._transition(command,'apply-schedule',lambda state:apply_proposal(state,command.payload.proposal_id,command.payload.mode,command.payload.clock_speed,command.payload.require_on_time))

    def upload_model(self,command):
        from hashlib import sha256
        from .library import decode_mesh, save_model
        payload=command.payload.model_dump(mode='json')
        data=decode_mesh(payload['stl_base64']);digest=sha256(data).hexdigest()
        def persist(db):
            db.execute('INSERT OR IGNORE INTO meshes VALUES (?, ?)',(digest,data))
        identity={key:value for key,value in payload.items() if key!='stl_base64'}
        identity['mesh_digest']=digest
        return self._transition(command,'model-upload',lambda state:save_model(state,payload,digest),persist,identity)

    def read_mesh(self,digest):
        with self.lock,self.store.transaction() as db:
            state=self.store.load(db)
            if not any(asset['id']=='upload-'+digest for asset in state.get('visual_assets',[])):
                return None
            return db.execute('SELECT data FROM meshes WHERE digest=?',(digest,)).fetchone()[0]

    def load_shop_examples(self,command):
        from .shop import load_examples
        return self._transition(command,'shop-examples',load_examples)

    def decide_shop_request(self,command):
        from .shop import decide
        return self._transition(command,'shop-decision',lambda state:decide(state,command.payload.model_dump(mode='json')))

    def revise_order(self,command):
        from .order_review import revise
        return self._transition(command,'order-revise',lambda state:revise(state,command.payload.model_dump(mode='json')))

    def delete_order(self,command):
        from .order_review import delete
        return self._transition(command,'order-delete',lambda state:delete(state,command.payload.model_dump(mode='json')))

    def estimate_order(self,request):
        from .estimates import estimate
        state=self.snapshot()
        if str(request.session_id)!=state['session_id']:
            raise ValueError('Stale session; refresh before estimating')
        return estimate(state,request.order.model_dump(mode='json'))

    def simulate_order(self,command):
        from .shop import simulate
        from .order_demo import simulate_automatic_order
        handler=simulate_automatic_order if command.payload.mode=='end_to_end' else simulate
        return self._transition(command,'shop-simulate',lambda state:handler(state,command.payload.model_dump(mode='json')))

    def schedule(self, command: ScheduleCommand) -> dict:
        return self._transition(command, "schedule", lambda state: schedule(state, command.payload.mode))

    def create_model_task(self, command):
        return self._transition(command, 'model-create', lambda state: create_task(state, command.payload.model_dump(mode='json')))

    def move_model_task(self, command):
        return self._transition(command, 'model-move', lambda state: move_task(state, command.payload.model_dump(mode='json')))

    def start(self, command) -> dict:
        return self._transition(command, "start", lambda state: start_job(state, command.payload.job_id))

    def advance(self, command) -> dict:
        return self._transition(command, "advance", lambda state: advance(state, command.payload.seconds))

    def plan_order(self,command):
        def plan(state):
            from copy import deepcopy
            result=deepcopy(state)
            payload=command.payload.order.model_dump(mode='json')
            if not any(artifact['id']==payload['artifact_id'] for artifact in result['artifacts']):
                raise ValueError('Unknown artifact')
            order=dict(id=str(uuid4()),**payload,status='queued',successful_quantity=0,schedule_mode=command.payload.mode)
            result['orders'].append(order)
            record(result,'order_created','Order added from prepared model profile',order_id=order['id'])
            if command.payload.review_only:
                order['requires_schedule_review']=True
                return result
            result=schedule(result,command.payload.mode,preserve_mode=True)
            if command.payload.mode=='automatic':
                result['running']=True
                result['clock_speed']=command.payload.clock_speed
            return result
        return self._transition(command,'plan-order',plan)

    def clock(self,command):
        def configure(state):
            from copy import deepcopy
            result=deepcopy(state)
            result['running']=command.payload.running
            result['clock_speed']=command.payload.speed
            record(result,'clock_changed','Clock '+('running' if result['running'] else 'paused'))
            return result
        return self._transition(command,'clock',configure)

    def tick(self):
        with self.lock, self.store.transaction() as db:
            state=self.store.load(db)
            if state['running']:
                original=state
                try:
                    state=schedule(state,'automatic',preserve_mode=True)
                    speed=state.get('clock_speed',60)
                    for offset in range(0,speed,300):
                        state=advance(state,min(300,speed-offset))
                except (ValueError,RecursionError) as error:
                    state=original
                    state['running']=False
                    record(state,'clock_stopped','Clock paused: '+str(error),source='system',status='blocked')
                from .order_demo import refresh_order_demonstrations
                state=refresh_order_demonstrations(state)
                state['revision']+=1
                self.store.save(db,state)

    def load_filament(self,command):
        from .controls import load_filament
        return self._transition(command,'load-filament',lambda state:load_filament(state,command.payload.model_dump(mode='json')))

    def printer_control(self,command):
        return self._transition(command,'printer-control',lambda state: control_printer(state,command.payload.printer_id,command.payload.action))

    def scenario_event(self,command):
        from .demo_scenarios import trigger_scenario
        return self._transition(command,'scenario-event',lambda state:trigger_scenario(state,command.payload.model_dump(mode='json')))

    def reset(self,command):
        def replace(state):
            result=scenario_state(command.payload.scenario,
                state['printers'] if command.payload.scenario=='fault-demo' else None)
            result['session_id']=str(uuid4())
            record(result,'scenario_reset','Reset to '+command.payload.scenario+' scenario',source='system')
            return result
        return self._transition(command,'reset',replace)

    def _transition(self, command, name, transition, persist=None, identity=None) -> dict:
        canonical = json.dumps({"command": name, "payload": identity if identity is not None else command.payload.model_dump(mode="json")}, sort_keys=True)
        if name=='reset':
            canonical=json.dumps({'command':name,'source_session':str(command.session_id),'payload':command.payload.model_dump(mode='json')},sort_keys=True)
        key = str(command.idempotency_key)
        with self.lock, self.store.transaction() as db:
            state = self.store.load(db)
            previous = db.execute("SELECT payload, result FROM commands WHERE key=?", (key,)).fetchone()
            if name=='reset' and previous and previous[0]==canonical:
                # Reset and restart atomically clear older receipts; canonical includes the source session.
                return json.loads(previous[1])
            if str(command.session_id) != state["session_id"]:
                raise ValueError("Stale session; refresh state before submitting")
            if previous:
                if previous[0] != canonical:
                    raise ValueError("Idempotency key already used with a different payload")
                return json.loads(previous[1])
            if command.expected_revision != state["revision"]:
                raise ValueError("Stale revision; refresh state before submitting")
            before=state
            state = transition(state)
            from .order_demo import refresh_order_demonstrations
            state = refresh_order_demonstrations(state)
            if persist:
                persist(db)
            if name=='reset':
                db.execute('DELETE FROM commands')
            elif state!=before:
                state["revision"] += 1
            self.store.save(db, state)
            db.execute("INSERT INTO commands VALUES (?, ?, ?)", (key, canonical, json.dumps(state)))
            return state

    def execute(self, command: dict | CommandEnvelope) -> dict:
        request = CommandEnvelope.model_validate(command)
        payload = request.payload.model_dump(mode="json")
        canonical = json.dumps(payload, sort_keys=True)
        key = str(request.idempotency_key)
        with self.lock, self.store.transaction() as db:
            state = self.store.load(db)
            if str(request.session_id) != state["session_id"]:
                raise ValueError("Stale session; refresh state before submitting")
            previous = db.execute("SELECT payload, result FROM commands WHERE key=?", (key,)).fetchone()
            if previous:
                if previous[0] != canonical:
                    raise ValueError("Idempotency key already used with a different payload")
                return json.loads(previous[1])
            if request.expected_revision != state["revision"]:
                raise ValueError("Stale revision; refresh state before submitting")
            if not any(item["id"] == payload["artifact_id"] for item in state["artifacts"]):
                raise ValueError("Unknown artifact")
            state["orders"].append({"id": str(uuid4()), **payload, "status": "queued", "successful_quantity": 0})
            state["revision"] += 1
            state["events"].append({"type": "order_created", "order_id": state["orders"][-1]["id"], "timestamp": state["simulation_time"]})
            self.store.save(db, state)
            db.execute("INSERT INTO commands VALUES (?, ?, ?)", (key, canonical, json.dumps(state)))
            return state
