import csv,json,math,sys,datetime,pathlib
from collections import defaultdict

def load(path):
    with open(path,newline='',encoding='utf-8-sig') as f:
        rows=list(csv.DictReader(f))
    if not rows: raise ValueError('Empty option chain')
    required={'trade_date','expiry','option_type','strike','open_interest','underlying_price','implied_volatility','delta'}
    missing=required-set(rows[0]);
    if missing: raise ValueError('Missing columns: '+','.join(sorted(missing)))
    return rows

def norm(r):
    t=r['option_type'].strip().upper()
    if t not in ('C','P'): raise ValueError('option_type must be C or P')
    strike=float(r['strike']);oi=int(float(r['open_interest']));s=float(r['underlying_price']);iv=float(r['implied_volatility']);delta=float(r['delta'])
    if strike<=0 or oi<0 or s<=0 or iv<=0 or not -1<=delta<=1: raise ValueError('Invalid market values')
    date=datetime.date.fromisoformat(r['trade_date']);expiry=datetime.date.fromisoformat(r['expiry']);
    if expiry<date: raise ValueError('Expired option')
    gamma=float(r['gamma']) if r.get('gamma','').strip() else None
    if gamma is not None and gamma<0: raise ValueError('Negative gamma')
    return dict(date=date,expiry=expiry,t=t,k=strike,oi=oi,s=s,iv=iv,delta=delta,gamma=gamma)

def calc(rows, multiplier=100, rate=0.04, sign='call-positive-put-negative'):
    x=[norm(r) for r in rows]; dates={r['date'] for r in x};
    if len(dates)!=1: raise ValueError('Mixed trade dates')
    spots={r['s'] for r in x};
    if len(spots)!=1: raise ValueError('Mixed underlying prices')
    s=x[0]['s'];dt=x[0]['date'];groups=defaultdict(lambda:defaultdict(float));records=[]
    for r in x:
        tau=max((r['expiry']-dt).days/365.0,1/365.0)
        # Black-76 forward option gamma, under an explicitly assumed flat risk-free rate.
        gamma=r['gamma']
        if gamma is None:
            d1=(math.log(s/r['k'])+0.5*r['iv']**2*tau)/(r['iv']*math.sqrt(tau))
            gamma=math.exp(-rate*tau)*math.exp(-d1*d1/2)/math.sqrt(2*math.pi)/(s*r['iv']*math.sqrt(tau))
        raw_gex=gamma*r['oi']*multiplier*s*s*0.01
        gex=raw_gex*(1 if r['t']=='C' else -1) if sign=='call-positive-put-negative' else raw_gex
        dex=r['delta']*r['oi']*multiplier*s
        groups[r['expiry'].isoformat()][r['k']]+=gex
        records.append(dict(expiry=r['expiry'].isoformat(),strike=r['k'],type=r['t'],oi=r['oi'],iv=r['iv'],delta=r['delta'],gamma=gamma,gex=gex,dex=dex))
    bystrike=defaultdict(float)
    for r in records: bystrike[r['strike']]+=r['gex']
    calls=sorted((r for r in records if r['type']=='C'),key=lambda r:r['gex'],reverse=True)
    puts=sorted((r for r in records if r['type']=='P'),key=lambda r:r['gex'])
    def unique_levels(a):
        out=[]
        for r in a:
            if r['strike'] not in out:out.append(r['strike'])
            if len(out)==3:break
        return out
    return dict(status='calculated_model_estimate',as_of=dt.isoformat(),underlying_price=s,unit='USD per 1% underlying move',multiplier=multiplier,sign_assumption=sign,model='Black-76 (flat risk-free rate, input IV, supplied gamma preferred)',risk_free_rate=rate,net_gex=sum(r['gex'] for r in records),net_dex=sum(r['dex'] for r in records),call_walls=unique_levels(calls),put_walls=unique_levels(puts),gex_by_strike=[{'strike':k,'gex':v} for k,v in sorted(bystrike.items())],by_expiry=[{'expiry':k,'net_gex':sum(v.values())} for k,v in sorted(groups.items())],gamma_flip=None,gamma_flip_note='Requires recomputing gamma across hypothetical underlying prices; not inferred from current net GEX.',dealer_positioning_note='OI-based GEX sign is a convention, not observed dealer positioning.',data_source='user-provided authorized CME-derived normalized chain; no CME ingestion included')

if __name__=='__main__':
    if len(sys.argv)!=3:sys.exit('Usage: python backend/calculate.py input/chain.csv output/eod.json')
    p=pathlib.Path(sys.argv[2]);p.parent.mkdir(parents=True,exist_ok=True)
    result=calc(load(sys.argv[1]));p.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n');print('Wrote',p)
