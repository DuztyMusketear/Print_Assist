"""Derived commitments: physical stock is never deducted at reservation time."""
ACTIVE={'planned','pending','running','paused'}

def remaining_grams(state,job):
 order=next(o for o in state['orders'] if o['id']==job['order_id'])
 artifact=next(a for a in state['artifacts'] if a['id']==order['artifact_id'])
 return max(0,artifact['filament_grams']*(1-job.get('elapsed_seconds',0)/artifact['duration_seconds']))

def reserved(state,printer_id):
 return sum(remaining_grams(state,j) for j in state['jobs'] if j['printer_id']==printer_id and j['status'] in ACTIVE)

def free_grams(state,printer):
 return printer['material']['grams']-reserved(state,printer['id'])

def ledger(state):
 return [dict(printer_id=p['id'],stock_grams=p['material']['grams'],reserved_grams=reserved(state,p['id']),available_grams=free_grams(state,p)) for p in state['printers']]
