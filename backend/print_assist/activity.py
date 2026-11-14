"""Entity-linked deterministic production activity."""
def record(state, event_type, message, *, source='user', status='accepted', order_id=None, printer_id=None, job_id=None):
    events=state.setdefault('events',[])
    if status=='blocked':
        previous=next((event for event in reversed(events) if event.get('order_id')==order_id),None)
        if previous and previous['type']==event_type and previous.get('message')==message:
            return
    events.append(dict(type=event_type,message=message,source=source,status=status,
                       order_id=order_id,printer_id=printer_id,job_id=job_id,timestamp=state['simulation_time']))
