/* BrandGauge Generative Engine — v3.4
 *
 * Correction in this version: the needle is no longer decomposed.
 *
 * Its two blocks share ONE drawn angle (37.25 deg) — they are parallel to each
 * other, unlike the ticks, which each rotate to face the pivot. The hub also
 * sits 12.3 units off the pointing axis, at 89.2 deg to it. Taking the parts
 * apart and re-rotating each by its own bearing (v3.3) threw them 89 deg out of
 * parallel and lost the hand-set offset.
 *
 * So the needle is kept exactly as drawn, as one rigid group with the pivot at
 * the origin, and rotated whole. Zero reconstruction error.
 *
 * Native bearing 65.85 deg, which on the mark's own sweep is a reading of 60.
 * Unit radius 115.5, so scale = R / 115.5.
 */
export const ATOM="M -0.37925813148186804,0.11087181827743126 L -0.3732378996616024,-0.10089333641866535 L -0.36474515623770165,-0.39028313660528385 C -0.3634169314343759,-0.43409418052697013 -0.32874087272576363,-0.46972467705652776 -0.2849014093989693,-0.47186524265526275 L 0.2544552334046356,-0.49989192533966925 C 0.3008469496391277,-0.5022156408112424 0.34055252499947075,-0.46679198477855116 0.34313004479156023,-0.4202451440112366 L 0.358270704775891,-0.13872209556530055 L 0.37222799543805873,0.12534411138007462 L 0.38753759559267437,0.4111538079347406 C 0.3900444609370822,0.46009777707693267 0.35078532069156554,0.5009452748470473 0.3018697709544824,0.4999833497893929 L -0.3050130308085534,0.4884813019448533 C -0.35194038102409253,0.4876887111225716 -0.38906528407163077,0.44861311481498317 -0.38760996007550114,0.40174220934456834 L -0.37915945169417,0.11128074713076666 L -0.37925813148186804,0.11087181827743126";
export const NEEDLE={paths:["M -22.370000000000005,-10.909999999999968 L -16.519999999999982,-16.25999999999999 L -10.009999999999991,-22.220000000000027 C -8.990000000000009,-23.149999999999977 -7.420000000000016,-23.220000000000027 -6.310000000000002,-22.379999999999995 L 5.079999999999984,-13.75 C 6.189999999999998,-12.909999999999968 6.490000000000009,-11.419999999999959 5.789999999999964,-10.240000000000009 L 1.3199999999999363,-2.730000000000018 L -2.6900000000000546,4.009999999999991 L -7.330000000000041,11.809999999999945 C -8.190000000000055,13.25 -10.180000000000064,13.61999999999989 -11.54000000000002,12.589999999999918 L -28.939999999999998,-0.5800000000000409 C -30.30000000000001,-1.6100000000000136 -30.399999999999977,-3.560000000000059 -29.149999999999977,-4.7000000000000455 L -22.389999999999986,-10.8900000000001 L -22.370000000000005,-10.909999999999968","M 12.700000000000045,-43.0 L 18.550000000000068,-48.35000000000002 L 19.950000000000045,-49.629999999999995 C 20.970000000000027,-50.559999999999945 22.54000000000002,-50.629999999999995 23.650000000000034,-49.789999999999964 L 25.630000000000052,-48.289999999999964 C 26.740000000000066,-47.44999999999993 27.040000000000077,-45.95999999999992 26.340000000000032,-44.77999999999997 L 25.380000000000052,-43.16999999999996 L 21.37000000000006,-36.42999999999995 L 20.240000000000066,-34.51999999999998 C 19.380000000000052,-33.07999999999993 17.390000000000043,-32.710000000000036 16.030000000000086,-33.74000000000001 L 11.260000000000105,-37.360000000000014 C 9.900000000000091,-38.389999999999986 9.800000000000125,-40.34000000000003 11.050000000000125,-41.48000000000002 L 12.700000000000102,-42.99000000000001 L 12.700000000000045,-43.0"],nativeBearing:65.85,unitRadius:115.5,
  note:"Two parallel blocks, drawn angle 37.25deg, hub offset 12.3 at 89.2deg from the pointing axis. Rotate as one unit; never re-rotate the parts separately."};
