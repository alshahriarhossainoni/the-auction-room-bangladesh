import json,sys,pathlib,datetime
src=pathlib.Path(sys.argv[1]); dst=pathlib.Path(sys.argv[2]); d=json.loads(src.read_text())
assert d['status']=='calculated_model_estimate' and d['as_of'] and d['gex_by_strike']
# Preserve clearly disclosed estimates, never label as live CME feed.
call=d.get('call_walls',[]); put=d.get('put_walls',[])
def at(a,i):return a[i] if len(a)>i else None
monthly={'net_gex':d['net_gex'],'net_dex':d['net_dex'],'zero_gamma':None,'call_resistance':at(call,0),'put_support':at(put,0),'call_wall_3':at(call,0),'call_wall_2':at(call,1),'call_wall_1':at(call,2),'put_wall_3':at(put,0),'put_wall_2':at(put,1),'put_wall_1':at(put,2),'iv':{}}
# Monthly here means all supplied expiries, not a single monthly contract.
out={'status':'model_estimate','as_of':d['as_of'],'source':'Authorized normalized EOD chain; model-derived estimates','reference_price':d['underlying_price'],'monthly':monthly,'odte':{},'surface':None,'gamma_by_strike':[{'strike':v['strike'],'net_gex':v['gex']} for v in d['gex_by_strike']],'notes':{'scope':'all supplied expiries; not monthly-only','gex_sign':d['sign_assumption'],'dealer_positioning':d['dealer_positioning_note'],'gamma_flip':d['gamma_flip_note'],'license':'Publish only when source authorization permits public derived-data display'}}
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(json.dumps(out,indent=2)+'\n');print('Wrote',dst)
