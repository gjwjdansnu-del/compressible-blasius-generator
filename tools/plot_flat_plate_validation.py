from pathlib import Path
import json
import numpy as np
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parents[1]
REF=ROOT.parent/'02_flat_plate_compressible_blasius_validation'/'reference'
results=json.loads((ROOT/'validation'/'flat_plate_web_results.json').read_text())
colors={'M2p8':'#1774b6','M4p5':'#1a9c3c'}
fig,axes=plt.subplots(1,2,figsize=(11.5,5.2),sharey=True)
metrics={}
for name in ('M2p8','M4p5'):
    data=results[name]['data']; eta=np.array([r['eta'] for r in data])
    metrics[name]={}
    for ax,var,key in ((axes[0],'u','u_over_ue'),(axes[1],'T','T_over_Te')):
        ref=np.loadtxt(REF/f'bl2d_fig3_{name}_{var}.csv',delimiter=',',skiprows=1)
        value=np.array([r[key] for r in data]); predicted=np.interp(ref[:,0],eta,value)
        error=predicted-ref[:,1]
        metrics[name][var]={'rmse':float(np.sqrt(np.mean(error**2))),'max_abs':float(np.max(np.abs(error)))}
        color=colors[name]; label=f'$M_e={2.8 if name=="M2p8" else 4.5}$'
        order=np.argsort(ref[:,0]); ax.plot(ref[order,1],ref[order,0],'-',color=color,lw=2.1,label=f'{label} BL2D reference')
        ax.scatter(ref[:,1],ref[:,0],color=color,s=18,alpha=.55,zorder=3)
        visible=eta<=10; ax.plot(value[visible],eta[visible],'--',color=color,lw=2.1,label=f'{label} website solver')
axes[0].set(xlabel='$u/U_e$',ylabel='$\\eta$',xlim=(0,1.2),ylim=(0,10)); axes[1].set(xlabel='$T/T_e$',xlim=(.5,5))
for ax in axes: ax.grid(alpha=.22); ax.legend(fontsize=8,frameon=False)
fig.suptitle('Adiabatic compressible Blasius: BL2D reference vs website solver'); fig.tight_layout()
fig.savefig(ROOT/'validation'/'flat_plate_web_vs_bl2d.png',dpi=220); plt.close(fig)
(ROOT/'validation'/'flat_plate_web_metrics.json').write_text(json.dumps(metrics,indent=2))
print(json.dumps(metrics,indent=2))
if any(metrics[c][v]['rmse'] >= (.008 if v=='u' else .03) for c in metrics for v in metrics[c]): raise SystemExit(1)