export const GEOM={pivot:[448.4,575.8],radius:115.5,sweep:[163.3,2.4],ticks:7,step:26.8,growth:[0.34,1.00],fill:0.80,markOwnReading:60};
const T={paper:'#FAF6EF',ink:'#16120E',char:'#5A1E0C',flare:'#FF3D14',ember:'#FF9E1B',danfo:'#FFC12E',ash:'#8C877E'};
export const RAMP=[T.danfo,T.ember,T.flare];
const D=Math.PI/180;
const hxc=c=>[1,3,5].map(i=>parseInt(c.substr(i,2),16));
const hsc=a=>'#'+a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
const mixc=(a,b,t)=>{const A=hxc(a),B=hxc(b);return hsc(A.map((v,i)=>v+(B[i]-v)*t));};
export function grade(t,st){st=st||RAMP;const n=st.length-1,p=Math.max(0,Math.min(1,t))*n,i=Math.min(Math.floor(p),n-1);return mixc(st[i],st[i+1],p-i);}
function rng(seed){let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619);}
return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const at=(x,y,deg,size,fill,op=1)=>`<g transform="translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${deg.toFixed(2)}) scale(${size.toFixed(3)})"><path d="${ATOM}" fill="${fill}" fill-opacity="${op}"/></g>`;

/* the needle, whole. angle is the bearing it should point at, in degrees, y-up. */
export function needle(cx,cy,R,angle,colour){
  const s=R/NEEDLE.unitRadius;
  return `<g transform="translate(${cx.toFixed(2)},${cy.toFixed(2)}) rotate(${(-(angle-NEEDLE.nativeBearing)).toFixed(2)}) scale(${s.toFixed(4)})">`
    + NEEDLE.paths.map(d=>`<path d="${d}" fill="${colour}"/>`).join('') + '</g>';
}
export function sweep(s,r,W,H,ink,n=7,needleColour){
  const val=s[0]/100,cx=W/2,cy=H*0.78,R=Math.min(W,H)*0.40;
  const A0=GEOM.sweep[0],A1=GEOM.sweep[1],step=Math.abs(A1-A0)/(n-1);
  const chord=2*R*Math.sin(step*D/2),out=[];
  for(let k=0;k<n;k++){const t=k/(n-1),a=A0+(A1-A0)*t,lit=t<=val;
    out.push(at(cx+Math.cos(a*D)*R,cy-Math.sin(a*D)*R,-a,
      chord*GEOM.fill*(GEOM.growth[0]+(GEOM.growth[1]-GEOM.growth[0])*t)*(lit?1:0.60),
      lit?grade(t/Math.max(val,.001)):ink,lit?1:0.16));}
  out.push(needle(cx,cy,R,A0+(A1-A0)*val,needleColour||T.char));
  return out.join('');
}
export function crescendo(val,W,H,ink,n=20){const gap=W/n,out=[];
  for(let k=0;k<n;k++){const t=k/(n-1),lit=t<=val;
    out.push(at(gap*(k+.5),H/2,0,gap*0.70*(0.42+0.58*t)*(lit?1:0.6),lit?grade(t/Math.max(val,.001)):ink,lit?1:0.16));}
  return out.join('');}
export function field(s,r,W,H,ink){
  const cols=Math.max(6,Math.round(W/34)),rows=Math.max(6,Math.round(H/34));
  const gx=W/cols,gy=H/rows,cell=Math.min(gx,gy),out=[];
  for(let c=0;c<cols;c++)for(let ro=0;ro<rows;ro++){
    const bias=s[Math.floor((c/cols)*s.length)%s.length]/100,on=r()<bias*0.82+0.05;
    const heat=Math.max(0,Math.min(1,bias*0.55+(1-ro/rows)*0.45));
    out.push(at(c*gx+gx/2,ro*gy+gy/2,0,cell*0.60*(on?(0.55+bias*0.45):0.34),on?grade(heat):ink,on?1:0.10));}
  return out.join('');}
