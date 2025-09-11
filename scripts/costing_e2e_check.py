#!/usr/bin/env python3
import json, sys, math

with open('examples/costing/data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

planned_cost = d['project']['planned_cost'] or 0
planned_effort = d['project']['planned_effort'] or 0
contract_amount = d['project']['contract_amount'] or 0

rate_map = {m['user_id']: m['rate'] for m in d['members']}
labor_cost = 0.0
effort = 0.0
for ts in d['timesheets']:
    h = float(ts['hours'])
    effort += h
    rate = float(rate_map.get(ts['user_id'], 0))
    labor_cost += h * rate

external_cost = float(d.get('external_cost', 0))
overhead = float(d.get('overhead', 0))

progress_method = d.get('progress_method', 'cost')
def clamp01(x):
    return max(0.0, min(1.0, x))

if progress_method == 'cost':
    denom = planned_cost if planned_cost else 0
    progress = clamp01((labor_cost + external_cost + overhead) / denom) if denom else 0.0
elif progress_method == 'effort':
    denom = planned_effort if planned_effort else 0
    progress = clamp01(effort / denom) if denom else 0.0
else:
    progress = 0.0

revenue_progress = contract_amount * progress
gross_profit = revenue_progress - (labor_cost + external_cost + overhead)

print(json.dumps({
    'labor_cost': round(labor_cost, 2),
    'external_cost': round(external_cost, 2),
    'overhead': round(overhead, 2),
    'progress': round(progress, 4),
    'revenue_progress': round(revenue_progress, 2),
    'gross_profit': round(gross_profit, 2)
}, ensure_ascii=False))

# simple expectation
expected_labor = 80 * 5000
assert abs(labor_cost - expected_labor) < 1e-6, 'labor_cost mismatch'
ratio = (expected_labor + external_cost) / planned_cost if planned_cost else 0.0
expected_progress = min(1.0, ratio)
assert round(progress, 4) == round(expected_progress, 4), 'progress mismatch'
print('OK: costing e2e sample passed')