export function ridge(s,r,W,H,ink){const lh=H/(s.length+0.6),n=Math.max(8,Math.round(W/28)),gap=W/n,out=[];
  s.forEach((v,i)=>{const y=lh*(i+0.8);
    for(let k=0;k<n;k++){const t=k/(n-1),lit=t<=v/100;
      out.push(at(gap*(k+.5),y,0,gap*0.72*(0.4+0.6*t)*(lit?1:0.58),lit?grade(t/Math.max(v/100,.001)):ink,lit?1:0.11));}});
  return out.join('');}
export function core(s,r,W,H,ink){const cx=W/2,cy=H/2,base=Math.min(W,H)*0.12,step=Math.min(W,H)*0.072,out=[];
  s.forEach((v,i)=>{const R=base+step*i,n=14+i*5,sa=360/n,chord=2*R*Math.sin(sa*D/2),col=grade(i/Math.max(s.length-1,1));
    for(let k=0;k<n;k++){const t=k/n,a=t*360-90,lit=t<=v/100;
      out.push(at(cx+Math.cos(a*D)*R,cy+Math.sin(a*D)*R,a,chord*0.70*(lit?1:0.58),lit?col:ink,lit?1:0.11));}});
  return out.join('');}
const MODES={field,ridge,core};
export function render(o){o=o||{};
  const mode=o.mode||'sweep',signals=o.signals||[72,78,64,71,55],seed=o.seed||'brandgauge';
  const w=o.w||1080,h=o.h||1080,ground=o.ground||T.paper,ink=o.ink||T.ink,n=o.n||7;
  const r=rng(seed),s=signals.map(v=>Math.max(0,Math.min(100,v)));
  const body=mode==='sweep'?sweep(s,r,w,h,ink,n,o.needleColour):MODES[mode](s,r,w,h,ink);
  const bg=ground==='transparent'?'':`<rect width="${w}" height="${h}" fill="${ground}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>BrandGauge reading, ${mode}</title>${bg}${body}</svg>`;}


/* ============================================================ CHARTS
 * Every chart form is built from the atom. No chart library, no rounded-rect
 * fills, no gradient bars. Value is carried by size and heat together, which
 * is the mark's own rule applied to data.
 *
 * All of these return a fragment; wrap with chart() for a full SVG.
 */

/* COLUMN — comparison across categories. Each column is a stack of atoms,
 * so the bar is quantised and you can count it. */
export function columns(series,W,H,ink,{max=null,pad=0.24}={}){
  const n=series.length,slot=W/n,top=Math.max(...series.map(d=>d.value)),lim=max||top;
  const cell=slot*(1-pad);
  const steps=Math.max(8,Math.min(22,Math.round(H/(cell*0.62))));
  const stepH=H/steps, unit=Math.min(cell,stepH)*0.82, out=[];
  series.forEach((d,i)=>{
    const x=slot*(i+0.5),lit=Math.round(steps*(d.value/lim));
    for(let k=0;k<steps;k++){
      const t=k/(steps-1),on=k<lit,y=H-(k+0.5)*stepH;
      out.push(at(x,y,0,unit*(0.62+0.38*t)*(on?1:0.62),on?grade(t):ink,on?1:0.09));
    }
  });
  return out.join('');
}

/* TREND — a line, rendered as atoms that grow toward the newest reading.
 * There is no stroke. The eye follows the size change, not a polyline. */
export function trend(values,W,H,ink,{min=null,max=null}={}){
  const lo=min??Math.min(...values),hi=max??Math.max(...values),span=(hi-lo)||1;
  const gap=W/values.length,out=[];
  values.forEach((v,i)=>{
    const t=i/(values.length-1||1);
    const y=H-((v-lo)/span)*(H*0.82)-H*0.09;
    out.push(at(gap*(i+0.5),y,0,gap*0.62*(0.5+0.5*t),grade(t),1));
  });
  return out.join('');
}

/* STACK — share of voice. One horizontal bar split by competitor.
 * Your share is graded; everyone else is ink at descending opacity. */
export function stack(parts,W,H,ink){
  const total=parts.reduce((a,p)=>a+p.value,0)||1;
  const n=Math.max(12,Math.round(W/26)),gap=W/n,out=[];
  let cursor=0,idx=0,acc=parts[0]?.value||0;
  for(let k=0;k<n;k++){
    const frac=(k+0.5)/n;
    while(frac>acc/total&&idx<parts.length-1){idx++;acc+=parts[idx].value;}
    const p=parts[idx],own=p.own===true;
    const local=frac;
    out.push(at(gap*(k+0.5),H/2,0,Math.min(gap,H)*0.72*(0.55+0.45*local),
      own?grade(local):ink, own?1:(0.34-idx*0.06)));
  }
  return out.join('');
}

/* FUNNEL — stages, each a row of atoms whose count is the volume.
 * Never a tapering gradient block. You can count the drop-off. */
export function funnelChart(stages,W,H,ink){
  const lh=H/stages.length,top=stages[0]?.value||1,out=[];
  const n=Math.max(8,Math.round(W/30)),gap=W/n;
  stages.forEach((s,i)=>{
    const y=lh*(i+0.5),lit=Math.round(n*(s.value/top));
    for(let k=0;k<n;k++){
      const t=k/(n-1),on=k<lit;
      out.push(at(gap*(k+0.5),y,0,gap*0.70*(0.45+0.55*t)*(on?1:0.55),
        on?grade(1-i/Math.max(stages.length-1,1)):ink,on?1:0.09));
    }
  });
  return out.join('');
}

/* DOTS — distribution. One atom per observation, jittered by seed, sized and
 * heated by value. For survey spreads and mention scatter. */
export function dots(points,r,W,H,ink,{min=0,max=100}={}){
  const span=(max-min)||1,out=[];
  points.forEach(p=>{
    const t=(p.value-min)/span;
    const x=(p.x??r())*W*0.9+W*0.05;
    const y=H-(t*H*0.82)-H*0.09+(r()-0.5)*H*0.04;
    out.push(at(x,y,0,Math.min(W,H)*0.038*(0.6+0.4*t),grade(t),0.86));
  });
  return out.join('');
}

/* chart() wraps any of the above with axis labels in Disket. */
export function chart(body,{W=600,H=320,ground='transparent',labels=[],
  labelColour='#8C877E',font="'Disket Mono',ui-monospace,monospace"}={}){
  const bg=ground==='transparent'?'':`<rect width="${W}" height="${H}" fill="${ground}"/>`;
  const gap=W/(labels.length||1);
  const ax=labels.map((l,i)=>`<text x="${(gap*(i+0.5)).toFixed(1)}" y="${H-4}" text-anchor="middle" `
    +`font-family="${font}" font-size="10" letter-spacing="1.6" fill="${labelColour}">${String(l).toUpperCase()}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img">${bg}${body}${ax}</svg>`;
}

/* ========================================================== GRADIENTS
 * BrandGauge gradients are atmospheric or quantised, never decorative fills.
 * bloom() is data-driven: the glow radius and opacity carry the reading, so
 * even the soft light on the screen is a measurement.
 */
export function bloom(value,W,H,{cx=0.5,cy=0.78,id='bg-bloom'}={}){
  const t=Math.max(0,Math.min(1,value/100));
  const r=(0.28+0.34*t)*100, op=(0.10+0.34*t).toFixed(3);
  return `<defs><radialGradient id="${id}" cx="${cx*100}%" cy="${cy*100}%" r="${r}%">`
    +`<stop offset="0%" stop-color="${grade(t)}" stop-opacity="${op}"/>`
    +`<stop offset="55%" stop-color="${grade(t*0.55)}" stop-opacity="${(op*0.35).toFixed(3)}"/>`
    +`<stop offset="100%" stop-color="#16120E" stop-opacity="0"/></radialGradient></defs>`
    +`<rect width="${W}" height="${H}" fill="url(#${id})"/>`;
}



/* ================================================== TIER 1 — INSTRUMENT
 * Conventional, immediately legible chart forms for everyday reading inside
 * the product. These use shapes people already know how to read: a line with
 * an area fill, axes, horizontal gridlines, a hover crosshair.
 *
 * The brand lives in the COLOUR ENCODING, not in a novel geometry:
 *   heat = value, vertically, exactly as it does on the gauge.
 * A line that climbs literally heats up, cool at the bottom of the domain and
 * Flare at the top. Heat means one thing everywhere in this system.
 *
 * The atom appears only as the data-point marker, which is where a fingerprint
 * costs the reader nothing.
 */

const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const MONO="'Disket Mono',ui-monospace,monospace";

/* HEATLINE — the signature product chart.
 * series: [{value, label}]  compare: [{value}] optional neutral second series
 */
export function heatLine(series,{W=720,H=340,min=null,max=null,compare=null,
  ground='transparent',ink='#16120E',label='',unit='',gridlines=4,
  markers=true,id='hl'}={}){
  const vals=series.map(d=>d.value);
  const lo=min??Math.max(0,Math.floor(Math.min(...vals)/10)*10-5);
  const hi=max??Math.ceil(Math.max(...vals)/10)*10+5;
  const span=(hi-lo)||1;
  const padL=46,padR=18,padT=18,padB=30;
  const iw=W-padL-padR, ih=H-padT-padB;
  const X=i=>padL+(i/(series.length-1||1))*iw;
  const Y=v=>padT+ih-((v-lo)/span)*ih;

  const out=[ground==='transparent'?'':`<rect width="${W}" height="${H}" fill="${ground}"/>`];

  /* vertical ramp across the value domain — this is the whole idea */
  out.push(`<defs>
    <linearGradient id="${id}-stroke" x1="0" y1="${(padT+ih).toFixed(1)}" x2="0" y2="${padT}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${grade(0)}"/><stop offset="48%" stop-color="${grade(.5)}"/><stop offset="100%" stop-color="${grade(1)}"/>
    </linearGradient>
    <linearGradient id="${id}-fill" x1="0" y1="${padT}" x2="0" y2="${(padT+ih).toFixed(1)}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${grade(1)}" stop-opacity=".26"/>
      <stop offset="55%" stop-color="${grade(.5)}" stop-opacity=".10"/>
      <stop offset="100%" stop-color="${grade(0)}" stop-opacity="0"/>
    </linearGradient>
  </defs>`);

  /* gridlines, horizontal only, and the y scale in Disket */
  for(let g=0;g<=gridlines;g++){
    const v=lo+(span*g/gridlines), y=Y(v);
    out.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="${ink}" stroke-opacity="${g===0?.22:.08}"/>`);
    out.push(`<text x="${padL-10}" y="${(y+3.5).toFixed(1)}" text-anchor="end" font-family="${MONO}" font-size="10" letter-spacing="1" fill="${ink}" fill-opacity=".45">${Math.round(v)}</text>`);
  }

  const pts=series.map((d,i)=>[X(i),Y(d.value)]);
  const path=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  /* neutral comparison series first, so it sits behind */
  if(compare&&compare.length){
    const cp=compare.map((d,i)=>[X(i),Y(d.value)]);
    out.push(`<path d="${cp.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="none" stroke="${ink}" stroke-opacity=".30" stroke-width="1.75" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  out.push(`<path d="${path} L${pts[pts.length-1][0].toFixed(1)},${(padT+ih).toFixed(1)} L${pts[0][0].toFixed(1)},${(padT+ih).toFixed(1)} Z" fill="url(#${id}-fill)"/>`);
  out.push(`<path d="${path}" fill="none" stroke="url(#${id}-stroke)" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/>`);

  if(markers) pts.forEach((p,i)=>{
    const t=(series[i].value-lo)/span, last=i===pts.length-1;
    out.push(at(p[0],p[1],0,last?13:7.5,grade(t),1));
  });

  /* the newest reading is called out, because that is what people look for */
  const lastPt=pts[pts.length-1], lastVal=series[series.length-1].value;
  out.push(`<text x="${Math.min(lastPt[0]+14,W-padR)}" y="${(lastPt[1]-14).toFixed(1)}" text-anchor="${lastPt[0]>W-90?'end':'start'}" font-family="${MONO}" font-size="17" fill="${grade((lastVal-lo)/span)}">${lastVal}${esc(unit)}</text>`);

  /* x labels, thinned so they never collide */
  const every=Math.ceil(series.length/6);
  series.forEach((d,i)=>{ if(d.label&&i%every===0)
    out.push(`<text x="${X(i).toFixed(1)}" y="${H-8}" text-anchor="middle" font-family="${MONO}" font-size="10" letter-spacing="1.4" fill="${ink}" fill-opacity=".45">${esc(String(d.label).toUpperCase())}</text>`);});

  if(label) out.push(`<text x="${padL}" y="12" font-family="${MONO}" font-size="10" letter-spacing="1.8" fill="${ink}" fill-opacity=".45">${esc(label.toUpperCase())}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img"><title>${esc(label||'Trend')}</title>${out.join('')}</svg>`;
}

/* HEATBARS — the legible bar. Same encoding: fill heats with height.
 * Use when categories are named and comparison is the job. */
export function heatBars(series,{W=720,H=320,max=null,ground='transparent',
  ink='#16120E',unit='',gridlines=3,id='hb'}={}){
  const hi=max??Math.ceil(Math.max(...series.map(d=>d.value))/10)*10;
  const padL=46,padR=18,padT=18,padB=32,iw=W-padL-padR,ih=H-padT-padB;
  const slot=iw/series.length,bw=Math.min(slot*0.56,64);
  const out=[ground==='transparent'?'':`<rect width="${W}" height="${H}" fill="${ground}"/>`];
  out.push(`<defs><linearGradient id="${id}-f" x1="0" y1="${padT+ih}" x2="0" y2="${padT}" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="${grade(0)}"/><stop offset="55%" stop-color="${grade(.55)}"/><stop offset="100%" stop-color="${grade(1)}"/></linearGradient></defs>`);
  for(let g=0;g<=gridlines;g++){
    const v=hi*g/gridlines,y=padT+ih-(v/hi)*ih;
    out.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="${ink}" stroke-opacity="${g===0?.22:.08}"/>`);
    out.push(`<text x="${padL-10}" y="${(y+3.5).toFixed(1)}" text-anchor="end" font-family="${MONO}" font-size="10" fill="${ink}" fill-opacity=".45">${Math.round(v)}</text>`);
  }
  series.forEach((d,i)=>{
    const h=(d.value/hi)*ih,x=padL+slot*i+(slot-bw)/2,y=padT+ih-h;
    out.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${d.muted?ink:`url(#${id}-f)`}" fill-opacity="${d.muted?.16:1}"/>`);
    out.push(`<text x="${(x+bw/2).toFixed(1)}" y="${(y-8).toFixed(1)}" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${d.muted?ink:grade(d.value/hi)}" fill-opacity="${d.muted?.5:1}">${d.value}${esc(unit)}</text>`);
    out.push(`<text x="${(x+bw/2).toFixed(1)}" y="${H-10}" text-anchor="middle" font-family="${MONO}" font-size="10" letter-spacing="1.2" fill="${ink}" fill-opacity=".45">${esc(String(d.label).toUpperCase())}</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img">${out.join('')}</svg>`;
}

export const PRESETS={ogImage:{mode:'core',w:1200,h:630,ground:T.ink},socialSquare:{mode:'sweep',w:1080,h:1080,ground:T.paper,n:12},socialStory:{mode:'field',w:1080,h:1920,ground:T.ink},reportCover:{mode:'ridge',w:1240,h:1754,ground:T.paper},avatar:{mode:'core',w:512,h:512,ground:T.ink},billboard48:{mode:'sweep',w:3000,h:1000,ground:T.ink,n:9,needleColour:'#FAF6EF'}};
export const asset=(p,o)=>render(Object.assign({},PRESETS[p],o||{}));
