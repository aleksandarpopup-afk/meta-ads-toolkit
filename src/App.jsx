import { useState, useEffect, useRef, Fragment } from "react";
import { createClient } from "@supabase/supabase-js";

// ── IMAGE TYPE DETECTOR ───────────────────────────────────────────────────────
function getImageMediaType(base64){
  if(!base64) return "image/jpeg";
  if(base64.startsWith("/9j/")) return "image/jpeg";
  if(base64.startsWith("iVBORw")) return "image/png";
  if(base64.startsWith("R0lGOD")) return "image/gif";
  if(base64.startsWith("UklGR")) return "image/webp";
  return "image/png"; // default to png for screenshots
}


// ── COLORS ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#08080f", sur:"rgba(255,255,255,0.04)", brd:"rgba(255,255,255,0.08)",
  txt:"#fff", mut:"rgba(255,255,255,0.4)", dim:"rgba(255,255,255,0.2)",
  acc:"#6366F1", acl:"#A5B4FC",
  grn:"#34D399", yel:"#FBBF24", red:"#F87171",
  gBg:"#022c22", yBg:"#451a03", rBg:"#450a0a",
  gBr:"#065f46", yBr:"#78350f", rBr:"#7f1d1d",
};
const SC = { poor:{c:"#F87171",b:"#450a0a",r:"#7f1d1d"}, ok:{c:"#FBBF24",b:"#451a03",r:"#78350f"}, good:{c:"#34D399",b:"#022c22",r:"#065f46"} };
const BM = {
  ROAS:{p:1.5,o:2.5,g:4,rev:false}, CTR:{p:0.5,o:1.5,g:3,rev:false},
  CPC:{p:3,o:1.5,g:0.5,rev:true}, CPA:{p:80,o:40,g:15,rev:true},
  ConversionRate:{p:1,o:3,g:6,rev:false}, Revenue:{p:500,o:2000,g:5000,rev:false},
};

function gStatus(k,v){ const b=BM[k]; if(!b||v===""||isNaN(v)) return null; const n=parseFloat(v); if(b.rev) return n>=b.p?"poor":n>=b.o?"ok":"good"; return n<=b.p?"poor":n<=b.o?"ok":"good"; }
function gOverall(ss){ const vs=Object.values(ss).filter(Boolean); if(!vs.length) return null; const sc={poor:0,ok:1,good:2}; const avg=vs.reduce((a,s)=>a+sc[s],0)/vs.length; return avg<0.6?"poor":avg<1.4?"ok":"good"; }

// ── RESPONSIVE HOOK ──────────────────────────────────────────────────────────
function useIsMobile(){ const [m,setM]=useState(window.innerWidth<520); useEffect(()=>{ const h=()=>setM(window.innerWidth<520); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[]); return m; }

// ── UI ATOMS ────────────────────────────────────────────────────────────────
const BrandName=()=><span>Perf<span style={{background:"linear-gradient(90deg,#00E5FF,#A855F7)",WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent",color:"#00E5FF"}}>Mind</span></span>;

// ── UI ANIMACIJE (samo izgled; ne utiču na podatke) ─────────────────────────
// Stilovi se ubacuju jednom. Ako korisnik u sistemu ima "smanji animacije", sve se prikazuje odmah.
if(typeof document!=="undefined"&&!document.getElementById("pm-ui-css")){
  const st=document.createElement("style"); st.id="pm-ui-css";
  st.textContent=`@keyframes pmShimmer{0%{background-position:-480px 0}100%{background-position:480px 0}}
.pm-sk{background:linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.04) 100%);background-size:960px 100%;animation:pmShimmer 1.4s linear infinite;border-radius:8px}
@keyframes pmIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.pm-in{animation:pmIn .45s cubic-bezier(.2,.7,.2,1) backwards}
@keyframes pmCardIn{from{opacity:0;transform:translateY(10px);box-shadow:0 0 0 rgba(0,0,0,0)}}
.pm-card-in{animation:pmCardIn .55s cubic-bezier(.2,.7,.2,1) backwards}
select{color-scheme:dark}
select option{background:#13131f;color:#e5e7eb}
.pm-lift{transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
.pm-lift:hover{transform:translateY(-2px);border-color:rgba(165,180,252,0.35)!important;box-shadow:0 6px 18px rgba(0,0,0,0.25)}
@keyframes pmDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.pm-dots{display:inline-flex;gap:4px;vertical-align:middle}.pm-dots i{width:6px;height:6px;border-radius:50%;background:#A5B4FC;display:block;animation:pmDot 1.1s ease-in-out infinite}.pm-dots i:nth-child(2){animation-delay:.15s}.pm-dots i:nth-child(3){animation-delay:.3s}
@media (prefers-reduced-motion: reduce){.pm-dots i{animation:none;opacity:.7}}
@media (prefers-reduced-motion: reduce){.pm-sk,.pm-in,.pm-card-in{animation:none}.pm-lift,.pm-lift:hover{transition:none;transform:none}}`;
  document.head.appendChild(st);
}
const PM_REDUCED=typeof window!=="undefined"&&!!window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Poslednja prikazana vrednost svakog animiranog broja – da bi se pri promeni perioda brojalo od stare do nove vrednosti
const PM_LAST=new Map();
const PM_HOME={on:false,t0:0};
function pmAnimReset(prefix){ for(const k of [...PM_LAST.keys()]) if(k.startsWith(prefix)) PM_LAST.delete(k); }
// Broj koji se "odbrojava" do tačne vrednosti (~0,7 s). Krajnji prikaz je uvek tačna vrednost.
function AnimNum({value,format,k,dur=700}){
  const target=Number(value);
  const ok=isFinite(target);
  const [v,setV]=useState(()=>!ok||PM_REDUCED?target:(PM_LAST.has(k)?PM_LAST.get(k):0));
  useEffect(()=>{
    if(!ok||PM_REDUCED){ setV(target); PM_LAST.set(k,target); return; }
    const from=PM_LAST.has(k)?PM_LAST.get(k):0;
    if(from===target){ setV(target); return; }
    let raf; const t0=performance.now(); let cur=from;
    const step=now=>{ const p=Math.min(1,(now-t0)/dur); const e=1-Math.pow(1-p,3); cur=from+(target-from)*e; setV(p<1?cur:target); if(p<1) raf=requestAnimationFrame(step); else PM_LAST.set(k,target); };
    raf=requestAnimationFrame(step);
    return()=>{ cancelAnimationFrame(raf); PM_LAST.set(k,target); };
  },[target,k]);
  return <>{format?format(v):v}</>;
}
// Vrati prikaz na vrh (prozor + glavna kolona sa sadržajem) – posle promene modula, izbora klijenta i sl.
function pmScrollTop(){
  try{ window.scrollTo(0,0); document.querySelectorAll("[data-pm-scroll]").forEach(el=>{ el.scrollTop=0; }); }catch(e){}
}
// Tri tačkice dok AI piše
const PmDots=()=><span className="pm-dots" aria-hidden="true"><i/><i/><i/></span>;
// Skeleton (siv obris koji svetluca dok se podaci učitavaju)
const Sk=({w="100%",h=14,r=8,style})=><div className="pm-sk" style={{width:w,height:h,borderRadius:r,...style}}/>;
function SkCards({n=3,min=140}){ return <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fit,minmax(${min}px,1fr))`,gap:10,marginBottom:20}}>
  {Array.from({length:n},(_,i)=><div key={i} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px"}}><Sk w="55%" h={10} style={{marginBottom:10}}/><Sk w="75%" h={20}/></div>)}
</div>; }
function SkTable({rows=8,cols=6}){ return <div style={{marginBottom:16}}>
  <Sk h={36} r={10} style={{marginBottom:14}}/>
  {Array.from({length:rows},(_,i)=><div key={i} style={{display:"grid",gridTemplateColumns:`2.4fr repeat(${cols-1},1fr)`,gap:12,padding:"10px 4px",borderTop:`1px solid ${C.brd}`}}>
    {Array.from({length:cols},(_,j)=><Sk key={j} h={12} w={j===0?`${60+((i*17)%30)}%`:"70%"} style={j===0?null:{marginLeft:"auto"}}/>)}
  </div>)}
</div>; }

const Lbl=({c})=><div style={{color:C.mut,fontSize:11,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:8}}>{c}</div>;
const TIn=({v,ch,ph})=><input value={v} onChange={e=>ch(e.target.value)} placeholder={ph} style={{width:"100%",padding:"13px 14px",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:10,color:C.txt,fontSize:16,outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.5)"} onBlur={e=>e.target.style.borderColor=C.brd}/>;

function fmtMoney(amount,currency){
  try{
    return new Intl.NumberFormat("sr-RS",{style:"currency",currency:currency||"EUR",maximumFractionDigits:0}).format(amount||0);
  }catch(e){
    return `${(amount||0).toFixed(0)} ${currency||"EUR"}`;
  }
}
const NIn=({v,ch,ph,sx})=><div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" inputMode="decimal" value={v} onChange={e=>ch(e.target.value)} placeholder={ph} style={{flex:1,padding:"13px 14px",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:10,color:C.txt,fontSize:16,outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.5)"} onBlur={e=>e.target.style.borderColor=C.brd}/>{sx&&<span style={{color:C.mut,fontSize:13,fontWeight:600,minWidth:20}}>{sx}</span>}</div>;
const DIn=({v,ch})=><input type="date" value={v} onChange={e=>ch(e.target.value)} style={{width:"100%",padding:"13px 12px",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:10,color:C.txt,fontSize:14,outline:"none",boxSizing:"border-box"}}/>;
const Div=({l})=><div style={{display:"flex",alignItems:"center",gap:10,margin:"22px 0 12px"}}><div style={{height:1,flex:1,background:C.brd}}/>{l&&<span style={{color:C.dim,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",whiteSpace:"nowrap"}}>{l}</span>}<div style={{height:1,flex:1,background:C.brd}}/></div>;
const ST=({c})=><div style={{color:C.dim,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",margin:"20px 0 10px"}}>{c}</div>;
const Btn=({onClick,disabled,children,sec})=><button onClick={onClick} disabled={disabled} style={{padding:"15px 20px",borderRadius:11,fontSize:15,fontWeight:700,cursor:disabled?"not-allowed":"pointer",border:sec?`1px solid ${C.brd}`:"none",background:disabled?"rgba(255,255,255,0.06)":sec?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366F1,#8B5CF6)",color:disabled?"rgba(255,255,255,0.3)":C.txt,width:"100%"}}>{children}</button>;

function Pills({opts,val,ch,multi=false}){
  const arr=multi?(Array.isArray(val)?val:[]):null;
  return <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{opts.map(o=>{ const sel=multi?arr.includes(o):val===o; return <button key={o} onClick={()=>{ if(multi){ch(sel?arr.filter(x=>x!==o):[...arr,o]);}else ch(o); }} style={{padding:"7px 13px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:sel?`1px solid ${C.acc}`:`1px solid ${C.brd}`,background:sel?"rgba(99,102,241,0.2)":C.sur,color:sel?C.acl:C.mut}}>{o}</button>; })}</div>;
}

// ── TRANSLATIONS ────────────────────────────────────────────────────────────
const T={
  sr:{
    appTitle:"PerfMind", appSub:"Performance Intelligence Platform",
    back:"← Nazad",
    m1t:"Health Check", m1s:"Brza dijagnoza kampanje iz screenshota ili CSV-a",
    m2t:"Budget Pacing", m2s:"Tempo potrošnje po klijentu, underspend i overspend na prvi pogled",
    m10t:"Clients", m10s:"Svi klijenti i povezani GA4 i Google Ads nalozi",
    m12t:"Product Intelligence", m12s:"Svaki proizvod, od pregleda do prodaje",
    m13t:"Ask Your Data", m13s:"Pitaj bilo šta o podacima klijenta, odgovor za par sekundi",
    m16t:"Investigate", m16s:"Nešto se promenilo? Saznaj šta i zašto.",
    m14t:"Campaign Intelligence", m14s:"Šta svaka kampanja stvarno donosi",
    grpAn:"Analitika", grpDw:"Svakodnevni rad", open:"Otvori",
    m15t:"Report Studio", m15s:"Izveštaj za klijenta u par klikova, sa PDF-om",
    analyze:"Analiziraj →", 
    newA:"← Nova analiza", poor:"Kritično", ok:"Prosečno", good:"Odlično",
    nxt:"Dalje →", prv:"←", res:"Rezultati", s1:"Osnove", s2:"Metrike", s3:"Targeting & Kreativa",
    hTitle:"Dijagnoza Meta kampanje", hSub:"Unesi podatke i dobij profesionalnu analizu sa konkretnim preporukama.",
    hName:"Naziv kampanje", hNamePh:"npr. Retargeting – Jun 2025",
    hGoal:"Cilj kampanje", hGoals:["Konverzije / Prodaja","Lead Generation","Traffic","Brand Awareness","Katalog / DPA"],
    hPer:"Period", hPers:["Poslednja 7 dana","Poslednja 14 dana","Poslednji mesec","Custom"],
    hBud:"Ukupan budžet (€)", hBudPh:"npr. 1500", hSp:"Potrošeno (€)", hSpPh:"npr. 1280",
    hBudUse:"Iskorišćenost budžeta", hBudH:"Efikasnost budžeta",
    hMet:"Metrike performansi",
    hROAS:"ROAS", hROASh:"Povrat na uloženi budžet",
    hCTR:"CTR (%)", hCTRh:"Click-through rate",
    hCPC:"CPC (€)", hCPCh:"Cena po kliku",
    hCPA:"CPA (€)", hCPAh:"Cena po akviziciji",
    hCR:"Conversion Rate (%)", hCRh:"% posetilaca koji konvertuju",
    hRev:"Revenue (€)", hRevh:"Ukupan prihod",
    hTarg:"Targetiranje", hAudT:"Tip publike",
    hAudTs:["Cold – Interests","Lookalike audience","Retargeting – Custom audience","Broad (bez restrikcija)","Kombinovano"],
    hAudS:"Veličina publike",
    hAudSs:["Mikro < 100K","Mala 100K–500K","Srednja 500K–2M","Velika 2M–10M","Broad 10M+"],
    hFreq:"Prosečna frekvencija", hFreqPh:"npr. 2.4",
    hCr:"Kreativa", hCrF:"Format kreative (može više)",
    hCrFs:["Statična slika","Video (Reels/Story)","Carousel","Collection","Dynamic / DPA","Instant Experience"],
    hCrA:"Starost kreative", hCrAs:["Sveža < 2 nedelje","2–4 nedelje","1–2 meseca","Stara > 2 meseca"],
    hCopy:"Fokus ad copy-ja",
    hCopys:["Problem/rešenje","Benefit-driven","Social proof","Urgency/scarcity","Storytelling","Direktna ponuda"],
    hFill:"Unesi bar 3 metrike", hOvr:"Ukupna ocena",
    hMAN:"Analiza metrika", hTAN:"Analiza targetiranja", hCAN:"Analiza kreative",
    hPRI:"Prioritetne akcije – uradi odmah", hSTR:"Strateške preporuke",
    hGl:"Cilj", hMsub:"analiziranih metrika",
  },
  en:{
    appTitle:"PerfMind", appSub:"Performance Intelligence Platform",
    back:"← Back",
    m1t:"Health Check", m1s:"Quick campaign diagnosis from a screenshot or CSV",
    m2t:"Budget Pacing", m2s:"Spend pace per client, underspend and overspend at a glance",
    m10t:"Clients", m10s:"All clients and connected GA4 and Google Ads accounts",
    m12t:"Product Intelligence", m12s:"Every product, from view to sale",
    m13t:"Ask Your Data", m13s:"Ask anything about your client's data, answers in seconds",
    m16t:"Investigate", m16s:"Something changed? Find out what and why.",
    m14t:"Campaign Intelligence", m14s:"What every campaign really delivers",
    grpAn:"Analytics", grpDw:"Daily work", open:"Open",
    m15t:"Report Studio", m15s:"Client reports in a few clicks, with PDF",
    analyze:"Analyze →", 
    newA:"← New Analysis", poor:"Critical", ok:"Average", good:"Excellent",
    nxt:"Next →", prv:"←", res:"Results", s1:"Basics", s2:"Metrics", s3:"Targeting & Creative",
    hTitle:"Diagnose your Meta campaign", hSub:"Enter your data and get a professional analysis with concrete recommendations.",
    hName:"Campaign Name", hNamePh:"e.g. Retargeting – June 2025",
    hGoal:"Campaign Objective", hGoals:["Conversions / Sales","Lead Generation","Traffic","Brand Awareness","Catalog / DPA"],
    hPer:"Period", hPers:["Last 7 days","Last 14 days","Last month","Custom"],
    hBud:"Total Budget (€)", hBudPh:"e.g. 1500", hSp:"Amount Spent (€)", hSpPh:"e.g. 1280",
    hBudUse:"Budget Usage", hBudH:"Budget Efficiency",
    hMet:"Performance Metrics",
    hROAS:"ROAS", hROASh:"Return on ad spend",
    hCTR:"CTR (%)", hCTRh:"Click-through rate",
    hCPC:"CPC (€)", hCPCh:"Cost per click",
    hCPA:"CPA (€)", hCPAh:"Cost per acquisition",
    hCR:"Conversion Rate (%)", hCRh:"% of visitors who convert",
    hRev:"Revenue (€)", hRevh:"Total campaign revenue",
    hTarg:"Targeting", hAudT:"Audience Type",
    hAudTs:["Cold – Interests","Lookalike audience","Retargeting – Custom audience","Broad (no restrictions)","Combined"],
    hAudS:"Audience Size",
    hAudSs:["Micro < 100K","Small 100K–500K","Medium 500K–2M","Large 2M–10M","Broad 10M+"],
    hFreq:"Average Frequency", hFreqPh:"e.g. 2.4",
    hCr:"Creative", hCrF:"Creative Format (multi-select)",
    hCrFs:["Static image","Video (Reels/Story)","Carousel","Collection","Dynamic / DPA","Instant Experience"],
    hCrA:"Creative Age", hCrAs:["Fresh < 2 weeks","2–4 weeks","1–2 months","Old > 2 months"],
    hCopy:"Ad Copy Focus",
    hCopys:["Problem/solution","Benefit-driven","Social proof","Urgency/scarcity","Storytelling","Direct offer"],
    hFill:"Enter at least 3 metrics", hOvr:"Overall Score",
    hMAN:"Metrics Analysis", hTAN:"Targeting Analysis", hCAN:"Creative Analysis",
    hPRI:"Priority Actions – Do Now", hSTR:"Strategic Recommendations",
    hGl:"Goal", hMsub:"metrics analyzed",
  }
};

// ── MARKDOWN RENDERER ────────────────────────────────────────────────────────
function MD2({text}){
  if(!text) return null;
  const lines=text.split("\n");
  const els=[];
  let i=0;
  while(i<lines.length){
    const l=lines[i];
    // Skip separators
    if(/^---+$/.test(l.trim())){i++;continue;}
    // H2
    if(l.startsWith("## ")){
      const txt=l.replace(/^## /,"").replace(/[#]/g,"").replace(/\*\*/g,"").trim();
      els.push(<div key={i} style={{color:C.acl,fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",margin:"18px 0 8px",paddingTop:i>0?12:0,borderTop:i>0?`1px solid ${C.brd}`:"none"}}>{txt}</div>);
      i++;continue;
    }
    // H3
    if(l.startsWith("### ")){
      const txt=l.replace(/^### /,"").replace(/\*\*/g,"").trim();
      els.push(<div key={i} style={{color:C.txt,fontSize:13,fontWeight:700,margin:"12px 0 6px"}}>{txt}</div>);
      i++;continue;
    }
    // Table rows
    if(l.trim().startsWith("|")&&!l.trim().match(/^\|[-| ]+\|$/)){
      const cells=l.trim().split("|").filter((_,idx,arr)=>idx>0&&idx<arr.length-1).map(c=>c.trim());
      const isHeader=lines[i+1]&&lines[i+1].trim().match(/^\|[-| ]+\|$/);
      els.push(<div key={i} style={{display:"grid",gridTemplateColumns:`repeat(${cells.length},1fr)`,gap:4,padding:"6px 0",borderBottom:`1px solid ${C.brd}`}}>
        {cells.map((c,j)=><div key={j} style={{color:isHeader?C.mut:C.txt,fontSize:12,fontWeight:isHeader?700:400}}>{c.replace(/\*\*/g,"")}</div>)}
      </div>);
      if(isHeader) i+=2; else i++;
      continue;
    }
    // Skip table separator
    if(l.trim().match(/^\|[-| ]+\|$/)){i++;continue;}
    // Empty line
    if(!l.trim()){els.push(<div key={i} style={{height:4}}/>);i++;continue;}
    // Normal line – render bold
    const parts=l.split(/\*\*([^*]+)\*\*/g);
    const rendered=parts.map((p,j)=>j%2===1?<strong key={j} style={{color:C.txt,fontWeight:700}}>{p}</strong>:<span key={j}>{p}</span>);
    // Bullet/dash
    const isBullet=l.match(/^[\-\*•]\s/);
    els.push(<div key={i} style={{color:"rgba(255,255,255,0.75)",fontSize:13,lineHeight:1.7,paddingLeft:isBullet?12:0,position:"relative"}}>
      {isBullet&&<span style={{position:"absolute",left:0,color:C.acl}}>•</span>}
      {rendered}
    </div>);
    i++;
  }
  return <div style={{display:"flex",flexDirection:"column",gap:2}}>{els}</div>;
}
function advice(lang, data, ss) {
  const sr=lang==="sr";
  const {goal,audT,freq:fq,crFs=[],crA,cpF,bud,sp}=data;
  const fr=parseFloat(fq)||0;
  const br=parseFloat(bud)>0?(parseFloat(sp)||0)/parseFloat(bud):null;
  const adv={m:{},tg:[],cr:[],st:[],pr:[]};

  const MET={
    ROAS:{
      poor:sr?"ROAS ispod 1.5x je alarmantan signal – kampanja troši više nego što zarađuje. Proveri: (1) Da li pixel ispravno beleži purchase evente – greška u atribuciji je čest uzrok lažno niskog ROAS-a. (2) Kvalitet landing page-a – ako CTR nije loš ali ROAS jeste, problem je u konverziji post-klika. (3) Da li je AOV dovoljno visoka da pokrije CPA? Pauziraj slabe ad setove i preraspodeli budžet na top performere."
        :"ROAS below 1.5x is a critical signal – the campaign spends more than it earns. Check: (1) Pixel correctly tracks purchase events – attribution errors cause falsely low ROAS. (2) Landing page quality – if CTR is fine but ROAS isn't, the problem is post-click conversion. (3) Is AOV high enough to support your CPA? Pause weak ad sets and reallocate budget to top performers.",
      ok:sr?"ROAS između 1.5–4x je funkcionalan ali ostavlja novac na stolu. Testiraj novi ad copy sa benefit-driven pristupom, uvedi upsell/cross-sell na landing page-u da povećaš AOV, i osiguraj da retargeting kampanja ima dovoljno budžeta – retargeting tipično daje 3–5x bolji ROAS od cold audience."
        :"ROAS between 1.5–4x is functional but leaves money on the table. Test new ad copy with a benefit-driven approach, introduce upsell/cross-sell to increase AOV, and ensure retargeting has enough budget – retargeting typically delivers 3–5x better ROAS than cold audiences.",
      good:sr?"Odličan ROAS – kampanja je profitabilna. Povećaj budžet za 20–30% svakih 3–4 dana (ne odjednom). Dupliraj top ad setove i testiraj Advantage+ kampanje za dalju optimizaciju."
        :"Excellent ROAS – campaign is profitable. Increase budget by 20–30% every 3–4 days (not all at once). Duplicate top ad sets and test Advantage+ campaigns for further optimization.",
    },
    CTR:{
      poor:sr?"CTR ispod 0.5% znači da kreativa ne zaustavlja scroll. Kreativa je odgovorna za 70–80% uspeha kampanje. Odmah testiraj: UGC umesto poliranog sadržaja, hook u prvoj sekundi videa mora biti direktno relevantan bolu ciljne publike, promeni format – pređi na Reels koji Meta organski favorizuje u aukciji."
        :"CTR below 0.5% means your creative isn't stopping the scroll. Creative accounts for 70–80% of campaign success. Test immediately: UGC instead of polished content, the hook in the first second must address your audience's pain point directly, switch to Reels format which Meta algorithmically favors.",
      ok:sr?"CTR je prosečan. Meta prosek za Feed je 0.9%. Testiraj minimum 3–4 kreativne varijante istovremeno, koristi Dynamic Creative Testing, i analiziraj koji demografski segment klikće više pa na njega usmeri veći deo budžeta."
        :"CTR is average. Meta average for Feed is 0.9%. Test at least 3–4 creative variants simultaneously, use Dynamic Creative Testing, and analyze which demographic segment clicks more – then allocate more budget there.",
      good:sr?"Odličan CTR – kreativa efektivno privlači pažnju. Sada fokus prebaci na post-klik iskustvo: konzistentnost između ad-a i LP direktno utiče na Conversion Rate i Quality Score koji snižava CPM."
        :"Excellent CTR – creative is capturing attention effectively. Now focus on the post-click experience: consistency between ad and LP directly impacts Conversion Rate and Quality Score, which lowers CPM.",
    },
    CPC:{
      poor:sr?"Visok CPC (>3€) direktno jede profitabilnost. Uzroci: visok CPM zbog uske publike ili loše relevantnosti kreative, nizak CTR koji podiže efektivnu cenu. Rešenja: proširi targeting (Broad ili veći LAL), proveri ad relevance dijagnostiku u Meta Business Suite, testiraj Advantage+ audience."
        :"High CPC (>€3) directly eats into profitability. Causes: high CPM due to narrow audience or poor creative relevance, low CTR driving up effective cost. Solutions: broaden targeting (Broad or larger LAL), check ad relevance diagnostics in Meta Business Suite, test Advantage+ audience.",
      ok:sr?"CPC je u prihvatljivom rangu. Prati trend – ako raste tokom kampanje, to je signal audience saturation. Osvoji publiku (LAL od top kupaca) ili refreshuj kreativu."
        :"CPC is in an acceptable range. Monitor the trend – if rising, it signals audience saturation. Refresh the audience (LAL from top buyers) or update the creative.",
      good:sr?"Nizak CPC – Meta ti daje klikove po efikasnoj ceni. Proveri da li sav taj traffic konvertuje jer nizak CPC bez konverzija ukazuje na problem sa relevancijom publike ili landing page-om."
        :"Low CPC – Meta is delivering clicks efficiently. Verify traffic is converting, as low CPC without conversions indicates a relevance or landing page issue.",
    },
    CPA:{
      poor:sr?"CPA iznad 80€ je kritičan. Proveri: da li optimizuješ za pravi event (purchase, ne add to cart), da li je conversion window ispravno postavljen (7-day click je standard), i da li imaš minimum 50 konverzija/nedelji za stabilnu optimizaciju algoritma."
        :"CPA above €80 is critical. Check: optimizing for the right event (purchase, not add to cart), conversion window set correctly (7-day click is standard), and minimum 50 conversions/week for stable algorithm optimization.",
      ok:sr?"CPA je prihvatljiv ali ima prostora. Da smanjiš CPA: testiraj Broad targeting sa Advantage+ kreativama, uvedi retargeting funnel za nekonvertovane posetioce, i razmotri value-based optimization."
        :"CPA is acceptable but improvable. To lower CPA: test Broad targeting with Advantage+ creatives, introduce a retargeting funnel for non-converters, and consider value-based optimization.",
      good:sr?"Odličan CPA – akvizicija je efikasna. Skaliraj kampanju i koristi top konvertere kao seed audience za Lookalike kampanje."
        :"Excellent CPA – acquisition is efficient. Scale this campaign and use top converters as seed for Lookalike campaigns.",
    },
    ConversionRate:{
      poor:sr?"Conversion rate ispod 1% je jasan signal da je problem na landing page-u, ne u kampanji. Proveri: brzinu učitavanja (>3 sekunde = gubitak konverzija), mobile UX (80%+ Meta trafika je mobile), jasnoću CTA. Instaliraj Hotjar ili Microsoft Clarity (besplatno) da vidiš gde korisnici napuštaju stranicu."
        :"Conversion rate below 1% is a clear signal the problem is on the landing page. Check: load speed (>3 seconds = losing conversions), mobile UX (80%+ of Meta traffic is mobile), CTA clarity. Install Hotjar or Microsoft Clarity (free) to see where users drop off.",
      ok:sr?"Conversion rate je solidan. Za unapređenje: A/B testiraj headline i CTA na LP, dodaj social proof (recenzije, logotipi), i uvedi exit-intent popup za one koji ne konvertuju."
        :"Conversion rate is solid. For improvement: A/B test headline and CTA on LP, add social proof (reviews, logos), and introduce exit-intent popup for non-converters.",
      good:sr?"Odličan conversion rate – LP i ad su u sinergiji. Fokusiraj se na povećanje volumena trafika skalirajući budžet i šireći audience."
        :"Excellent conversion rate – LP and ad are in synergy. Focus on increasing traffic volume by scaling budget and expanding audience.",
    },
    Revenue:{
      poor:sr?"Nizak prihod može biti uzrokovan malim budžetom, niskim AOV-om ili lošim ROAS-om. Fokusiraj se na povećanje AOV kroz bundle ponude, upsell na checkout-u ili free shipping threshold. Prihod = trafik × conversion rate × prosečna vrednost porudžbine."
        :"Low revenue can result from small budget, low AOV, or poor ROAS. Focus on increasing AOV through bundles, checkout upsell, or free shipping thresholds. Revenue = traffic × conversion rate × average order value.",
      ok:sr?"Prihod je solidan. Da ga povećaš bez povećanja budžeta: optimizuj post-purchase email flow, uvedi loyalty program i povećaj LTV, i testiraj visoko-vredne audience segmente."
        :"Revenue is solid. To increase without raising budget: optimize post-purchase email flow, introduce loyalty program to increase LTV, test high-value audience segments.",
      good:sr?"Sjajan prihod – kampanja je jako profitabilna. Analiziraj koji proizvodi generišu najveći prihod i dupliraj tu strukturu u novim kampanjama."
        :"Great revenue – campaign is highly profitable. Analyze which products generate the most revenue and replicate that structure in new campaigns.",
    },
  };

  ["ROAS","CTR","CPC","CPA","ConversionRate","Revenue"].forEach(k=>{ if(ss[k]) adv.m[k]=MET[k][ss[k]]; });

  if(ss.ROAS==="poor"){adv.pr.push(sr?"🔴 Hitno: Proveri Meta pixel atribuciju i purchase evente":"🔴 Urgent: Verify Meta pixel attribution and purchase events"); adv.pr.push(sr?"🔴 Hitno: Pauziraj ad setove sa ROAS < 1.0":"🔴 Urgent: Pause ad sets with ROAS < 1.0");}
  if(ss.CTR==="poor") adv.pr.push(sr?"🔴 Hitno: Osvoji kreativu – CTR ispod 0.5% zahteva A/B test novih vizuala":"🔴 Urgent: Refresh creative – CTR below 0.5% requires A/B testing new visuals");
  if(ss.CPC==="poor") adv.pr.push(sr?"⚠️ Visok CPC: Proveri audience overlap i proširi targeting":"⚠️ High CPC: Check audience overlap and broaden targeting");
  if(ss.CPA==="poor") adv.pr.push(sr?"🔴 CPA kritično visok: Proveri optimization event i conversion window":"🔴 CPA critically high: Check optimization event and conversion window");
  if(ss.ConversionRate==="poor") adv.pr.push(sr?"🔴 Nizak CR: Problem je na landing page-u – proveri mobile UX i page speed":"🔴 Low CR: Problem is on the landing page – check mobile UX and page speed");

  if(audT){
    if(audT.includes("Interest")||audT.includes("Cold")) adv.tg.push(sr?"Interest targeting je sve manje precizan (iOS14+ impact). Razmotri prelaz na Broad targeting sa Advantage+ – Meta algoritam često nadmašuje manualni interest targeting kada imaš 50+ konverzija/nedelji.":"Interest targeting is becoming less precise (iOS14+ impact). Consider switching to Broad targeting with Advantage+ – Meta's algorithm often outperforms manual interest targeting when you have 50+ conversions/week.");
    else if(audT.includes("Lookalike")) adv.tg.push(sr?"LAL je jedna od najefikasnijih strategija. Proveri: da li je seed audience kvalitetan (top 25% kupaca po vrednosti), koji procenat koristiš (1% najprecizniji, 3–5% više volumena), i da li kombinuješ LAL sa interest layerom.":"LAL is one of the most effective strategies. Check: quality of seed audience (top 25% of buyers by value), which percentage (1% most precise, 3–5% more volume), and whether you're combining LAL with an interest layer.");
    else if(audT.includes("Retargeting")){adv.tg.push(sr?"Retargeting je najprofitabilniji deo funnela. Segmentiraj po toplini: Add to cart/Checkout → direktna ponuda, Product page views → benefit messaging, Website visitors 30–60 dana → awareness. Svaki segment treba poseban ad set sa prilagođenim messagingom.":"Retargeting is the most profitable part of the funnel. Segment by warmth: Add to cart/Checkout → direct offer, Product page views → benefit messaging, Website visitors 30–60 days → awareness. Each segment needs a separate ad set with tailored messaging."); adv.pr.push(sr?"💡 Segmentiraj retargeting po nivou namere (ATC vs pageview vs visitor)":"💡 Segment retargeting by intent level (ATC vs pageview vs visitor)");}
    else if(audT.includes("Broad")) adv.tg.push(sr?"Broad targeting radi dobro sa dovoljnim budžetom (min 30–50€/dan po ad setu) i dobro optimizovanim pixelom. Ako nemaš 50+ konverzija/nedelji, Broad može biti neefikasan jer algoritam nema dovoljno signala.":"Broad targeting works well with sufficient budget (min €30–50/day per ad set) and a well-optimized pixel. If you don't have 50+ conversions/week, Broad can be inefficient as the algorithm lacks enough signals.");
  }
  if(fr>3.5){adv.tg.push(sr?`⚠️ Frekvencija ${fr}x je visoka – publika je zasićena. Efekat: povećanje CPC, pad CTR, negativni komentari. Hitno: osvoji publiku (novi LAL ili Broad) ili drastično osvoji kreativu.`:`⚠️ Frequency at ${fr}x is high – audience is saturated. Effect: rising CPC, falling CTR, negative comments. Urgently refresh audience (new LAL or Broad) or drastically update creative.`);adv.pr.push(sr?`⚠️ Frekvencija ${fr}x: Osvoji kreativu ili proširi publiku odmah`:`⚠️ Frequency ${fr}x: Refresh creative or expand audience immediately`);}
  else if(fr>0&&fr<1.5) adv.tg.push(sr?`Frekvencija ${fr}x je niska. Za retargeting, cilj je 3–7x u 7 dana. Povećaj budžet ili suzi publiku.`:`Frequency at ${fr}x is low. For retargeting, target 3–7x in 7 days. Increase budget or narrow audience.`);

  if(crFs.length>0){
    const hSt=crFs.some(f=>f.includes("Static")||f.includes("Statična"));
    const hVid=crFs.some(f=>f.includes("Video")||f.includes("Reels"));
    if(hSt&&!hVid) adv.cr.push(sr?"Koristiš samo statičnu sliku – algoritam sve više favorizuje video format, posebno Reels (9:16). Uvedi kratki video (6–15 sekundi) sa jakim hookom u prvoj sekundi ili UGC-style content koji izgleda organski.":"You're using only static images – Meta's algorithm increasingly favors video, especially Reels (9:16). Introduce short video (6–15 seconds) with a strong hook or UGC-style content that looks organic.");
    if(hVid&&hSt) adv.cr.push(sr?"Odlično što testiraš više formata. Prati koji format ima bolji CPM i CTR po placement-u i alociraj budžet tamo.":"Great that you're testing multiple formats. Monitor which has better CPM and CTR per placement and allocate budget accordingly.");
    if(crFs.length>=3) adv.cr.push(sr?"Testiraš 3+ formata – odlično za učenje. Meta tipično troši 70% budžeta na 20% kreativa, pa daj dovoljno vremena (5–7 dana) i budžeta svakom formatu pre donošenja zaključaka.":"Testing 3+ formats – great for learning. Meta typically spends 70% of budget on 20% of creatives, so give each format enough time (5–7 days) and budget before drawing conclusions.");
  }
  if(crA){
    const old=crA.includes("Stara")||crA.includes("Old")||crA.includes("1–2");
    if(old){adv.cr.push(sr?"Kreativa je stara i verovatno u fazi zasićenja. Proveri koji ad ima najveći spend i da li mu pada CTR tokom vremena. Uvedi 2–3 sveže varijante sa različitim hookom i vizuelom.":"Creative is old and likely in saturation phase. Check which ad has the highest spend and declining CTR over time. Introduce 2–3 fresh variants with different hooks and visuals.");adv.pr.push(sr?"💡 Osvoji kreativu: Uvedi minimum 2 nove varijante sa drugačijim hookom":"💡 Refresh creative: Introduce minimum 2 new variants with different hooks");}
  }
  if(goal){
    if(sr){
      if(goal.includes("Konverzij")||goal.includes("Prodaj")) adv.st.push("Za konverzijsku kampanju: osiguraj minimum 50 purchase eventa/nedelji pre skaliranja, koristi CBO za efikasniju distribuciju budžeta, i testiraj Advantage Shopping Campaign za e-com.");
      else if(goal.includes("Lead")) adv.st.push("Za lead gen: testiraj Meta Instant Forms (viši volumen, niži kvalitet) vs landing page (niži volumen, viši kvalitet) i prati do konačne prodaje. Lead quality je bitniji od lead volumena.");
      else if(goal.includes("Awareness")) adv.st.push("Za awareness: primarni KPI treba biti Reach i Frequency, ne ROAS. Meri brand lift kroz porast direktnog trafika u periodu kampanje.");
    } else {
      if(goal.includes("Conversion")||goal.includes("Sales")) adv.st.push("For conversion campaigns: ensure 50+ purchase events/week before scaling, use CBO for efficient budget distribution, and test Advantage Shopping Campaign for e-commerce.");
      else if(goal.includes("Lead")) adv.st.push("For lead gen: test Meta Instant Forms (higher volume, lower quality) vs landing page (lower volume, higher quality) and track to final sale. Lead quality matters more than volume.");
      else if(goal.includes("Awareness")) adv.st.push("For awareness: primary KPI should be Reach and Frequency, not ROAS. Measure brand lift through increase in direct traffic during the campaign period.");
    }
  }
  if(ss.ROAS==="good") adv.st.push(sr?"✅ Skaliraj uspešne ad setove postepeno – 20–30% povećanje budžeta na 3–4 dana":"✅ Scale winning ad sets gradually – 20–30% budget increase every 3–4 days");
  if(ss.CPA==="good") adv.st.push(sr?"✅ Koristi top konvertere kao seed za LAL 1–3% kampanje":"✅ Use top converters as seed for LAL 1–3% campaigns");
  if(br!==null){
    if(br<0.7) adv.st.push(sr?`Potrošeno ${Math.round(br*100)}% budžeta – kampanja ne troši dovoljno. Proveri policy violations, ograničenja delivery-ja ili previše restriktivno targetiranje.`:`Only ${Math.round(br*100)}% of budget spent – campaign isn't spending enough. Check for policy violations, delivery restrictions, or overly restrictive targeting.`);
    else if(br>0.98) adv.st.push(sr?`Budžet gotovo u potpunosti potrošen (${Math.round(br*100)}%). Ako su rezultati dobri, povećaj budžet da ne gubiš impression share.`:`Budget almost fully spent (${Math.round(br*100)}%). If results are good, increase budget to avoid losing impression share.`);
  }
  return adv;
}

// ── MODULE 1: HEALTH ─────────────────────────────────────────────────────────
function HealthMod({t,lang}){
  const mob=useIsMobile();
  const sr=lang==="sr";
  const [mode,setMode]=useState(null); // null=izbor, "manual"=rucno, "screenshot"=upload
  const [step,setSt]=useState(0);
  const [f,setF]=useState({name:"",goal:"",per:"",bud:"",sp:"",ROAS:"",CTR:"",CPC:"",CPA:"",ConversionRate:"",Revenue:"",audT:"",audS:"",freq:"",crFs:[],crA:"",cpF:""});
  const [done,setDone]=useState(false);
  const [aiAnalysis,setAiAnalysis]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [screenshot,setScreenshot]=useState(null);
  const [screenshotPreview,setScreenshotPreview]=useState(null);
  const [screenshotName,setScreenshotName]=useState("");
  const [dragOver,setDragOver]=useState(false);
  const [csv,setCsv]=useState(null);
  const [csvName,setCsvName]=useState("");
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const MK=["ROAS","CTR","CPC","CPA","ConversionRate","Revenue"];
  const ss={}; MK.forEach(k=>{ss[k]=gStatus(k,f[k]);});
  const ov=gOverall(ss); const fl=MK.filter(k=>f[k]!=="").length;
  const br=parseFloat(f.bud)>0?(parseFloat(f.sp)||0)/parseFloat(f.bud):null;
  const adv=advice(lang,{goal:f.goal,audT:f.audT,freq:f.freq,crFs:f.crFs,crA:f.crA,cpF:f.cpF,bud:f.bud,sp:f.sp},ss);
  const MD=[{k:"ROAS",l:t.hROAS,h:t.hROASh,sx:"x",ph:"3.2"},{k:"CTR",l:t.hCTR,h:t.hCTRh,sx:"%",ph:"1.8"},{k:"CPC",l:t.hCPC,h:t.hCPCh,sx:"€",ph:"0.85"},{k:"CPA",l:t.hCPA,h:t.hCPAh,sx:"€",ph:"25"},{k:"ConversionRate",l:t.hCR,h:t.hCRh,sx:"%",ph:"2.4"},{k:"Revenue",l:t.hRev,h:t.hRevh,sx:"€",ph:"1500"}];

  const handleFile=(file)=>{
    if(!file||!file.type.startsWith("image/")) return;
    setScreenshotName(file.name);
    const reader=new FileReader();
    reader.onload=(e)=>{
      const base64=e.target.result.split(",")[1];
      setScreenshot(base64);
      setScreenshotPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const parseCSV=(text)=>{
    const lines=text.split("\n").filter(l=>l.trim());
    if(lines.length<2) return null;
    const headers=lines[0].split(",").map(h=>h.replace(/"/g,"").trim());
    const rows=lines.slice(1).map(line=>{
      const vals=line.match(/(".*?"|[^,]+)/g)||[];
      const row={};
      headers.forEach((h,i)=>{ row[h]=(vals[i]||"").replace(/"/g,"").trim(); });
      return row;
    }).filter(r=>Object.values(r).some(v=>v));
    return{headers,rows};
  };

  const handleCSV=(file)=>{
    if(!file) return;
    setCsvName(file.name);
    const reader=new FileReader();
    reader.onload=e=>setCsv(e.target.result);
    reader.readAsText(file,"UTF-8");
  };

  const handleCSVAnalyze=async()=>{
    if(!csv) return;
    setDone(true); setAiLoading(true); setAiAnalysis("");
    try{
      const parsed=parseCSV(csv);
      const csvSummary=parsed?`Kolone: ${parsed.headers.join(", ")}\nPodaci:\n${parsed.rows.slice(0,30).map(r=>Object.values(r).join(" | ")).join("\n")}`:csv.slice(0,3000);
      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:2000,
          messages:[{role:"user",content:sr
            ?`Ti si senior Meta Ads ekspert. Analiziraj ovaj CSV export iz marketing alata. Piši isključivo na srpskom jeziku, ekavski (ne koristiti reči kao "prosječan", "označen", "prikazati" – već "prosečan", "obeležen", "prikazati").

CSV PODACI:
${csvSummary}

Pročitaj sve metrike i napiši analizu. NE koristi Markdown (##, **, ---, tabele). Koristi samo običan tekst:

EXECUTIVE SUMMARY
(2-3 rečenice – opšta ocena)

METRIKE KOJE SAM UOČIO
(Navedi sve metrike koje vidiš)

KLJUČNI PROBLEMI
(2-4 problema sa crticom)

ŠTA RADI DOBRO
(1-3 pozitivne stvari)

PRIORITETNE AKCIJE
(3-5 konkretnih akcija, numerisano)

STRATEŠKE PREPORUKE
(2-3 preporuke)

Budi konkretan i profesionalan.`
            :`You are a senior Meta Ads expert. Analyze this CSV export from a marketing tool.

CSV DATA:
${csvSummary}

Read all metrics and write an analysis. Do NOT use Markdown (##, **, ---, tables). Use plain text only:

EXECUTIVE SUMMARY
(2-3 sentences – overall assessment)

METRICS I IDENTIFIED
(List all metrics you can see)

KEY ISSUES
(2-4 issues with dashes)

WHAT'S WORKING
(1-3 positive things)

PRIORITY ACTIONS
(3-5 concrete actions, numbered)

STRATEGIC RECOMMENDATIONS
(2-3 recommendations)

Be specific and professional.`
          }]
        })
      });
      const data=await res.json();
      setAiAnalysis(data.content?.[0]?.text||"");
    }catch(e){
      setAiAnalysis(sr?"Greška pri analizi CSV-a. Pokušaj ponovo.":"Error analyzing CSV. Please try again.");
    }
    setAiLoading(false);
  };

  const handleScreenshotAnalyze=async()=>{
    if(!screenshot) return;
    setDone(true); setAiLoading(true); setAiAnalysis("");
    try {
      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:2000,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:getImageMediaType(screenshot),data:screenshot}},
            {type:"text",text:sr
              ?`Ti si senior Meta Ads ekspert. Analiziraj ovaj screenshot iz marketing alata. Piši isključivo na srpskom jeziku, ekavski (ne koristiti reči kao "prosječan", "označen", "prikazati" – već "prosečan", "obeležen", "prikazati").

Pročitaj sve metrike i napiši analizu. NE koristi Markdown (##, **, ---, tabele). Koristi samo običan tekst:

EXECUTIVE SUMMARY
(2-3 rečenice – opšta ocena)

METRIKE KOJE SAM UOČIO
(Navedi sve metrike koje vidiš)

KLJUČNI PROBLEMI
(2-4 problema sa crticom)

ŠTA RADI DOBRO
(1-3 pozitivne stvari)

PRIORITETNE AKCIJE
(3-5 konkretnih akcija, numerisano)

STRATEŠKE PREPORUKE
(2-3 preporuke)

Budi konkretan i profesionalan.`
              :`You are a senior Meta Ads expert. Analyze this screenshot from a marketing tool.

Read all visible metrics and write an analysis. Do NOT use Markdown (##, **, ---, tables). Use plain text only:

EXECUTIVE SUMMARY
(2-3 sentences – overall assessment)

METRICS I IDENTIFIED
(List all metrics you can see)

KEY ISSUES
(2-4 issues with dashes)

WHAT'S WORKING
(1-3 positive things)

PRIORITY ACTIONS
(3-5 concrete actions, numbered)

STRATEGIC RECOMMENDATIONS
(2-3 recommendations)

Be specific and professional.`}
          ]}]
        })
      });
      const data=await res.json();
      setAiAnalysis(data.content?.[0]?.text||"");
    } catch(e) {
      setAiAnalysis(sr?"Greška pri analizi screenshota. Pokušaj ponovo.":"Error analyzing screenshot. Please try again.");
    }
    setAiLoading(false);
  };

  const handleAnalyze = async () => {
    setDone(true);
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const metrics = MK.filter(k=>f[k]!=="").map(k=>`${k}: ${f[k]}`).join(", ");
      const prompt = sr
        ? `Ti si senior Meta Ads ekspert sa 10+ godina iskustva. Analiziraj ovu Meta kampanju i daj detaljnu, personalizovanu analizu. Piši isključivo na srpskom jeziku, ekavski (npr. "prosečan" ne "prosječan", "označen" ne "obilježen", "prikazati" ne "prikazivati").

Naziv kampanje: ${f.name||"Nije navedeno"}
Cilj kampanje: ${f.goal||"Nije navedeno"}
Period: ${f.per||"Nije navedeno"}
Budžet: ${f.bud?"€"+f.bud:""} | Potrošeno: ${f.sp?"€"+f.sp:""}
Metrike: ${metrics}
Tip publike: ${f.audT||"Nije navedeno"}
Veličina publike: ${f.audS||"Nije navedeno"}
Frekvencija: ${f.freq||"Nije navedeno"}
Format kreative: ${f.crFs?.join(", ")||"Nije navedeno"}
Starost kreative: ${f.crA||"Nije navedeno"}
Ad copy fokus: ${f.cpF||"Nije navedeno"}

Napiši analizu u sledećem formatu. NE koristi Markdown oznake (##, **, ---, |tabele|). Koristi samo običan tekst sa sekcijama:

EXECUTIVE SUMMARY
(2-3 rečenice – opšta ocena kampanje)

KLJUČNI PROBLEMI
(Navedi 2-4 konkretna problema, svaki u novom redu sa crticom)

ŠTA RADI DOBRO
(Navedi 1-3 stvari koje funkcionišu)

PRIORITETNE AKCIJE
(3-5 konkretnih akcija, numerisano)

STRATEŠKE PREPORUKE
(2-3 dugoročne preporuke)

Budi konkretan, direktan i profesionalan.`
        : `You are a senior Meta Ads expert with 10+ years of experience. Analyze this Meta campaign and provide a detailed, personalized analysis.

Campaign name: ${f.name||"Not specified"}
Campaign objective: ${f.goal||"Not specified"}
Period: ${f.per||"Not specified"}
Budget: ${f.bud?"€"+f.bud:""} | Spent: ${f.sp?"€"+f.sp:""}
Metrics: ${metrics}
Audience type: ${f.audT||"Not specified"}
Audience size: ${f.audS||"Not specified"}
Frequency: ${f.freq||"Not specified"}
Creative format: ${f.crFs?.join(", ")||"Not specified"}
Creative age: ${f.crA||"Not specified"}
Ad copy focus: ${f.cpF||"Not specified"}

Write analysis in this format:

🎯 EXECUTIVE SUMMARY
(2-3 sentences – overall campaign assessment)

📊 KEY ISSUES
(List 2-4 specific problems with explanation of why they're issues)

✅ WHAT'S WORKING
(List 1-3 things that are working well)

🚀 PRIORITY ACTIONS – DO NOW
(3-5 concrete actions with clear instructions)

💡 STRATEGIC RECOMMENDATIONS
(2-3 long-term recommendations)

Be specific, direct and professional. Use real Meta Ads benchmark values.`;

      const result = await callClaude(prompt, lang);
      setAiAnalysis(result);
    } catch(e) {
      setAiAnalysis(sr?"Greška pri AI analizi. Statička analiza je prikazana ispod.":"Error with AI analysis. Static analysis is shown below.");
    }
    setAiLoading(false);
  };

  const reset=()=>{setSt(0);setDone(false);setAiAnalysis("");setMode(null);setScreenshot(null);setScreenshotPreview(null);setScreenshotName("");setCsv(null);setCsvName("");setF({name:"",goal:"",per:"",bud:"",sp:"",ROAS:"",CTR:"",CPC:"",CPA:"",ConversionRate:"",Revenue:"",audT:"",audS:"",freq:"",crFs:[],crA:"",cpF:""});};
  const ovc=ov?SC[ov]:null;
  const STEPS=[t.s1,t.s2,t.s3];
  const BudBar=()=>br!==null?<div style={{background:C.sur,borderRadius:10,padding:"12px 14px",marginTop:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:C.mut}}>{t.hBudUse}</span><span style={{fontSize:12,fontWeight:700,color:br>0.9?C.grn:br>0.6?C.yel:C.red}}>{Math.round(br*100)}%</span></div><div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(br*100,100)}%`,background:"linear-gradient(90deg,#6366F1,#8B5CF6)",borderRadius:3}}/></div></div>:null;

  // ── REZULTATI (zajednički za oba moda) ──
  if(done) return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 4px"}}>{t.res}</h2>
    {mode==="screenshot"&&screenshotName&&<p style={{color:C.mut,fontSize:12,margin:"0 0 20px"}}>📸 {screenshotName}</p>}
    {mode==="csv"&&csvName&&<p style={{color:C.mut,fontSize:12,margin:"0 0 20px"}}>📊 {csvName}</p>}
    {mode==="manual"&&<p style={{color:C.mut,fontSize:12,margin:"0 0 20px"}}>{fl} {t.hMsub} · Meta Ads</p>}

    {mode==="manual"&&ovc&&<div style={{background:ovc.b,border:`1px solid ${ovc.r}`,borderRadius:14,padding:"20px",marginBottom:20,textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>{ov==="poor"?"🚨":ov==="ok"?"⚡":"🏆"}</div><div style={{color:ovc.c,fontSize:17,fontWeight:800,marginBottom:4}}>{t.hOvr}: {t[ov]}</div>{f.goal&&<div style={{color:C.mut,fontSize:12}}>{t.hGl}: {f.goal}</div>}</div>}
    {mode==="manual"&&br!==null&&<div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px",marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,fontWeight:700,color:C.mut}}>{t.hBudH}</span><span style={{fontSize:12,fontWeight:800,color:br>0.85?C.grn:C.yel}}>€{parseFloat(f.sp).toLocaleString()} / €{parseFloat(f.bud).toLocaleString()} ({Math.round(br*100)}%)</span></div><div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(br*100,100)}%`,background:"linear-gradient(90deg,#6366F1,#34D399)",borderRadius:3}}/></div></div>}

    {/* AI ANALIZA */}
    <div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:14,padding:"16px",marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <span style={{fontSize:16}}>✦</span>
        <span style={{color:C.acl,fontWeight:700,fontSize:13}}>{sr?"Analiza":"Analysis"}</span>
        {aiLoading&&<span style={{color:C.mut,fontSize:12,marginLeft:"auto"}}>{sr?"Analizira...":"Analyzing..."}</span>}
      </div>
      {aiLoading&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[1,2,3,4].map(i=><div key={i} className="pm-sk" style={{height:12,borderRadius:6,width:i===4?"60%":"100%"}}/>)}
      </div>}
      {aiAnalysis&&!aiLoading&&<div className="pm-in"><MD2 text={aiAnalysis}/></div>}
    </div>

    {mode==="manual"&&<>
      {adv.pr.length>0&&<><ST c={t.hPRI}/><div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:"14px",marginBottom:16}}>{adv.pr.map((p,i)=><div key={i} style={{color:"rgba(255,255,255,0.75)",fontSize:12,lineHeight:1.7,padding:"5px 0",borderBottom:i<adv.pr.length-1?`1px solid ${C.brd}`:"none"}}>{p}</div>)}</div></>}
      <ST c={t.hMAN}/>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {MD.map(({k,l,sx})=>{ if(!f[k]||!ss[k]) return null; const cfg=SC[ss[k]]; return <div key={k} style={{background:`${cfg.b}80`,border:`1px solid ${cfg.r}`,borderLeft:`3px solid ${cfg.c}`,borderRadius:12,padding:"13px 15px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{color:C.txt,fontWeight:700,fontSize:13}}>{l}</span><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:cfg.c,fontWeight:800,fontSize:15}}>{f[k]}{sx}</span><div style={{width:7,height:7,borderRadius:"50%",background:cfg.c}}/></div></div>{adv.m[k]&&<p style={{color:"rgba(255,255,255,0.6)",fontSize:12,margin:0,lineHeight:1.7}}>{adv.m[k]}</p>}</div>; })}
      </div>
      {adv.tg.length>0&&<><ST c={t.hTAN}/><div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px",marginBottom:16}}>{adv.tg.map((a,i)=><div key={i} style={{color:"rgba(255,255,255,0.65)",fontSize:12,lineHeight:1.7,padding:"6px 0",borderBottom:i<adv.tg.length-1?`1px solid ${C.brd}`:"none"}}>{a}</div>)}</div></>}
      {adv.cr.length>0&&<><ST c={t.hCAN}/><div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px",marginBottom:16}}>{adv.cr.map((a,i)=><div key={i} style={{color:"rgba(255,255,255,0.65)",fontSize:12,lineHeight:1.7,padding:"6px 0",borderBottom:i<adv.cr.length-1?`1px solid ${C.brd}`:"none"}}>{a}</div>)}</div></>}
      {adv.st.length>0&&<><ST c={t.hSTR}/><div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"14px",marginBottom:20}}>{adv.st.map((a,i)=><div key={i} style={{color:"rgba(255,255,255,0.65)",fontSize:12,lineHeight:1.7,padding:"6px 0",borderBottom:i<adv.st.length-1?`1px solid ${C.brd}`:"none"}}>{a}</div>)}</div></>}
    </>}
    <Btn onClick={reset} sec>{t.newA}</Btn>
  </div>;

  // ── IZBOR MODA ──
  if(!mode) return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.hTitle}</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 28px",lineHeight:1.6}}>{sr?"Kako želiš da analiziraš kampanju?":"How would you like to analyze the campaign?"}</p>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <button onClick={()=>setMode("screenshot")} style={{background:"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(99,102,241,0.08))",border:"1px solid rgba(99,102,241,0.4)",borderRadius:16,padding:"20px",textAlign:"left",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
        <div style={{fontSize:28,marginBottom:10}}>📸</div>
        <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:6}}>{sr?"Upload Screenshot":"Upload Screenshot"}</div>
        <div style={{color:C.mut,fontSize:13,lineHeight:1.5}}>{sr?"Uploaduj screenshot iz Meta Ads Managera, Looker Studia ili bilo kog alata. AI sam čita i analizira sve što vidi na slici.":"Upload a screenshot from Meta Ads Manager, Looker Studio or any tool. AI reads and analyzes everything it sees in the image."}</div>
        <div style={{marginTop:12,color:C.acl,fontSize:12,fontWeight:700}}>{sr?"Analizira automatski":"Analyzes automatically"} →</div>
      </button>
      <button onClick={()=>setMode("csv")} style={{background:"linear-gradient(135deg,rgba(0,212,255,0.15),rgba(0,212,255,0.05))",border:"1px solid rgba(0,212,255,0.3)",borderRadius:16,padding:"20px",textAlign:"left",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
        <div style={{fontSize:28,marginBottom:10}}>📊</div>
        <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:6}}>{sr?"Upload CSV":"Upload CSV"}</div>
        <div style={{color:C.mut,fontSize:13,lineHeight:1.5}}>{sr?"Uploaduj CSV export iz Meta Ads Managera, Looker Studia, Google Ads-a ili GA4. AI čita podatke direktno iz tabele.":"Upload a CSV export from Meta Ads Manager, Looker Studio, Google Ads or GA4. AI reads the data directly from the table."}</div>
        <div style={{marginTop:12,color:"#00D4FF",fontSize:12,fontWeight:700}}>{sr?"Analizira automatski":"Analyzes automatically"} →</div>
      </button>
      <button onClick={()=>setMode("manual")} style={{background:"linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.05))",border:"1px solid rgba(16,185,129,0.3)",borderRadius:16,padding:"20px",textAlign:"left",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
        <div style={{fontSize:28,marginBottom:10}}>✏️</div>
        <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:6}}>{sr?"Ručni unos metrika":"Manual Metrics Entry"}</div>
        <div style={{color:C.mut,fontSize:13,lineHeight:1.5}}>{sr?"Unesi metrike ručno (ROAS, CTR, CPC, CPA...) i dobij detaljnu analizu sa benchmarkom za svaku metriku.":"Enter metrics manually (ROAS, CTR, CPC, CPA...) and get detailed analysis with benchmarks for each metric."}</div>
        <div style={{marginTop:12,color:"#34D399",fontSize:12,fontWeight:700}}>📊 {sr?"Analiza sa benchmarkom":"Analysis with benchmarks"} →</div>
      </button>
    </div>
  </div>;

  // ── SCREENSHOT MOD ──
  if(mode==="screenshot"&&!done) return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      <button onClick={()=>setMode(null)} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:13,fontWeight:600,padding:0}}>{t.prv}</button>
      <h2 style={{fontSize:20,fontWeight:800,margin:0}}>📸 {sr?"Upload Screenshot":"Upload Screenshot"}</h2>
    </div>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 20px",lineHeight:1.5}}>{sr?"Uploaduj screenshot iz bilo kog alata – Meta Ads Manager, Looker Studio, Google Ads, Excel, Whatagraph... AI će sam pročitati sve metrike.":"Upload a screenshot from any tool – Meta Ads Manager, Looker Studio, Google Ads, Excel, Whatagraph... AI will read all metrics automatically."}</p>

    {!screenshotPreview&&<div
      onDragOver={e=>{e.preventDefault();setDragOver(true);}}
      onDragLeave={()=>setDragOver(false)}
      onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0]);}}
      onClick={()=>document.getElementById("scUpload").click()}
      style={{border:`2px dashed ${dragOver?"#6366F1":"rgba(255,255,255,0.15)"}`,borderRadius:16,padding:"40px 20px",textAlign:"center",cursor:"pointer",background:dragOver?"rgba(99,102,241,0.08)":"rgba(255,255,255,0.02)",transition:"all 0.2s",marginBottom:20}}>
      <div style={{fontSize:40,marginBottom:12}}>📂</div>
      <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:6}}>{sr?"Prevuci screenshot ovde":"Drag screenshot here"}</div>
      <div style={{color:C.mut,fontSize:13}}>{sr?"ili klikni da odabereš fajl":"or click to select file"}</div>
      <div style={{color:C.dim,fontSize:11,marginTop:8}}>PNG, JPG, JPEG</div>
    </div>}
    <input id="scUpload" type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>

    {screenshotPreview&&<div style={{marginBottom:20}}>
      <img src={screenshotPreview} alt="screenshot" style={{width:"100%",borderRadius:12,border:`1px solid ${C.brd}`,marginBottom:10}}/>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>{setScreenshot(null);setScreenshotPreview(null);setScreenshotName("");}} style={{flex:1,background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:10,color:C.mut,fontSize:13,fontWeight:600,padding:"10px",cursor:"pointer"}}>{sr?"Promeni sliku":"Change image"}</button>
      </div>
    </div>}

    <Btn onClick={handleScreenshotAnalyze} disabled={!screenshot}>{sr?"Analiziraj screenshot →":"Analyze screenshot →"}</Btn>
  </div>;

  // ── CSV MOD ──
  if(mode==="csv"&&!done) return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      <button onClick={()=>setMode(null)} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:13,fontWeight:600,padding:0}}>{t.prv}</button>
      <h2 style={{fontSize:20,fontWeight:800,margin:0}}>📊 {sr?"Upload CSV":"Upload CSV"}</h2>
    </div>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 20px",lineHeight:1.5}}>{sr?"Uploaduj CSV export iz Meta Ads Managera, Looker Studia, Google Ads-a ili GA4. AI će pročitati sve redove i kolone.":"Upload a CSV export from Meta Ads Manager, Looker Studio, Google Ads or GA4. AI will read all rows and columns."}</p>

    {!csv&&<div onClick={()=>document.getElementById("hcCsvUpload").click()}
      style={{border:"2px dashed rgba(255,255,255,0.15)",borderRadius:16,padding:"40px 20px",textAlign:"center",cursor:"pointer",background:"rgba(255,255,255,0.02)",transition:"all 0.2s",marginBottom:20}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="#00D4FF"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.15)"}>
      <div style={{fontSize:40,marginBottom:12}}>📂</div>
      <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:6}}>{sr?"Klikni da odabereš CSV fajl":"Click to select CSV file"}</div>
      <div style={{color:C.mut,fontSize:13}}>{sr?"Export table data → CSV":"Export table data → CSV"}</div>
      <div style={{color:C.dim,fontSize:11,marginTop:8}}>.CSV</div>
    </div>}
    <input id="hcCsvUpload" type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={e=>handleCSV(e.target.files[0])}/>

    {csv&&<div style={{background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:12,padding:"14px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div><div style={{color:C.grn,fontWeight:700,fontSize:13}}>✅ {csvName}</div><div style={{color:C.mut,fontSize:11,marginTop:4}}>{sr?"CSV učitan":"CSV loaded"}</div></div>
      <button onClick={()=>{setCsv(null);setCsvName("");}} style={{background:"none",border:`1px solid ${C.brd}`,borderRadius:8,color:C.mut,fontSize:12,padding:"6px 12px",cursor:"pointer"}}>{sr?"Promeni":"Change"}</button>
    </div>}

    <Btn onClick={handleCSVAnalyze} disabled={!csv}>{sr?"Analiziraj CSV →":"Analyze CSV →"}</Btn>
  </div>;

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:24}}>{STEPS.map((s,i)=><div key={i} style={{flex:1}}><div style={{height:3,borderRadius:2,background:i<step?"#6366F1":i===step?"linear-gradient(90deg,#6366F1,#8B5CF6)":"rgba(255,255,255,0.08)",marginBottom:5}}/><div style={{fontSize:10,color:i<=step?C.mut:C.dim,fontWeight:600}}>{s}</div></div>)}</div>
    {step===0&&<><h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.hTitle}</h2><p style={{color:C.mut,fontSize:13,margin:"0 0 22px",lineHeight:1.6}}>{t.hSub}</p><Lbl c={t.hName}/><div style={{marginBottom:16}}><TIn v={f.name} ch={v=>set("name",v)} ph={t.hNamePh}/></div><Div l={t.hGoal}/><Pills opts={t.hGoals} val={f.goal} ch={v=>set("goal",v)}/><Div l={t.hPer}/><Pills opts={t.hPers} val={f.per} ch={v=>set("per",v)}/><Div l={t.hBudH}/><div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:4}}><div><Lbl c={t.hBud}/><NIn v={f.bud} ch={v=>set("bud",v)} ph={t.hBudPh} sx="€"/></div><div><Lbl c={t.hSp}/><NIn v={f.sp} ch={v=>set("sp",v)} ph={t.hSpPh} sx="€"/></div></div><BudBar/><div style={{marginTop:22}}><Btn onClick={()=>setSt(1)}>{t.nxt}</Btn></div></>}
    {step===1&&<><h2 style={{fontSize:20,fontWeight:800,margin:"0 0 18px"}}>{t.hMet}</h2><div style={{display:"flex",flexDirection:"column",gap:10}}>{MD.map(({k,l,h,ph,sx})=><div key={k} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:11,padding:"13px 15px"}}><div style={{marginBottom:9}}><span style={{color:C.txt,fontWeight:700,fontSize:13}}>{l}</span><span style={{color:C.dim,fontSize:11,marginLeft:8}}>{h}</span></div><NIn v={f[k]} ch={v=>set(k,v)} ph={ph} sx={sx}/></div>)}</div><div style={{display:"flex",gap:10,marginTop:22}}><div style={{flex:1}}><Btn onClick={()=>setSt(0)} sec>{t.prv}</Btn></div><div style={{flex:4}}><Btn onClick={()=>setSt(2)} disabled={fl<3}>{fl<3?t.hFill:`${t.s3} →`}</Btn></div></div></>}
    {step===2&&<><h2 style={{fontSize:20,fontWeight:800,margin:"0 0 18px"}}>{t.hTarg} & {t.hCr}</h2><Lbl c={t.hAudT}/><Pills opts={t.hAudTs} val={f.audT} ch={v=>set("audT",v)}/><Div l={t.hAudS}/><Pills opts={t.hAudSs} val={f.audS} ch={v=>set("audS",v)}/><Div l={t.hFreq}/><NIn v={f.freq} ch={v=>set("freq",v)} ph={t.hFreqPh} sx="x"/><Div l={t.hCrF}/><Pills opts={t.hCrFs} val={f.crFs} ch={v=>set("crFs",v)} multi={true}/><Div l={t.hCrA}/><Pills opts={t.hCrAs} val={f.crA} ch={v=>set("crA",v)}/><Div l={t.hCopy}/><Pills opts={t.hCopys} val={f.cpF} ch={v=>set("cpF",v)}/><div style={{display:"flex",gap:10,marginTop:24}}><div style={{flex:1}}><Btn onClick={()=>setSt(1)} sec>{t.prv}</Btn></div><div style={{flex:4}}><Btn onClick={handleAnalyze}>{t.analyze}</Btn></div></div></>}
  </div>;
}

// ── BUDGET PACING: POMOCNE FUNKCIJE ──────────────────────────────────────────
// Datumi se cuvaju kao "YYYY-MM-DD" (lokalni dan), racunanje dana ide preko UTC da letnje/zimsko vreme ne pravi gresku.
const bpISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const bpParse=s=>{const [y,m,d]=String(s).split("-").map(Number);return new Date(y,m-1,d);};
const bpDays=(a,b)=>{const A=bpParse(a),B=bpParse(b);return Math.round((Date.UTC(B.getFullYear(),B.getMonth(),B.getDate())-Date.UTC(A.getFullYear(),A.getMonth(),A.getDate()))/86400000);};
const bpAddDays=(s,n)=>{const d=bpParse(s);d.setDate(d.getDate()+n);return bpISO(d);};
const bpToday=()=>bpISO(new Date());
const bpMonthRange=(y,m)=>({from:bpISO(new Date(y,m,1)),to:bpISO(new Date(y,m+1,0))});
const BP_UNDER=-0.20; // vise od 20% ispod ocekivanog = underspend (kao u internom Excelu)
const BP_PLATFORMS=[{k:"meta",l:"Meta"},{k:"google_ads",l:"Google Ads"},{k:"tiktok",l:"TikTok"},{k:"other",l:"Other"}];
const BP_CURRENCIES=["EUR","RSD","USD","BAM","MKD","HUF","BGN","RON","CHF","GBP"];
const BP_ORDER={over:0,under:1,no_spend:2,no_entry:3,ok:4,early:5,not_started:6,finished:7};

// Racuna tempo jednog budzeta na osnovu poslednjeg unosa.
function bpCalc(b,today){
  const entries=b.budget_spend_entries||[];
  const last=entries.length?entries[entries.length-1]:null;
  const total=Number(b.total_budget)||0;
  const totalDays=bpDays(b.start_date,b.end_date)+1;
  const out={last,total,totalDays,spent:last?Number(last.spent)||0:null,expected:null,diff:null,diffPct:null,projPct:null,daily:null,remaining:null,stale:false,finPct:null};
  if(today<b.start_date) return {...out,status:"not_started"};
  if(!last) return {...out,status:"no_entry"};
  // Unos "zakljucno sa juce" pokriva potrosnju do dana pre unosa
  let ref=last.through_today?last.entry_date:bpAddDays(last.entry_date,-1);
  if(ref>b.end_date) ref=b.end_date;
  const elapsed=Math.max(0,Math.min(totalDays,bpDays(b.start_date,ref)+1));
  const spent=out.spent;
  const expected=total*elapsed/totalDays;
  const remaining=total-spent;
  const remDays=totalDays-elapsed;
  const res={...out,elapsed,expected,remaining,
    diff:spent-expected,
    diffPct:expected>0?(spent-expected)/expected:null,
    projPct:expected>0?spent/expected:null,
    daily:remDays>0?Math.max(remaining,0)/remDays:null,
    stale:b.auto?!!b.auto.stale:(last.entry_date<today&&today<=b.end_date)};
  if(today>b.end_date) return {...res,status:"finished",finPct:total>0?spent/total:null};
  if(spent===0&&elapsed>0) return {...res,status:"no_spend"};
  if(expected<=0) return {...res,status:"early"};
  if(res.diffPct>0) return {...res,status:"over"};
  if(res.diffPct<BP_UNDER) return {...res,status:"under"};
  return {...res,status:"ok"};
}

function bpStatusMeta(status,sr,calc){
  const pct=v=>v==null?"":` ${(v*100).toFixed(0)}%`;
  const m={
    over:{c:C.red,l:sr?"Overspend – smanji potrošnju":"Overspend – reduce spend"},
    under:{c:C.yel,l:sr?"Underspend – povećaj potrošnju":"Underspend – increase spend"},
    no_spend:{c:C.red,l:sr?"Nema potrošnje – proveri":"No spend – check it"},
    no_entry:{c:C.mut,l:sr?"Nema unosa":"No entry yet"},
    ok:{c:C.grn,l:sr?"Na tempu":"On pace"},
    early:{c:C.acl,l:sr?"Prvi dan":"First day"},
    not_started:{c:C.dim,l:sr?"Nije počelo":"Not started"},
    finished:{c:C.acl,l:(sr?"Završeno":"Completed")+pct(calc&&calc.finPct)},
  };
  return m[status]||{c:C.mut,l:status};
}

// Kratak pregled za zivu karticu na pocetnom ekranu
function bpSummary(budgets,today){
  const cnt={};
  budgets.forEach(b=>{const s=bpCalc(b,today).status;cnt[s]=(cnt[s]||0)+1;});
  return cnt;
}

const bpPct=v=>v==null?"–":`${(v*100).toFixed(1)}%`;
const bpInp={padding:"10px 12px",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:9,color:C.txt,fontSize:14,outline:"none",boxSizing:"border-box",width:"100%"};
const bpBtn=(primary)=>({padding:"10px 14px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",border:primary?"none":`1px solid ${C.brd}`,background:primary?"linear-gradient(135deg,#10B981,#059669)":"rgba(255,255,255,0.05)",color:"#fff",whiteSpace:"nowrap"});

// Grafikon tempa: idealna linija naspram stvarnih unosa
function BpChart({b,sr}){
  const calcTotalDays=bpDays(b.start_date,b.end_date)+1;
  const total=Number(b.total_budget)||0;
  const entries=b.budget_spend_entries||[];
  const W=600,H=170,P=28;
  const maxY=Math.max(total,...entries.map(e=>Number(e.spent)||0))*1.08||1;
  const x=d=>P+(d/calcTotalDays)*(W-P*2);
  const y=v=>H-P-(v/maxY)*(H-P*2);
  const pts=entries.map(e=>{
    let ref=e.through_today?e.entry_date:bpAddDays(e.entry_date,-1);
    if(ref>b.end_date) ref=b.end_date;
    const el=Math.max(0,Math.min(calcTotalDays,bpDays(b.start_date,ref)+1));
    return [x(el),y(Number(e.spent)||0)];
  });
  return <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${C.brd}`,borderRadius:10,padding:"10px 8px 6px",marginTop:10}}>
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}} role="img" aria-label={sr?"Grafikon tempa potrošnje":"Spend pace chart"}>
      <line x1={P} y1={H-P} x2={W-P} y2={H-P} stroke="rgba(255,255,255,0.15)"/>
      <line x1={x(0)} y1={y(0)} x2={x(calcTotalDays)} y2={y(total)} stroke="rgba(255,255,255,0.35)" strokeDasharray="5 5"/>
      {pts.length>1&&<polyline points={pts.map(p=>p.join(",")).join(" ")} fill="none" stroke="#10B981" strokeWidth="2.5"/>}
      {pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#10B981"/>)}
      <text x={P} y={H-8} fill="rgba(255,255,255,0.4)" fontSize="11">{b.start_date.slice(8)}.{b.start_date.slice(5,7)}.</text>
      <text x={W-P} y={H-8} fill="rgba(255,255,255,0.4)" fontSize="11" textAnchor="end">{b.end_date.slice(8)}.{b.end_date.slice(5,7)}.</text>
    </svg>
    <div style={{display:"flex",gap:14,fontSize:11,color:C.mut,padding:"2px 8px 0"}}>
      <span>- - {sr?"idealan tempo":"ideal pace"}</span>
      <span style={{color:"#10B981"}}>● {sr?"stvarna potrošnja":"actual spend"}</span>
    </div>
  </div>;
}

// ── MODULE 2: BUDGET PACING ──────────────────────────────────────────────────
function BudgetPacingMod({t,lang}){
  useEffect(()=>{ pmAnimReset("bp:"); },[]); // pri svakom ulasku u modul brojevi se odbrojavaju od 0
  const sr=lang==="sr";
  const mob=useIsMobile();
  const now=new Date();
  const [ym,setYm]=useState({y:now.getFullYear(),m:now.getMonth()});
  const [budgets,setBudgets]=useState([]);
  const [loading,setLoading]=useState(true);
  const [loadErr,setLoadErr]=useState("");
  const [clients,setClients]=useState([]);
  const [clientsLoading,setClientsLoading]=useState(true);
  const [inputs,setInputs]=useState({});
  const [throughToday,setThroughToday]=useState(false);
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState(null);
  const [filter,setFilter]=useState("all");
  const [platTab,setPlatTab]=useState(()=>{ try{ return localStorage.getItem("mat_bp_platform")||"all"; }catch(e){ return "all"; } });
  const [expanded,setExpanded]=useState(null);
  const [form,setForm]=useState(null); // null | {mode:"new"} | {mode:"edit",b} | {mode:"period"}
  const today=bpToday();
  const range=bpMonthRange(ym.y,ym.m);
  const monthLabel=new Date(ym.y,ym.m,1).toLocaleDateString(sr?"sr-Latn-RS":"en-GB",{month:"long",year:"numeric"});

  const loadBudgets=async()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setBudgets([]); setLoading(false); return; }
    setLoading(true); setLoadErr("");
    try{
      const r=await fetch(`/api/budgets?user_id=${uid}&from=${range.from}&to=${range.to}`);
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"error");
      setBudgets(Array.isArray(d)?d:[]);
    }catch(e){
      setLoadErr(sr?"Budžeti nisu učitani. Osveži stranicu i pokušaj ponovo.":"Budgets could not be loaded. Refresh the page and try again.");
      setBudgets([]);
    }
    setLoading(false);
  };
  useEffect(()=>{ loadBudgets(); },[ym.y,ym.m]);

  const loadClients=()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setClientsLoading(false); return; }
    fetch(`/api/clients?user_id=${uid}`).then(r=>r.json()).then(d=>setClients(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setClientsLoading(false));
  };
  useEffect(()=>{ loadClients(); },[]);

  const shiftMonth=delta=>{
    const hasPending=Object.values(inputs).some(v=>String(v).trim()!=="");
    if(hasPending&&!window.confirm(sr?"Imaš nesačuvane unose potrošnje. Preći na drugi mesec bez čuvanja?":"You have unsaved spend entries. Switch month without saving?")) return;
    setInputs({}); setExpanded(null); setFilter("all"); setYm(p=>{const d=new Date(p.y,p.m+delta,1);return {y:d.getFullYear(),m:d.getMonth()};}); };

  const rows=budgets.map(b=>({b,calc:bpCalc(b,today)}))
    .sort((a,z)=>(BP_ORDER[a.calc.status]-BP_ORDER[z.calc.status])||String(a.b.clients?.name||"").localeCompare(String(z.b.clients?.name||"")));
  // Platforme koje postoje u ovom mesecu; izabrana kartica se pamti na ovom racunaru
  const platCounts={}; rows.forEach(r=>{platCounts[r.b.platform]=(platCounts[r.b.platform]||0)+1;});
  const platList=BP_PLATFORMS.filter(p=>platCounts[p.k]);
  const tab=platTab!=="all"&&platCounts[platTab]?platTab:"all";
  const chooseTab=k=>{ setPlatTab(k); setFilter("all"); try{ localStorage.setItem("mat_bp_platform",k); }catch(e){} };
  const platName=k=>{const p=BP_PLATFORMS.find(x=>x.k===k);return p?(p.k==="other"?(sr?"Ostalo":"Other"):p.l):k;};
  const rowsP=tab==="all"?rows:rows.filter(r=>r.b.platform===tab);
  const counts={}; rowsP.forEach(r=>{counts[r.calc.status]=(counts[r.calc.status]||0)+1;});
  const shown=filter==="all"?rowsP:rowsP.filter(r=>r.calc.status===filter);
  // U prikazu "Sve" lista se deli naslovima po platformi (samo ako ima vise platformi)
  const groups=tab==="all"&&platList.length>1
    ?platList.map(p=>({k:p.k,title:platName(p.k),items:shown.filter(r=>r.b.platform===p.k)})).filter(g=>g.items.length)
    :[{k:"one",title:null,items:shown}];
  const pending=Object.entries(inputs).filter(([,v])=>String(v).trim()!=="");
  const canEnter=b=>today>=b.start_date&&!b.auto;

  const saveEntries=async()=>{
    const uid=await getOrCreateUser();
    const entries=[];
    for(const [id,v] of pending){
      const n=Number(String(v).replace(/\s/g,"").replace(",","."));
      if(!isFinite(n)||n<0){ setMsg({err:true,t:sr?"Proveri unete iznose – dozvoljeni su samo brojevi 0 ili veći.":"Check the amounts – only numbers 0 or higher are allowed."}); return; }
      entries.push({budget_id:Number(id),spent:n,entry_date:today,through_today:throughToday});
    }
    if(!entries.length) return;
    setSaving(true); setMsg(null);
    try{
      const r=await fetch("/api/budgets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:uid,action:"entries",entries})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||"error");
      setInputs({});
      setMsg({err:false,t:sr?`Sačuvano: ${entries.length}`:`Saved: ${entries.length}`});
      await loadBudgets();
    }catch(e){
      setMsg({err:true,t:sr?"Unosi nisu sačuvani. Pokušaj ponovo.":"Entries were not saved. Please try again."});
    }
    setSaving(false);
  };

  const deleteBudget=async b=>{
    if(!window.confirm(sr?`Obrisati budžet za ${b.clients?.name||""}? Brišu se i svi unosi potrošnje.`:`Delete the budget for ${b.clients?.name||""}? All spend entries will be deleted too.`)) return;
    const uid=localStorage.getItem("mat_user_id");
    try{
      const r=await fetch(`/api/budgets?id=${b.id}&user_id=${uid}`,{method:"DELETE"});
      if(!r.ok) throw new Error();
      setForm(null); await loadBudgets();
    }catch(e){ alert(sr?"Budžet nije obrisan. Pokušaj ponovo.":"Budget was not deleted. Please try again."); }
  };

  const filters=[["all",sr?"Svi":"All",rowsP.length],["over","Overspend",counts.over||0],["under","Underspend",counts.under||0],["no_spend",sr?"Bez potrošnje":"No spend",counts.no_spend||0],["no_entry",sr?"Bez unosa":"No entry",counts.no_entry||0],["ok",sr?"Na tempu":"On pace",counts.ok||0],["finished",sr?"Završeni":"Completed",counts.finished||0]].filter(f=>f[0]==="all"||f[2]>0);

  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>💰 Budget Pacing</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 18px"}}>{t.m2s}</p>

    {/* Mesec i akcije */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={()=>shiftMonth(-1)} style={bpBtn(false)} aria-label={sr?"Prethodni mesec":"Previous month"}>←</button>
        <div style={{fontWeight:800,fontSize:15,minWidth:mob?120:150,textAlign:"center",textTransform:"capitalize"}}>{monthLabel}</div>
        <button onClick={()=>shiftMonth(1)} style={bpBtn(false)} aria-label={sr?"Sledeći mesec":"Next month"}>→</button>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>setForm({mode:"period"})} style={bpBtn(false)}>{sr?"Novi period":"New period"}</button>
        <button onClick={()=>setForm({mode:"new"})} style={bpBtn(true)}>+ {sr?"Novi budžet":"New budget"}</button>
      </div>
    </div>

    {form&&<BpForm form={form} sr={sr} mob={mob} clients={clients} setClients={setClients} clientsLoading={clientsLoading} range={range} ym={ym}
      onClose={()=>setForm(null)} onSaved={async()=>{setForm(null);await loadBudgets();}} onDelete={deleteBudget}/>}

    {/* Kartice po platformi */}
    {!loading&&platList.length>1&&<div role="tablist" style={{display:"flex",gap:4,flexWrap:"wrap",borderBottom:`1px solid ${C.brd}`,marginBottom:12}}>
      {[{k:"all",l:sr?"Sve":"All",n:rows.length},...platList.map(p=>({k:p.k,l:platName(p.k),n:platCounts[p.k]}))].map(x=><button key={x.k} role="tab" aria-selected={tab===x.k} onClick={()=>chooseTab(x.k)} style={{padding:"9px 14px",fontSize:13,fontWeight:700,cursor:"pointer",background:"transparent",border:"none",borderBottom:tab===x.k?"2px solid #10B981":"2px solid transparent",color:tab===x.k?"#fff":C.mut,marginBottom:-1}}>{x.l} <span style={{color:C.dim,fontWeight:600}}>{x.n}</span></button>)}
    </div>}

    {/* Filteri po statusu */}
    {!loading&&rows.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
      {filters.map(([k,l,n])=><button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:filter===k?`1px solid #10B981`:`1px solid ${C.brd}`,background:filter===k?"rgba(16,185,129,0.15)":"transparent",color:filter===k?"#fff":C.mut}}>{l} · {n}</button>)}
    </div>}

    {/* Unos potrosnje */}
    {!loading&&rows.some(r=>canEnter(r.b))&&<div style={{background:"rgba(16,185,129,0.06)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:12,padding:"12px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{color:C.mut,fontSize:12}}>{sr?"Potrošnja zaključno sa:":"Spend up to and including:"}</span>
        {[[false,sr?"Juče":"Yesterday"],[true,sr?"Danas":"Today"]].map(([v,l])=><button key={l} onClick={()=>setThroughToday(v)} style={{padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",background:throughToday===v?"rgba(16,185,129,0.35)":"rgba(255,255,255,0.07)",color:throughToday===v?"#fff":C.mut}}>{l}</button>)}
      </div>
      <button onClick={saveEntries} disabled={saving||!pending.length} style={{...bpBtn(true),opacity:saving||!pending.length?0.45:1,cursor:saving||!pending.length?"not-allowed":"pointer"}}>
        {saving?(sr?"Čuvam...":"Saving..."):(sr?`Sačuvaj unose${pending.length?` (${pending.length})`:""}`:`Save entries${pending.length?` (${pending.length})`:""}`)}
      </button>
    </div>}
    {msg&&<div style={{color:msg.err?C.red:C.grn,fontSize:13,margin:"-6px 0 12px"}}>{msg.t}</div>}

    {loading&&<div aria-busy="true" aria-label={sr?"Učitavam budžete":"Loading budgets"}>{[0,1,2].map(i=><div key={i} style={{background:C.sur,border:`1px solid ${C.brd}`,borderLeft:"3px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"12px 14px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10}}><div style={{flex:1}}><Sk w="35%" h={13} style={{marginBottom:8}}/><Sk w="55%" h={10}/></div><Sk w={70} h={12}/></div>
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(5,1fr)",gap:8,marginTop:12}}>{[0,1,2,3,4].map(j=><div key={j}><Sk w="60%" h={8} style={{marginBottom:6}}/><Sk w="80%" h={12}/></div>)}</div>
    </div>)}</div>}
    {!loading&&loadErr&&<div style={{color:C.red,fontSize:13,marginBottom:12}}>{loadErr}</div>}
    {!loading&&!loadErr&&rows.length===0&&<div style={{textAlign:"center",padding:"32px 12px",background:"rgba(255,255,255,0.02)",border:`1px solid ${C.brd}`,borderRadius:12}}>
      <div style={{fontSize:34,marginBottom:10}}>💰</div>
      <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>{sr?"Nema budžeta za ovaj mesec":"No budgets for this month"}</div>
      <div style={{color:C.mut,fontSize:13}}>{sr?"Klikni \"+ Novi budžet\" ili \"Novi period\" da dodaš budžete klijenata.":"Click \"+ New budget\" or \"New period\" to add client budgets."}</div>
    </div>}

    {!loading&&rows.length>0&&shown.length===0&&<div style={{color:C.mut,fontSize:13,padding:"12px 0"}}>{sr?"Nema budžeta za ovaj filter.":"No budgets for this filter."}</div>}
    {!loading&&groups.map(g=><div key={g.k}>
      {g.title&&<div style={{fontSize:11,fontWeight:700,letterSpacing:"1.2px",textTransform:"uppercase",color:C.mut,margin:"16px 0 8px"}}>{g.title} · {g.items.length}</div>}
      {g.items.map(({b,calc})=>{
      const sm=bpStatusMeta(calc.status,sr,calc);
      const cur=b.currency||"EUR";
      const plat=BP_PLATFORMS.find(p=>p.k===b.platform);
      const open=expanded===b.id;
      return <div key={b.id} className="pm-in" style={{background:C.sur,border:`1px solid ${C.brd}`,borderLeft:`3px solid ${sm.c}`,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14}}>{b.clients?.name||"—"}{tab==="all"&&platList.length<=1&&<span style={{color:C.mut,fontWeight:500,fontSize:12}}> · {plat?(plat.k==="other"?(sr?"Ostalo":"Other"):plat.l):b.platform}</span>}</div>
            <div style={{color:C.mut,fontSize:12,marginTop:2}}>{bpParse(b.start_date).toLocaleDateString(sr?"sr-RS":"en-GB")} – {bpParse(b.end_date).toLocaleDateString(sr?"sr-RS":"en-GB")} · {sr?"budžet":"budget"} {fmtMoney(b.total_budget,cur)}{b.note?` · ${b.note}`:""}</div>
          </div>
          <div style={{color:sm.c,fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{sm.l}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(5,1fr)",gap:8,marginTop:10}}>
          {[
            [sr?"Potrošeno":"Spent",calc.spent==null?"–":<AnimNum k={`bp:${b.id}:spent`} value={calc.spent} format={v=>fmtMoney(v,cur)}/>],
            [sr?"Očekivano":"Expected",calc.expected==null?"–":fmtMoney(calc.expected,cur)],
            [sr?"Razlika":"Difference",calc.diffPct==null?"–":`${calc.diff>=0?"+":""}${fmtMoney(calc.diff,cur)} (${calc.diffPct>=0?"+":""}${(calc.diffPct*100).toFixed(1)}%)`],
            [sr?"Tempo":"Pace",bpPct(calc.projPct)],
            [sr?"Dnevno potrebno":"Daily needed",calc.daily==null?"–":fmtMoney(calc.daily,cur)],
          ].map(([l,v])=><div key={l}><div style={{color:C.dim,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.6px"}}>{l}</div><div style={{fontSize:13,fontWeight:600,marginTop:2}}>{v}</div></div>)}
        </div>
        {b.auto&&<div style={{color:"#10B981",fontSize:11,marginTop:8,fontWeight:600}}>⚡ {sr?"Automatski iz Google Ads":"Automatic from Google Ads"} · {sr?"podaci zaključno sa":"data up to"} {bpParse(b.auto.data_through).toLocaleDateString(sr?"sr-RS":"en-GB")}{b.campaign_filter?` · ${sr?"kampanje koje sadrže":"campaigns containing"} "${b.campaign_filter}"`:""}</div>}
        {b.auto&&b.auto.stale&&<div style={{color:C.yel,fontSize:11,marginTop:4}}>{sr?"Google Ads podaci nisu osveženi od tada. Veza je verovatno istekla – u Clients otkači i ponovo poveži Google Ads.":"Google Ads data hasn't refreshed since then. The connection has probably expired – in Clients, disconnect and reconnect Google Ads."}</div>}
        {b.auto&&!b.auto.fx_ok&&<div style={{color:C.yel,fontSize:11,marginTop:4}}>{sr?"Kurs za konverziju valute trenutno nije dostupan – iznosi su prikazani bez konverzije.":"The exchange rate is currently unavailable – amounts are shown without conversion."}</div>}
        {b.auto&&b.auto.overlap&&<div style={{color:C.yel,fontSize:11,marginTop:4}}>{sr?"Ovaj budžet se preklapa sa drugim Google Ads budžetom istog klijenta – ista potrošnja se možda broji dvaput. Proveri filtere kampanja.":"This budget overlaps another Google Ads budget of the same client – the same spend may be counted twice. Check the campaign filters."}</div>}
        {b.auto_error&&<div style={{color:C.yel,fontSize:11,marginTop:8}}>{sr?"Automatski Google Ads podaci trenutno nisu dostupni. Pokušaj ponovo kasnije.":"Automatic Google Ads data is currently unavailable. Try again later."}</div>}
        {!b.auto&&calc.stale&&calc.last&&<div style={{color:C.yel,fontSize:11,marginTop:8}}>{sr?`Poslednji unos: ${bpParse(calc.last.entry_date).toLocaleDateString("sr-RS")} – unesi današnje stanje.`:`Last entry: ${bpParse(calc.last.entry_date).toLocaleDateString("en-GB")} – enter today's figure.`}</div>}
        <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
          {canEnter(b)&&<input type="text" inputMode="decimal" value={inputs[b.id]||""} onChange={e=>setInputs(p=>({...p,[b.id]:e.target.value}))}
            placeholder={(sr?"Potrošeno do sada":"Spent so far")+(calc.spent!=null?` (${sr?"poslednje":"last"}: ${fmtMoney(calc.spent,cur)})`:"")}
            aria-label={sr?"Potrošeno do sada":"Spent so far"}
            style={{...bpInp,flex:"1 1 200px",width:"auto"}}/>}
          <button onClick={()=>setExpanded(open?null:b.id)} style={bpBtn(false)}>{open?(sr?"Sakrij grafikon":"Hide chart"):(sr?"Grafikon":"Chart")}</button>
          <button onClick={()=>setForm({mode:"edit",b})} style={bpBtn(false)}>{sr?"Izmeni":"Edit"}</button>
        </div>
        {open&&<BpChart b={b} sr={sr}/>}
      </div>;
    })}
    </div>)}

    {/* Traka za cuvanje uvek vidljiva na dnu dok ima nesacuvanih unosa */}
    {!loading&&pending.length>0&&<div style={{position:"sticky",bottom:0,zIndex:50,marginTop:12,paddingBottom:"env(safe-area-inset-bottom, 0px)"}}>
      <div style={{background:"#0d1f18",border:"1px solid rgba(16,185,129,0.45)",borderRadius:12,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",boxShadow:"0 -6px 24px rgba(0,0,0,0.45)"}}>
        <div style={{fontSize:13,color:"#fff",fontWeight:600}}>
          {sr?`Nesačuvano: ${pending.length}`:`Unsaved: ${pending.length}`}
          <span style={{color:C.mut,fontWeight:500}}> · {sr?"zaključno sa":"up to"} {throughToday?(sr?"danas":"today"):(sr?"juče":"yesterday")}</span>
        </div>
        <button onClick={saveEntries} disabled={saving} style={{...bpBtn(true),opacity:saving?0.5:1}}>{saving?(sr?"Čuvam...":"Saving..."):(sr?"Sačuvaj unose":"Save entries")}</button>
      </div>
    </div>}
  </div>;
}

// Forma: novi budzet, izmena budzeta ili "Novi period" (lista klijenata iz prethodnog meseca, bez iznosa)
function BpForm({form,sr,mob,clients,setClients,clientsLoading,range,ym,onClose,onSaved,onDelete}){
  const edit=form.mode==="edit"?form.b:null;
  const [clientId,setClientId]=useState(edit?String(edit.client_id):"");
  const [platform,setPlatform]=useState(edit?edit.platform:"meta");
  const [start,setStart]=useState(edit?edit.start_date:range.from);
  const [end,setEnd]=useState(edit?edit.end_date:range.to);
  const [amount,setAmount]=useState(edit?String(edit.total_budget):"");
  const [currency,setCurrency]=useState(edit?edit.currency:"EUR");
  const [note,setNote]=useState(edit?(edit.note||""):"");
  const [campFilter,setCampFilter]=useState(edit?(edit.campaign_filter||""):"");
  const [newName,setNewName]=useState("");
  const [creatingClient,setCreatingClient]=useState(false);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  // Novi period
  const [prevRows,setPrevRows]=useState(null);
  const [prevAmounts,setPrevAmounts]=useState({});

  useEffect(()=>{
    if(form.mode!=="period") return;
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setPrevRows([]); return; }
    const pr=bpMonthRange(ym.m===0?ym.y-1:ym.y,ym.m===0?11:ym.m-1);
    fetch(`/api/budgets?user_id=${uid}&from=${pr.from}&to=${pr.to}`).then(r=>r.json()).then(d=>{
      const seen=new Set(); const list=[];
      (Array.isArray(d)?d:[]).forEach(b=>{const k=`${b.client_id}|${b.platform}|${b.campaign_filter||""}`; if(!seen.has(k)){seen.add(k);list.push({key:k,client_id:b.client_id,name:b.clients?.name||"—",platform:b.platform,currency:b.currency||"EUR",campaign_filter:b.campaign_filter||""});}});
      list.sort((a,z)=>a.name.localeCompare(z.name));
      setPrevRows(list);
    }).catch(()=>setPrevRows([]));
  },[form.mode]);

  const addClient=async()=>{
    if(!newName.trim()) return;
    setCreatingClient(true);
    try{
      const uid=await getOrCreateUser();
      const r=await fetch("/api/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:uid,name:newName.trim()})});
      const c=await r.json();
      if(r.ok&&c.id){
        setClients(p=>p.some(x=>String(x.id)===String(c.id))?p:[c,...p]);
        setClientId(String(c.id)); setNewName("");
      } else alert(sr?"Klijent nije sačuvan. Pokušaj ponovo.":"Client was not saved. Please try again.");
    }catch(e){ alert(sr?"Klijent nije sačuvan. Proveri internet vezu i pokušaj ponovo.":"Client was not saved. Check your connection and try again."); }
    setCreatingClient(false);
  };

  const num=v=>Number(String(v).replace(/\s/g,"").replace(",","."));

  const save=async()=>{
    setErr("");
    if(!start||!end||end<start){ setErr(sr?"Proveri datume – kraj ne može biti pre početka.":"Check the dates – the end can't be before the start."); return; }
    const uid=await getOrCreateUser();
    setSaving(true);
    try{
      if(form.mode==="period"){
        const list=(prevRows||[]).filter(r=>String(prevAmounts[r.key]||"").trim()!=="").map(r=>({client_id:r.client_id,platform:r.platform,start_date:start,end_date:end,total_budget:num(prevAmounts[r.key]),currency:r.currency,campaign_filter:r.campaign_filter}));
        if(!list.length){ setErr(sr?"Unesi iznos bar za jednog klijenta.":"Enter an amount for at least one client."); setSaving(false); return; }
        if(list.some(b=>!isFinite(b.total_budget)||b.total_budget<0)){ setErr(sr?"Iznosi moraju biti brojevi 0 ili veći.":"Amounts must be numbers 0 or higher."); setSaving(false); return; }
        const r=await fetch("/api/budgets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:uid,action:"create",budgets:list})});
        if(!r.ok) throw new Error();
      } else {
        const tb=num(amount);
        if(!clientId){ setErr(sr?"Izaberi klijenta.":"Choose a client."); setSaving(false); return; }
        if(!isFinite(tb)||tb<0||String(amount).trim()===""){ setErr(sr?"Unesi ispravan iznos budžeta.":"Enter a valid budget amount."); setSaving(false); return; }
        const body={client_id:Number(clientId),platform,start_date:start,end_date:end,total_budget:tb,currency,note,campaign_filter:platform==="google_ads"?campFilter:""};
        const r=edit
          ?await fetch(`/api/budgets?id=${edit.id}&user_id=${uid}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
          :await fetch("/api/budgets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:uid,action:"create",budgets:[body]})});
        if(!r.ok) throw new Error();
      }
      await onSaved();
    }catch(e){
      setErr(sr?"Nije sačuvano. Pokušaj ponovo.":"Not saved. Please try again.");
    }
    setSaving(false);
  };

  const title=form.mode==="edit"?(sr?"Izmeni budžet":"Edit budget"):form.mode==="period"?(sr?"Novi period":"New period"):(sr?"Novi budžet":"New budget");
  const L=({c})=><div style={{color:C.mut,fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",margin:"0 0 6px"}}>{c}</div>;
  const dates=<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
    <div><L c={sr?"Početak":"Start"}/><input type="date" value={start} onChange={e=>setStart(e.target.value)} style={bpInp}/></div>
    <div><L c={sr?"Kraj":"End"}/><input type="date" value={end} onChange={e=>setEnd(e.target.value)} style={bpInp}/></div>
  </div>;

  return <div style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:14,padding:"16px",marginBottom:16}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontWeight:800,fontSize:15}}>{title}</div>
      <button onClick={onClose} style={{...bpBtn(false),padding:"6px 10px"}} aria-label={sr?"Zatvori":"Close"}>✕</button>
    </div>

    {form.mode==="period"?<>
      <div style={{color:C.mut,fontSize:13,marginBottom:12}}>{sr?"Klijenti iz prethodnog meseca, bez iznosa. Upiši budžet za one koji nastavljaju – prazni se preskaču.":"Clients from the previous month, without amounts. Enter a budget for those who continue – empty ones are skipped."}</div>
      {dates}
      {prevRows===null&&<div style={{color:C.acl,fontSize:13}}>✦ {sr?"Učitavam...":"Loading..."}</div>}
      {prevRows&&prevRows.length===0&&<div style={{color:C.mut,fontSize:13,marginBottom:10}}>{sr?"U prethodnom mesecu nema budžeta. Koristi \"+ Novi budžet\".":"There are no budgets in the previous month. Use \"+ New budget\"."}</div>}
      {prevRows&&prevRows.map(r=>{const plat=BP_PLATFORMS.find(p=>p.k===r.platform);return <div key={r.key} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <div style={{flex:1,minWidth:0,fontSize:13}}>{r.name} <span style={{color:C.mut}}>· {plat?(plat.k==="other"?(sr?"Ostalo":"Other"):plat.l):r.platform}{r.campaign_filter?` · "${r.campaign_filter}"`:""}</span></div>
        <input type="text" inputMode="decimal" value={prevAmounts[r.key]||""} onChange={e=>setPrevAmounts(p=>({...p,[r.key]:e.target.value}))} placeholder={`${sr?"Budžet":"Budget"} (${r.currency})`} aria-label={`${r.name} ${sr?"budžet":"budget"}`} style={{...bpInp,width:mob?120:170}}/>
      </div>;})}
    </>:<>
      <L c={sr?"Klijent":"Client"}/>
      {clientsLoading?<div style={{color:C.acl,fontSize:13,marginBottom:12}}>✦ {sr?"Učitavam klijente...":"Loading clients..."}</div>:
        <select value={clientId} onChange={e=>setClientId(e.target.value)} disabled={!!edit} style={{...bpInp,marginBottom:8}}>
          <option value="" style={{background:"#13131f",color:"#e5e7eb"}}>{sr?"— izaberi klijenta —":"— choose a client —"}</option>
          {clients.map(c=><option key={c.id} value={String(c.id)} style={{background:"#13131f",color:"#e5e7eb"}}>{c.name}</option>)}
        </select>}
      {!edit&&<div style={{display:"flex",gap:8,marginBottom:12}}>
        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder={sr?"ili upiši ime novog klijenta":"or type a new client name"} style={{...bpInp,flex:1,width:"auto"}}/>
        <button onClick={addClient} disabled={creatingClient||!newName.trim()} style={{...bpBtn(false),opacity:creatingClient||!newName.trim()?0.5:1}}>{creatingClient?"...":(sr?"+ Novi klijent":"+ New client")}</button>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:12}}>
        <div><L c={sr?"Platforma":"Platform"}/>
          <select value={platform} onChange={e=>setPlatform(e.target.value)} style={bpInp}>
            {BP_PLATFORMS.map(p=><option key={p.k} value={p.k} style={{background:"#13131f",color:"#e5e7eb"}}>{p.k==="other"?(sr?"Ostalo":"Other"):p.l}</option>)}
          </select></div>
        <div><L c={sr?"Valuta":"Currency"}/>
          <select value={currency} onChange={e=>setCurrency(e.target.value)} style={bpInp}>
            {(BP_CURRENCIES.includes(currency)?BP_CURRENCIES:[currency,...BP_CURRENCIES]).map(c=><option key={c} value={c} style={{background:"#13131f",color:"#e5e7eb"}}>{c}</option>)}
          </select></div>
      </div>
      {dates}
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:12}}>
        <div><L c={sr?"Ukupan budžet":"Total budget"}/><input type="text" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={sr?"npr. 5000":"e.g. 5000"} style={bpInp}/></div>
        <div><L c={sr?"Napomena (opciono)":"Note (optional)"}/><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Always On" maxLength={200} style={bpInp}/></div>
      </div>
      {platform==="google_ads"&&<div style={{marginBottom:12}}>
        <L c={sr?"Samo kampanje čiji naziv sadrži (opciono)":"Only campaigns whose name contains (optional)"}/>
        <input value={campFilter} onChange={e=>setCampFilter(e.target.value)} placeholder={sr?"prazno = ceo nalog, npr. Search ili RS":"empty = whole account, e.g. Search or RS"} maxLength={100} style={bpInp}/>
        <div style={{color:C.mut,fontSize:11,marginTop:6,lineHeight:1.5}}>{sr?"Ako je klijent povezan sa Google Ads (u Clients), potrošnja se popunjava automatski svako jutro. Ako nije, unosi se ručno.":"If the client is connected to Google Ads (in Clients), spend is filled in automatically every morning. If not, it is entered manually."}</div>
      </div>}
    </>}

    {err&&<div style={{color:C.red,fontSize:13,marginBottom:10}}>{err}</div>}
    <div style={{display:"flex",gap:8,justifyContent:"space-between",flexWrap:"wrap"}}>
      <div>{edit&&<button onClick={()=>onDelete(edit)} style={{...bpBtn(false),color:C.red,borderColor:"rgba(248,113,113,0.3)"}}>{sr?"Obriši budžet":"Delete budget"}</button>}</div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onClose} style={bpBtn(false)}>{sr?"Otkaži":"Cancel"}</button>
        <button onClick={save} disabled={saving} style={{...bpBtn(true),opacity:saving?0.5:1}}>{saving?(sr?"Čuvam...":"Saving..."):(sr?"Sačuvaj":"Save")}</button>
      </div>
    </div>
  </div>;
}

// ── REPORT STUDIO: POMOCNE FUNKCIJE ──────────────────────────────────────────
const rsEsc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rsNum=(v,d=0)=>v==null||!isFinite(v)?"–":new Intl.NumberFormat("sr-RS",{minimumFractionDigits:d,maximumFractionDigits:d}).format(v);
const rsDate=(s,sr)=>bpParse(s).toLocaleDateString(sr?"sr-RS":"en-GB");
const rsDelta=(cur,prev)=>(prev==null||!isFinite(prev)||prev===0||cur==null||!isFinite(cur))?null:(cur-prev)/prev;
const rsSum=(arr,k)=>(arr||[]).reduce((s,x)=>s+(Number(x[k])||0),0);

// Glavni brojevi iz odgovora /api/campaigns (isti izvor kao Campaign Intelligence)
function rsTotals(d){
  if(!d) return null;
  const c=d.campaigns||[];
  const spend=Number(d.totalSpendEUR)||0, revenue=Number(d.totalRevenueEUR)||0;
  const purchases=rsSum(c,"conversions"), clicks=rsSum(c,"clicks"), impressions=rsSum(c,"impressions");
  return {spend,revenue,roas:spend>0?revenue/spend:null,purchases,clicks,impressions,
    cpc:clicks>0?spend/clicks:null,cpa:purchases>0?spend/purchases:null,ctr:impressions>0?clicks/impressions:null};
}

function rsPeriodRange(key,custom){
  const t=new Date(); const y=new Date(t); y.setDate(y.getDate()-1);
  const back=n=>{const s=new Date(y); s.setDate(s.getDate()-(n-1)); return {from:bpISO(s),to:bpISO(y)};};
  if(key==="7") return back(7);
  if(key==="30") return back(30);
  if(key==="90") return back(90);
  if(key==="month"){ const from=bpISO(new Date(t.getFullYear(),t.getMonth(),1)); return {from:from>bpISO(y)?bpISO(y):from,to:bpISO(y)}; }
  if(key==="lastmonth") return bpMonthRange(t.getMonth()===0?t.getFullYear()-1:t.getFullYear(),t.getMonth()===0?11:t.getMonth()-1);
  return {from:custom.from,to:custom.to};
}

// Grafikon: potrosnja po danu (stubici) i prihod po danu (linija)
function RsChart({daily,sr,forPrint}){
  if(!daily||!daily.length) return null;
  const W=640,H=200,P=34;
  const max=Math.max(1,...daily.map(d=>Math.max(d.spendEUR||0,d.revenueEUR||0)))*1.1;
  const n=daily.length, bw=Math.max(2,(W-P*2)/n*0.6);
  const x=i=>P+(i+0.5)*((W-P*2)/n);
  const y=v=>H-P-((v||0)/max)*(H-P*2);
  const axis=forPrint?"#d1d5db":"rgba(255,255,255,0.15)", lbl=forPrint?"#6b7280":"rgba(255,255,255,0.4)";
  const pts=daily.map((d,i)=>`${x(i)},${y(d.revenueEUR)}`).join(" ");
  const tick=[0,Math.floor((n-1)/2),n-1].filter((v,i,a)=>a.indexOf(v)===i);
  return <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}} role="img" aria-label={sr?"Potrošnja i prihod po danima":"Spend and revenue by day"}>
    <line x1={P} y1={H-P} x2={W-P} y2={H-P} stroke={axis}/>
    {daily.map((d,i)=><rect key={d.date} x={x(i)-bw/2} y={y(d.spendEUR)} width={bw} height={Math.max(0,H-P-y(d.spendEUR))} fill="#F59E0B" opacity="0.75"/>)}
    <polyline points={pts} fill="none" stroke="#10B981" strokeWidth="2.5"/>
    {tick.map(i=><text key={i} x={x(i)} y={H-12} fill={lbl} fontSize="11" textAnchor="middle">{daily[i].date.slice(8)}.{daily[i].date.slice(5,7)}.</text>)}
    <text x={P} y={16} fill={lbl} fontSize="11">{rsNum(max/1.1)} €</text>
  </svg>;
}

// ── REPORT STUDIO: PDF ───────────────────────────────────────────────────────
// PDF se pravi kao pravi dokument (pdfmake): tekst je pravi tekst (ostar, moze da se kopira i pretrazuje),
// tabele se same prelamaju na sledecu stranu. Grafikon se crta na canvas i ubacuje kao slika visoke rezolucije.
function rsChartPng(daily,sr){
  if(!daily||!daily.length) return "";
  const S=3, W=700, H=250, PL=62, PR=16, PT=16, PB=56;
  const cv=document.createElement("canvas"); cv.width=W*S; cv.height=H*S;
  const g=cv.getContext("2d"); g.scale(S,S);
  g.fillStyle="#ffffff"; g.fillRect(0,0,W,H);
  const max=Math.max(1,...daily.map(d=>Math.max(d.spendEUR||0,d.revenueEUR||0)));
  const nice=v=>{const p=Math.pow(10,Math.floor(Math.log10(v)));const n=v/p;return (n<=1?1:n<=2?2:n<=5?5:10)*p;};
  const top=nice(max);
  const n=daily.length, cw=(W-PL-PR)/n, bw=Math.max(2,Math.min(22,cw*0.6));
  const ch=H-PT-PB;
  const x=i=>PL+(i+0.5)*cw, y=v=>PT+ch*(1-(v||0)/top);
  g.font="11px Arial"; g.textBaseline="middle";
  for(let i=0;i<=4;i++){
    const v=top*i/4, yy=y(v);
    g.strokeStyle=i===0?"#9ca3af":"#e5e7eb"; g.lineWidth=1;
    g.beginPath(); g.moveTo(PL,yy); g.lineTo(W-PR,yy); g.stroke();
    g.fillStyle="#6b7280"; g.textAlign="right";
    g.fillText(new Intl.NumberFormat("sr-RS",{maximumFractionDigits:0}).format(v)+" €",PL-8,yy);
  }
  g.fillStyle="#F59E0B";
  daily.forEach((d,i)=>{const h=ch*((d.spendEUR||0)/top); g.fillRect(x(i)-bw/2,PT+ch-h,bw,h);});
  g.strokeStyle="#059669"; g.lineWidth=2.5; g.lineJoin="round"; g.beginPath();
  daily.forEach((d,i)=>{ if(i===0) g.moveTo(x(i),y(d.revenueEUR)); else g.lineTo(x(i),y(d.revenueEUR)); }); g.stroke();
  g.fillStyle="#059669"; if(n<=45) daily.forEach((d,i)=>{g.beginPath(); g.arc(x(i),y(d.revenueEUR),2.6,0,Math.PI*2); g.fill();});
  g.fillStyle="#6b7280"; g.textAlign="center"; g.textBaseline="top";
  const step=Math.max(1,Math.ceil(n/8));
  daily.forEach((d,i)=>{ if((i%step===0&&(n-1-i>=step*0.6))||i===n-1) g.fillText(`${d.date.slice(8)}.${d.date.slice(5,7)}.`,x(i),PT+ch+8); });
  // Legenda
  const ly=H-16; g.textAlign="left"; g.textBaseline="middle"; g.font="11px Arial";
  g.fillStyle="#F59E0B"; g.fillRect(PL,ly-5,10,10);
  g.fillStyle="#4b5563"; g.fillText(sr?"potrošnja":"spend",PL+16,ly);
  const lx=PL+16+g.measureText(sr?"potrošnja":"spend").width+24;
  g.strokeStyle="#059669"; g.lineWidth=2.5; g.beginPath(); g.moveTo(lx,ly); g.lineTo(lx+16,ly); g.stroke();
  g.fillStyle="#059669"; g.beginPath(); g.arc(lx+8,ly,2.6,0,Math.PI*2); g.fill();
  g.fillStyle="#4b5563"; g.fillText(sr?"prihod":"revenue",lx+22,ly);
  return cv.toDataURL("image/png");
}

// Ucitava pdfmake (i ugradjeni font Roboto sa nasim slovima) tek kad zatreba
let rsPdfMakePromise=null;
function rsLoadPdfMake(){
  if(window.pdfMake&&window.pdfMake.vfs) return Promise.resolve(window.pdfMake);
  if(rsPdfMakePromise) return rsPdfMakePromise;
  const load=src=>new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});
  rsPdfMakePromise=load("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js")
    .then(()=>load("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js"))
    .then(()=>{ if(!window.pdfMake||!window.pdfMake.vfs) throw new Error("pdfmake missing"); return window.pdfMake; })
    .catch(e=>{ rsPdfMakePromise=null; throw e; });
  return rsPdfMakePromise;
}

// Tekst sa **podebljanim** delovima -> niz za pdfmake
function rsRich(s){
  const parts=String(s).split(/\*\*(.+?)\*\*/g);
  return parts.map((p,i)=>i%2?{text:p,bold:true}:p).filter(p=>p!=="");
}

function rsPdfDoc({rep,kpis,camps,unattr,ai,sr,chartImg}){
  const pct=d=>`${d>0?"+":d<0?"−":""}${rsNum(Math.abs(d*100),1)}%`;
  const dcol=(d,good)=>d==null||good==null||Math.abs(d)<0.005?"#6b7280":((d>0)===(good>0)?"#059669":"#dc2626");
  const period=`${rsDate(rep.period.from,sr)} – ${rsDate(rep.period.to,sr)}`;
  const prevP=rep.prevPeriod?`${rsDate(rep.prevPeriod.from,sr)} – ${rsDate(rep.prevPeriod.to,sr)}`:"";
  const h2=t=>({text:t.toUpperCase(),style:"h2"});
  const kCell=x=>({stack:[
    {text:x.l.toUpperCase(),fontSize:7.5,bold:true,color:"#6b7280",characterSpacing:0.4},
    {text:x.v,fontSize:15,bold:true,color:"#111827",margin:[0,3,0,1]},
    {text:x.d!=null?`${pct(x.d)} ${sr?"vs prethodni":"vs previous"}`:" ",fontSize:8,bold:true,color:dcol(x.d,x.good)},
  ],fillColor:"#f8fafc",margin:[8,7,8,7]});
  const kRows=[];
  for(let i=0;i<kpis.length;i+=4){ const r=kpis.slice(i,i+4).map(kCell); while(r.length<4) r.push({text:""}); kRows.push(r); }

  // Zakljucak (Markdown -> pdfmake)
  const aiBlocks=[];
  if(ai){
    String(ai).split("\n").forEach(l=>{
      if(/^#{1,3} /.test(l)) aiBlocks.push({text:rsRich(l.replace(/^#{1,3} /,"")),bold:true,color:"#312e81",fontSize:10.5,margin:[0,aiBlocks.length?8:0,0,3]});
      else if(/^[-*] /.test(l)) aiBlocks.push({text:["•  ",...rsRich(l.slice(2))],margin:[4,0,0,2]});
      else if(/^\d+\. /.test(l)) aiBlocks.push({text:rsRich(l),margin:[4,0,0,2]});
      else if(l.trim()) aiBlocks.push({text:rsRich(l),margin:[0,0,0,4]});
    });
  }

  const head=[sr?"Kampanja":"Campaign",sr?"Potrošnja":"Spend",sr?"Prihod":"Revenue","ROAS",sr?"Kupovine":"Purchases"]
    .map((t,i)=>({text:t,bold:true,color:"#374151",fillColor:"#f3f4f6",alignment:i?"right":"left"}));
  const body=[head,...camps.map(c=>[
    {text:String(c.campaign_name||"")},
    {text:`${rsNum(c.spendEUR)} €`,alignment:"right"},
    {text:`${rsNum(c.revenueEUR)} €`,alignment:"right"},
    {text:c.spendEUR>0?rsNum(c.roas,2):"–",alignment:"right",bold:true,color:c.spendEUR>0?(c.roas>=1?"#059669":"#dc2626"):"#6b7280"},
    {text:rsNum(c.conversions),alignment:"right"},
  ])];

  const created=new Date().toLocaleDateString(sr?"sr-RS":"en-GB");
  const source=sr?"Izvor: Google Ads (potrošnja) i GA4 (prihod i kupovine)":"Source: Google Ads (spend) and GA4 (revenue and purchases)";

  return {
    pageSize:"A4",
    pageMargins:[36,36,36,46],
    info:{title:`${rep.client.name} – Google Ads`},
    defaultStyle:{font:"Roboto",fontSize:9.5,color:"#1f2937",lineHeight:1.2},
    styles:{h2:{fontSize:9.5,bold:true,color:"#4338ca",characterSpacing:0.8,margin:[0,16,0,7]}},
    footer:(cur,total)=>({columns:[
      {text:`${source} · ${sr?"Napravljeno":"Created"} ${created}`,fontSize:7.5,color:"#9ca3af"},
      {text:`${cur} / ${total}`,alignment:"right",fontSize:7.5,color:"#9ca3af",width:50},
    ],margin:[36,14,36,0]}),
    content:[
      {table:{widths:["*"],body:[[{stack:[
        {text:`GOOGLE ADS ${sr?"IZVEŠTAJ":"REPORT"}`,fontSize:8,bold:true,color:"#c7d2fe",characterSpacing:1.2},
        {text:rep.client.name,fontSize:19,bold:true,color:"#ffffff",margin:[0,3,0,4]},
        {text:`${period}${prevP?`  ·  ${sr?"poređenje sa":"compared to"} ${prevP}`:""}  ·  ${sr?"iznosi u EUR":"amounts in EUR"}`,fontSize:9,color:"#e0e7ff"},
      ],fillColor:"#1e1b4b",margin:[14,12,14,12]}]]},layout:"noBorders"},
      h2(sr?"Glavni pokazatelji":"Key metrics"),
      {table:{widths:["*","*","*","*"],body:kRows,dontBreakRows:true},
        layout:{hLineWidth:()=>5,vLineWidth:()=>5,hLineColor:()=>"#ffffff",vLineColor:()=>"#ffffff",paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0}},
      ...(chartImg?[h2(sr?"Potrošnja i prihod po danima":"Spend and revenue by day"),{image:chartImg,width:523}]:[]),
      ...(aiBlocks.length?[h2(sr?"Zaključak i preporuke":"Conclusion and recommendations"),
        {table:{widths:["*"],body:[[{stack:aiBlocks,fillColor:"#f5f7ff",margin:[10,8,10,6]}]]},
          layout:{hLineWidth:()=>0,vLineWidth:i=>i===0?3:0,vLineColor:()=>"#6366f1",paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0}}]:[]),
      h2(`${sr?"Kampanje":"Campaigns"} (${camps.length})`),
      {table:{headerRows:1,dontBreakRows:true,widths:["*",62,62,40,52],body},fontSize:8.5,
        layout:{hLineWidth:(i,node)=>i===0||i===node.table.body.length?0:0.5,vLineWidth:()=>0,hLineColor:()=>"#e5e7eb",
          fillColor:(i)=>i>0&&i%2===0?"#fafafa":null,paddingTop:()=>4,paddingBottom:()=>4}},
      ...(unattr&&unattr.revenueEUR>0?[{text:`${sr?"Prihod iz Google Ads kanala bez prepoznate kampanje":"Revenue from Google Ads channels without a recognized campaign"}: ${rsNum(unattr.revenueEUR)} €`,fontSize:8.5,color:"#6b7280",margin:[0,8,0,0]}]:[]),
    ],
  };
}

// ── REPORT STUDIO: UVOZ IZ SCREENSHOTA / FAJLA ──────────────────────────────
const RS_SOURCES=[{k:"meta",l:"Meta"},{k:"google_ads",l:"Google Ads"},{k:"ga4",l:"GA4"},{k:"looker",l:"Looker Studio"},{k:"other",l:"Other"}];
const rsSourceName=(k,sr)=>k==="other"?(sr?"Ostalo":"Other"):(RS_SOURCES.find(s=>s.k===k)||{l:k}).l;

// Smanjuje sliku (najvise 2000 px) i vraca base64 JPEG bez prefiksa, da zahtev ne bude prevelik
function rsImageToJpeg(dataUrl){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const max=2000, sc=Math.min(1,max/Math.max(img.width,img.height));
      const cv=document.createElement("canvas"); cv.width=Math.round(img.width*sc); cv.height=Math.round(img.height*sc);
      const g=cv.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,cv.width,cv.height); g.drawImage(img,0,0,cv.width,cv.height);
      resolve(cv.toDataURL("image/jpeg",0.88).split(",")[1]);
    };
    img.onerror=reject;
    img.src=dataUrl;
  });
}

// Markdown (naslovi, tacke, tabele, pasusi) -> pdfmake elementi
function rsMdToPdf(md){
  const out=[]; const lines=String(md||"").split("\n"); let i=0;
  const isSep=l=>/^\|?\s*:?-{2,}/.test(l.trim())&&/^[|:\-\s]+$/.test(l.trim());
  const cells=l=>l.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(c=>c.trim());
  while(i<lines.length){
    const l=lines[i];
    if(/^---+$/.test(l.trim())){i++;continue;}
    if(l.trim().startsWith("|")){
      const rows=[];
      while(i<lines.length&&lines[i].trim().startsWith("|")){ if(!isSep(lines[i])) rows.push(cells(lines[i])); i++; }
      if(rows.length){
        const n=Math.max(...rows.map(r=>r.length));
        const body=rows.map((r,ri)=>{const rr=[...r]; while(rr.length<n) rr.push(""); return rr.map((c,ci)=>({text:rsRich(c),bold:ri===0,color:ri===0?"#374151":"#1f2937",fillColor:ri===0?"#f3f4f6":(ri%2===0?"#fafafa":null),alignment:ci>0&&/^[\d\s.,%€$+\-−x]+( ?(din|RSD|EUR|USD|kom|pcs))?$/.test(c.replace(/\*\*/g,""))?"right":"left"}));});
        out.push({table:{headerRows:1,dontBreakRows:true,widths:Array(n).fill("*"),body},fontSize:8.5,
          layout:{hLineWidth:(k,node)=>k===0||k===node.table.body.length?0:0.5,vLineWidth:()=>0,hLineColor:()=>"#e5e7eb",paddingTop:()=>4,paddingBottom:()=>4},margin:[0,2,0,8]});
      }
      continue;
    }
    if(/^#{1,3} /.test(l)) out.push({text:rsRich(l.replace(/^#{1,3} /,"")).map(p=>typeof p==="string"?p:p.text),style:"h2"});
    else if(/^[-*] /.test(l)) out.push({text:["•  ",...rsRich(l.slice(2))],margin:[4,0,0,3]});
    else if(/^\d+\. /.test(l)) out.push({text:rsRich(l),margin:[4,0,0,3]});
    else if(l.trim()) out.push({text:rsRich(l),margin:[0,0,0,5]});
    i++;
  }
  return out;
}

function rsPdfDocMd({title,clientName,subtitle,md,sr}){
  const created=new Date().toLocaleDateString(sr?"sr-RS":"en-GB");
  return {
    pageSize:"A4", pageMargins:[36,36,36,46],
    info:{title:`${clientName} – ${title}`},
    defaultStyle:{font:"Roboto",fontSize:9.5,color:"#1f2937",lineHeight:1.2},
    styles:{h2:{fontSize:9.5,bold:true,color:"#4338ca",characterSpacing:0.8,margin:[0,14,0,6]}},
    footer:(cur,total)=>({columns:[
      {text:`${sr?"Napravljeno":"Created"} ${created}`,fontSize:7.5,color:"#9ca3af"},
      {text:`${cur} / ${total}`,alignment:"right",fontSize:7.5,color:"#9ca3af",width:50},
    ],margin:[36,14,36,0]}),
    content:[
      {table:{widths:["*"],body:[[{stack:[
        {text:title.toUpperCase(),fontSize:8,bold:true,color:"#c7d2fe",characterSpacing:1.2},
        {text:clientName,fontSize:19,bold:true,color:"#ffffff",margin:[0,3,0,4]},
        {text:subtitle,fontSize:9,color:"#e0e7ff"},
      ],fillColor:"#1e1b4b",margin:[14,12,14,12]}]]},layout:"noBorders"},
      ...rsMdToPdf(md),
    ],
  };
}

function RsImports({sr,lang,mob,clientId,clientName}){
  const [listKey,setListKey]=useState("30");
  const [listCustom,setListCustom]=useState(()=>rsPeriodRange("30",{}));
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(false);
  const [checked,setChecked]=useState({});
  const [expanded,setExpanded]=useState(null);
  const [compare,setCompare]=useState(false);
  // novi uvoz
  const [formOpen,setFormOpen]=useState(false);
  const [source,setSource]=useState("meta");
  const [pFrom,setPFrom]=useState("");
  const [pTo,setPTo]=useState("");
  const [file,setFile]=useState(null); // {kind:"image"|"csv", data, name, preview}
  const [analyzing,setAnalyzing]=useState(false);
  const [formErr,setFormErr]=useState("");
  const [drag,setDrag]=useState(false);
  // izvestaj
  const [report,setReport]=useState("");
  const [reportLoading,setReportLoading]=useState(false);
  const [reportMeta,setReportMeta]=useState(null);
  const [pdfBusy,setPdfBusy]=useState(false);
  const fileRef=useRef(null);

  const range=rsPeriodRange(listKey,listCustom);
  const load=async()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid||!clientId||!range.from||!range.to){ setItems([]); return; }
    setLoading(true);
    try{
      const r=await fetch(`/api/imports?user_id=${uid}&client_id=${clientId}&from=${range.from}&to=${range.to}`);
      const d=await r.json();
      setItems(r.ok&&Array.isArray(d)?d:[]);
    }catch(e){ setItems([]); }
    setChecked({}); setLoading(false);
  };
  useEffect(()=>{ load(); setReport(""); },[clientId,listKey,listCustom.from,listCustom.to]);

  const takeFile=async f=>{
    if(!f) return;
    setFormErr(""); setFormOpen(true);
    const isCsv=/\.csv$/i.test(f.name||"")||f.type==="text/csv";
    if(isCsv){
      const txt=await f.text();
      setFile({kind:"csv",data:txt.slice(0,50000),name:f.name||"data.csv",preview:null});
      return;
    }
    if(!(f.type||"").startsWith("image/")){ setFormErr(sr?"Podržani su slike (screenshot) i CSV fajlovi.":"Images (screenshots) and CSV files are supported."); return; }
    const dataUrl=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(f);});
    try{ const jpg=await rsImageToJpeg(dataUrl); setFile({kind:"image",data:jpg,name:f.name||"screenshot",preview:dataUrl}); }
    catch(e){ setFormErr(sr?"Slika nije mogla da se učita.":"The image could not be loaded."); }
  };

  // Ctrl+V bilo gde u ovom delu: ako je u clipboard-u slika, ona postaje novi uvoz
  useEffect(()=>{
    const h=e=>{
      const it=[...(e.clipboardData?.items||[])].find(x=>x.kind==="file"&&x.type.startsWith("image/"));
      if(!it) return;
      e.preventDefault();
      takeFile(it.getAsFile());
    };
    document.addEventListener("paste",h);
    return()=>document.removeEventListener("paste",h);
  },[]);

  const quick=k=>{ const r=rsPeriodRange(k,{}); setPFrom(r.from); setPTo(r.to); };

  const analyzeAndSave=async()=>{
    setFormErr("");
    if(!clientId){ setFormErr(sr?"Izaberi klijenta.":"Choose a client."); return; }
    if(!file){ setFormErr(sr?"Nalepi screenshot (Ctrl+V), prevuci fajl ili izaberi fajl.":"Paste a screenshot (Ctrl+V), drop a file or choose a file."); return; }
    if(!pFrom||!pTo||pTo<pFrom){ setFormErr(sr?"Unesi period od–do koji podaci pokrivaju (obavezno).":"Enter the from–to period the data covers (required)."); return; }
    const uid=await getOrCreateUser();
    setAnalyzing(true);
    const src=rsSourceName(source,sr);
    const what=file.kind==="image"?(sr?"Na slici je izveštaj":"The image shows a report"):(sr?"Ispod su CSV podaci izveštaja":"Below is report CSV data");
    const prompt=sr
      ?`Ti si iskusan analitičar digitalnog marketinga. ${what}. Izvor: ${src}. Period koji podaci pokrivaju: ${rsDate(pFrom,true)} – ${rsDate(pTo,true)}.\n\n1) Pročitaj podatke i prepiši ključne brojeve u Markdown tabelu (ukupno i po kampanjama/redovima, najviše 25 redova). Prepiši samo ono što stvarno piše, ništa ne izmišljaj i ne računaj metrike kojih nema.\n2) Napiši kratku analizu u 3–5 tačaka.\n\nOdgovori na srpskom (latinica), tačno u ovom formatu:\n## Podaci\n(tabela)\n## Brza analiza\n- ...\n\nAko podatke ne možeš da pročitaš, napiši to jasno u jednoj rečenici.`
      :`You are an experienced digital marketing analyst. ${what}. Source: ${src}. Period the data covers: ${rsDate(pFrom,false)} – ${rsDate(pTo,false)}.\n\n1) Read the data and copy the key figures into a Markdown table (totals and per campaign/row, at most 25 rows). Copy only what is actually shown, don't invent anything and don't calculate metrics that aren't there.\n2) Write a short analysis in 3–5 bullet points.\n\nAnswer in English, exactly in this format:\n## Data\n(table)\n## Quick analysis\n- ...\n\nIf you can't read the data, say so clearly in one sentence.`;
    const content=file.kind==="image"
      ?[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:file.data}},{type:"text",text:prompt}]
      :[{type:"text",text:`${prompt}\n\nCSV:\n${file.data}`}];
    try{
      const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,messages:[{role:"user",content}]})});
      const d=await res.json();
      const text=d.content?.[0]?.text||"";
      if(!res.ok||!text) throw new Error("analyze");
      const r=await fetch("/api/imports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:uid,client_id:Number(clientId),period_from:pFrom,period_to:pTo,source,analysis_text:text})});
      const saved=await r.json();
      if(!r.ok) throw new Error("save");
      setFile(null); setFormOpen(false);
      await load();
      if(saved&&saved.id) setExpanded(saved.id);
    }catch(e){
      setFormErr(sr?"Uvoz nije sačuvan. Pokušaj ponovo.":"The import was not saved. Please try again.");
    }
    setAnalyzing(false);
  };

  const remove=async it=>{
    if(!window.confirm(sr?"Obrisati ovaj uvoz?":"Delete this import?")) return;
    const uid=localStorage.getItem("mat_user_id");
    try{ const r=await fetch(`/api/imports?id=${it.id}&user_id=${uid}`,{method:"DELETE"}); if(!r.ok) throw new Error(); await load(); }
    catch(e){ alert(sr?"Uvoz nije obrisan. Pokušaj ponovo.":"The import was not deleted. Please try again."); }
  };

  const sel=items.filter(it=>checked[it.id]);
  const canCompare=sel.length===2;

  const makeReport=async()=>{
    if(!sel.length) return;
    setReportLoading(true); setReport("");
    const ordered=[...sel].sort((a,b)=>a.period_from<b.period_from?-1:1);
    const block=(it,label)=>`### ${label}${rsSourceName(it.metrics?.source,sr)} · ${rsDate(it.period_from,sr)} – ${rsDate(it.period_to,sr)}\n${it.analysis_text}`;
    const doCompare=compare&&canCompare;
    const data=doCompare
      ?`${block(ordered[0],sr?"Period A: ":"Period A: ")}\n\n${block(ordered[1],sr?"Period B: ":"Period B: ")}`
      :ordered.map(it=>block(it,"")).join("\n\n");
    const prompt=sr
      ?(doCompare
        ?`Ti si iskusan konsultant za digitalni marketing. Napravi profesionalan izveštaj za klijenta "${clientName}" koji poredi dva perioda. Koristi SAMO podatke ispod, ništa ne izmišljaj.\n\n${data}\n\nNapiši na srpskom (latinica), u Markdown formatu, sa delovima: "## Rezime" (2–3 rečenice), "## Poređenje ključnih brojeva" (tabela sa kolonama Metrika | Period A | Period B | Promena), "## Šta se poboljšalo", "## Šta se pogoršalo", "## Preporuke" (3–5 konkretnih koraka). Ne pominji da si AI.`
        :`Ti si iskusan konsultant za digitalni marketing. Napravi profesionalan izveštaj za klijenta "${clientName}" na osnovu podataka ispod. Koristi SAMO te podatke, ništa ne izmišljaj.\n\n${data}\n\nNapiši na srpskom (latinica), u Markdown formatu, sa delovima: "## Rezime" (2–3 rečenice), "## Ključni brojevi" (tabela), "## Šta ide dobro", "## Šta treba poboljšati", "## Preporuke" (3–5 konkretnih koraka). Ne pominji da si AI.`)
      :(doCompare
        ?`You are an experienced digital marketing consultant. Create a professional report for client "${clientName}" comparing two periods. Use ONLY the data below, don't invent anything.\n\n${data}\n\nWrite in English, in Markdown, with parts: "## Summary" (2–3 sentences), "## Key figures compared" (table with columns Metric | Period A | Period B | Change), "## What improved", "## What got worse", "## Recommendations" (3–5 concrete steps). Don't mention that you are an AI.`
        :`You are an experienced digital marketing consultant. Create a professional report for client "${clientName}" based on the data below. Use ONLY that data, don't invent anything.\n\n${data}\n\nWrite in English, in Markdown, with parts: "## Summary" (2–3 sentences), "## Key figures" (table), "## What's working", "## What needs improvement", "## Recommendations" (3–5 concrete steps). Don't mention that you are an AI.`);
    try{
      const txt=await callClaude(prompt,lang);
      setReport(txt||(sr?"Izveštaj nije napravljen. Pokušaj ponovo.":"The report could not be created. Please try again."));
      const from=ordered[0].period_from, to=ordered.reduce((m,it)=>it.period_to>m?it.period_to:m,ordered[0].period_to);
      const sources=[...new Set(ordered.map(it=>rsSourceName(it.metrics?.source,sr)))].join(", ");
      setReportMeta({from,to,sources,compare:doCompare,a:doCompare?ordered[0]:null,b:doCompare?ordered[1]:null});
    }catch(e){ setReport(sr?"Izveštaj nije napravljen. Pokušaj ponovo.":"The report could not be created. Please try again."); }
    setReportLoading(false);
  };

  const downloadPdf=async()=>{
    if(!report||!reportMeta||pdfBusy) return;
    setPdfBusy(true);
    const safe=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"dj").replace(/Đ/g,"Dj").replace(/[^A-Za-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
    const m=reportMeta;
    const subtitle=m.compare
      ?`${sr?"Period A":"Period A"}: ${rsDate(m.a.period_from,sr)} – ${rsDate(m.a.period_to,sr)}  ·  ${sr?"Period B":"Period B"}: ${rsDate(m.b.period_from,sr)} – ${rsDate(m.b.period_to,sr)}  ·  ${sr?"Izvor":"Source"}: ${m.sources}`
      :`${rsDate(m.from,sr)} – ${rsDate(m.to,sr)}  ·  ${sr?"Izvor":"Source"}: ${m.sources}`;
    try{
      const pm=await rsLoadPdfMake();
      pm.createPdf(rsPdfDocMd({title:sr?"Izveštaj":"Report",clientName:clientName||"",subtitle,md:report,sr})).download(`${safe(clientName)||"klijent"}_izvestaj_${m.from}_${m.to}.pdf`);
    }catch(e){ alert(sr?"PDF nije napravljen. Proveri internet vezu i pokušaj ponovo.":"The PDF could not be created. Check your connection and try again."); }
    setPdfBusy(false);
  };

  const L=({c})=><div style={{color:C.mut,fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",margin:"0 0 6px"}}>{c}</div>;
  const pill=(on)=>({padding:"7px 13px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:on?"1px solid #F59E0B":`1px solid ${C.brd}`,background:on?"rgba(245,158,11,0.15)":"transparent",color:on?"#fff":C.mut});

  if(!clientId) return <div style={{color:C.mut,fontSize:13,padding:"8px 0"}}>{sr?"Izaberi klijenta iznad.":"Choose a client above."}</div>;

  return <div>
    {/* Novi uvoz */}
    <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);takeFile(e.dataTransfer.files&&e.dataTransfer.files[0]);}}
      style={{background:drag?"rgba(245,158,11,0.1)":C.sur,border:drag?"2px dashed #F59E0B":`1px solid ${C.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
      {!formOpen?<div style={{textAlign:"center",padding:"10px 0"}}>
        <div style={{fontSize:28,marginBottom:6}}>📥</div>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{sr?"Nalepi screenshot (Ctrl+V) ili prevuci fajl ovde":"Paste a screenshot (Ctrl+V) or drop a file here"}</div>
        <div style={{color:C.mut,fontSize:12,marginBottom:12}}>{sr?"Screenshot iz Meta Ads Managera, Looker-a, GA4... ili CSV fajl":"A screenshot from Meta Ads Manager, Looker, GA4... or a CSV file"}</div>
        <button onClick={()=>fileRef.current&&fileRef.current.click()} style={bpBtn(false)}>{sr?"Izaberi fajl":"Choose file"}</button>
      </div>:<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:800,fontSize:15}}>{sr?"Novi uvoz":"New import"}</div>
          <button onClick={()=>{setFormOpen(false);setFile(null);setFormErr("");}} style={{...bpBtn(false),padding:"6px 10px"}} aria-label={sr?"Zatvori":"Close"}>✕</button>
        </div>
        {file?<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:10,padding:"8px"}}>
          {file.preview?<img src={file.preview} alt="" style={{width:90,height:60,objectFit:"cover",borderRadius:6}}/>:<div style={{fontSize:26,width:40,textAlign:"center"}}>📄</div>}
          <div style={{flex:1,minWidth:0,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</div>
          <button onClick={()=>fileRef.current&&fileRef.current.click()} style={bpBtn(false)}>{sr?"Zameni":"Replace"}</button>
        </div>:<div style={{color:C.mut,fontSize:13,marginBottom:12}}>{sr?"Nalepi screenshot (Ctrl+V), prevuci fajl ili":"Paste a screenshot (Ctrl+V), drop a file or"} <button onClick={()=>fileRef.current&&fileRef.current.click()} style={{...bpBtn(false),padding:"4px 10px"}}>{sr?"izaberi fajl":"choose a file"}</button></div>}
        <L c={sr?"Izvor podataka":"Data source"}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {RS_SOURCES.map(s=><button key={s.k} onClick={()=>setSource(s.k)} style={pill(source===s.k)}>{rsSourceName(s.k,sr)}</button>)}
        </div>
        <L c={sr?"Period koji podaci pokrivaju (obavezno)":"Period the data covers (required)"}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {[["7",sr?"Prošlih 7 dana":"Last 7 days"],["30",sr?"Prošlih 30 dana":"Last 30 days"],["month",sr?"Ovaj mesec":"This month"],["lastmonth",sr?"Prošli mesec":"Last month"]].map(([k,l])=><button key={k} onClick={()=>quick(k)} style={pill(false)}>{l}</button>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <input type="date" value={pFrom} onChange={e=>setPFrom(e.target.value)} style={bpInp} aria-label={sr?"Od":"From"}/>
          <input type="date" value={pTo} onChange={e=>setPTo(e.target.value)} style={bpInp} aria-label={sr?"Do":"To"}/>
        </div>
        {formErr&&<div style={{color:C.red,fontSize:13,marginBottom:10}}>{formErr}</div>}
        <button onClick={analyzeAndSave} disabled={analyzing} style={{padding:"11px 16px",borderRadius:11,fontSize:14,fontWeight:700,cursor:analyzing?"not-allowed":"pointer",border:"none",background:"linear-gradient(135deg,#F59E0B,#D97706)",color:"#fff",opacity:analyzing?0.6:1}}>
          {analyzing?(sr?"Analiziram i čuvam...":"Analyzing and saving..."):(sr?"Analiziraj i sačuvaj":"Analyze and save")}
        </button>
      </div>}
      {!formOpen&&formErr&&<div style={{color:C.red,fontSize:13,marginTop:8,textAlign:"center"}}>{formErr}</div>}
      <input ref={fileRef} type="file" accept="image/*,.csv,text/csv" style={{display:"none"}} onChange={e=>{takeFile(e.target.files&&e.target.files[0]); e.target.value="";}}/>
    </div>

    {/* Sacuvani uvozi */}
    <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
      <div style={{fontWeight:800,fontSize:15,marginBottom:10}}>{sr?"Sačuvani uvozi":"Saved imports"}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:listKey==="custom"?10:12}}>
        {[["30",sr?"30 dana":"30 days"],["90",sr?"90 dana":"90 days"],["lastmonth",sr?"Prošli mesec":"Last month"],["custom",sr?"Proizvoljno":"Custom"]].map(([k,l])=><button key={k} onClick={()=>setListKey(k)} style={pill(listKey===k)}>{l}</button>)}
      </div>
      {listKey==="custom"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <input type="date" value={listCustom.from||""} onChange={e=>setListCustom(p=>({...p,from:e.target.value}))} style={bpInp} aria-label={sr?"Od":"From"}/>
        <input type="date" value={listCustom.to||""} onChange={e=>setListCustom(p=>({...p,to:e.target.value}))} style={bpInp} aria-label={sr?"Do":"To"}/>
      </div>}
      {loading&&<div style={{color:C.acl,fontSize:13}}>✦ {sr?"Učitavam uvoze...":"Loading imports..."}</div>}
      {!loading&&items.length===0&&<div style={{color:C.mut,fontSize:13}}>{sr?"Nema uvoza u ovom periodu.":"No imports in this period."}</div>}
      {!loading&&items.map(it=><div key={it.id} style={{border:`1px solid ${checked[it.id]?"rgba(245,158,11,0.5)":C.brd}`,borderRadius:10,padding:"10px 12px",marginBottom:8,background:checked[it.id]?"rgba(245,158,11,0.06)":"transparent"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <input type="checkbox" checked={!!checked[it.id]} onChange={e=>setChecked(p=>({...p,[it.id]:e.target.checked}))} aria-label={sr?"Uključi u izveštaj":"Include in report"}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:13}}>{rsSourceName(it.metrics?.source,sr)} · {rsDate(it.period_from,sr)} – {rsDate(it.period_to,sr)}</div>
            <div style={{color:C.dim,fontSize:11}}>{sr?"uvezeno":"imported"} {new Date(it.created_at).toLocaleDateString(sr?"sr-RS":"en-GB")}</div>
          </div>
          <button onClick={()=>setExpanded(expanded===it.id?null:it.id)} style={bpBtn(false)}>{expanded===it.id?(sr?"Sakrij":"Hide"):(sr?"Prikaži":"Show")}</button>
          <button onClick={()=>remove(it)} style={{...bpBtn(false),color:C.red}} aria-label={sr?"Obriši uvoz":"Delete import"}>✕</button>
        </div>
        {expanded===it.id&&<div style={{marginTop:10}}><MD2 text={it.analysis_text}/></div>}
      </div>)}
      {!loading&&items.length>0&&<div style={{borderTop:`1px solid ${C.brd}`,marginTop:10,paddingTop:12}}>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:canCompare?"pointer":"default",opacity:canCompare?1:0.5,marginBottom:10}}>
          <input type="checkbox" checked={compare&&canCompare} disabled={!canCompare} onChange={e=>setCompare(e.target.checked)}/>
          {sr?"Uporedi dva izabrana uvoza (period A i period B)":"Compare the two selected imports (period A and period B)"}
        </label>
        <button onClick={makeReport} disabled={!sel.length||reportLoading} style={{padding:"11px 16px",borderRadius:11,fontSize:14,fontWeight:700,cursor:!sel.length||reportLoading?"not-allowed":"pointer",border:"none",background:"linear-gradient(135deg,#F59E0B,#D97706)",color:"#fff",opacity:!sel.length||reportLoading?0.5:1}}>
          {reportLoading?(sr?"Pravim izveštaj...":"Creating report..."):(sr?`Napravi izveštaj${sel.length?` (${sel.length})`:""}`:`Create report${sel.length?` (${sel.length})`:""}`)}
        </button>
        {!sel.length&&<div style={{color:C.mut,fontSize:12,marginTop:6}}>{sr?"Čekiraj uvoze koje izveštaj treba da obuhvati.":"Check the imports the report should include."}</div>}
      </div>}
    </div>

    {report&&<div className="pm-in" style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:14,padding:"16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}>
        <div style={{fontWeight:800,fontSize:15}}>{clientName} – {sr?"izveštaj":"report"}</div>
        {reportMeta&&<button onClick={downloadPdf} disabled={pdfBusy} style={{...bpBtn(false),opacity:pdfBusy?0.6:1}}>📄 {pdfBusy?(sr?"Pravim PDF...":"Creating PDF..."):(sr?"Preuzmi PDF":"Download PDF")}</button>}
      </div>
      <MD2 text={report}/>
    </div>}
  </div>;
}

// Padajuci meni sa pretragom (za kategorije i kampanje u "Prodaja po kampanjama").
// Lista se otvara kao plutajuci panel (position:fixed), pa je ne sece tabela sa horizontalnim skrolom.
const rsFold=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"dj");
function RsSearchSelect({value,onChange,options,allLabel,searchPlaceholder,compact,ariaLabel}){
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const [hi,setHi]=useState(0);
  const [pos,setPos]=useState(null);
  const btnRef=useRef(null), panelRef=useRef(null), inputRef=useRef(null);
  const filtered=options.filter(o=>!q.trim()||rsFold(o).includes(rsFold(q.trim())));
  const items=[{v:"",l:allLabel},...filtered.map(o=>({v:o,l:o}))];

  const place=()=>{
    const r=btnRef.current?.getBoundingClientRect(); if(!r) return;
    const w=Math.max(r.width,300), maxH=340;
    const below=window.innerHeight-r.bottom-8;
    const up=below<220&&r.top>below;
    setPos({left:Math.max(8,Math.min(r.left,window.innerWidth-w-8)),width:w,
      ...(up?{bottom:window.innerHeight-r.top+4}:{top:r.bottom+4}),
      maxH:Math.min(maxH,Math.max(160,up?r.top-12:below))});
  };
  const openIt=()=>{ place(); setQ(""); setHi(0); setOpen(true); };
  const close=()=>setOpen(false);
  const pick=v=>{ onChange(v); close(); };

  useEffect(()=>{
    if(!open) return;
    setTimeout(()=>inputRef.current&&inputRef.current.focus(),0);
    const onDown=e=>{ if(panelRef.current?.contains(e.target)||btnRef.current?.contains(e.target)) return; close(); };
    const onScroll=e=>{ if(panelRef.current?.contains(e.target)) return; close(); };
    document.addEventListener("mousedown",onDown);
    window.addEventListener("scroll",onScroll,true);
    window.addEventListener("resize",close);
    return()=>{ document.removeEventListener("mousedown",onDown); window.removeEventListener("scroll",onScroll,true); window.removeEventListener("resize",close); };
  },[open]);

  const onKey=e=>{
    if(e.key==="Escape"){ close(); btnRef.current?.focus(); }
    else if(e.key==="ArrowDown"){ e.preventDefault(); setHi(h=>Math.min(items.length-1,h+1)); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); setHi(h=>Math.max(0,h-1)); }
    else if(e.key==="Enter"){ e.preventDefault(); const it=items[Math.min(hi,items.length-1)]; if(it) pick(it.v); }
  };

  const shown=value||allLabel;
  return <>
    <button ref={btnRef} type="button" onClick={()=>open?close():openIt()} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
      style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,textAlign:"left",cursor:"pointer",
        padding:compact?"5px 8px":"10px 12px",background:"rgba(255,255,255,0.06)",border:`1px solid ${open?"#F59E0B":C.brd}`,borderRadius:compact?7:9,
        color:C.txt,fontSize:compact?11:14,fontWeight:compact?600:400,maxWidth:compact?220:"none",boxSizing:"border-box"}}>
      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{shown}</span>
      <span style={{color:C.mut,fontSize:10,flexShrink:0}}>▾</span>
    </button>
    {open&&pos&&<div ref={panelRef} role="listbox" style={{position:"fixed",zIndex:1000,left:pos.left,width:pos.width,top:pos.top,bottom:pos.bottom,
      background:"#15152a",border:`1px solid ${C.brd}`,borderRadius:10,boxShadow:"0 12px 32px rgba(0,0,0,0.55)",display:"flex",flexDirection:"column",maxHeight:pos.maxH,overflow:"hidden",textAlign:"left",textTransform:"none",letterSpacing:"normal"}}>
      <div style={{padding:8,borderBottom:`1px solid ${C.brd}`}}>
        <input ref={inputRef} value={q} onChange={e=>{setQ(e.target.value);setHi(0);}} onKeyDown={onKey} placeholder={searchPlaceholder}
          style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:8,color:C.txt,fontSize:13,outline:"none"}}/>
      </div>
      <div style={{overflowY:"auto",flex:1}}>
        {items.map((it,i)=><div key={it.v||"__all"} role="option" aria-selected={value===it.v} onMouseEnter={()=>setHi(i)} onMouseDown={e=>{e.preventDefault();pick(it.v);}}
          style={{padding:"8px 12px",fontSize:13,cursor:"pointer",color:value===it.v?"#F59E0B":C.txt,fontWeight:value===it.v||i===0?600:400,
            background:i===hi?"rgba(245,158,11,0.15)":"transparent",wordBreak:"break-word"}}>{it.l}</div>)}
        {filtered.length===0&&<div style={{padding:"8px 12px",fontSize:12,color:C.mut}}>—</div>}
      </div>
    </div>}
  </>;
}

// ── REPORT STUDIO: PRODAJA PO KAMPANJAMA ─────────────────────────────────────
const RS_TYPES=[
  {k:"meta",sr:"Meta",en:"Meta",c:"#60A5FA"},
  {k:"google",sr:"Google",en:"Google",c:"#FBBF24"},
  {k:"paid_other",sr:"Ostali plaćeni",en:"Other paid",c:"#C084FC"},
  {k:"organic",sr:"Organski",en:"Organic",c:"#34D399"},
  {k:"direct",sr:"Direktno",en:"Direct",c:"#94A3B8"},
  {k:"referral",sr:"Preporuke",en:"Referral",c:"#F472B6"},
  {k:"other",sr:"Ostalo",en:"Other",c:"#9CA3AF"},
];
const rsType=(k,sr)=>{const x=RS_TYPES.find(t=>t.k===k)||RS_TYPES[RS_TYPES.length-1];return {l:sr?x.sr:x.en,c:x.c};};

function RsProductSales({sr,lang,mob,clientId,clientName}){
  const [periodKey,setPeriodKey]=useState("7");
  const [custom,setCustom]=useState(()=>rsPeriodRange("7",{}));
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [view,setView]=useState("campaign");
  const [cat,setCat]=useState("");
  const [camp,setCamp]=useState("");
  const [types,setTypes]=useState({});
  const [q,setQ]=useState("");
  const [inEur,setInEur]=useState(false);
  const [open,setOpen]=useState(null);
  const [limit,setLimit]=useState(100);
  const [pdfBusy,setPdfBusy]=useState(false);

  useEffect(()=>{ setData(null); setErr(""); setCat(""); setCamp(""); },[clientId]);

  const load=async()=>{
    setErr(""); setData(null); setOpen(null); setLimit(100); setCat(""); setCamp("");
    if(!clientId){ setErr(sr?"Izaberi klijenta.":"Choose a client."); return; }
    const r=rsPeriodRange(periodKey,custom);
    if(!r.from||!r.to||r.to<r.from){ setErr(sr?"Proveri period – kraj ne može biti pre početka.":"Check the period – the end can't be before the start."); return; }
    const uid=await getOrCreateUser();
    setLoading(true);
    try{
      const res=await fetch(`/api/report-product-sales?client_id=${clientId}&user_id=${uid}&from=${r.from}&to=${r.to}`);
      const d=await res.json();
      if(!res.ok){
        const e=String(d.error||"");
        if(e==="no_ga4") setErr(sr?"GA4 nije povezan za ovog klijenta. Poveži ga u Clients.":"GA4 is not connected for this client. Connect it in Clients.");
        else if(e.includes("invalid_grant")) setErr(sr?"Veza sa Google nalogom je istekla. U Clients otkači i ponovo poveži GA4.":"The Google connection has expired. In Clients, disconnect and reconnect GA4.");
        else setErr(sr?"Podaci nisu učitani. Pokušaj ponovo.":"Data could not be loaded. Please try again.");
      } else { setData(d); setInEur(false); }
    }catch(e){ setErr(sr?"Podaci nisu učitani. Proveri internet vezu i pokušaj ponovo.":"Data could not be loaded. Check your connection and try again."); }
    setLoading(false);
  };

  const cur=data?(inEur?"EUR":data.currency):"EUR";
  const mul=data&&inEur&&data.eurRate?data.eurRate:1;
  const money=v=>`${rsNum(v*mul)} ${cur==="RSD"?"din":cur}`;

  const all=data?data.rows:[];
  const typeCounts={}; all.forEach(r=>{typeCounts[r.type]=(typeCounts[r.type]||0)+r.revenue;});
  const anyType=Object.values(types).some(Boolean);
  const ql=q.trim().toLowerCase();
  const pass=(r,skip)=>(skip==="cat"||!cat||r.category===cat)&&(skip==="camp"||!camp||r.campaign===camp)&&(!anyType||types[r.type])&&(!ql||String(r.itemName).toLowerCase().includes(ql)||String(r.campaign).toLowerCase().includes(ql)||String(r.itemId).includes(ql));
  const rows=all.filter(r=>pass(r));
  const cats=[...new Set(all.filter(r=>pass(r,"cat")).map(r=>r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const campRev={}; all.filter(r=>pass(r,"camp")).forEach(r=>{campRev[r.campaign]=(campRev[r.campaign]||0)+r.revenue;});
  const camps=Object.keys(campRev).sort((a,b)=>campRev[b]-campRev[a]);
  // Padajuci meniji sa pretragom; "compact" = verzija u zaglavlju tabele
  const catSelect=(compact)=><RsSearchSelect value={cat} onChange={v=>{setCat(v);setLimit(100);setOpen(null);}}
    options={cat&&!cats.includes(cat)?[cat,...cats]:cats} allLabel={sr?"Sve kategorije":"All categories"}
    searchPlaceholder={sr?"Pretraži kategoriju...":"Search category..."} compact={compact} ariaLabel={sr?"Kategorija":"Category"}/>;
  const campSelect=(compact)=><RsSearchSelect value={camp} onChange={v=>{setCamp(v);setLimit(100);setOpen(null);}}
    options={camp&&!camps.includes(camp)?[camp,...camps]:camps} allLabel={sr?"Sve kampanje":"All campaigns"}
    searchPlaceholder={sr?"Pretraži kampanju...":"Search campaign..."} compact={compact} ariaLabel={sr?"Kampanja":"Campaign"}/>;
  const totQty=rows.reduce((s,r)=>s+r.qty,0), totRev=rows.reduce((s,r)=>s+r.revenue,0);

  const group=(keyFn,labelFn)=>{
    const m={};
    rows.forEach(r=>{const k=keyFn(r); if(!m[k]) m[k]={k,label:labelFn(r),type:r.type,qty:0,revenue:0,items:[]}; m[k].qty+=r.qty; m[k].revenue+=r.revenue; m[k].items.push(r);});
    return Object.values(m).sort((a,b)=>b.revenue-a.revenue);
  };
  const byCampaign=data?group(r=>`${r.campaign}|${r.type}`,r=>r.campaign):[];
  const byProduct=data?group(r=>r.itemId||r.itemName,r=>r.itemName):[];

  const pill=on=>({padding:"7px 13px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:on?"1px solid #F59E0B":`1px solid ${C.brd}`,background:on?"rgba(245,158,11,0.15)":"transparent",color:on?"#fff":C.mut});
  const cell={padding:"6px 8px",borderBottom:`1px solid ${C.brd}`};
  const Badge=({t})=>{const x=rsType(t,sr);return <span style={{fontSize:10,fontWeight:700,color:x.c,border:`1px solid ${x.c}55`,borderRadius:20,padding:"1px 7px",whiteSpace:"nowrap"}}>{x.l}</span>;};

  const downloadPdf=async()=>{
    if(!data||pdfBusy) return;
    setPdfBusy(true);
    const esc=s=>String(s==null?"":s).replace(/\|/g,"/");
    const typeRows=RS_TYPES.map(t=>{const rr=rows.filter(r=>r.type===t.k);return {t,qty:rr.reduce((s,r)=>s+r.qty,0),rev:rr.reduce((s,r)=>s+r.revenue,0)};}).filter(x=>x.qty>0).sort((a,b)=>b.rev-a.rev);
    const pct=v=>totRev>0?`${rsNum(v/totRev*100,1)}%`:"–";
    let md=`## ${sr?"Ukupno":"Total"}\n| ${sr?"Prodato komada":"Items sold"} | ${sr?"Prihod":"Revenue"} |\n|---|---|\n| ${rsNum(totQty)} | ${money(totRev)} |\n`;
    md+=`## ${sr?"Po vrsti izvora":"By source type"}\n| ${sr?"Izvor":"Source"} | ${sr?"Komada":"Items"} | ${sr?"Prihod":"Revenue"} | ${sr?"Udeo":"Share"} |\n|---|---|---|---|\n`+typeRows.map(x=>`| ${sr?x.t.sr:x.t.en} | ${rsNum(x.qty)} | ${money(x.rev)} | ${pct(x.rev)} |`).join("\n")+"\n";
    md+=`## ${sr?"Kampanje":"Campaigns"} (top ${Math.min(40,byCampaign.length)})\n| ${sr?"Kampanja":"Campaign"} | ${sr?"Izvor":"Source"} | ${sr?"Komada":"Items"} | ${sr?"Prihod":"Revenue"} | ${sr?"Udeo":"Share"} |\n|---|---|---|---|---|\n`+byCampaign.slice(0,40).map(g=>`| ${esc(g.label)} | ${rsType(g.type,sr).l} | ${rsNum(g.qty)} | ${money(g.revenue)} | ${pct(g.revenue)} |`).join("\n")+"\n";
    md+=`## ${sr?"Najprodavaniji proizvodi":"Top products"} (top ${Math.min(40,byProduct.length)})\n| ${sr?"Proizvod":"Product"} | ${sr?"Kategorija":"Category"} | ${sr?"Komada":"Items"} | ${sr?"Prihod":"Revenue"} | ${sr?"Najviše iz":"Mostly from"} |\n|---|---|---|---|---|\n`+byProduct.slice(0,40).map(g=>{const top=[...g.items].sort((a,b)=>b.revenue-a.revenue)[0];return `| ${esc(g.label)} | ${esc(top.category)} | ${rsNum(g.qty)} | ${money(g.revenue)} | ${esc(top.campaign)} |`;}).join("\n")+"\n";
    const filt=[cat&&`${sr?"kategorija":"category"}: ${cat}`,camp&&`${sr?"kampanja":"campaign"}: ${camp}`,anyType&&`${sr?"izvori":"sources"}: ${RS_TYPES.filter(t=>types[t.k]).map(t=>sr?t.sr:t.en).join(", ")}`,ql&&`${sr?"pretraga":"search"}: "${q.trim()}"`].filter(Boolean).join(" · ");
    const subtitle=`${rsDate(data.period.from,sr)} – ${rsDate(data.period.to,sr)}  ·  ${sr?"Izvor: GA4":"Source: GA4"}${filt?`  ·  ${filt}`:""}`;
    const safe=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"dj").replace(/Đ/g,"Dj").replace(/[^A-Za-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
    try{
      const pm=await rsLoadPdfMake();
      pm.createPdf(rsPdfDocMd({title:sr?"Prodaja po kampanjama":"Sales by campaign",clientName:clientName||data.client.name,subtitle,md,sr})).download(`${safe(clientName||data.client.name)||"klijent"}_prodaja_po_kampanjama_${data.period.from}_${data.period.to}.pdf`);
    }catch(e){ alert(sr?"PDF nije napravljen. Proveri internet vezu i pokušaj ponovo.":"The PDF could not be created. Check your connection and try again."); }
    setPdfBusy(false);
  };

  if(!clientId) return <div style={{color:C.mut,fontSize:13,padding:"8px 0"}}>{sr?"Izaberi klijenta iznad.":"Choose a client above."}</div>;

  return <div>
    <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
      <div style={{color:C.mut,fontSize:13,marginBottom:12}}>{sr?"Šta je prodato i iz koje kampanje je došlo – svi izvori (Meta, Google, organski, direktno...), uživo iz GA4.":"What was sold and which campaign it came from – all sources (Meta, Google, organic, direct...), live from GA4."}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:periodKey==="custom"?10:14}}>
        {[["7",sr?"7 dana":"7 days"],["30",sr?"30 dana":"30 days"],["month",sr?"Ovaj mesec":"This month"],["lastmonth",sr?"Prošli mesec":"Last month"],["custom",sr?"Proizvoljno":"Custom"]].map(([k,l])=><button key={k} onClick={()=>setPeriodKey(k)} style={pill(periodKey===k)}>{l}</button>)}
      </div>
      {periodKey==="custom"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <input type="date" value={custom.from||""} onChange={e=>setCustom(p=>({...p,from:e.target.value}))} style={bpInp} aria-label={sr?"Od":"From"}/>
        <input type="date" value={custom.to||""} onChange={e=>setCustom(p=>({...p,to:e.target.value}))} style={bpInp} aria-label={sr?"Do":"To"}/>
      </div>}
      <button onClick={load} disabled={loading} style={{padding:"12px 18px",borderRadius:11,fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",border:"none",background:"linear-gradient(135deg,#F59E0B,#D97706)",color:"#fff",opacity:loading?0.6:1}}>
        {loading?(sr?"Učitavam iz GA4...":"Loading from GA4..."):(sr?"Prikaži prodaju po kampanjama":"Show sales by campaign")}
      </button>
      {err&&<div style={{color:C.red,fontSize:13,marginTop:10}}>{err}</div>}
    </div>

    {data&&<div>
      {/* Zbir i akcije */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
        <div>
          <div style={{fontWeight:800,fontSize:17}}>{rsNum(totQty)} {sr?"komada":"items"} · {money(totRev)}</div>
          <div style={{color:C.mut,fontSize:12,marginTop:2}}>{rsDate(data.period.from,sr)} – {rsDate(data.period.to,sr)}{(cat||camp||anyType||ql)?` · ${sr?"filtrirano":"filtered"}`:""}</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {data.currency!=="EUR"&&data.eurRate&&<button onClick={()=>setInEur(v=>!v)} style={bpBtn(false)}>{inEur?(data.currency==="RSD"?"din":data.currency):"EUR"}</button>}
          <button onClick={downloadPdf} disabled={pdfBusy||!rows.length} style={{...bpBtn(false),opacity:pdfBusy||!rows.length?0.5:1}}>📄 {pdfBusy?(sr?"Pravim PDF...":"Creating PDF..."):(sr?"Preuzmi PDF":"Download PDF")}</button>
        </div>
      </div>
      {data.truncated&&<div style={{color:C.yel,fontSize:12,marginBottom:10}}>{sr?"Period ima veoma mnogo redova – prikazano je prvih 60.000 (najveći prihod). Za potpune podatke izaberi kraći period.":"The period has a very large number of rows – the first 60,000 (highest revenue) are shown. Choose a shorter period for complete data."}</div>}
      {inEur&&<div style={{color:C.mut,fontSize:11,marginBottom:10}}>{sr?"Preračunato u EUR po kursu":"Converted to EUR at the rate from"} {data.rateDate?new Date(data.rateDate).toLocaleDateString(sr?"sr-RS":"en-GB"):""}</div>}

      {/* Filteri */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        {RS_TYPES.filter(t=>typeCounts[t.k]).map(t=><button key={t.k} onClick={()=>setTypes(p=>({...p,[t.k]:!p[t.k]}))} style={{...pill(!!types[t.k]),borderColor:types[t.k]?t.c:C.brd}}>
          <span style={{color:t.c}}>●</span> {sr?t.sr:t.en}
        </button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr 1fr",gap:10,marginBottom:12}}>
        {catSelect(false)}
        {campSelect(false)}
        <input value={q} onChange={e=>{setQ(e.target.value);setLimit(100);}} placeholder={sr?"Pretraži proizvod ili kampanju...":"Search product or campaign..."} style={bpInp}/>
      </div>

      {/* Prikazi */}
      <div role="tablist" style={{display:"flex",gap:4,borderBottom:`1px solid ${C.brd}`,marginBottom:10}}>
        {[["campaign",sr?"Po kampanji":"By campaign"],["product",sr?"Po proizvodu":"By product"],["table",sr?"Tabela":"Table"]].map(([k,l])=><button key={k} role="tab" aria-selected={view===k} onClick={()=>{setView(k);setOpen(null);setLimit(100);}} style={{padding:"8px 12px",fontSize:13,fontWeight:700,cursor:"pointer",background:"transparent",border:"none",borderBottom:view===k?"2px solid #F59E0B":"2px solid transparent",color:view===k?"#fff":C.mut,marginBottom:-1}}>{l}</button>)}
      </div>

      {rows.length===0&&<div style={{color:C.mut,fontSize:13,padding:"12px 0"}}>{sr?"Nema prodaje za izabrane filtere.":"No sales for the selected filters."}</div>}

      {(view==="campaign"||view==="product")&&rows.length>0&&<div>
        {(view==="campaign"?byCampaign:byProduct).slice(0,limit).map(g=>{
          const isOpen=open===g.k;
          const sub=view==="campaign"
            ?group2(g.items,r=>r.itemId||r.itemName,r=>r.itemName)
            :group2(g.items,r=>`${r.campaign}|${r.type}`,r=>r.campaign);
          return <div key={g.k} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:10,marginBottom:6}}>
            <button onClick={()=>setOpen(isOpen?null:g.k)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"transparent",border:"none",color:C.txt,cursor:"pointer",textAlign:"left"}}>
              <span style={{color:C.mut,fontSize:11,width:10}}>{isOpen?"▾":"▸"}</span>
              <span style={{flex:1,minWidth:0,fontSize:13,fontWeight:600,wordBreak:"break-word"}}>{g.label} {view==="campaign"&&<Badge t={g.type}/>}</span>
              <span style={{fontSize:12,color:C.mut,whiteSpace:"nowrap"}}>{rsNum(g.qty)} {sr?"kom":"pcs"}</span>
              <span style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",minWidth:mob?90:120,textAlign:"right"}}>{money(g.revenue)}</span>
            </button>
            {isOpen&&<div style={{padding:"0 12px 10px 32px",overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <tbody>{sub.map(s=><tr key={s.k}>
                  <td style={{...cell,wordBreak:"break-word"}}>{s.label} {view==="product"&&<Badge t={s.type}/>}</td>
                  <td style={{...cell,textAlign:"right",color:C.mut,whiteSpace:"nowrap"}}>{rsNum(s.qty)} {sr?"kom":"pcs"}</td>
                  <td style={{...cell,textAlign:"right",whiteSpace:"nowrap"}}>{money(s.revenue)}</td>
                </tr>)}</tbody>
              </table>
            </div>}
          </div>;
        })}
      </div>}

      {view==="table"&&rows.length>0&&<div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"8px",overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:680}}>
          <thead><tr>
            <th style={{...cell,color:C.mut,fontWeight:600,textAlign:"left"}}>ID</th>
            <th style={{...cell,color:C.mut,fontWeight:600,textAlign:"left"}}>{sr?"Proizvod":"Product"}</th>
            <th style={{...cell,color:C.mut,fontWeight:600,textAlign:"left",verticalAlign:"bottom"}}><div style={{marginBottom:4}}>{sr?"Kategorija":"Category"}</div>{catSelect(true)}</th>
            <th style={{...cell,color:C.mut,fontWeight:600,textAlign:"left",verticalAlign:"bottom"}}><div style={{marginBottom:4}}>{sr?"Kampanja":"Campaign"}</div>{campSelect(true)}</th>
            <th style={{...cell,color:C.mut,fontWeight:600,textAlign:"right",verticalAlign:"bottom"}}>{sr?"Komada":"Items"}</th>
            <th style={{...cell,color:C.mut,fontWeight:600,textAlign:"right",verticalAlign:"bottom"}}>{sr?"Prihod":"Revenue"}</th>
          </tr></thead>
          <tbody>{rows.slice(0,limit).map((r,i)=><tr key={i}>
            <td style={{...cell,color:C.mut}}>{r.itemId}</td>
            <td style={{...cell,wordBreak:"break-word"}}>{r.itemName}</td>
            <td style={cell}>{r.category}</td>
            <td style={{...cell,wordBreak:"break-word"}}>{r.campaign} <Badge t={r.type}/></td>
            <td style={{...cell,textAlign:"right"}}>{rsNum(r.qty)}</td>
            <td style={{...cell,textAlign:"right",whiteSpace:"nowrap"}}>{money(r.revenue)}</td>
          </tr>)}</tbody>
        </table>
      </div>}

      {(view==="table"?rows.length:(view==="campaign"?byCampaign:byProduct).length)>limit&&<button onClick={()=>setLimit(l=>l+200)} style={{...bpBtn(false),marginTop:10}}>{sr?"Prikaži još":"Show more"}</button>}
    </div>}
  </div>;
}

// Grupisanje za otvoren red (kampanja → proizvodi, proizvod → kampanje)
function group2(items,keyFn,labelFn){
  const m={};
  items.forEach(r=>{const k=keyFn(r); if(!m[k]) m[k]={k,label:labelFn(r),type:r.type,qty:0,revenue:0}; m[k].qty+=r.qty; m[k].revenue+=r.revenue;});
  return Object.values(m).sort((a,b)=>b.revenue-a.revenue);
}

// ── MODULE 15: REPORT STUDIO ─────────────────────────────────────────────────
function ReportStudioMod({t,lang,initialTab}){
  const sr=lang==="sr";
  const [tab,setTab]=useState(initialTab==="import"?"import":"gads");
  const mob=useIsMobile();
  const [clients,setClients]=useState([]);
  const [clientsLoading,setClientsLoading]=useState(true);
  const [clientId,setClientId]=useState("");
  const [periodKey,setPeriodKey]=useState("30");
  const [custom,setCustom]=useState(()=>rsPeriodRange("30",{}));
  const [compare,setCompare]=useState(true);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [rep,setRep]=useState(null);
  const [ai,setAi]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [showAll,setShowAll]=useState(false);

  useEffect(()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setClientsLoading(false); return; }
    fetch(`/api/clients?user_id=${uid}`).then(r=>r.json()).then(d=>setClients(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setClientsLoading(false));
  },[]);

  const periods=[["7",sr?"7 dana":"7 days"],["30",sr?"30 dana":"30 days"],["90",sr?"90 dana":"90 days"],["month",sr?"Ovaj mesec":"This month"],["lastmonth",sr?"Prošli mesec":"Last month"],["custom",sr?"Proizvoljno":"Custom"]];

  const generate=async()=>{
    setErr(""); setRep(null); setAi(""); setShowAll(false);
    if(!clientId){ setErr(sr?"Izaberi klijenta.":"Choose a client."); return; }
    const r=rsPeriodRange(periodKey,custom);
    if(!r.from||!r.to||r.to<r.from){ setErr(sr?"Proveri period – kraj ne može biti pre početka.":"Check the period – the end can't be before the start."); return; }
    const uid=await getOrCreateUser();
    setLoading(true);
    try{
      const res=await fetch(`/api/report-google-ads?client_id=${clientId}&user_id=${uid}&from=${r.from}&to=${r.to}&compare=${compare?1:0}`);
      const d=await res.json();
      if(!res.ok){
        const e=String(d.error||"");
        if(e==="no_gads") setErr(sr?"Google Ads nije povezan za ovog klijenta. Poveži ga u Clients.":"Google Ads is not connected for this client. Connect it in Clients.");
        else if(e==="no_ga4") setErr(sr?"GA4 nije povezan za ovog klijenta. Poveži ga u Clients – potreban je za prihod i ROAS.":"GA4 is not connected for this client. Connect it in Clients – it's needed for revenue and ROAS.");
        else if(e.includes("invalid_grant")) setErr(sr?"Veza sa Google nalogom je istekla. U Clients otkači i ponovo poveži GA4 i Google Ads za ovog klijenta.":"The Google connection has expired. In Clients, disconnect and reconnect GA4 and Google Ads for this client.");
        else setErr(sr?"Izveštaj nije napravljen. Pokušaj ponovo.":"The report could not be created. Please try again.");
      } else setRep(d);
    }catch(e){ setErr(sr?"Izveštaj nije napravljen. Proveri internet vezu i pokušaj ponovo.":"The report could not be created. Check your connection and try again."); }
    setLoading(false);
  };

  const cur=rep?rsTotals(rep.current):null;
  const prev=rep&&rep.previous?rsTotals(rep.previous):null;
  const camps=rep?[...(rep.current.campaigns||[])].sort((a,b)=>(b.spendEUR||0)-(a.spendEUR||0)):[];
  const unattr=rep?rep.current.unattributed:null;

  const kpis=cur?[
    {k:"spend",l:sr?"Potrošnja":"Spend",v:`${rsNum(cur.spend)} €`,d:rsDelta(cur.spend,prev&&prev.spend),good:null},
    {k:"revenue",l:sr?"Prihod":"Revenue",v:`${rsNum(cur.revenue)} €`,d:rsDelta(cur.revenue,prev&&prev.revenue),good:1},
    {k:"roas",l:"ROAS",v:cur.roas==null?"–":`${rsNum(cur.roas,2)}x`,d:rsDelta(cur.roas,prev&&prev.roas),good:1},
    {k:"purchases",l:sr?"Kupovine":"Purchases",v:rsNum(cur.purchases),d:rsDelta(cur.purchases,prev&&prev.purchases),good:1},
    {k:"cpa",l:sr?"Cena po kupovini":"Cost per purchase",v:cur.cpa==null?"–":`${rsNum(cur.cpa,2)} €`,d:rsDelta(cur.cpa,prev&&prev.cpa),good:-1},
    {k:"clicks",l:sr?"Klikovi":"Clicks",v:rsNum(cur.clicks),d:rsDelta(cur.clicks,prev&&prev.clicks),good:1},
    {k:"cpc",l:"CPC",v:cur.cpc==null?"–":`${rsNum(cur.cpc,2)} €`,d:rsDelta(cur.cpc,prev&&prev.cpc),good:-1},
    {k:"ctr",l:"CTR",v:cur.ctr==null?"–":`${rsNum(cur.ctr*100,2)}%`,d:rsDelta(cur.ctr,prev&&prev.ctr),good:1},
  ]:[];
  const dColor=(d,good)=>d==null||good==null||Math.abs(d)<0.005?C.mut:((d>0)===(good>0)?C.grn:C.red);
  const dText=d=>d==null?"":`${d>0?"+":""}${(d*100).toFixed(1)}%`;

  const writeAi=async()=>{
    if(!rep||!cur) return;
    setAiLoading(true); setAi("");
    const top=camps.slice(0,15).map(c=>`- ${c.campaign_name}: ${sr?"potrošnja":"spend"} ${rsNum(c.spendEUR)} €, ${sr?"prihod":"revenue"} ${rsNum(c.revenueEUR)} €, ROAS ${rsNum(c.roas,2)}, ${sr?"kupovine":"purchases"} ${rsNum(c.conversions)}`).join("\n");
    const line=(t,p)=>`${t}${p?` (${sr?"prethodni period":"previous period"}: ${p})`:""}`;
    const prompt=sr
      ?`Ti si iskusan Google Ads konsultant. Napiši kratak, jasan zaključak izveštaja za klijenta "${rep.client.name}" za period ${rsDate(rep.period.from,true)} – ${rsDate(rep.period.to,true)}. Iznosi su u EUR. Prihod i kupovine su iz GA4 (Google Ads kanali).\n\nUkupno:\n${line(`Potrošnja ${rsNum(cur.spend)} €`,prev&&`${rsNum(prev.spend)} €`)}\n${line(`Prihod ${rsNum(cur.revenue)} €`,prev&&`${rsNum(prev.revenue)} €`)}\n${line(`ROAS ${rsNum(cur.roas,2)}`,prev&&rsNum(prev.roas,2))}\n${line(`Kupovine ${rsNum(cur.purchases)}`,prev&&rsNum(prev.purchases))}\n${line(`CPC ${rsNum(cur.cpc,2)} €`,prev&&`${rsNum(prev.cpc,2)} €`)}\n\nKampanje (najveća potrošnja prvo):\n${top}\n\nNapiši na srpskom (latinica), u Markdown formatu, sa tri kratka dela: "## Rezime" (2–3 rečenice), "## Šta ide dobro" i "## Preporuke" (3–5 konkretnih koraka). Koristi samo date brojeve, ništa ne izmišljaj. Ne pominji da si AI.`
      :`You are an experienced Google Ads consultant. Write a short, clear report conclusion for client "${rep.client.name}" for ${rsDate(rep.period.from,false)} – ${rsDate(rep.period.to,false)}. Amounts are in EUR. Revenue and purchases come from GA4 (Google Ads channels).\n\nTotals:\n${line(`Spend ${rsNum(cur.spend)} €`,prev&&`${rsNum(prev.spend)} €`)}\n${line(`Revenue ${rsNum(cur.revenue)} €`,prev&&`${rsNum(prev.revenue)} €`)}\n${line(`ROAS ${rsNum(cur.roas,2)}`,prev&&rsNum(prev.roas,2))}\n${line(`Purchases ${rsNum(cur.purchases)}`,prev&&rsNum(prev.purchases))}\n${line(`CPC ${rsNum(cur.cpc,2)} €`,prev&&`${rsNum(prev.cpc,2)} €`)}\n\nCampaigns (highest spend first):\n${top}\n\nWrite in English, in Markdown, with three short parts: "## Summary" (2–3 sentences), "## What's working" and "## Recommendations" (3–5 concrete steps). Use only the given numbers, don't invent anything. Don't mention that you are an AI.`;
    try{
      const txt=await callClaude(prompt,lang);
      setAi(txt||(sr?"Zaključak nije napisan. Pokušaj ponovo.":"The conclusion could not be written. Please try again."));
    }catch(e){ setAi(sr?"Zaključak nije napisan. Pokušaj ponovo.":"The conclusion could not be written. Please try again."); }
    setAiLoading(false);
  };

  // PDF: pravo preuzimanje jednim klikom, kao pravi dokument (pdfmake)
  const [pdfBusy,setPdfBusy]=useState(false);
  const exportPdf=async()=>{
    if(!rep||!cur||pdfBusy) return;
    setPdfBusy(true);
    const safe=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"dj").replace(/Đ/g,"Dj").replace(/[^A-Za-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
    const filename=`${safe(rep.client.name)||"klijent"}_Google-Ads_${rep.period.from}_${rep.period.to}.pdf`;
    try{
      const pm=await rsLoadPdfMake();
      const chartImg=rep.daily?rsChartPng(rep.daily,sr):"";
      pm.createPdf(rsPdfDoc({rep,kpis,camps,unattr,ai,sr,chartImg})).download(filename);
    }catch(e){
      alert(sr?"PDF nije napravljen. Proveri internet vezu i pokušaj ponovo.":"The PDF could not be created. Check your connection and try again.");
    }
    setPdfBusy(false);
  };

  const clientName=clients.find(c=>String(c.id)===String(clientId))?.name;

  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>📑 Report Studio</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 18px"}}>{t.m15s}</p>

    {/* Klijent (zajednicki za oba dela) */}
    <div style={{marginBottom:12}}>
      <div style={{color:C.mut,fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",margin:"0 0 6px"}}>{sr?"Klijent":"Client"}</div>
      {clientsLoading?<div style={{color:C.acl,fontSize:13}}>✦ {sr?"Učitavam klijente...":"Loading clients..."}</div>:
        clients.length===0?<div style={{color:C.mut,fontSize:13}}>{sr?"Nema klijenata još. Dodaj klijenta u Clients.":"No clients yet. Add a client in Clients."}</div>:
        <select value={clientId} onChange={e=>{setClientId(e.target.value);setRep(null);setAi("");setErr("");}} style={bpInp}>
          <option value="" style={{background:"#13131f",color:"#e5e7eb"}}>{sr?"— izaberi klijenta —":"— choose a client —"}</option>
          {clients.map(c=><option key={c.id} value={String(c.id)} style={{background:"#13131f",color:"#e5e7eb"}}>{c.name}</option>)}
        </select>}
    </div>

    {/* Dva dela: Google Ads izvestaj (glavni) i izvestaj iz screenshota/fajla */}
    <div role="tablist" style={{display:"flex",gap:4,flexWrap:"wrap",borderBottom:`1px solid ${C.brd}`,marginBottom:14}}>
      {[["gads",sr?"Google Ads izveštaj":"Google Ads report"],["sales",sr?"Prodaja po kampanjama":"Sales by campaign"],["import",sr?"Iz screenshota / fajla":"From screenshot / file"]].map(([k,l])=><button key={k} role="tab" aria-selected={tab===k} onClick={()=>setTab(k)} style={{padding:"9px 14px",fontSize:13,fontWeight:700,cursor:"pointer",background:"transparent",border:"none",borderBottom:tab===k?"2px solid #F59E0B":"2px solid transparent",color:tab===k?"#fff":C.mut,marginBottom:-1}}>{l}</button>)}
    </div>

    {tab==="sales"&&<RsProductSales sr={sr} lang={lang} mob={mob} clientId={clientId} clientName={clients.find(c=>String(c.id)===String(clientId))?.name||""}/>}

    {tab==="import"&&<RsImports sr={sr} lang={lang} mob={mob} clientId={clientId} clientName={clients.find(c=>String(c.id)===String(clientId))?.name||""}/>}

    {tab==="gads"&&<>
    <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
      <div style={{color:C.mut,fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",margin:"0 0 6px"}}>{sr?"Period":"Period"}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:periodKey==="custom"?10:14}}>
        {periods.map(([k,l])=><button key={k} onClick={()=>setPeriodKey(k)} style={{padding:"7px 13px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:periodKey===k?"1px solid #F59E0B":`1px solid ${C.brd}`,background:periodKey===k?"rgba(245,158,11,0.15)":"transparent",color:periodKey===k?"#fff":C.mut}}>{l}</button>)}
      </div>
      {periodKey==="custom"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <input type="date" value={custom.from||""} onChange={e=>setCustom(p=>({...p,from:e.target.value}))} style={bpInp} aria-label={sr?"Od":"From"}/>
        <input type="date" value={custom.to||""} onChange={e=>setCustom(p=>({...p,to:e.target.value}))} style={bpInp} aria-label={sr?"Do":"To"}/>
      </div>}
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.txt,cursor:"pointer",marginBottom:14}}>
        <input type="checkbox" checked={compare} onChange={e=>setCompare(e.target.checked)}/> {sr?"Uporedi sa prethodnim periodom iste dužine":"Compare with the previous period of the same length"}
      </label>
      <button onClick={generate} disabled={loading} style={{padding:"12px 18px",borderRadius:11,fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",border:"none",background:"linear-gradient(135deg,#F59E0B,#D97706)",color:"#fff",opacity:loading?0.6:1}}>
        {loading?(sr?"Pravim izveštaj...":"Creating report..."):(sr?"Napravi Google Ads izveštaj":"Create Google Ads report")}
      </button>
      {err&&<div style={{color:C.red,fontSize:13,marginTop:10}}>{err}</div>}
    </div>

    {rep&&cur&&<div className="pm-in">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:12}}>
        <div>
          <div style={{fontWeight:800,fontSize:17}}>{rep.client.name||clientName} – Google Ads</div>
          <div style={{color:C.mut,fontSize:12,marginTop:2}}>{rsDate(rep.period.from,sr)} – {rsDate(rep.period.to,sr)}{rep.prevPeriod?` · ${sr?"poređenje sa":"compared to"} ${rsDate(rep.prevPeriod.from,sr)} – ${rsDate(rep.prevPeriod.to,sr)}`:""} · {sr?"iznosi u EUR":"amounts in EUR"}</div>
        </div>
        <button onClick={exportPdf} disabled={pdfBusy} style={{...bpBtn(false),opacity:pdfBusy?0.6:1}}>📄 {pdfBusy?(sr?"Pravim PDF...":"Creating PDF..."):(sr?"Preuzmi PDF":"Download PDF")}</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {kpis.map((x,xi)=><div key={x.k} className="pm-in pm-lift" style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px",animationDelay:`${80+xi*50}ms`}}>
          <div style={{color:C.dim,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.6px"}}>{x.l}</div>
          <div style={{fontSize:18,fontWeight:800,marginTop:4}}>{x.v}</div>
          {x.d!=null&&<div style={{fontSize:11,fontWeight:700,color:dColor(x.d,x.good),marginTop:2}}>{dText(x.d)}</div>}
        </div>)}
      </div>
      {rep.current.fxMissing&&<div style={{color:C.red,fontSize:12,margin:"-4px 0 12px"}}>⚠️ {sr?"Kurs za konverziju u EUR trenutno nije dostupan – deo iznosa je u originalnoj valuti naloga, pa zbirovi mogu biti netačni.":"The EUR exchange rate is currently unavailable – some amounts are in the account's original currency, so totals may be inaccurate."}</div>}
      {rep.previous===null&&rep.prevPeriod&&<div style={{color:C.mut,fontSize:12,margin:"-4px 0 12px"}}>{sr?"Podaci za prethodni period nisu dostupni, pa poređenje nije prikazano.":"Data for the previous period isn't available, so the comparison isn't shown."}</div>}

      <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>{sr?"Potrošnja i prihod po danima":"Spend and revenue by day"}</div>
        {rep.daily?<RsChart daily={rep.daily} sr={sr} forPrint={false}/>
          :<div style={{color:C.mut,fontSize:12}}>{sr?"Grafikon trenutno nije dostupan.":"The chart is currently unavailable."}</div>}
        {rep.daily&&<div style={{display:"flex",gap:14,fontSize:11,color:C.mut,marginTop:6}}>
          <span style={{color:"#F59E0B"}}>■ {sr?"potrošnja":"spend"}</span><span style={{color:"#10B981"}}>● {sr?"prihod":"revenue"}</span>
        </div>}
      </div>

      <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:12,padding:"12px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{fontWeight:700,fontSize:13}}>{sr?"Zaključak i preporuke":"Conclusion and recommendations"}</div>
          <button onClick={writeAi} disabled={aiLoading} style={{...bpBtn(false),opacity:aiLoading?0.6:1}}>{aiLoading?(sr?"Pišem...":"Writing..."):ai?(sr?"Napiši ponovo":"Rewrite"):(sr?"Napiši zaključak":"Write conclusion")}</button>
        </div>
        {!ai&&!aiLoading&&<div style={{color:C.mut,fontSize:12,marginTop:6}}>{sr?"Opciono: kratak rezime, šta ide dobro i konkretne preporuke. Ulazi i u PDF.":"Optional: a short summary, what's working and concrete recommendations. Included in the PDF."}</div>}
        {aiLoading&&<div aria-busy="true" style={{display:"flex",flexDirection:"column",gap:8,marginTop:12}}>{[1,2,3].map(i=><Sk key={i} h={11} w={i===3?"55%":"100%"}/>)}</div>}
        {ai&&!aiLoading&&<div className="pm-in" style={{marginTop:10}}><MD2 text={ai}/></div>}
      </div>

      <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px",overflowX:"auto"}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>{sr?"Kampanje":"Campaigns"} · {camps.length}</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:520}}>
          <thead><tr>{[sr?"Kampanja":"Campaign",sr?"Potrošnja":"Spend",sr?"Prihod":"Revenue","ROAS",sr?"Kupovine":"Purchases"].map(h=><th key={h} style={{textAlign:"left",color:C.mut,fontWeight:600,padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{h}</th>)}</tr></thead>
          <tbody>{(showAll?camps:camps.slice(0,15)).map(c=><tr key={c.campaign_id}>
            <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{c.campaign_name}</td>
            <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{rsNum(c.spendEUR)} €</td>
            <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{rsNum(c.revenueEUR)} €</td>
            <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.brd}`,color:c.spendEUR>0?(c.roas>=1?C.grn:C.red):C.mut,fontWeight:700}}>{c.spendEUR>0?rsNum(c.roas,2):"–"}</td>
            <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{rsNum(c.conversions)}</td>
          </tr>)}</tbody>
        </table>
        {camps.length>15&&<button onClick={()=>setShowAll(v=>!v)} style={{...bpBtn(false),marginTop:10}}>{showAll?(sr?"Prikaži manje":"Show less"):(sr?`Prikaži sve (${camps.length})`:`Show all (${camps.length})`)}</button>}
        {unattr&&unattr.revenueEUR>0&&<div style={{color:C.mut,fontSize:12,marginTop:10}}>{sr?"Prihod iz Google Ads kanala bez prepoznate kampanje":"Revenue from Google Ads channels without a recognized campaign"}: {rsNum(unattr.revenueEUR)} €</div>}
      </div>
    </div>}
    </>}
  </div>;
}

// ── AI HELPER ────────────────────────────────────────────────────────────────
async function callClaude(prompt, lang) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ── USER UUID ────────────────────────────────────────────────────────────────
async function getOrCreateUser(){
  let uid=localStorage.getItem("mat_user_id");
  if(uid&&!uid.startsWith("local-")) return uid;
  // Stari privremeni "local-" ID baza ne prihvata – brise se i pravi se pravi nalog
  if(uid) localStorage.removeItem("mat_user_id");
  try{
    const r=await fetch("/api/user",{method:"POST",headers:{"Content-Type":"application/json"}});
    const data=await r.json();
    if(data.id){ localStorage.setItem("mat_user_id",data.id); return data.id; }
  }catch(e){}
  // Server nije odgovorio: nista se ne pamti, sledeci put se pokusava ponovo
  return null;
}


// ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY="BNeZYihbfY4pd6cDVaD48xRthYXSfMN9CC-3-AjLLObt5RJYa6R5cqKI1OL8Fu2rZUg4B9rtryCpBAe-lxoHpJA";

function urlBase64ToUint8Array(base64String){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const rawData=window.atob(base64);
  const outputArray=new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;++i){ outputArray[i]=rawData.charCodeAt(i); }
  return outputArray;
}

async function subscribeToPush(){
  try{
    console.log("subscribeToPush called");
    if(!("serviceWorker" in navigator)||!("PushManager" in window)){
      console.log("No serviceWorker or PushManager support");
      return false;
    }
    const reg=await navigator.serviceWorker.ready;
    console.log("ServiceWorker ready:", reg);
    const existing=await reg.pushManager.getSubscription();
    console.log("Existing subscription:", existing);
    if(existing){
      const uid=await getOrCreateUser();
      console.log("User ID:", uid);
      const r=await fetch("/api/push-subscribe",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({user_id:uid,subscription:existing.toJSON()})
      });
      const data=await r.json();
      console.log("Push subscribe response:", data);
      return true;
    }
    const sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    console.log("New subscription:", sub);
    const uid=await getOrCreateUser();
    console.log("User ID:", uid);
    const r=await fetch("/api/push-subscribe",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({user_id:uid,subscription:sub.toJSON()})
    });
    const data=await r.json();
    console.log("Push subscribe response:", data);
    return true;
  }catch(e){ console.log("Push subscribe error:",e); return false; }
}

async function requestNotificationPermission(){
  if(!("Notification" in window)) return false;
  if(Notification.permission==="granted"){ await subscribeToPush(); return true; }
  if(Notification.permission==="denied") return false;
  const perm=await Notification.requestPermission();
  if(perm==="granted"){ await subscribeToPush(); return true; }
  return false;
}

// ── MODULE 10: MOJI KLIJENTI ─────────────────────────────────────────────────
function MyClientsMod({t,lang,goMod}){
  const sr=lang==="sr";
  const [clients,setClients]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState(null);
  const [ga4,setGa4]=useState(null);
  const [ga4Loading,setGa4Loading]=useState(false);
  const [ga4Setup,setGa4Setup]=useState(null);
  const [ga4Error,setGa4Error]=useState("");
  const [ga4Saving,setGa4Saving]=useState(false);
  const [gads,setGads]=useState(null);
  const [gadsLoading,setGadsLoading]=useState(false);
  const [gadsSetup,setGadsSetup]=useState(null);
  const [gadsError,setGadsError]=useState("");
  const [gadsSaving,setGadsSaving]=useState(false);
  const [gadsBackfilling,setGadsBackfilling]=useState(false);
  const [newClientOpen,setNewClientOpen]=useState(false);
  const [newClientName,setNewClientName]=useState("");
  const [creatingClient,setCreatingClient]=useState(false);
  const [renaming,setRenaming]=useState(false);
  const [renameValue,setRenameValue]=useState("");
  const [renamingSaving,setRenamingSaving]=useState(false);

  useEffect(()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setLoading(false); return; }
    fetch(`/api/clients?user_id=${uid}`)
      .then(r=>r.json())
      .then(data=>{ setClients(Array.isArray(data)?data:[]); setLoading(false); })
      .catch(()=>setLoading(false));
  },[]);

  const loadAnalyses=(client)=>{
    setSelected(client);
    setGa4(null);
    setGa4Loading(true);
    setGads(null);
    setGadsLoading(true);
    fetch(`/api/ga4-connect?client_id=${client.id}`)
      .then(r=>r.json())
      .then(data=>{ setGa4(Array.isArray(data)&&data.length>0?data[0]:null); setGa4Loading(false); })
      .catch(()=>setGa4Loading(false));
    fetch(`/api/google-ads-connect?client_id=${client.id}`)
      .then(r=>r.json())
      .then(data=>{ setGads(Array.isArray(data)&&data.length>0?data[0]:null); setGadsLoading(false); })
      .catch(()=>setGadsLoading(false));
  };

  // Prepoznaj povratak sa Google OAuth ekrana (?ga4_setup= ili ?ga4_error=, i ?gads_setup=/?gads_error=)
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const setupId=params.get("ga4_setup");
    const err=params.get("ga4_error");
    const gadsSetupId=params.get("gads_setup");
    const gadsErr=params.get("gads_error");
    if(err){
      setGa4Error(err);
      window.history.replaceState({},"",window.location.pathname+"?mod=10");
    }
    if(setupId){
      fetch(`/api/temp-fetch?id=${setupId}`)
        .then(r=>r.json())
        .then(res=>{ if(res.data) setGa4Setup(res.data); window.history.replaceState({},"",window.location.pathname+"?mod=10"); })
        .catch(()=>window.history.replaceState({},"",window.location.pathname+"?mod=10"));
    }
    if(gadsErr){
      setGadsError(gadsErr);
      window.history.replaceState({},"",window.location.pathname+"?mod=10");
    }
    if(gadsSetupId){
      fetch(`/api/temp-fetch?id=${gadsSetupId}`)
        .then(r=>r.json())
        .then(res=>{ if(res.data) setGadsSetup(res.data); window.history.replaceState({},"",window.location.pathname+"?mod=10"); })
        .catch(()=>window.history.replaceState({},"",window.location.pathname+"?mod=10"));
    }
  },[]);

  // Kad se klijenti učitaju i imamo GA4 ili Google Ads setup na čekanju, automatski otvori tog klijenta
  useEffect(()=>{
    if((ga4Setup||gadsSetup)&&clients.length>0){
      const pendingClientId=ga4Setup?ga4Setup.client_id:gadsSetup.client_id;
      const c=clients.find(cl=>String(cl.id)===String(pendingClientId));
      if(c) loadAnalyses(c);
    }
  },[clients,ga4Setup,gadsSetup]);

  const connectGA4=()=>{
    const uid=localStorage.getItem("mat_user_id");
    window.location.href=`/api/ga4-auth?client_id=${selected.id}&uid=${uid}`;
  };

  const disconnectGA4=async()=>{
    if(!window.confirm(sr?"Otkači GA4 vezu za ovog klijenta?":"Disconnect GA4 for this client?")) return;
    try{
      await fetch(`/api/ga4-connect?client_id=${selected.id}`,{method:"DELETE"});
      setGa4(null);
    }catch(e){}
  };

  const savePropertySelection=async(prop)=>{
    setGa4Saving(true);
    const uid=localStorage.getItem("mat_user_id");
    try{
      const r=await fetch("/api/ga4-connect",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({user_id:uid,client_id:ga4Setup.client_id,property_id:prop.property_id,property_name:prop.property_name,refresh_token:ga4Setup.refresh_token})
      });
      if(!r.ok){ const d=await r.json().catch(()=>({})); throw new Error(d.error||String(r.status)); }
      setGa4({property_id:prop.property_id,property_name:prop.property_name});
      setGa4Setup(null);
    }catch(e){ alert((lang==="sr"?"Povezivanje GA4 naloga nije uspelo: ":"Connecting the GA4 property failed: ")+e.message); }
    setGa4Saving(false);
  };

  const connectGoogleAds=()=>{
    const uid=localStorage.getItem("mat_user_id");
    window.location.href=`/api/google-ads-auth?client_id=${selected.id}&uid=${uid}`;
  };

  const disconnectGoogleAds=async()=>{
    if(!window.confirm(sr?"Otkači Google Ads vezu za ovog klijenta?":"Disconnect Google Ads for this client?")) return;
    try{
      await fetch(`/api/google-ads-connect?client_id=${selected.id}`,{method:"DELETE"});
      setGads(null);
    }catch(e){}
  };

  const refreshGoogleAdsHistory=async()=>{
    setGadsBackfilling(true);
    try{
      const r=await fetch("/api/google-ads-backfill",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({client_id:selected.id,days:90})
      });
      const d=await r.json();
      alert(r.ok?(sr?`Gotovo! Osveženo ${d.rowsWritten} redova istorije.`:`Done! Refreshed ${d.rowsWritten} history rows.`):(d.error||(sr?"Greška":"Error")));
    }catch(e){
      alert(sr?"Greška pri osvežavanju.":"Error refreshing.");
    }
    setGadsBackfilling(false);
  };

  const saveGoogleAdsSelection=async(acc)=>{
    setGadsSaving(true);
    const uid=localStorage.getItem("mat_user_id");
    try{
      const r=await fetch("/api/google-ads-connect",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          user_id:uid,
          client_id:gadsSetup.client_id,
          customer_id:acc.customer_id,
          manager_id:acc.manager_id,
          account_name:acc.account_name,
          currency_code:acc.currency_code,
          refresh_token:gadsSetup.refresh_token
        })
      });
      // Ranije se "povezano" prikazivalo i kad čuvanje ne uspe
      if(!r.ok){ const d=await r.json().catch(()=>({})); throw new Error(d.error||String(r.status)); }
      setGads({customer_id:acc.customer_id,manager_id:acc.manager_id,account_name:acc.account_name,currency_code:acc.currency_code});
      setGadsSetup(null);
    }catch(e){ alert((lang==="sr"?"Povezivanje Google Ads naloga nije uspelo: ":"Connecting the Google Ads account failed: ")+e.message); }
    setGadsSaving(false);
  };

  const deleteClient=async(id)=>{
    if(!window.confirm(sr?"Obrisati klijenta i sve njegove podatke (veze sa GA4 i Google Ads, budžete, uvoze)?":"Delete the client and all their data (GA4 and Google Ads connections, budgets, imports)?")) return;
    try{
      const r=await fetch(`/api/clients?id=${id}&user_id=${localStorage.getItem("mat_user_id")}`,{method:"DELETE"});
      if(!r.ok) throw new Error();
      setClients(prev=>prev.filter(c=>c.id!==id));
    }catch(e){ alert(sr?"Klijent nije obrisan. Pokušaj ponovo.":"The client was not deleted. Please try again."); }
  };

  const addClient=async()=>{
    if(!newClientName.trim()) return;
    setCreatingClient(true);
    try{
      const uid=await getOrCreateUser();
      const r=await fetch("/api/clients",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({user_id:uid,name:newClientName.trim()})
      });
      const c=await r.json();
      if(r.ok&&c.id){
        setClients(prev=>[c,...prev]);
        setNewClientName("");
        setNewClientOpen(false);
      } else {
        alert(lang==="sr"?"Klijent nije sačuvan. Pokušaj ponovo.":"Client was not saved. Please try again.");
      }
    }catch(e){
      alert(lang==="sr"?"Klijent nije sačuvan. Proveri internet vezu i pokušaj ponovo.":"Client was not saved. Check your connection and try again.");
    }
    setCreatingClient(false);
  };

  const startRename=()=>{ setRenameValue(selected.name); setRenaming(true); };

  const saveRename=async()=>{
    if(!renameValue.trim()) return;
    setRenamingSaving(true);
    try{
      const r=await fetch(`/api/clients?id=${selected.id}&user_id=${localStorage.getItem("mat_user_id")}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:renameValue.trim()})
      });
      const updated=await r.json();
      if(r.ok&&updated.id){
        setSelected(s=>({...s,name:updated.name}));
        setClients(prev=>prev.map(c=>c.id===updated.id?{...c,name:updated.name}:c));
        setRenaming(false);
      } else alert(sr?"Ime nije promenjeno. Pokušaj ponovo.":"The name was not changed. Please try again.");
    }catch(e){ alert(sr?"Ime nije promenjeno. Pokušaj ponovo.":"The name was not changed. Please try again."); }
    setRenamingSaving(false);
  };

  if(selected) return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      <button onClick={()=>{setSelected(null);}} style={{background:"none",border:"none",color:C.acl,cursor:"pointer",fontSize:13,fontWeight:600,padding:0}}>← {sr?"Svi klijenti":"All clients"}</button>
    </div>
    {!renaming&&<div style={{display:"flex",alignItems:"center",gap:10,margin:"0 0 4px"}}>
      <h2 style={{fontSize:20,fontWeight:800,margin:0}}>{selected.name}</h2>
      <button onClick={startRename} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:14,padding:2}} title={sr?"Izmeni ime":"Edit name"}>✏️</button>
    </div>}
    {renaming&&<div style={{display:"flex",gap:8,alignItems:"center",margin:"0 0 4px"}}>
      <input value={renameValue} onChange={e=>setRenameValue(e.target.value)} autoFocus style={{flex:1,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.05)",color:C.txt,fontSize:15,fontWeight:700}}/>
      <button onClick={saveRename} disabled={renamingSaving||!renameValue.trim()} style={{background:"rgba(52,211,153,0.15)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:8,color:C.grn,fontSize:12,fontWeight:700,padding:"8px 12px",cursor:"pointer"}}>{sr?"Sačuvaj":"Save"}</button>
      <button onClick={()=>setRenaming(false)} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12,padding:"8px"}}>{sr?"Otkaži":"Cancel"}</button>
    </div>}
    <p style={{color:C.mut,fontSize:13,margin:"0 0 16px"}}>{sr?"Povezani nalozi":"Connected accounts"}</p>

    <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px 16px",marginBottom:20}}>
      {ga4Loading&&<div style={{color:C.mut,fontSize:12}}>{sr?"Proveravam GA4 status...":"Checking GA4 status..."}</div>}

      {!ga4Loading&&ga4&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div>
          <div style={{color:C.grn,fontWeight:700,fontSize:13}}>✅ {sr?"GA4 povezan":"GA4 connected"}</div>
          <div style={{color:C.mut,fontSize:11,marginTop:2}}>{ga4.property_name}</div>
        </div>
        <button onClick={disconnectGA4} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,color:C.red,fontSize:11,fontWeight:600,padding:"6px 12px",cursor:"pointer",whiteSpace:"nowrap"}}>{sr?"Otkači":"Disconnect"}</button>
      </div>}

      {!ga4Loading&&!ga4&&!(ga4Setup&&String(ga4Setup.client_id)===String(selected.id))&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{color:C.mut,fontSize:12}}>{sr?"GA4 nije povezan za ovog klijenta":"GA4 is not connected for this client"}</div>
        <button onClick={connectGA4} style={{background:"rgba(0,212,255,0.15)",border:"1px solid rgba(0,212,255,0.3)",borderRadius:8,color:"#00D4FF",fontSize:12,fontWeight:700,padding:"8px 14px",cursor:"pointer",whiteSpace:"nowrap"}}>🔗 {sr?"Poveži GA4":"Connect GA4"}</button>
      </div>}

      {ga4Setup&&String(ga4Setup.client_id)===String(selected.id)&&<div>
        <div style={{color:C.txt,fontWeight:700,fontSize:13,marginBottom:10}}>{sr?"Izaberi GA4 nalog za ovog klijenta:":"Choose a GA4 account for this client:"}</div>
        {ga4Setup.properties.length===0&&<div style={{color:C.mut,fontSize:12}}>{sr?"Nije pronađen nijedan GA4 nalog na ovom Google nalogu.":"No GA4 accounts found on this Google account."}</div>}
        {ga4Setup.properties.map(p=><div key={p.property_id} onClick={()=>!ga4Saving&&savePropertySelection(p)}
          style={{padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:8,marginBottom:6,cursor:ga4Saving?"default":"pointer",opacity:ga4Saving?0.6:1}}>
          <div style={{color:C.txt,fontSize:13,fontWeight:600}}>{p.property_name}</div>
          <div style={{color:C.mut,fontSize:11}}>{p.account_name}</div>
        </div>)}
      </div>}
    </div>

    {ga4Error&&<div style={{color:C.red,fontSize:12,marginBottom:16}}>⚠️ {sr?"Greška pri povezivanju GA4":"GA4 connection error"}: {ga4Error}</div>}

    <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px 16px",marginBottom:20}}>
      {gadsLoading&&<div style={{color:C.mut,fontSize:12}}>{sr?"Proveravam Google Ads status...":"Checking Google Ads status..."}</div>}

      {!gadsLoading&&gads&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div>
          <div style={{color:C.grn,fontWeight:700,fontSize:13}}>✅ {sr?"Google Ads povezan":"Google Ads connected"}</div>
          <div style={{color:C.mut,fontSize:11,marginTop:2}}>{gads.account_name} ({gads.customer_id}){gads.manager_id?` · ${sr?"preko MCC":"via MCC"}`:""}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={refreshGoogleAdsHistory} disabled={gadsBackfilling} style={{background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:8,color:"#00D4FF",fontSize:11,fontWeight:600,padding:"6px 12px",cursor:gadsBackfilling?"default":"pointer",whiteSpace:"nowrap"}}>{gadsBackfilling?(sr?"Osvežavam...":"Refreshing..."):(sr?"🔄 Osveži istoriju":"🔄 Refresh history")}</button>
          <button onClick={disconnectGoogleAds} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,color:C.red,fontSize:11,fontWeight:600,padding:"6px 12px",cursor:"pointer",whiteSpace:"nowrap"}}>{sr?"Otkači":"Disconnect"}</button>
        </div>
      </div>}

      {!gadsLoading&&!gads&&!(gadsSetup&&String(gadsSetup.client_id)===String(selected.id))&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <div style={{color:C.mut,fontSize:12}}>{sr?"Google Ads nije povezan za ovog klijenta":"Google Ads is not connected for this client"}</div>
        <button onClick={connectGoogleAds} style={{background:"rgba(0,212,255,0.15)",border:"1px solid rgba(0,212,255,0.3)",borderRadius:8,color:"#00D4FF",fontSize:12,fontWeight:700,padding:"8px 14px",cursor:"pointer",whiteSpace:"nowrap"}}>🔗 {sr?"Poveži Google Ads":"Connect Google Ads"}</button>
      </div>}

      {gadsSetup&&String(gadsSetup.client_id)===String(selected.id)&&<div>
        <div style={{color:C.txt,fontWeight:700,fontSize:13,marginBottom:10}}>{sr?"Izaberi Google Ads nalog za ovog klijenta:":"Choose a Google Ads account for this client:"}</div>
        {gadsSetup.properties.length===0&&<div style={{color:C.mut,fontSize:12}}>{sr?"Nije pronađen nijedan Google Ads nalog na ovom Google nalogu.":"No Google Ads accounts found on this Google account."}</div>}
        {gadsSetup.properties.map(p=><div key={p.customer_id} onClick={()=>!gadsSaving&&saveGoogleAdsSelection(p)}
          style={{padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:8,marginBottom:6,cursor:gadsSaving?"default":"pointer",opacity:gadsSaving?0.6:1}}>
          <div style={{color:C.txt,fontSize:13,fontWeight:600}}>{p.account_name}</div>
          <div style={{color:C.mut,fontSize:11}}>{p.customer_id}{p.manager_id?` · ${sr?"preko MCC":"via MCC"} ${p.manager_id}`:""}</div>
        </div>)}
      </div>}
    </div>

    {gadsError&&<div style={{color:C.red,fontSize:12,marginBottom:16}}>⚠️ {sr?"Greška pri povezivanju Google Ads":"Google Ads connection error"}: {gadsError}</div>}

  </div>;

  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.m10t}</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 20px"}}>{t.m10s}</p>

    {!newClientOpen&&<button onClick={()=>setNewClientOpen(true)} style={{background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,color:C.acl,fontSize:13,fontWeight:700,padding:"10px 16px",cursor:"pointer",marginBottom:20}}>+ {sr?"Novi klijent":"New client"}</button>}
    {newClientOpen&&<div style={{display:"flex",gap:8,marginBottom:20}}>
      <input value={newClientName} onChange={e=>setNewClientName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addClient()} autoFocus placeholder={sr?"Ime klijenta...":"Client name..."} style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.05)",color:C.txt,fontSize:13}}/>
      <button onClick={addClient} disabled={creatingClient||!newClientName.trim()} style={{background:"linear-gradient(135deg,#6366F1,#4f46e5)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,padding:"10px 16px",cursor:"pointer"}}>{sr?"Sačuvaj":"Save"}</button>
      <button onClick={()=>{setNewClientOpen(false);setNewClientName("");}} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12}}>{sr?"Otkaži":"Cancel"}</button>
    </div>}

    {loading&&<div aria-busy="true" aria-label={sr?"Učitavam klijente":"Loading clients"}>{[0,1,2].map(i=><div key={i} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
      <div style={{flex:1}}><Sk w="30%" h={14} style={{marginBottom:8}}/><Sk w="45%" h={10}/></div><Sk w={90} h={32} r={10}/>
    </div>)}</div>}

    {!loading&&clients.length===0&&<div style={{textAlign:"center",padding:"32px 0"}}>
      <div style={{fontSize:40,marginBottom:12}}>👥</div>
      <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:8}}>{sr?"Još nema klijenata":"No clients yet"}</div>
      <div style={{color:C.mut,fontSize:13,marginBottom:20}}>{sr?"Klikni \"+ Novi klijent\" iznad da dodaš prvog klijenta. Posle ga po želji možeš povezati sa GA4 i Google Ads nalogom.":"Click \"+ New client\" above to add your first client. You can then connect it to GA4 and Google Ads if you want."}</div>
    </div>}

    {!loading&&clients.length>0&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      {clients.map((c,ci)=><div key={c.id} className="pm-in" style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",animationDelay:`${Math.min(ci,10)*40}ms`}}>
        <div onClick={()=>loadAnalyses(c)} style={{cursor:"pointer",flex:1}}
          onMouseEnter={e=>e.currentTarget.parentElement.style.borderColor="rgba(99,102,241,0.4)"}
          onMouseLeave={e=>e.currentTarget.parentElement.style.borderColor=C.brd}>
          <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:4}}>👤 {c.name}</div>
          <div style={{color:C.mut,fontSize:12}}>{sr?"Klijent od":"Client since"}: {new Date(c.created_at).toLocaleDateString(sr?"sr-RS":"en-US")}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div onClick={()=>loadAnalyses(c)} style={{color:C.acl,fontSize:13,fontWeight:600,cursor:"pointer"}}>{t.open} →</div>
          <button onClick={()=>deleteClient(c.id)} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,color:C.red,fontSize:11,fontWeight:600,padding:"4px 10px",cursor:"pointer"}}>
            {sr?"Obriši":"Delete"}
          </button>
        </div>
      </div>)}
    </div>}
  </div>;
}

function ProductIntelligenceMod({t,lang,goMod}){
  useEffect(()=>{ pmAnimReset("pi:"); },[]); // pri svakom ulasku u modul brojevi se odbrojavaju od 0
  const sr=lang==="sr";
  const [clients,setClients]=useState([]);
  const [clientsLoading,setClientsLoading]=useState(true);
  const [selectedClient,setSelectedClient]=useState(null);
  useEffect(()=>{ pmScrollTop(); },[selectedClient]); // izbor klijenta / povratak na listu – na vrh
  const [period,setPeriod]=useState("7"); // podrazumevano 7 dana (brze ucitavanje, najcesce se gleda)
  const [customFrom,setCustomFrom]=useState("");
  const [customTo,setCustomTo]=useState("");
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);
  const [filter,setFilter]=useState("all");
  const [measure,setMeasure]=useState("viewed");
  const [paidOrganic,setPaidOrganic]=useState(null);
  const [sourcePlatform,setSourcePlatform]=useState(null);
  const [aiBrief,setAiBrief]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [err,setErr]=useState("");
  const [search,setSearch]=useState("");
  const [sortKey,setSortKey]=useState("revenue");
  const [sortDir,setSortDir]=useState("desc");
  const [visibleCount,setVisibleCount]=useState(50);
  const [newClientOpen,setNewClientOpen]=useState(false);
  const [newClientName,setNewClientName]=useState("");
  const [creatingClient,setCreatingClient]=useState(false);
  const briefReqId=useRef(0);
  const lastData=useRef(null);

  useEffect(()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setClientsLoading(false); return; }
    fetch(`/api/clients?user_id=${uid}`).then(r=>r.json()).then(d=>setClients(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setClientsLoading(false));
  },[]);

  const addClient=async()=>{
    if(!newClientName.trim()) return;
    setCreatingClient(true);
    try{
      const uid=await getOrCreateUser();
      const r=await fetch("/api/clients",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({user_id:uid,name:newClientName.trim()})
      });
      const c=await r.json();
      if(r.ok&&c.id){
        setClients(prev=>[c,...prev]);
        setNewClientName("");
        setNewClientOpen(false);
      } else {
        alert(lang==="sr"?"Klijent nije sačuvan. Pokušaj ponovo.":"Client was not saved. Please try again.");
      }
    }catch(e){
      alert(lang==="sr"?"Klijent nije sačuvan. Proveri internet vezu i pokušaj ponovo.":"Client was not saved. Check your connection and try again.");
    }
    setCreatingClient(false);
  };

  const generateBrief=async(d)=>{
    const myId=++briefReqId.current;
    setAiLoading(true);
    try{
      const bestsellers=[...d.catalog].sort((a,b)=>b.revenue-a.revenue).slice(0,5);
      const spikes=d.catalog.filter(i=>i.viewed>=20&&i.viewedChangePct>=50).sort((a,b)=>b.viewedChangePct-a.viewedChangePct).slice(0,5);
      const abandoned=d.catalog.filter(i=>i.addedToCart>=10&&i.conversionRate<5).sort((a,b)=>b.addedToCart-a.addedToCart).slice(0,5);

      const summary=`Best-selleri: ${bestsellers.map(b=>`${b.name} (${fmtMoney(b.revenue,d.currency)}, ${b.purchased} kupovina)`).join("; ")||"nema"}.
Skokovi u pregledima: ${spikes.map(s=>`${s.name} (+${s.viewedChangePct.toFixed(0)}%)`).join("; ")||"nema"}.
Napuštene korpe: ${abandoned.map(a=>`${a.name} (${a.addedToCart} u korpi, ${a.conversionRate.toFixed(1)}% konverzija)`).join("; ")||"nema"}.`;

      const prompt=sr
        ?`Ti si e-commerce analitičar. Piši isključivo na srpskom jeziku, ekavski (ne "prosječan" već "prosečan", ne "također" već "takođe", ne "riječi" već "reči", ne "tjedan" već "nedelja"). Na osnovu ovih GA4 podataka o proizvodima za poslednjih ${d.periodDays} dana, napiši uvid u TAČNO tri linije, bez markdown formatiranja (bez **, bez #), svaka linija u formatu "Naziv: rečenica":

Best-selleri: [jedna rečenica o najboljim proizvodima]
Skokovi: [jedna rečenica o proizvodima koji rastu, ili napiši da nema značajnih skokova ako nema]
Napuštene korpe: [jedna rečenica o proizvodima sa niskom konverzijom iz korpe, ili napiši da nema ako nema]

Podaci:
${summary}`
        :`You are an e-commerce analyst. Based on this GA4 product data for the last ${d.periodDays} days, write an insight in EXACTLY three lines, no markdown formatting, each line as "Label: sentence":

Bestsellers: [one sentence about top products]
Spikes: [one sentence about rising products, or state there are none significant]
Abandoned carts: [one sentence about products with low cart-to-purchase conversion, or state there are none]

Data:
${summary}`;

      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:300,messages:[{role:"user",content:prompt}]})
      });
      const rd=await res.json();
      if(myId!==briefReqId.current) return; // stigao je zakasneli odgovor, ignoriši ga
      setAiBrief(rd.content?.[0]?.text||"");
    }catch(e){
      if(myId===briefReqId.current) setAiBrief("");
    }
    if(myId===briefReqId.current) setAiLoading(false);
  };

  // AI uvid se pise samo na dugme (stedi tokene). Kad se promeni jezik, stari uvid se brise - korisnik ga po zelji ponovo napise.
  useEffect(()=>{
    briefReqId.current++; setAiBrief(""); setAiLoading(false);
  },[lang]);

  const load=async(client,params)=>{
    setLoading(true); setErr(""); setData(null); setAiBrief(""); setFilter("all");
    setPaidOrganic(null); setSourcePlatform(null); setMeasure("viewed");
    setSearch(""); setSortKey("revenue"); setSortDir("desc"); setVisibleCount(50);
    lastData.current=null;
    try{
      const qs=params.from&&params.to?`from=${params.from}&to=${params.to}`:`days=${params.days}`;
      const res=await fetch(`/api/product-intelligence?client_id=${client.id}&${qs}`);
      if(res.status===404){ setErr("no_ga4"); setLoading(false); return; }
      const d=await res.json();
      if(!res.ok) throw new Error(d.error||(sr?"Greška pri učitavanju":"Loading error"));
      setData(d);
      lastData.current=d;
      briefReqId.current++; // stari AI uvid (ako je jos u izradi) vise ne vazi za nove podatke
    }catch(e){ setErr(e.message); }
    setLoading(false);
  };

  const applyPeriod=(p)=>{
    setPeriod(p);
    if(p!=="custom"&&selectedClient) load(selectedClient,{days:p});
  };
  const applyCustom=()=>{
    if(selectedClient&&customFrom&&customTo) load(selectedClient,{from:customFrom,to:customTo});
  };

  const periods=[{v:"7",l:sr?"7 dana":"7 days"},{v:"30",l:sr?"30 dana":"30 days"},{v:"90",l:sr?"90 dana":"90 days"},{v:"custom",l:sr?"Prilagođeno":"Custom"}];
  const filters=[
    {v:"all",l:sr?"Ceo katalog":"Full catalog"},
    {v:"bestsellers",l:sr?"Best-selleri":"Bestsellers"},
    {v:"spikes",l:sr?"Skokovi":"Spikes"},
    {v:"drops",l:sr?"Padovi":"Drops"},
    {v:"abandoned",l:sr?"Napuštene korpe":"Abandoned carts"},
    {v:"sources",l:sr?"Izvori":"Sources"},
    {v:"categories",l:sr?"Kategorije":"Categories"}
  ];
  const measures={
    viewed:{min:20,label:sr?"Pregledi":"Viewed",field:"viewed",changeField:"viewedChangePct",prevField:"previousViewed"},
    addedToCart:{min:10,label:sr?"Korpa":"Cart",field:"addedToCart",changeField:"cartChangePct",prevField:"previousAddedToCart"},
    purchased:{min:5,label:sr?"Kupljeno":"Purchased",field:"purchased",changeField:"purchasedChangePct",prevField:"previousPurchased"}
  };
  const platformLabels={meta:"Meta",google:"Google",tiktok:"TikTok",direct:sr?"Direktan":"Direct",other:sr?"Ostalo":"Other"};

  const sortRows=(arr)=>{
    return [...arr].sort((a,b)=>{
      const av=a[sortKey],bv=b[sortKey];
      if(typeof av==="string") return sortDir==="desc"?bv.localeCompare(av):av.localeCompare(bv);
      return sortDir==="desc"?bv-av:av-bv;
    });
  };
  const toggleSort=(key)=>{
    if(sortKey===key) setSortDir(d=>d==="desc"?"asc":"desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const isExplorable=filter==="all"||filter==="categories"||(filter==="sources"&&paidOrganic&&sourcePlatform);

  const rawRows=()=>{
    if(!data) return [];
    if(filter==="bestsellers") return [...data.catalog].sort((a,b)=>b.revenue-a.revenue).slice(0,10);
    if(filter==="spikes"){
      const cfg=measures[measure];
      const eligible=data.catalog.filter(i=>i[cfg.field]>=cfg.min&&i[cfg.changeField]>=50);
      const fromZero=eligible.filter(i=>i[cfg.prevField]===0).sort((a,b)=>b[cfg.field]-a[cfg.field]).slice(0,5);
      const fromZeroIds=new Set(fromZero.map(i=>i.id));
      const percentSpikes=eligible.filter(i=>!fromZeroIds.has(i.id)).sort((a,b)=>b[cfg.changeField]-a[cfg.changeField]).slice(0,10-fromZero.length);
      return [...fromZero,...percentSpikes];
    }
    if(filter==="drops"){
      const cfg=measures[measure];
      return data.catalog.filter(i=>i[cfg.field]>=cfg.min&&i[cfg.changeField]<=-50).sort((a,b)=>a[cfg.changeField]-b[cfg.changeField]).slice(0,10);
    }
    if(filter==="abandoned") return [...data.catalog].filter(i=>i.addedToCart>=10&&i.conversionRate<5).sort((a,b)=>b.addedToCart-a.addedToCart).slice(0,10);
    if(filter==="sources") return (paidOrganic&&sourcePlatform)?(data.sourceCatalog[paidOrganic][sourcePlatform]||[]):[];
    if(filter==="categories") return data.categories||[];
    return data.catalog;
  };

  const filteredRows=()=>{
    let r=rawRows();
    if(isExplorable){
      if(search.trim()){
        const q=search.trim().toLowerCase();
        r=r.filter(i=>i.name.toLowerCase().includes(q)||(i.id!==undefined&&String(i.id).toLowerCase().includes(q)));
      }
      r=sortRows(r);
    }
    return r;
  };

  const SortTh=({k,label,align})=><th onClick={()=>isExplorable&&toggleSort(k)} style={{padding:"6px 4px",fontWeight:600,textAlign:align||"right",cursor:isExplorable?"pointer":"default",userSelect:"none",whiteSpace:"nowrap"}}>
    {label}{isExplorable&&sortKey===k?(sortDir==="desc"?" ▼":" ▲"):""}
  </th>;

  // IZBOR KLIJENTA
  if(!selectedClient) return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>🛍️ Product Intelligence</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 20px"}}>{t.m12s}</p>

    {!newClientOpen&&<button onClick={()=>setNewClientOpen(true)} style={{background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,color:C.acl,fontSize:13,fontWeight:700,padding:"10px 16px",cursor:"pointer",marginBottom:20}}>+ {sr?"Novi klijent":"New client"}</button>}
    {newClientOpen&&<div style={{display:"flex",gap:8,marginBottom:20}}>
      <input value={newClientName} onChange={e=>setNewClientName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addClient()} autoFocus placeholder={sr?"Ime klijenta...":"Client name..."} style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.05)",color:C.txt,fontSize:13}}/>
      <button onClick={addClient} disabled={creatingClient||!newClientName.trim()} style={{background:"linear-gradient(135deg,#6366F1,#4f46e5)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,padding:"10px 16px",cursor:"pointer"}}>{sr?"Sačuvaj":"Save"}</button>
      <button onClick={()=>{setNewClientOpen(false);setNewClientName("");}} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12}}>{sr?"Otkaži":"Cancel"}</button>
    </div>}

    {clientsLoading
      ?<div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",color:C.acl,fontSize:13,textAlign:"center"}}>
        ✦ {sr?"Učitavam klijente...":"Loading clients..."}
      </div>
      :clients.length===0
      ?<div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",color:C.mut,fontSize:13,textAlign:"center"}}>
        {sr?"Nema klijenata još. Dodaj jednog iznad.":"No clients yet. Add one above."}
      </div>
      :<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {clients.map(c=><button key={c.id} onClick={()=>{setSelectedClient(c);load(c,{days:period});}} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:10,padding:"12px 16px",textAlign:"left",cursor:"pointer",color:C.txt,fontWeight:600,fontSize:13}}>
          👤 {c.name}
        </button>)}
      </div>
    }
  </div>;

  const rows=filteredRows();
  const visibleRows=isExplorable?rows.slice(0,visibleCount):rows;
  const showTrendCol=filter==="spikes"||filter==="drops";
  const trendCfg=measures[measure];

  // KONTROLNA TABLA
  return <div>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div>
        <button onClick={()=>{setSelectedClient(null);setData(null);}} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12,padding:0,marginBottom:4}}>{sr?"← Svi klijenti":"← All clients"}</button>
        <h2 style={{fontSize:18,fontWeight:800,margin:0}}>{selectedClient.name}</h2>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {periods.map(p=><button key={p.v} onClick={()=>applyPeriod(p.v)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${period===p.v?"rgba(99,102,241,0.6)":C.brd}`,background:period===p.v?"rgba(99,102,241,0.2)":"transparent",color:period===p.v?C.acl:C.mut,fontSize:12,fontWeight:600,cursor:"pointer"}}>{p.l}</button>)}
        <button onClick={()=>invLaunch(goMod,{client:selectedClient,period,customFrom,customTo,qtype:"other",question:sr?"Šta se promenilo i zašto?":"What changed and why?",lang})} title={sr?"Pokreni istragu za ovog klijenta i period":"Investigate this client and period"} style={invBtnStyle}>🔎 {sr?"Istraži promene":"Investigate changes"}</button>
      </div>
    </div>

    {period==="custom"&&<div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:16,flexWrap:"wrap",background:"rgba(255,255,255,0.02)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px 14px"}}>
      <div style={{flex:1,minWidth:140}}><Lbl c={sr?"Od":"From"}/><DIn v={customFrom} ch={setCustomFrom}/></div>
      <div style={{flex:1,minWidth:140}}><Lbl c={sr?"Do":"To"}/><DIn v={customTo} ch={setCustomTo}/></div>
      <button onClick={applyCustom} disabled={!customFrom||!customTo} style={{padding:"12px 18px",borderRadius:10,border:"none",background:!customFrom||!customTo?"rgba(99,102,241,0.3)":"linear-gradient(135deg,#6366F1,#4f46e5)",color:"#fff",fontSize:13,fontWeight:700,cursor:!customFrom||!customTo?"default":"pointer"}}>{sr?"Primeni":"Apply"}</button>
    </div>}

    {loading&&<div aria-busy="true" aria-label={sr?"Učitavam GA4 podatke":"Loading GA4 data"}>
      <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"14px 16px",marginBottom:16}}><Sk w={90} h={10} style={{marginBottom:10}}/><Sk w="70%" h={12}/></div>
      <Sk w={220} h={12} style={{marginBottom:14}}/>
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>{[86,96,74,110,90,84].map((w,i)=><Sk key={i} w={w} h={30} r={20}/>)}</div>
      <SkTable rows={8} cols={8}/>
    </div>}

    {err==="no_ga4"&&!loading&&<div style={{background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:12,padding:"16px",color:C.txt,fontSize:13,marginBottom:16}}>
      🔗 {sr?"GA4 nije povezan za ovog klijenta. Idi u":"GA4 is not connected for this client. Go to"} <b>Clients</b> {sr?"da ga povežeš.":"to connect it."}
    </div>}
    {err&&err!=="no_ga4"&&!loading&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"16px",color:C.red,fontSize:13,marginBottom:16}}>⚠️ {err}</div>}

    {data&&!loading&&<>
      <div className="pm-in" style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <div style={{color:C.acl,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginBottom:8}}>{sr?"AI Uvid":"AI Insight"}</div>
        {aiLoading
          ?<div style={{color:C.mut,fontSize:13}}>{sr?"Analiziram...":"Analyzing..."}</div>
          :!aiBrief
          ?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
            <div style={{color:C.mut,fontSize:13}}>{sr?"Kratak rezime: best-selleri, skokovi i napuštene korpe za izabrani period.":"A short summary: bestsellers, spikes and abandoned carts for the selected period."}</div>
            <button onClick={()=>lastData.current&&generateBrief(lastData.current)} style={{padding:"8px 14px",borderRadius:10,border:"1px solid rgba(99,102,241,0.5)",background:"rgba(99,102,241,0.15)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>✦ {sr?"Napiši AI uvid":"Write AI insight"}</button>
          </div>
          :<div style={{color:C.txt,fontSize:13,lineHeight:1.7}}>
            {aiBrief.split("\n").filter(l=>l.trim()).map((line,i)=>{
              const idx=line.indexOf(":");
              if(idx===-1) return <div key={i}>{line}</div>;
              return <div key={i}><b>{line.slice(0,idx+1)}</b>{line.slice(idx+1)}</div>;
            })}
            <button onClick={()=>lastData.current&&generateBrief(lastData.current)} style={{marginTop:8,padding:"5px 10px",borderRadius:8,border:`1px solid ${C.brd}`,background:"transparent",color:C.mut,fontSize:11,fontWeight:600,cursor:"pointer"}}>{sr?"Napiši ponovo":"Rewrite"}</button>
          </div>
        }
      </div>

      <div className="pm-in" style={{color:C.mut,fontSize:12,marginBottom:14,animationDelay:"60ms"}}>
        <AnimNum k={`pi:${selectedClient.id}:rev`} value={Object.values(data.sourceTotals.paid).reduce((a,b)=>a+b,0)+Object.values(data.sourceTotals.organic).reduce((a,b)=>a+b,0)} format={v=>fmtMoney(v,data.currency)}/> {sr?"ukupan prihod za period":"total revenue for period"}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {filters.map(f=><button key={f.v} onClick={()=>{setFilter(f.v);setPaidOrganic(null);setSourcePlatform(null);setSearch("");setVisibleCount(50);}} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${filter===f.v?"rgba(99,102,241,0.6)":C.brd}`,background:filter===f.v?"rgba(99,102,241,0.2)":"transparent",color:filter===f.v?C.acl:C.mut,fontSize:12,fontWeight:600,cursor:"pointer"}}>{f.l}</button>)}
      </div>

      {filter==="bestsellers"&&<div style={{color:C.mut,fontSize:11,marginBottom:14,fontStyle:"italic"}}>ⓘ {sr?"Varijante istog proizvoda (npr. različite boje) prikazujemo posebno, po ID-u, radi preciznosti. GA4-ov sopstveni izveštaj ih grupiše pod isto ime, pa se pojedinačni redovi ovde mogu razlikovati od GA4 'top proizvod' pogleda - zbir svih varijanti se poklapa.":"We show variants of the same product (e.g. different colors) separately, by ID, for precision. GA4's own report groups them under one name, so individual rows here may differ from GA4's 'top product' view - the sum of all variants matches."}</div>}

      {(filter==="spikes"||filter==="drops")&&<div style={{marginBottom:14}}>
        <Lbl c={sr?"Meri po":"Measure by"}/>
        <div style={{display:"flex",gap:6}}>
          {Object.keys(measures).map(k=><button key={k} onClick={()=>setMeasure(k)} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${measure===k?"rgba(99,102,241,0.6)":C.brd}`,background:measure===k?"rgba(99,102,241,0.2)":"transparent",color:measure===k?C.acl:C.mut,fontSize:12,fontWeight:600,cursor:"pointer"}}>{measures[k].label}</button>)}
        </div>
      </div>}

      {filter==="all"&&data.catalogTruncated&&<div style={{color:C.mut,fontSize:12,marginBottom:10}}>{sr?`Katalog ima ${data.totalProducts} proizvoda u ovom periodu – prikazano je ${data.catalog.length} najvažnijih (svi sa kupovinom ili korpom, pa najgledaniji). Ukupan prihod je za ceo katalog.`:`The catalog has ${data.totalProducts} products in this period – the ${data.catalog.length} most relevant are shown (all with purchases or carts, then most viewed). Total revenue covers the full catalog.`}</div>}

      {filter==="sources"&&<div style={{marginBottom:10}}>
        <Lbl c={sr?"💰 Plaćeno":"💰 Paid"}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {["meta","google","tiktok","other"].map(p=><button key={p} onClick={()=>{setPaidOrganic("paid");setSourcePlatform(p);setSearch("");setVisibleCount(50);}} style={{flex:"1 1 100px",padding:"10px",borderRadius:10,border:`1px solid ${paidOrganic==="paid"&&sourcePlatform===p?"rgba(0,212,255,0.6)":C.brd}`,background:paidOrganic==="paid"&&sourcePlatform===p?"rgba(0,212,255,0.15)":"rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"left"}}>
            <div style={{color:C.mut,fontSize:11,fontWeight:700,marginBottom:2}}>{platformLabels[p]}</div>
            <div style={{color:paidOrganic==="paid"&&sourcePlatform===p?"#00D4FF":C.txt,fontSize:14,fontWeight:700}}>{fmtMoney(data.sourceTotals.paid[p]||0,data.currency)}</div>
          </button>)}
        </div>
        <Lbl c={sr?"🌱 Organsko":"🌱 Organic"}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          {["meta","google","tiktok","direct","other"].map(p=><button key={p} onClick={()=>{setPaidOrganic("organic");setSourcePlatform(p);setSearch("");setVisibleCount(50);}} style={{flex:"1 1 100px",padding:"10px",borderRadius:10,border:`1px solid ${paidOrganic==="organic"&&sourcePlatform===p?"rgba(52,211,153,0.6)":C.brd}`,background:paidOrganic==="organic"&&sourcePlatform===p?"rgba(52,211,153,0.15)":"rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"left"}}>
            <div style={{color:C.mut,fontSize:11,fontWeight:700,marginBottom:2}}>{platformLabels[p]}</div>
            <div style={{color:paidOrganic==="organic"&&sourcePlatform===p?C.grn:C.txt,fontSize:14,fontWeight:700}}>{fmtMoney(data.sourceTotals.organic[p]||0,data.currency)}</div>
          </button>)}
        </div>
        {!(paidOrganic&&sourcePlatform)&&<div style={{color:C.mut,fontSize:12,textAlign:"center",padding:"10px 0"}}>{sr?"Izaberi kanal iznad da vidiš proizvode":"Pick a channel above to see products"}</div>}
        {paidOrganic&&sourcePlatform&&<div style={{color:C.mut,fontSize:11,marginBottom:10,fontStyle:"italic"}}>ⓘ {sr?"Zbir prihoda po proizvodima ispod može biti nešto manji od broja iznad, zbog GA4 ograničenja kod transakcija bez potpunih podataka o proizvodu.":"The per-product revenue sum below may be slightly lower than the number above, due to a GA4 limitation with transactions missing full product data."}</div>}
      </div>}

      {isExplorable&&<input value={search} onChange={e=>{setSearch(e.target.value);setVisibleCount(50);}} placeholder={sr?"🔍 Pretraži po nazivu ili ID-u...":"🔍 Search by name or ID..."} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.03)",color:C.txt,fontSize:13,marginBottom:14,boxSizing:"border-box"}}/>}

      {filter==="drops"&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",padding:"10px 14px",borderRadius:10,border:"1px solid rgba(129,140,248,0.3)",background:"rgba(129,140,248,0.06)",marginBottom:10}}>
        <span style={{color:C.txt,fontSize:12.5}}>{sr?"Vidiš pad? Istraga proverava kanale, uređaje, korake kupovine, cene i proizvode.":"See a drop? The investigation checks channels, devices, purchase steps, prices and products."}</span>
        <button onClick={()=>invLaunch(goMod,{client:selectedClient,period,customFrom,customTo,qtype:"revenue_drop",question:sr?"Zašto pojedini proizvodi padaju?":"Why are some products dropping?",lang})} style={invBtnStyle}>🔎 {sr?"Istraži zašto":"Investigate why"}</button>
      </div>}
      {filter==="categories"&&data.hasCategories===false&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Ovaj klijent nema podešene kategorije proizvoda u GA4-u.":"This client doesn't have product categories set up in GA4."}</div>}

      {rows.length===0&&filter!=="categories"&&(filter!=="sources"||(paidOrganic&&sourcePlatform))&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Nema proizvoda u ovoj kategoriji za izabrani period.":"No products in this category for the selected period."}</div>}

      {visibleRows.length>0&&<div key={`${filter}|${paidOrganic||""}|${sourcePlatform||""}`} className="pm-in" style={{overflowX:"auto",animationDelay:"120ms"}}>
        <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
          <thead>
            <tr style={{color:C.mut,textAlign:"left"}}>
              <SortTh k="name" label={sr?"Proizvod":"Product"} align="left"/>
              <SortTh k="viewed" label={sr?"Pregledi":"Viewed"}/>
              <SortTh k="addedToCart" label={sr?"Korpa":"Cart"}/>
              <SortTh k="purchased" label={sr?"Kupljeno":"Purchased"}/>
              <SortTh k="revenue" label={sr?"Prihod":"Revenue"}/>
              <SortTh k="viewToCartRate" label={sr?"Pregled→Korpa":"View→Cart"}/>
              <SortTh k="cartToPurchaseRate" label={sr?"Korpa→Kupovina":"Cart→Purchase"}/>
              <SortTh k="conversionRate" label={sr?"Ukupna konverzija":"Overall conversion"}/>
              {showTrendCol&&<th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Promena":"Change"}</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r,i)=><tr key={i} className={i<12?"pm-in":undefined} style={{borderTop:`1px solid ${C.brd}`,...(i<12?{animationDelay:`${140+i*25}ms`}:null)}}>
              <td style={{padding:"8px 4px",color:C.txt}}>{r.name}{r.id!==undefined&&<span style={{color:C.mut}}> ({r.id})</span>}</td>
              <td style={{padding:"8px 4px",textAlign:"right",color:C.mut}}>{r.viewed.toLocaleString()}</td>
              <td style={{padding:"8px 4px",textAlign:"right",color:C.mut}}>{r.addedToCart.toLocaleString()}</td>
              <td style={{padding:"8px 4px",textAlign:"right",fontWeight:600,color:C.txt}}>{r.purchased.toLocaleString()}</td>
              <td style={{padding:"8px 4px",textAlign:"right",color:C.grn}}>{fmtMoney(r.revenue,data.currency)}</td>
              <td style={{padding:"8px 4px",textAlign:"right",color:C.mut}}>{r.viewToCartRate.toFixed(1)}%</td>
              <td style={{padding:"8px 4px",textAlign:"right",color:C.mut}}>{r.cartToPurchaseRate.toFixed(1)}%</td>
              <td style={{padding:"8px 4px",textAlign:"right",color:C.yel}}>{r.conversionRate.toFixed(1)}%</td>
              {showTrendCol&&<td style={{padding:"8px 4px",textAlign:"right",fontWeight:700,color:filter==="spikes"?C.grn:C.red}}>
                {filter==="spikes"&&r[trendCfg.prevField]===0
                  ?`0→${r[trendCfg.field]}`
                  :`${r[trendCfg.changeField]>=0?"+":""}${r[trendCfg.changeField].toFixed(0)}%`
                }
              </td>}
            </tr>)}
          </tbody>
        </table>
      </div>}

      {isExplorable&&rows.length>visibleCount&&<button onClick={()=>setVisibleCount(v=>v+50)} style={{marginTop:14,width:"100%",padding:"10px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.03)",color:C.mut,fontSize:12,fontWeight:600,cursor:"pointer"}}>
        {sr?`Prikaži još 50 (${visibleCount} / ${rows.length})`:`Show 50 more (${visibleCount} / ${rows.length})`}
      </button>}
    </>}
  </div>;
}

function AskDataMod({t,lang}){
  const sr=lang==="sr";
  const [clients,setClients]=useState([]);
  const [clientsLoading,setClientsLoading]=useState(true);
  const [selectedClient,setSelectedClient]=useState(null);
  useEffect(()=>{ pmScrollTop(); },[selectedClient]); // izbor klijenta / povratak na listu – na vrh
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [newClientOpen,setNewClientOpen]=useState(false);
  const [newClientName,setNewClientName]=useState("");
  const [creatingClient,setCreatingClient]=useState(false);
  const scrollRef=useRef(null);

  useEffect(()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setClientsLoading(false); return; }
    fetch(`/api/clients?user_id=${uid}`).then(r=>r.json()).then(d=>setClients(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setClientsLoading(false));
  },[]);

  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
  },[messages,sending]);

  const addClient=async()=>{
    if(!newClientName.trim()) return;
    setCreatingClient(true);
    try{
      const uid=await getOrCreateUser();
      const r=await fetch("/api/clients",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({user_id:uid,name:newClientName.trim()})
      });
      const c=await r.json();
      if(r.ok&&c.id){
        setClients(prev=>[c,...prev]);
        setNewClientName("");
        setNewClientOpen(false);
      } else {
        alert(lang==="sr"?"Klijent nije sačuvan. Pokušaj ponovo.":"Client was not saved. Please try again.");
      }
    }catch(e){
      alert(lang==="sr"?"Klijent nije sačuvan. Proveri internet vezu i pokušaj ponovo.":"Client was not saved. Check your connection and try again.");
    }
    setCreatingClient(false);
  };

  const send=async()=>{
    if(!input.trim()||sending||!selectedClient) return;
    const q=input.trim();
    setInput("");
    const historyForRequest=messages;
    setMessages(m=>[...m,{role:"user",text:q}]);
    setSending(true);
    try{
      const res=await fetch("/api/ga4-ask",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({client_id:selectedClient.id,question:q,history:historyForRequest,lang})
      });
      if(res.status===404){
        setMessages(m=>[...m,{role:"assistant",text:sr?"GA4 nije povezan za ovog klijenta. Idi u Clients da ga povežeš.":"GA4 is not connected for this client. Go to Clients to connect it."}]);
        setSending(false);
        return;
      }
      const d=await res.json();
      if(!res.ok) throw new Error(d.error||"Error");
      setMessages(m=>[...m,{role:"assistant",text:d.answer}]);
    }catch(e){
      setMessages(m=>[...m,{role:"assistant",text:sr?"Došlo je do greške. Pokušaj ponovo.":"An error occurred. Please try again."}]);
    }
    setSending(false);
  };

  const newConversation=()=>setMessages([]);

  // IZBOR KLIJENTA
  if(!selectedClient) return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>💬 Ask Your Data</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 20px"}}>{t.m13s}</p>

    {!newClientOpen&&<button onClick={()=>setNewClientOpen(true)} style={{background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,color:C.acl,fontSize:13,fontWeight:700,padding:"10px 16px",cursor:"pointer",marginBottom:20}}>+ {sr?"Novi klijent":"New client"}</button>}
    {newClientOpen&&<div style={{display:"flex",gap:8,marginBottom:20}}>
      <input value={newClientName} onChange={e=>setNewClientName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addClient()} autoFocus placeholder={sr?"Ime klijenta...":"Client name..."} style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.05)",color:C.txt,fontSize:13}}/>
      <button onClick={addClient} disabled={creatingClient||!newClientName.trim()} style={{background:"linear-gradient(135deg,#6366F1,#4f46e5)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,padding:"10px 16px",cursor:"pointer"}}>{sr?"Sačuvaj":"Save"}</button>
      <button onClick={()=>{setNewClientOpen(false);setNewClientName("");}} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12}}>{sr?"Otkaži":"Cancel"}</button>
    </div>}

    {clientsLoading
      ?<div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",color:C.acl,fontSize:13,textAlign:"center"}}>
        ✦ {sr?"Učitavam klijente...":"Loading clients..."}
      </div>
      :clients.length===0
      ?<div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",color:C.mut,fontSize:13,textAlign:"center"}}>
        {sr?"Nema klijenata još. Dodaj jednog iznad.":"No clients yet. Add one above."}
      </div>
      :<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {clients.map(c=><button key={c.id} onClick={()=>{setSelectedClient(c);setMessages([]);}} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:10,padding:"12px 16px",textAlign:"left",cursor:"pointer",color:C.txt,fontWeight:600,fontSize:13}}>
          👤 {c.name}
        </button>)}
      </div>
    }
  </div>;

  // CHAT EKRAN
  return <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 220px)",minHeight:420}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div>
        <button onClick={()=>{setSelectedClient(null);setMessages([]);}} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12,padding:0,marginBottom:4}}>{sr?"← Svi klijenti":"← All clients"}</button>
        <h2 style={{fontSize:18,fontWeight:800,margin:0}}>{selectedClient.name}</h2>
      </div>
      <button onClick={newConversation} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${C.brd}`,borderRadius:8,color:C.mut,fontSize:12,fontWeight:600,padding:"8px 14px",cursor:"pointer"}}>🔄 {sr?"Nov razgovor":"New conversation"}</button>
    </div>

    <div ref={scrollRef} style={{flex:1,overflowY:"auto",background:"rgba(255,255,255,0.02)",border:`1px solid ${C.brd}`,borderRadius:12,padding:16,marginBottom:12,display:"flex",flexDirection:"column",gap:10}}>
      {messages.length===0&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"40px 10px"}}>
        {sr?'Postavi pitanje o svojim GA4 podacima, npr. "Koji je najprodavaniji proizvod poslednjih 30 dana?"':'Ask a question about your GA4 data, e.g. "What\'s the top-selling product in the last 30 days?"'}
      </div>}
      {messages.map((m,i)=><div key={i} className="pm-in" style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"80%",background:m.role==="user"?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.05)",border:`1px solid ${m.role==="user"?"rgba(99,102,241,0.4)":C.brd}`,borderRadius:12,padding:"10px 14px",color:C.txt,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.text}</div>)}
      {sending&&<div className="pm-in" style={{alignSelf:"flex-start",color:C.mut,fontSize:13,display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:"rgba(255,255,255,0.05)",border:`1px solid ${C.brd}`}}><PmDots/>{sr?"Razmišljam...":"Thinking..."}</div>}
    </div>

    <div style={{display:"flex",gap:8}}>
      <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={sr?"Postavi pitanje...":"Ask a question..."} disabled={sending} style={{flex:1,padding:"12px 14px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.05)",color:C.txt,fontSize:14,boxSizing:"border-box"}}/>
      <button onClick={send} disabled={sending||!input.trim()} style={{padding:"12px 20px",borderRadius:10,border:"none",background:sending||!input.trim()?"rgba(99,102,241,0.3)":"linear-gradient(135deg,#6366F1,#4f46e5)",color:"#fff",fontSize:13,fontWeight:700,cursor:sending||!input.trim()?"default":"pointer",whiteSpace:"nowrap"}}>{sr?"Pošalji":"Send"}</button>
    </div>
  </div>;
}

// ── CAMPAIGN INTELLIGENCE: POJMOVI PRETRAGE (korak B) ────────────────────────
function CiSearchTerms({sr,mob,clientId,qs}){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [sub,setSub]=useState("neg"); // neg | opp | all
  const [thr,setThr]=useState(20);
  const [camp,setCamp]=useState("");
  const [q,setQ]=useState("");
  const [sel,setSel]=useState({});
  const [fmt,setFmt]=useState("exact");
  const [limit,setLimit]=useState(100);
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    if(!clientId||!qs) return;
    let cancelled=false;
    (async()=>{
      setLoading(true); setErr(""); setData(null); setSel({}); setCamp(""); setLimit(100);
      try{
        const uid=await getOrCreateUser();
        const r=await fetch(`/api/search-terms?client_id=${clientId}&user_id=${uid}&${qs}`);
        const d=await r.json();
        if(cancelled) return;
        if(!r.ok){
          const e=String(d.error||"");
          setErr(e==="no_gads"?(sr?"Google Ads nije povezan za ovog klijenta. Poveži ga u Clients.":"Google Ads is not connected for this client. Connect it in Clients.")
            :e==="expired"||e.includes("invalid_grant")?(sr?"Veza sa Google Ads nalogom je istekla. U Clients otkači i ponovo poveži Google Ads.":"The Google Ads connection has expired. In Clients, disconnect and reconnect Google Ads.")
            :(sr?"Pojmovi pretrage nisu učitani. Pokušaj ponovo.":"Search terms could not be loaded. Please try again."));
        } else setData(d);
      }catch(e){ if(!cancelled) setErr(sr?"Pojmovi pretrage nisu učitani. Proveri internet vezu i pokušaj ponovo.":"Search terms could not be loaded. Check your connection and try again."); }
      if(!cancelled) setLoading(false);
    })();
    return()=>{cancelled=true;};
  },[clientId,qs]);

  if(loading) return <div style={{textAlign:"center",padding:"40px 0",color:C.acl,fontWeight:700,fontSize:15}}>✦ {sr?"Učitavam pojmove pretrage iz Google Ads-a...":"Loading search terms from Google Ads..."}</div>;
  if(err) return <div style={{color:C.red,fontSize:13,padding:"12px 0"}}>{err}</div>;
  if(!data) return null;

  const eur=v=>v==null?"–":`${rsNum(v,v<100?2:0)} €`;
  const all=data.terms;
  const noSale=t=>(data.ga4?t.ga4Purchases<0.5:true)&&t.adsConversions<0.5;
  const camps=[...new Set(all.flatMap(t=>t.campaigns))].sort((a,b)=>a.localeCompare(b));
  const ql=rsFold(q.trim());
  const base=all.filter(t=>(!camp||t.campaigns.includes(camp))&&(!ql||rsFold(t.text).includes(ql)));
  const neg=base.filter(t=>t.spendEUR>=thr&&!t.isExcluded&&!t.isKeyword&&noSale(t));
  // Prilike: kad je GA4 povezan, glavnu listu cine samo pojmovi sa STVARNOM kupovinom u GA4 (po GA4 prihodu, najveci prvo);
  // pojmovi koji imaju samo Google Ads konverzije idu na dno, odvojeno, sa oznakom "samo Google Ads".
  const oppCand=base.filter(t=>!t.isKeyword&&!t.isExcluded);
  const oppMain=(data.ga4?oppCand.filter(t=>t.ga4Purchases>=1).sort((a,b)=>b.ga4RevenueEUR-a.ga4RevenueEUR||b.ga4Purchases-a.ga4Purchases)
    :oppCand.filter(t=>t.adsConversions>=1).sort((a,b)=>b.adsConvValueEUR-a.adsConvValueEUR||b.adsConversions-a.adsConversions));
  const oppAdsOnly=data.ga4?oppCand.filter(t=>t.ga4Purchases<1&&t.adsConversions>=1).sort((a,b)=>b.adsConvValueEUR-a.adsConvValueEUR||b.adsConversions-a.adsConversions).map(t=>({...t,adsOnly:true})):[];
  const opp=oppMain.concat(oppAdsOnly);
  const rows=sub==="neg"?neg:sub==="opp"?opp:base;
  const selected=rows.filter(t=>sel[t.text]);
  const format=t=>fmt==="exact"?`[${t}]`:fmt==="phrase"?`"${t}"`:t;
  const negSpend=neg.reduce((s,t)=>s+t.spendEUR,0);
  const oppRev=oppMain.reduce((s,t)=>s+(data.ga4?t.ga4RevenueEUR:t.adsConvValueEUR),0);
  const tt=data.totals;
  const cover=tt.accountSpendEUR>0?tt.coveredSpendEUR/tt.accountSpendEUR:0;

  const copy=async()=>{
    const txt=selected.map(t=>format(t.text)).join("\n");
    try{ await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(()=>setCopied(false),2000); }
    catch(e){ alert(txt); }
  };
  const allOn=rows.slice(0,limit).length>0&&rows.slice(0,limit).every(t=>sel[t.text]);
  const toggleAll=()=>{ const on=!allOn; setSel(p=>{const n={...p}; rows.slice(0,limit).forEach(t=>{n[t.text]=on;}); return n;}); };

  const pill=on=>({padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:on?"1px solid rgba(99,102,241,0.7)":`1px solid ${C.brd}`,background:on?"rgba(99,102,241,0.2)":"transparent",color:on?"#fff":C.mut});
  const td={padding:"8px 6px",borderBottom:`1px solid ${C.brd}`,fontSize:12,color:C.txt};
  const thS={padding:"8px 6px",color:C.mut,fontWeight:600,fontSize:11,borderBottom:`1px solid ${C.brd}`,whiteSpace:"nowrap"};
  const tag=(l,c)=><span style={{fontSize:10,fontWeight:700,color:c,border:`1px solid ${c}55`,borderRadius:20,padding:"0 6px",marginLeft:4,whiteSpace:"nowrap"}}>{l}</span>;

  return <div>
    <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:12,padding:"12px 14px",marginBottom:14,fontSize:12.5,color:C.txt,lineHeight:1.55}}>
      {sr?"Pojmovi pretrage iz Search i Shopping kampanja":"Search terms from Search and Shopping campaigns"}: <b>{eur(tt.coveredSpendEUR)}</b> {sr?"od":"of"} {eur(tt.accountSpendEUR)} {sr?"ukupne potrošnje":"total spend"} (<b>{rsNum(cover*100,0)}%</b>). {sr?"Performance Max ne daje pojmove sa potrošnjom, pa nije obuhvaćen.":"Performance Max doesn't provide search terms with spend, so it isn't covered."}
    </div>
    {data.fxMissing&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>⚠️ {sr?"Kurs za konverziju u EUR trenutno nije dostupan – deo iznosa je u originalnoj valuti.":"The EUR exchange rate is currently unavailable – some amounts are in the original currency."}</div>}
    {!data.ga4&&<div style={{color:C.yel,fontSize:12,marginBottom:10}}>{data.ga4Error==="expired"?(sr?"Veza sa GA4 je istekla – kupovine se procenjuju samo po Google Ads konverzijama.":"The GA4 connection has expired – purchases are judged only by Google Ads conversions."):(sr?"GA4 prihod nije dostupan – kupovine se procenjuju samo po Google Ads konverzijama.":"GA4 revenue isn't available – purchases are judged only by Google Ads conversions.")}</div>}
    {data.truncated&&<div style={{color:C.mut,fontSize:12,marginBottom:10}}>{sr?"Pojmova ima veoma mnogo – prikazani su svi sa kupovinom i 8.000 sa najvećom potrošnjom.":"There are very many terms – all with purchases and the 8,000 with the highest spend are shown."}</div>}

    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
      {[["neg",`${sr?"Kandidati za negativne":"Negative candidates"} (${neg.length})`],["opp",`${sr?"Prilike":"Opportunities"} (${oppMain.length})`],["all",`${sr?"Svi pojmovi":"All terms"} (${base.length})`]].map(([k,l])=><button key={k} onClick={()=>{setSub(k);setLimit(100);}} style={pill(sub===k)}>{l}</button>)}
    </div>

    <div style={{color:C.mut,fontSize:12,lineHeight:1.55,marginBottom:10}}>
      {sub==="neg"&&<>{sr?`Pojmovi na koje je potrošeno ${thr} € ili više bez ijedne kupovine, a koji nisu ni ključne reči ni već isključeni. Ukupno `:`Terms that spent ${thr} € or more with no purchase and are neither keywords nor already excluded. Total `}<b style={{color:negSpend>0?C.red:C.txt}}>{eur(negSpend)}</b>.</>}
      {sub==="opp"&&<>{sr?`Pojmovi koji donose kupovine${data.ga4?" (po GA4)":""}, a nisu dodati kao ključne reči – kandidati za dodavanje, poređani po prihodu. Prihod `:`Terms that bring purchases${data.ga4?" (per GA4)":""} but aren't added as keywords – candidates to add, sorted by revenue. Revenue `}<b style={{color:C.grn}}>{eur(oppRev)}</b>.{oppAdsOnly.length>0&&(sr?` Na dnu su i pojmovi sa konverzijama samo po Google Ads-u (${oppAdsOnly.length}) – proveri ih pre dodavanja.`:` At the bottom are terms with conversions only per Google Ads (${oppAdsOnly.length}) – check them before adding.`)}</>}
      {sub==="all"&&(sr?"Svi pojmovi pretrage u periodu.":"All search terms in the period.")}
    </div>

    <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
      <RsSearchSelect value={camp} onChange={v=>{setCamp(v);setLimit(100);}} options={camps} allLabel={sr?"Sve kampanje":"All campaigns"} searchPlaceholder={sr?"Pretraži kampanju...":"Search campaign..."} ariaLabel={sr?"Kampanja":"Campaign"}/>
      <input value={q} onChange={e=>{setQ(e.target.value);setLimit(100);}} placeholder={sr?"Pretraži pojam...":"Search term..."} style={bpInp}/>
    </div>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {sub==="neg"&&<><span style={{color:C.mut,fontSize:12}}>{sr?"Potrošeno najmanje:":"Spent at least:"}</span>{[5,20,50].map(v=><button key={v} onClick={()=>setThr(v)} style={pill(thr===v)}>{v} €</button>)}</>}
      </div>
      {sub!=="all"&&<div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{color:C.mut,fontSize:12}}>{sr?"Format:":"Format:"}</span>
        {[["exact","[tačno]","[exact]"],["phrase","\"fraza\"","\"phrase\""],["broad",sr?"široko":"broad","broad"]].map(([k,a,b])=><button key={k} onClick={()=>setFmt(k)} style={pill(fmt===k)}>{sr?a:b}</button>)}
        <button onClick={copy} disabled={!selected.length} style={{...bpBtn(true),background:"linear-gradient(135deg,#6366F1,#4f46e5)",opacity:selected.length?1:0.45,cursor:selected.length?"pointer":"not-allowed"}}>
          {copied?(sr?"✓ Kopirano":"✓ Copied"):sub==="neg"?(sr?`Kopiraj kao negativne (${selected.length})`:`Copy as negatives (${selected.length})`):(sr?`Kopiraj kao ključne reči (${selected.length})`:`Copy as keywords (${selected.length})`)}
        </button>
      </div>}
    </div>

    {rows.length===0?<div style={{color:C.mut,fontSize:13,padding:"12px 0"}}>{sub==="neg"?(sr?"Nema pojmova koji rasipaju budžet za ovaj prag. 👍":"No terms wasting budget at this threshold. 👍"):sub==="opp"?(sr?"Nema novih pojmova sa kupovinom koji nisu već ključne reči.":"No new terms with purchases that aren't already keywords."):(sr?"Nema pojmova za izabrane filtere.":"No terms for the selected filters.")}</div>:
    <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"4px 8px",overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:720}}>
        <thead><tr>
          {sub!=="all"&&<th style={{...thS,width:28}}><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label={sr?"Izaberi sve prikazane":"Select all shown"}/></th>}
          <th style={{...thS,textAlign:"left"}}>{sr?"Pojam pretrage":"Search term"}</th>
          <th style={{...thS,textAlign:"right"}}>{sr?"Potrošnja":"Spend"}</th>
          <th style={{...thS,textAlign:"right"}}>{sr?"Klikovi":"Clicks"}</th>
          <th style={{...thS,textAlign:"right"}}>{sr?"GA4 prihod":"GA4 revenue"}</th>
          <th style={{...thS,textAlign:"right"}}>{sr?"Kupovine":"Purchases"}</th>
          <th style={{...thS,textAlign:"right"}}>{sr?"Ads konv.":"Ads conv."}</th>
        </tr></thead>
        <tbody>{rows.slice(0,limit).map((t,i,arr)=><Fragment key={t.text+i}>
          {sub==="opp"&&t.adsOnly&&(i===0||!arr[i-1].adsOnly)&&<tr><td colSpan={7} style={{padding:"12px 6px 6px",color:C.yel,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.6px",borderBottom:`1px solid ${C.brd}`}}>{sr?"Samo po Google Ads-u (GA4 nema kupovinu) – proveri pre dodavanja":"Only per Google Ads (no GA4 purchase) – check before adding"}</td></tr>}
          <tr style={{background:sel[t.text]?"rgba(99,102,241,0.08)":"transparent",opacity:t.adsOnly?0.8:1}}>
          {sub!=="all"&&<td style={td}><input type="checkbox" checked={!!sel[t.text]} onChange={e=>setSel(p=>({...p,[t.text]:e.target.checked}))} aria-label={t.text}/></td>}
          <td style={{...td,maxWidth:380}}>
            <div style={{fontWeight:600,wordBreak:"break-word"}}>{t.text}{t.adsOnly&&tag(sr?"samo Google Ads":"Google Ads only","#FBBF24")}{t.shopping&&tag("Shopping","#FBBF24")}{t.isKeyword&&tag(sr?"već ključna reč":"already a keyword","#34D399")}{t.isExcluded&&tag(sr?"već isključen":"already excluded","#9CA3AF")}</div>
            <div style={{color:C.mut,fontSize:11,marginTop:2,wordBreak:"break-word"}}>{t.campaigns[0]}{t.campaignCount>1?` +${t.campaignCount-1}`:""}</div>
          </td>
          <td style={{...td,textAlign:"right",fontWeight:700,whiteSpace:"nowrap"}}>{eur(t.spendEUR)}</td>
          <td style={{...td,textAlign:"right"}}>{rsNum(t.clicks)}</td>
          <td style={{...td,textAlign:"right",whiteSpace:"nowrap"}}>{data.ga4?eur(t.ga4RevenueEUR):"–"}</td>
          <td style={{...td,textAlign:"right"}}>{data.ga4?rsNum(t.ga4Purchases,0):"–"}</td>
          <td style={{...td,textAlign:"right",color:C.mut}}>{rsNum(t.adsConversions,t.adsConversions%1?1:0)}</td>
        </tr></Fragment>)}</tbody>
      </table>
    </div>}
    {rows.length>limit&&<button onClick={()=>setLimit(l=>l+200)} style={{...bpBtn(false),marginTop:10}}>{sr?`Prikaži još (${rows.length-limit})`:`Show more (${rows.length-limit})`}</button>}
    <div style={{color:C.dim,fontSize:11,marginTop:10,lineHeight:1.5}}>{sr?"Iznosi u EUR. App ništa ne menja u Google Ads nalogu – kopiranu listu nalepiš u Google Ads (negativne ključne reči ili nove ključne reči). \"Ads konv.\" su konverzije koje beleži Google Ads.":"Amounts in EUR. The app changes nothing in the Google Ads account – paste the copied list into Google Ads (negative keywords or new keywords). \"Ads conv.\" are conversions recorded by Google Ads."}</div>
  </div>;
}

// ── CAMPAIGN INTELLIGENCE: KLJUČNE REČI (korak A) ───────────────────────────
const KW_MATCH={exact:{sr:"Tačno",en:"Exact",c:"#34D399"},phrase:{sr:"Fraza",en:"Phrase",c:"#60A5FA"},broad:{sr:"Široko",en:"Broad",c:"#FBBF24"},other:{sr:"Ostalo",en:"Other",c:"#9CA3AF"}};

function CiKeywords({sr,mob,clientId,qs}){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [view,setView]=useState("all"); // all | bleed
  const [camp,setCamp]=useState("");
  const [match,setMatch]=useState({});
  const [q,setQ]=useState("");
  const [sort,setSort]=useState({k:"spendEUR",d:-1});
  const [limit,setLimit]=useState(100);
  const [thr,setThr]=useState(50);
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    if(!clientId||!qs) return;
    let cancelled=false;
    (async()=>{
      setLoading(true); setErr(""); setData(null); setCamp(""); setLimit(100);
      try{
        const uid=await getOrCreateUser();
        const r=await fetch(`/api/keywords?client_id=${clientId}&user_id=${uid}&${qs}`);
        const d=await r.json();
        if(cancelled) return;
        if(!r.ok){
          const e=String(d.error||"");
          setErr(e==="no_gads"?(sr?"Google Ads nije povezan za ovog klijenta. Poveži ga u Clients.":"Google Ads is not connected for this client. Connect it in Clients.")
            :e==="expired"||e.includes("invalid_grant")?(sr?"Veza sa Google Ads nalogom je istekla. U Clients otkači i ponovo poveži Google Ads.":"The Google Ads connection has expired. In Clients, disconnect and reconnect Google Ads.")
            :(sr?"Ključne reči nisu učitane. Pokušaj ponovo.":"Keywords could not be loaded. Please try again."));
        } else setData(d);
      }catch(e){ if(!cancelled) setErr(sr?"Ključne reči nisu učitane. Proveri internet vezu i pokušaj ponovo.":"Keywords could not be loaded. Check your connection and try again."); }
      if(!cancelled) setLoading(false);
    })();
    return()=>{cancelled=true;};
  },[clientId,qs]);

  const eur=v=>v==null?"–":`${rsNum(v,v<100?2:0)} €`;
  const all=data?data.keywords:[];
  const camps=[...new Set(all.map(k=>k.campaignName))].sort((a,b)=>a.localeCompare(b));
  const anyMatch=Object.values(match).some(Boolean);
  const ql=rsFold(q.trim());
  const base=all.filter(k=>(!camp||k.campaignName===camp)&&(!anyMatch||match[k.matchType])&&(!ql||rsFold(k.text).includes(ql)||rsFold(k.adGroupName).includes(ql)));
  const isBleeder=k=>k.spendEUR>=thr&&(data.ga4?k.ga4Purchases<0.5:true)&&k.adsConversions<0.5;
  const bleeders=data?base.filter(isBleeder):[];
  const bleedSpend=bleeders.reduce((s,k)=>s+k.spendEUR,0);
  const rows=(view==="bleed"?bleeders:base).slice().sort((a,b)=>{
    const av=a[sort.k], bv=b[sort.k];
    if(typeof av==="string") return sort.d*String(av).localeCompare(String(bv));
    return sort.d*((av??-1)-(bv??-1));
  });
  const tot=base.reduce((o,k)=>({spend:o.spend+k.spendEUR,rev:o.rev+k.ga4RevenueEUR,pur:o.pur+k.ga4Purchases,ads:o.ads+k.adsConversions,clicks:o.clicks+k.clicks}),{spend:0,rev:0,pur:0,ads:0,clicks:0});

  const copyList=async()=>{
    const txt=bleeders.map(k=>k.text).join("\n");
    try{ await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(()=>setCopied(false),2000); }
    catch(e){ alert(txt); }
  };

  const th=(k,l,right)=><th onClick={()=>setSort(s=>({k,d:s.k===k?-s.d:(typeof all[0]?.[k]==="string"?1:-1)}))}
    style={{padding:"8px 6px",textAlign:right?"right":"left",color:sort.k===k?C.acl:C.mut,fontWeight:600,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",borderBottom:`1px solid ${C.brd}`}}>
    {l}{sort.k===k?(sort.d<0?" ▾":" ▴"):""}</th>;
  const td={padding:"8px 6px",borderBottom:`1px solid ${C.brd}`,fontSize:12,color:C.txt};
  const pill=on=>({padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:on?"1px solid rgba(99,102,241,0.7)":`1px solid ${C.brd}`,background:on?"rgba(99,102,241,0.2)":"transparent",color:on?"#fff":C.mut});
  const card=(l,v,sub,col)=><div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px 14px"}}>
    <div style={{color:C.dim,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.6px"}}>{l}</div>
    <div style={{fontSize:18,fontWeight:800,marginTop:4,color:col||C.txt}}>{v}</div>
    {sub&&<div style={{color:C.mut,fontSize:11,marginTop:2}}>{sub}</div>}
  </div>;

  if(loading) return <div style={{textAlign:"center",padding:"40px 0",color:C.acl,fontWeight:700,fontSize:15}}>✦ {sr?"Učitavam ključne reči iz Google Ads-a...":"Loading keywords from Google Ads..."}</div>;
  if(err) return <div style={{color:C.red,fontSize:13,padding:"12px 0"}}>{err}</div>;
  if(!data) return null;

  const t=data.totals;
  const share=t.accountSpendEUR>0?t.searchSpendEUR/t.accountSpendEUR:0;

  return <div>
    {/* Pokrivenost: koliki deo potrosnje ima kljucne reci */}
    {view!=="terms"&&<div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:12,padding:"12px 14px",marginBottom:14,fontSize:12.5,color:C.txt,lineHeight:1.55}}>
      {t.searchSpendEUR>0
        ?<>{sr?"Ključne reči postoje samo u Search kampanjama":"Keywords exist only in Search campaigns"}: <b>{eur(t.searchSpendEUR)}</b> {sr?"od":"of"} {eur(t.accountSpendEUR)} {sr?"ukupne potrošnje":"total spend"} (<b>{rsNum(share*100,0)}%</b>). {share<0.3&&(sr?"Ostatak (Performance Max, Shopping...) ovde nije obuhvaćen.":"The rest (Performance Max, Shopping...) isn't covered here.")}</>
        :<>{sr?"Ovaj nalog u izabranom periodu nema potrošnju na Search kampanje, pa nema ni ključnih reči. Pojmovi pretrage (sledeći korak) pokrivaće i Shopping kampanje.":"This account has no Search campaign spend in the selected period, so there are no keywords. Search terms (next step) will also cover Shopping campaigns."}</>}
    </div>}
    {data.fxMissing&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>⚠️ {sr?"Kurs za konverziju u EUR trenutno nije dostupan – deo iznosa je u originalnoj valuti.":"The EUR exchange rate is currently unavailable – some amounts are in the original currency."}</div>}
    {!data.ga4&&<div style={{color:C.yel,fontSize:12,marginBottom:10}}>{data.ga4Error==="expired"?(sr?"Veza sa GA4 je istekla – prikazani su samo Google Ads podaci. U Clients ponovo poveži GA4.":"The GA4 connection has expired – only Google Ads data is shown. Reconnect GA4 in Clients."):data.ga4Error?(sr?"GA4 prihod trenutno nije dostupan – prikazani su samo Google Ads podaci.":"GA4 revenue is currently unavailable – only Google Ads data is shown."):(sr?"GA4 nije povezan – prikazani su samo Google Ads podaci (konverzije koje beleži Google Ads).":"GA4 isn't connected – only Google Ads data is shown (conversions recorded by Google Ads).")}</div>}

    {/* Prikaz: kljucne reci, rasipanje, pojmovi pretrage */}
    <div role="tablist" style={{display:"flex",gap:4,borderBottom:`1px solid ${C.brd}`,marginBottom:12,flexWrap:"wrap"}}>
      {[["all",sr?"Sve ključne reči":"All keywords"],["bleed",`${sr?"Rasipanje budžeta":"Budget waste"} (${bleeders.length})`],["terms",sr?"Pojmovi pretrage":"Search terms"]].map(([k,l])=><button key={k} role="tab" aria-selected={view===k} onClick={()=>{setView(k);setLimit(100);}} style={{padding:"8px 12px",fontSize:13,fontWeight:700,cursor:"pointer",background:"transparent",border:"none",borderBottom:view===k?"2px solid #6366F1":"2px solid transparent",color:view===k?"#fff":C.mut,marginBottom:-1}}>{l}</button>)}
    </div>

    {view==="terms"&&<CiSearchTerms sr={sr} mob={mob} clientId={clientId} qs={qs}/>}
    {view!=="terms"&&all.length===0&&<div style={{color:C.mut,fontSize:13,padding:"8px 0"}}>{sr?"Nema ključnih reči sa prikazima u ovom periodu. Pogledaj \"Pojmovi pretrage\" – oni pokrivaju i Shopping kampanje.":"No keywords with impressions in this period. See \"Search terms\" – they also cover Shopping campaigns."}</div>}
    {view!=="terms"&&all.length>0&&<>
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(5,1fr)",gap:10,marginBottom:14}}>
        {card(sr?"Potrošnja":"Spend",eur(tot.spend),`${rsNum(base.length)} ${sr?"ključnih reči":"keywords"}`)}
        {card(sr?"GA4 prihod":"GA4 revenue",data.ga4?eur(tot.rev):"–")}
        {card("ROAS",data.ga4&&tot.spend>0?`${rsNum(tot.rev/tot.spend,2)}x`:"–")}
        {card(sr?"Kupovine":"Purchases",data.ga4?rsNum(tot.pur,0):"–",`Google Ads: ${rsNum(tot.ads,0)} ${sr?"konv.":"conv."}`)}
        {card(sr?"Rasipanje":"Wasted",eur(bleedSpend),`${rsNum(tot.spend>0?bleedSpend/tot.spend*100:0,0)}% ${sr?"potrošnje":"of spend"} · ${bleeders.length} ${sr?"reči":"kw"}`,bleedSpend>0?C.red:C.grn)}
      </div>


      {/* Filteri */}
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
        <RsSearchSelect value={camp} onChange={v=>{setCamp(v);setLimit(100);}} options={camps} allLabel={sr?"Sve kampanje":"All campaigns"} searchPlaceholder={sr?"Pretraži kampanju...":"Search campaign..."} ariaLabel={sr?"Kampanja":"Campaign"}/>
        <input value={q} onChange={e=>{setQ(e.target.value);setLimit(100);}} placeholder={sr?"Pretraži ključnu reč ili ad grupu...":"Search keyword or ad group..."} style={bpInp}/>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
        {Object.entries(KW_MATCH).filter(([k])=>all.some(x=>x.matchType===k)).map(([k,m])=><button key={k} onClick={()=>setMatch(p=>({...p,[k]:!p[k]}))} style={{...pill(!!match[k]),borderColor:match[k]?m.c:C.brd}}><span style={{color:m.c}}>●</span> {sr?m.sr:m.en}</button>)}
        {view==="bleed"&&<>
          <span style={{color:C.mut,fontSize:12,marginLeft:8}}>{sr?"Potrošeno najmanje:":"Spent at least:"}</span>
          {[20,50,100].map(v=><button key={v} onClick={()=>setThr(v)} style={pill(thr===v)}>{v} €</button>)}
        </>}
      </div>

      {view==="bleed"&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}>
        <div style={{color:C.mut,fontSize:12,lineHeight:1.5}}>{sr?`Ključne reči koje su potrošile ${thr} € ili više, a nisu donele nijednu kupovinu${data.ga4?" ni u GA4 ni u Google Ads-u":" u Google Ads-u"}. Kandidati za pauziranje ili izmenu.`:`Keywords that spent ${thr} € or more with no purchase${data.ga4?" in either GA4 or Google Ads":" in Google Ads"}. Candidates to pause or change.`}</div>
        {bleeders.length>0&&<button onClick={copyList} style={bpBtn(false)}>{copied?(sr?"✓ Kopirano":"✓ Copied"):(sr?"Kopiraj listu reči":"Copy keyword list")}</button>}
      </div>}

      {rows.length===0?<div style={{color:C.mut,fontSize:13,padding:"12px 0"}}>{view==="bleed"?(sr?"Nema ključnih reči koje rasipaju budžet za ovaj prag. 👍":"No keywords wasting budget at this threshold. 👍"):(sr?"Nema ključnih reči za izabrane filtere.":"No keywords for the selected filters.")}</div>:
      <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"4px 8px",overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}>
          <thead><tr>
            {th("text",sr?"Ključna reč":"Keyword")}
            {th("spendEUR",sr?"Potrošnja":"Spend",true)}
            {th("clicks",sr?"Klikovi":"Clicks",true)}
            {th("cpcEUR","CPC",true)}
            {th("ga4RevenueEUR",sr?"GA4 prihod":"GA4 revenue",true)}
            {th("roas","ROAS",true)}
            {th("ga4Purchases",sr?"Kupovine":"Purchases",true)}
            {th("adsConversions",sr?"Ads konv.":"Ads conv.",true)}
          </tr></thead>
          <tbody>{rows.slice(0,limit).map((k,i)=>{const m=KW_MATCH[k.matchType]||KW_MATCH.other;return <tr key={i}>
            <td style={{...td,maxWidth:340}}>
              <div style={{fontWeight:600,wordBreak:"break-word"}}>{k.text} <span style={{fontSize:10,fontWeight:700,color:m.c,border:`1px solid ${m.c}55`,borderRadius:20,padding:"0 6px",marginLeft:4}}>{sr?m.sr:m.en}</span>{k.status==="PAUSED"&&<span style={{fontSize:10,color:C.mut,marginLeft:6}}>{sr?"pauzirana":"paused"}</span>}</div>
              <div style={{color:C.mut,fontSize:11,marginTop:2,wordBreak:"break-word"}}>{k.campaignName} › {k.adGroupName}</div>
            </td>
            <td style={{...td,textAlign:"right",fontWeight:700,whiteSpace:"nowrap"}}>{eur(k.spendEUR)}</td>
            <td style={{...td,textAlign:"right"}}>{rsNum(k.clicks)}</td>
            <td style={{...td,textAlign:"right",whiteSpace:"nowrap"}}>{eur(k.cpcEUR)}</td>
            <td style={{...td,textAlign:"right",whiteSpace:"nowrap"}}>{data.ga4?eur(k.ga4RevenueEUR):"–"}{k.shared&&data.ga4&&k.ga4RevenueEUR>0&&<span title={sr?"Približno: ista reč postoji u više ad grupa, prihod je podeljen prema klikovima":"Approximate: the same keyword is in several ad groups, revenue split by clicks"} style={{color:C.mut,marginLeft:3}}>≈</span>}</td>
            <td style={{...td,textAlign:"right",fontWeight:700,color:k.roas==null?C.mut:k.roas>=1?C.grn:C.red}}>{k.roas==null?"–":`${rsNum(k.roas,2)}x`}</td>
            <td style={{...td,textAlign:"right"}}>{data.ga4?rsNum(k.ga4Purchases,k.ga4Purchases%1?1:0):"–"}</td>
            <td style={{...td,textAlign:"right",color:C.mut}}>{rsNum(k.adsConversions,k.adsConversions%1?1:0)}</td>
          </tr>;})}</tbody>
        </table>
      </div>}
      {rows.length>limit&&<button onClick={()=>setLimit(l=>l+200)} style={{...bpBtn(false),marginTop:10}}>{sr?`Prikaži još (${rows.length-limit})`:`Show more (${rows.length-limit})`}</button>}
      <div style={{color:C.dim,fontSize:11,marginTop:10,lineHeight:1.5}}>{sr?"Iznosi u EUR. GA4 prihod po ključnoj reči je približan (GA4 ne zna ad grupu ni tip meča; ≈ označava podelu između ad grupa). \"Ads konv.\" su konverzije koje beleži Google Ads.":"Amounts in EUR. GA4 revenue per keyword is approximate (GA4 doesn't know the ad group or match type; ≈ marks a split between ad groups). \"Ads conv.\" are conversions recorded by Google Ads."}</div>
    </>}
  </div>;
}

function CampaignsMod({t,lang,goMod}){
  const sr=lang==="sr";
  useEffect(()=>{ pmAnimReset("ci:"); },[]); // pri svakom ulasku u modul brojevi se odbrojavaju od 0
  const [clients,setClients]=useState([]);
  const [clientsLoading,setClientsLoading]=useState(true);
  const [selectedClient,setSelectedClient]=useState(null);
  useEffect(()=>{ pmScrollTop(); },[selectedClient]); // izbor klijenta / povratak na listu – na vrh
  const [period,setPeriod]=useState("7"); // podrazumevano 7 dana (brze ucitavanje, najcesce se gleda)
  const [customFrom,setCustomFrom]=useState("");
  const [customTo,setCustomTo]=useState("");
  const [mode,setMode]=useState("byCampaign"); // byCampaign | byProduct | byCategory | byKeyword
  const [appliedQs,setAppliedQs]=useState(""); // period koji je stvarno ucitan (za tab Kljucne reci)
  const kwMob=typeof window!=="undefined"&&window.innerWidth<700;
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);
  const [err,setErr]=useState("");
  const [newClientOpen,setNewClientOpen]=useState(false);
  const [newClientName,setNewClientName]=useState("");
  const [creatingClient,setCreatingClient]=useState(false);

  // Drill-down (samo unutar "Po kampanji")
  const [drillCampaign,setDrillCampaign]=useState(null);
  useEffect(()=>{ pmScrollTop(); },[drillCampaign]); // otvaranje kampanje / povratak – na vrh
  const [campaignProducts,setCampaignProducts]=useState(null);
  const [campaignProductsLoading,setCampaignProductsLoading]=useState(false);
  const [adGroups,setAdGroups]=useState(null);
  const [adGroupsLoading,setAdGroupsLoading]=useState(false);
  const [drillAdGroup,setDrillAdGroup]=useState(null);
  const [ads,setAds]=useState(null);
  const [adsLoading,setAdsLoading]=useState(false);
  const [productSearch,setProductSearch]=useState("");
  const [productSort,setProductSort]=useState({key:"revenue",dir:"desc"});
  const [campaignSearch,setCampaignSearch]=useState("");
  const [productVisibleCount,setProductVisibleCount]=useState(50);

  // "Po proizvodu" tab
  const [byProductQuery,setByProductQuery]=useState("");
  const [byProductData,setByProductData]=useState(null);
  const [byProductLoading,setByProductLoading]=useState(false);
  const [byProductErr,setByProductErr]=useState("");

  // "Po kategoriji" tab
  const [categoryList,setCategoryList]=useState(null);
  const [categoryListLoading,setCategoryListLoading]=useState(false);
  const [selectedCategory,setSelectedCategory]=useState(null);
  const [categoryData,setCategoryData]=useState(null);
  const [categoryDataLoading,setCategoryDataLoading]=useState(false);

  useEffect(()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setClientsLoading(false); return; }
    fetch(`/api/clients?user_id=${uid}`).then(r=>r.json()).then(d=>setClients(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setClientsLoading(false));
  },[]);

  const addClient=async()=>{
    if(!newClientName.trim()) return;
    setCreatingClient(true);
    try{
      const uid=await getOrCreateUser();
      const r=await fetch("/api/clients",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({user_id:uid,name:newClientName.trim()})
      });
      const c=await r.json();
      if(r.ok&&c.id){
        setClients(prev=>[c,...prev]);
        setNewClientName("");
        setNewClientOpen(false);
      } else {
        alert(lang==="sr"?"Klijent nije sačuvan. Pokušaj ponovo.":"Client was not saved. Please try again.");
      }
    }catch(e){
      alert(lang==="sr"?"Klijent nije sačuvan. Proveri internet vezu i pokušaj ponovo.":"Client was not saved. Check your connection and try again.");
    }
    setCreatingClient(false);
  };

  const periodQS=()=>customFrom&&customTo&&period==="custom" ? `from=${customFrom}&to=${customTo}` : `days=${period}`;

  const lastLoadRef=useRef(null);

  const fetchWithTimeout=async(url,ms=40000)=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),ms);
    try{
      const res=await fetch(url,{signal:controller.signal});
      clearTimeout(timer);
      return res;
    }catch(e){
      clearTimeout(timer);
      if(e.name==="AbortError") throw new Error("timeout");
      throw e;
    }
  };

  const load=async(client,qsOverride)=>{
    const qs=qsOverride||periodQS();
    setAppliedQs(qs);
    lastLoadRef.current={client,qs};
    setLoading(true); setErr(""); setData(null); setCampaignSearch("");
    resetDrill();
    try{
      const res=await fetchWithTimeout(`/api/campaigns?client_id=${client.id}&${qs}`);
      const d=await res.json();
      if(res.status===404){ setErr(d.error==="no_gads"?"no_gads":"no_ga4"); setLoading(false); return; }
      if(!res.ok) throw new Error(d.error||(sr?"Greška pri učitavanju":"Loading error"));
      setData(d);
    }catch(e){ setErr(e.message==="timeout"?"timeout":e.message); }
    setLoading(false);
  };

  const retryLoad=()=>{
    if(lastLoadRef.current) load(lastLoadRef.current.client,lastLoadRef.current.qs);
  };

  const resetDrill=()=>{
    setDrillCampaign(null); setCampaignProducts(null); setAdGroups(null);
    setDrillAdGroup(null); setAds(null); setProductSearch(""); setProductVisibleCount(50);
  };

  // Kad se period promeni, osvežavamo SVE što je trenutno relevantno (top kampanje + otvoren tab), sa TAČNIM,
  // upravo-izabranim periodom (ne oslanjamo se na "period" state jer setState nije odmah dostupan u istom pozivu - "stale closure").
  const reloadAllForPeriod=(qs)=>{
    if(!selectedClient) return;
    load(selectedClient,qs);
    if(mode==="byProduct"&&byProductQuery.trim()) runProductSearch(qs);
    if(mode==="byCategory"){
      if(categoryList) loadCategoryList(qs);
    }
    setSelectedCategory(null); setCategoryData(null);
  };

  const applyPeriod=(p)=>{
    setPeriod(p);
    if(p==="custom") return;
    reloadAllForPeriod(`days=${p}`);
  };
  const applyCustom=()=>{
    if(!selectedClient||!customFrom||!customTo) return;
    reloadAllForPeriod(`from=${customFrom}&to=${customTo}`);
  };

  const openCampaign=async(camp,qsOverride)=>{
    const qs=qsOverride||periodQS();
    resetDrill();
    setDrillCampaign(camp);
    setCampaignProductsLoading(true);
    setAdGroupsLoading(true);
    try{
      const r=await fetch(`/api/campaign-products?client_id=${selectedClient.id}&campaign_id=${camp.campaign_id}&${qs}`);
      const d=await r.json();
      setCampaignProducts(r.ok?d:{products:[],currency:data.currency});
    }catch(e){ setCampaignProducts({products:[],currency:data.currency}); }
    setCampaignProductsLoading(false);
    try{
      const r2=await fetch(`/api/google-ads-drilldown?client_id=${selectedClient.id}&campaign_id=${camp.campaign_id}&${qs}`);
      const d2=await r2.json();
      setAdGroups(r2.ok?d2:null);
    }catch(e){ setAdGroups(null); }
    setAdGroupsLoading(false);
  };

  const openAdGroup=async(ag,qsOverride)=>{
    const qs=qsOverride||periodQS();
    setDrillAdGroup(ag);
    setAdsLoading(true);
    try{
      const r=await fetch(`/api/google-ads-drilldown?client_id=${selectedClient.id}&campaign_id=${drillCampaign.campaign_id}&ad_group_id=${ag.id}&${qs}`);
      const d=await r.json();
      setAds(r.ok?d:null);
    }catch(e){ setAds(null); }
    setAdsLoading(false);
  };

  const runProductSearch=async(qsOverride)=>{
    const qs=qsOverride||periodQS();
    if(!byProductQuery.trim()) return;
    setByProductLoading(true); setByProductErr(""); setByProductData(null);
    try{
      const r=await fetch(`/api/products-by-campaign?client_id=${selectedClient.id}&q=${encodeURIComponent(byProductQuery.trim())}&${qs}`);
      const d=await r.json();
      if(r.status===404){ setByProductErr(d.error==="no_gads"?"no_gads":"no_ga4"); setByProductLoading(false); return; }
      if(!r.ok) throw new Error(d.error||"Error");
      setByProductData(d);
    }catch(e){ setByProductErr(e.message); }
    setByProductLoading(false);
  };

  const loadCategoryList=async(qsOverride)=>{
    const qs=qsOverride||periodQS();
    setCategoryListLoading(true);
    try{
      const r=await fetch(`/api/products-by-category?client_id=${selectedClient.id}&${qs}`);
      const d=await r.json();
      setCategoryList(r.ok?d:null);
    }catch(e){ setCategoryList(null); }
    setCategoryListLoading(false);
  };

  const openCategory=async(catName,qsOverride)=>{
    const qs=qsOverride||periodQS();
    setSelectedCategory(catName);
    setCategoryDataLoading(true); setCategoryData(null);
    try{
      const r=await fetch(`/api/products-by-category?client_id=${selectedClient.id}&category=${encodeURIComponent(catName)}&${qs}`);
      const d=await r.json();
      setCategoryData(r.ok?d:null);
    }catch(e){ setCategoryData(null); }
    setCategoryDataLoading(false);
  };

  const switchMode=(m)=>{
    setMode(m);
    if(m==="byCategory"&&!categoryList) loadCategoryList();
  };

  const periods=[{v:"7",l:sr?"7 dana":"7 days"},{v:"30",l:sr?"30 dana":"30 days"},{v:"90",l:sr?"90 dana":"90 days"},{v:"custom",l:sr?"Prilagođeno":"Custom"}];

  const filteredCampaigns=()=>{
    if(!data) return [];
    if(!campaignSearch.trim()) return data.campaigns;
    const q=campaignSearch.trim().toLowerCase();
    return data.campaigns.filter(c=>c.campaign_name.toLowerCase().includes(q)||String(c.campaign_id).toLowerCase().includes(q));
  };

  const sortedCampaignProducts=()=>{
    if(!campaignProducts) return [];
    let list=[...campaignProducts.products];
    if(productSearch.trim()){
      const q=productSearch.trim().toLowerCase();
      list=list.filter(p=>p.name.toLowerCase().includes(q)||String(p.id).toLowerCase().includes(q));
    }
    list.sort((a,b)=>{
      const av=a[productSort.key],bv=b[productSort.key];
      return productSort.dir==="desc"?bv-av:av-bv;
    });
    return list;
  };
  const toggleProductSort=(key)=>{
    setProductSort(s=>s.key===key?{key,dir:s.dir==="desc"?"asc":"desc"}:{key,dir:"desc"});
  };

  // IZBOR KLIJENTA
  if(!selectedClient) return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>📢 Campaign Intelligence</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 20px"}}>{t.m14s}</p>

    {!newClientOpen&&<button onClick={()=>setNewClientOpen(true)} style={{background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,color:C.acl,fontSize:13,fontWeight:700,padding:"10px 16px",cursor:"pointer",marginBottom:20}}>+ {sr?"Novi klijent":"New client"}</button>}
    {newClientOpen&&<div style={{display:"flex",gap:8,marginBottom:20}}>
      <input value={newClientName} onChange={e=>setNewClientName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addClient()} autoFocus placeholder={sr?"Ime klijenta...":"Client name..."} style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.05)",color:C.txt,fontSize:13}}/>
      <button onClick={addClient} disabled={creatingClient||!newClientName.trim()} style={{background:"linear-gradient(135deg,#6366F1,#4f46e5)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,padding:"10px 16px",cursor:"pointer"}}>{sr?"Sačuvaj":"Save"}</button>
      <button onClick={()=>{setNewClientOpen(false);setNewClientName("");}} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12}}>{sr?"Otkaži":"Cancel"}</button>
    </div>}

    {clientsLoading
      ?<div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",color:C.acl,fontSize:13,textAlign:"center"}}>
        ✦ {sr?"Učitavam klijente...":"Loading clients..."}
      </div>
      :clients.length===0
      ?<div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",color:C.mut,fontSize:13,textAlign:"center"}}>
        {sr?"Nema klijenata još. Dodaj jednog iznad.":"No clients yet. Add one above."}
      </div>
      :<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {clients.map(c=><button key={c.id} onClick={()=>{setSelectedClient(c);load(c);}} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:10,padding:"12px 16px",textAlign:"left",cursor:"pointer",color:C.txt,fontWeight:600,fontSize:13}}>
          👤 {c.name}
        </button>)}
      </div>
    }
  </div>;

  const modes=[
    {v:"byCampaign",l:sr?"📢 Po kampanji":"📢 By campaign"},
    {v:"byProduct",l:sr?"🔍 Po proizvodu":"🔍 By product"},
    {v:"byCategory",l:sr?"📁 Po kategoriji":"📁 By category"},
    {v:"byKeyword",l:sr?"🔑 Po ključnoj reči":"🔑 By keyword"}
  ];

  // KONTROLNA TABLA
  return <div>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div>
        <button onClick={()=>{setSelectedClient(null);setData(null);}} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12,padding:0,marginBottom:4}}>{sr?"← Svi klijenti":"← All clients"}</button>
        <h2 style={{fontSize:18,fontWeight:800,margin:0}}>{selectedClient.name}</h2>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {periods.map(p=><button key={p.v} onClick={()=>applyPeriod(p.v)} style={{padding:"6px 12px",borderRadius:8,border:`1px solid ${period===p.v?"rgba(99,102,241,0.6)":C.brd}`,background:period===p.v?"rgba(99,102,241,0.2)":"transparent",color:period===p.v?C.acl:C.mut,fontSize:12,fontWeight:600,cursor:"pointer"}}>{p.l}</button>)}
        <button onClick={()=>invLaunch(goMod,{client:selectedClient,period,customFrom,customTo,qtype:"other",question:sr?"Šta se promenilo i zašto?":"What changed and why?",lang})} title={sr?"Pokreni istragu za ovog klijenta i period":"Investigate this client and period"} style={invBtnStyle}>🔎 {sr?"Istraži promene":"Investigate changes"}</button>
      </div>
    </div>

    {period==="custom"&&<div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:16,flexWrap:"wrap",background:"rgba(255,255,255,0.02)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px 14px"}}>
      <div style={{flex:1,minWidth:140}}><Lbl c={sr?"Od":"From"}/><DIn v={customFrom} ch={setCustomFrom}/></div>
      <div style={{flex:1,minWidth:140}}><Lbl c={sr?"Do":"To"}/><DIn v={customTo} ch={setCustomTo}/></div>
      <button onClick={applyCustom} disabled={!customFrom||!customTo} style={{padding:"12px 18px",borderRadius:10,border:"none",background:!customFrom||!customTo?"rgba(99,102,241,0.3)":"linear-gradient(135deg,#6366F1,#4f46e5)",color:"#fff",fontSize:13,fontWeight:700,cursor:!customFrom||!customTo?"default":"pointer"}}>{sr?"Primeni":"Apply"}</button>
    </div>}

    <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
      {modes.map(m=><button key={m.v} onClick={()=>switchMode(m.v)} style={{padding:"8px 14px",borderRadius:10,border:`1px solid ${mode===m.v?"rgba(99,102,241,0.6)":C.brd}`,background:mode===m.v?"rgba(99,102,241,0.2)":"transparent",color:mode===m.v?C.acl:C.mut,fontSize:13,fontWeight:600,cursor:"pointer"}}>{m.l}</button>)}
    </div>

    {mode==="byCampaign"&&<>
      {loading&&<div aria-busy="true" aria-label={sr?"Učitavam podatke":"Loading data"}><SkCards n={3}/><SkTable rows={8} cols={8}/></div>}

      {err==="no_gads"&&!loading&&<div style={{background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:12,padding:"16px",color:C.txt,fontSize:13,marginBottom:16}}>
        🔗 {sr?"Google Ads nije povezan za ovog klijenta. Idi u":"Google Ads is not connected for this client. Go to"} <b>Clients</b> {sr?"da ga povežeš.":"to connect it."}
      </div>}
      {err==="no_ga4"&&!loading&&<div style={{background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:12,padding:"16px",color:C.txt,fontSize:13,marginBottom:16}}>
        🔗 {sr?"GA4 nije povezan za ovog klijenta. Idi u":"GA4 is not connected for this client. Go to"} <b>Clients</b> {sr?"da ga povežeš.":"to connect it."}
      </div>}
      {err==="timeout"&&!loading&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"16px",marginBottom:16}}>
        <div style={{color:C.red,fontSize:13,fontWeight:700,marginBottom:6}}>⚠️ {sr?"Učitavanje podataka traje duže nego obično.":"Loading is taking longer than usual."}</div>
        <div style={{color:C.mut,fontSize:12,marginBottom:12}}>{sr?"Pokušaj sa kraćim periodom (npr. 7 dana), ili pokušaj ponovo.":"Try a shorter period (e.g. 7 days), or try again."}</div>
        <button onClick={retryLoad} style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,color:C.red,fontSize:12,fontWeight:700,padding:"8px 16px",cursor:"pointer"}}>{sr?"🔄 Pokušaj ponovo":"🔄 Try again"}</button>
      </div>}
      {err&&err!=="no_gads"&&err!=="no_ga4"&&err!=="timeout"&&!loading&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"16px",color:C.red,fontSize:13,marginBottom:16}}>⚠️ {err}</div>}

      {data&&!loading&&!drillCampaign&&<>
        {data.fxMissing&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,padding:"12px 16px",color:C.red,fontSize:12,marginBottom:12}}>
          ⚠️ {sr?"Kurs za konverziju u EUR trenutno nije dostupan. Deo iznosa je prikazan u originalnoj valuti naloga, pa zbirovi i ROAS mogu biti netačni. Pokušaj ponovo kasnije.":"The EUR exchange rate is currently unavailable. Some amounts are shown in the account's original currency, so totals and ROAS may be inaccurate. Try again later."}
        </div>}
        {(data.showSpendNative||data.showRevenueNative)&&<div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:12,padding:"12px 16px",color:C.yel,fontSize:12,marginBottom:16}}>
          ℹ️ {sr?`Prikazano u EUR kao glavnoj valuti (originalna valuta ispod, malim slovima), konvertovano po kursu iz ${data.rateDate?new Date(data.rateDate).toLocaleDateString("sr-RS"):"?"}.`:`Shown in EUR as the primary currency (original currency below, in small text), converted using the exchange rate from ${data.rateDate?new Date(data.rateDate).toLocaleDateString():"?"}.`}
        </div>}

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:20}}>
          <div className="pm-in pm-lift" style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px"}}>
            <div style={{color:C.mut,fontSize:11,marginBottom:4}}>{sr?"Ukupan spend":"Total spend"}</div>
            <div style={{color:C.txt,fontSize:18,fontWeight:800}}><AnimNum k={`ci:${selectedClient.id}:spend`} value={data.totalSpendEUR} format={v=>fmtMoney(v,"EUR")}/></div>
            {data.showSpendNative&&<div style={{color:C.mut,fontSize:11,marginTop:2}}>≈ {fmtMoney(data.totalSpend,data.gadsCurrency)}</div>}
          </div>
          <div className="pm-in pm-lift" style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px",animationDelay:"60ms"}}>
            <div style={{color:C.mut,fontSize:11,marginBottom:4}}>{sr?"Ukupan prihod":"Total revenue"}</div>
            <div style={{color:C.grn,fontSize:18,fontWeight:800}}><AnimNum k={`ci:${selectedClient.id}:rev`} value={data.totalRevenueEUR} format={v=>fmtMoney(v,"EUR")}/></div>
            {data.showRevenueNative&&<div style={{color:C.mut,fontSize:11,marginTop:2}}>≈ {fmtMoney(data.totalRevenue,data.currency)}</div>}
          </div>
          <div className="pm-in pm-lift" style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px",animationDelay:"120ms"}}>
            <div style={{color:C.mut,fontSize:11,marginBottom:4}}>ROAS</div>
            <div style={{color:C.acl,fontSize:18,fontWeight:800}}><AnimNum k={`ci:${selectedClient.id}:roas`} value={data.totalRoas} format={v=>v.toFixed(2)+"x"}/></div>
          </div>
        </div>

        {data.campaigns.length===0&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Nema kampanja sa potrošnjom u ovom periodu.":"No campaigns with spend in this period."}</div>}

        {data.campaigns.length>0&&<input value={campaignSearch} onChange={e=>setCampaignSearch(e.target.value)} placeholder={sr?"🔍 Pretraži kampanju...":"🔍 Search campaign..."} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.03)",color:C.txt,fontSize:13,marginBottom:10,boxSizing:"border-box"}}/>}

        {data.campaigns.length>0&&<div className="pm-in" style={{overflowX:"auto",marginBottom:16,animationDelay:"160ms"}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
            <thead>
              <tr style={{color:C.mut,textAlign:"left"}}>
                <th style={{padding:"6px 4px",fontWeight:600}}>{sr?"Kampanja":"Campaign"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Klikovi":"Clicks"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Impresije":"Impressions"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>Spend</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Prihod":"Revenue"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Kupovine":"Purchases"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Kupljeno":"Items bought"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns().map((c,i)=><tr key={i} className={i<12?"pm-in":undefined} onClick={()=>openCampaign(c)} style={{borderTop:`1px solid ${C.brd}`,cursor:"pointer",...(i<12?{animationDelay:`${180+i*30}ms`}:null)}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"8px 4px",color:C.acl,textDecoration:"underline"}}>{c.campaign_name} <span style={{color:C.mut}}>({c.campaign_id})</span>{c.no_spend_in_period&&<span style={{display:"inline-block",marginLeft:6,color:C.yel,fontSize:10,textDecoration:"none"}}>{sr?"bez potrošnje u periodu":"no spend in period"}</span>}</td>
                <td style={{padding:"8px 4px",textAlign:"right",color:C.mut}}>{c.clicks.toLocaleString()}</td>
                <td style={{padding:"8px 4px",textAlign:"right",color:C.mut}}>{c.impressions.toLocaleString()}</td>
                <td style={{padding:"8px 4px",textAlign:"right",color:C.txt}}>
                  {fmtMoney(c.spendEUR,"EUR")}
                  {data.showSpendNative&&<div style={{color:C.mut,fontSize:10}}>≈ {fmtMoney(c.spend,data.gadsCurrency)}</div>}
                </td>
                <td style={{padding:"8px 4px",textAlign:"right",color:C.grn}}>
                  {fmtMoney(c.revenueEUR,"EUR")}
                  {data.showRevenueNative&&<div style={{color:C.mut,fontSize:10}}>≈ {fmtMoney(c.revenue,data.currency)}</div>}
                </td>
                <td style={{padding:"8px 4px",textAlign:"right",color:C.mut}}>{c.conversions.toFixed(1)}</td>
                <td style={{padding:"8px 4px",textAlign:"right",color:C.mut}}>{c.itemsPurchased.toLocaleString()}</td>
                <td style={{padding:"8px 4px",textAlign:"right",fontWeight:700,color:c.spendEUR>0?(c.roas>=1?C.grn:C.red):C.mut}}>{c.spendEUR>0?`${c.roas.toFixed(2)}x`:"–"}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
        {filteredCampaigns().length===0&&campaignSearch.trim()&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"10px 0"}}>{sr?"Nema kampanja koje odgovaraju pretrazi.":"No campaigns match the search."}</div>}
        <div style={{color:C.mut,fontSize:11,marginBottom:16}}>{sr?"Klikni na kampanju za detalje (proizvodi, ad grupe).":"Click a campaign for details (products, ad groups)."}</div>


        {(data.unattributed.revenue>0||data.unattributed.conversions>0)&&<div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px 16px",color:C.mut,fontSize:12}}>
          ℹ️ {sr?"Neraspoređeno":"Unattributed"}: {fmtMoney(data.unattributed.revenueEUR,"EUR")}{data.showRevenueNative?` (≈ ${fmtMoney(data.unattributed.revenue,data.currency)})`:""} {sr?"prihoda i":"revenue and"} {data.unattributed.conversions.toFixed(1)} {sr?"kupovina iz Google Ads saobraćaja (Paid Search/Shopping/Video/PMax) koji nije mogao da se poveže sa konkretnom kampanjom.":"purchases from Google Ads traffic (Paid Search/Shopping/Video/PMax) that couldn't be matched to a specific campaign."}
        </div>}
      </>}

      {/* DRILL: KAMPANJA DETALJI */}
      {drillCampaign&&!drillAdGroup&&<div>
        <button onClick={resetDrill} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12,padding:0,marginBottom:10}}>{sr?"← Sve kampanje":"← All campaigns"}</button>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
          <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>{drillCampaign.campaign_name}</h3>
          <button onClick={()=>invLaunch(goMod,{client:selectedClient,period,customFrom,customTo,qtype:"other",question:sr?`Šta se promenilo kod kampanje „${drillCampaign.campaign_name}“ i zašto?`:`What changed with campaign “${drillCampaign.campaign_name}” and why?`,lang,campaignId:drillCampaign.campaign_id})} style={invBtnStyle}>🔎 {sr?"Istraži zašto":"Investigate why"}</button>
        </div>
        <div style={{color:C.mut,fontSize:12,marginBottom:16}}>{drillCampaign.campaign_id} · {fmtMoney(drillCampaign.spendEUR,"EUR")} spend · {drillCampaign.roas.toFixed(2)}x ROAS</div>

        <div style={{fontSize:13,fontWeight:700,color:C.txt,marginBottom:8}}>{sr?"Ad grupe":"Ad groups"}</div>
        {adGroupsLoading&&<div style={{color:C.mut,fontSize:12,marginBottom:16}}>{sr?"Učitavam...":"Loading..."}</div>}
        {!adGroupsLoading&&adGroups&&adGroups.items.length===0&&<div style={{color:C.mut,fontSize:12,marginBottom:16}}>{sr?"Nema ad grupa sa potrošnjom u ovom periodu.":"No ad groups with spend in this period."}</div>}
        {!adGroupsLoading&&adGroups&&adGroups.items.length>0&&<div style={{overflowX:"auto",marginBottom:24}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
            <thead>
              <tr style={{color:C.mut,textAlign:"left"}}>
                <th style={{padding:"6px 4px",fontWeight:600}}>{sr?"Ad grupa":"Ad group"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Klikovi":"Clicks"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Impresije":"Impressions"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>Spend</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Prihod":"Revenue"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Kupovine":"Purchases"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {adGroups.items.map((ag,i)=><tr key={i} onClick={()=>openAdGroup(ag)} style={{borderTop:`1px solid ${C.brd}`,cursor:"pointer"}}>
                <td style={{padding:"7px 4px",color:C.acl,textDecoration:"underline"}}>{ag.name}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{ag.clicks.toLocaleString()}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{ag.impressions.toLocaleString()}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.txt}}>{fmtMoney(ag.spendEUR,"EUR")}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.grn}}>{fmtMoney(ag.revenueEUR,"EUR")}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{ag.conversions.toFixed(1)}</td>
                <td style={{padding:"7px 4px",textAlign:"right",fontWeight:700,color:ag.roas>=1?C.grn:C.red}}>{ag.roas.toFixed(2)}x</td>
              </tr>)}
            </tbody>
          </table>
        </div>}

        <div style={{fontSize:13,fontWeight:700,color:C.txt,marginBottom:8}}>{sr?"Proizvodi prodati preko ove kampanje":"Products sold via this campaign"}</div>
        {campaignProductsLoading&&<div style={{color:C.mut,fontSize:12,marginBottom:16}}>{sr?"Učitavam...":"Loading..."}</div>}
        {!campaignProductsLoading&&campaignProducts&&<>
          <input value={productSearch} onChange={e=>{setProductSearch(e.target.value);setProductVisibleCount(50);}} placeholder={sr?"🔍 Pretraži proizvod...":"🔍 Search product..."} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.03)",color:C.txt,fontSize:13,marginBottom:10,boxSizing:"border-box"}}/>
          {sortedCampaignProducts().length===0&&<div style={{color:C.mut,fontSize:12,marginBottom:16}}>{sr?"Nema proizvoda za ovaj period.":"No products for this period."}</div>}
          {sortedCampaignProducts().length>0&&<div style={{overflowX:"auto",marginBottom:10}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <thead>
                <tr style={{color:C.mut,textAlign:"left"}}>
                  <th onClick={()=>toggleProductSort("name")} style={{padding:"6px 4px",fontWeight:600,cursor:"pointer"}}>{sr?"Proizvod":"Product"}</th>
                  <th onClick={()=>toggleProductSort("viewed")} style={{padding:"6px 4px",fontWeight:600,textAlign:"right",cursor:"pointer"}}>{sr?"Pregledi":"Viewed"}</th>
                  <th onClick={()=>toggleProductSort("addedToCart")} style={{padding:"6px 4px",fontWeight:600,textAlign:"right",cursor:"pointer"}}>{sr?"Korpa":"Cart"}</th>
                  <th onClick={()=>toggleProductSort("purchased")} style={{padding:"6px 4px",fontWeight:600,textAlign:"right",cursor:"pointer"}}>{sr?"Kupljeno":"Purchased"}</th>
                  <th onClick={()=>toggleProductSort("revenue")} style={{padding:"6px 4px",fontWeight:600,textAlign:"right",cursor:"pointer"}}>{sr?"Prihod":"Revenue"}</th>
                  <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Konverzija":"Conversion"}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCampaignProducts().slice(0,productVisibleCount).map((p,i)=><tr key={i} style={{borderTop:`1px solid ${C.brd}`}}>
                  <td style={{padding:"7px 4px",color:C.txt}}>{p.name} <span style={{color:C.mut}}>({p.id})</span></td>
                  <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{p.viewed.toLocaleString()}</td>
                  <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{p.addedToCart.toLocaleString()}</td>
                  <td style={{padding:"7px 4px",textAlign:"right",fontWeight:600,color:C.txt}}>{p.purchased.toLocaleString()}</td>
                  <td style={{padding:"7px 4px",textAlign:"right",color:C.grn}}>{fmtMoney(p.revenue,campaignProducts.currency)}</td>
                  <td style={{padding:"7px 4px",textAlign:"right",color:C.yel}}>{p.conversionRate.toFixed(1)}%</td>
                </tr>)}
              </tbody>
            </table>
          </div>}
          {sortedCampaignProducts().length>productVisibleCount&&<button onClick={()=>setProductVisibleCount(v=>v+50)} style={{width:"100%",padding:"9px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.03)",color:C.mut,fontSize:12,fontWeight:600,cursor:"pointer"}}>
            {sr?`Prikaži još 50 (${productVisibleCount} / ${sortedCampaignProducts().length})`:`Show 50 more (${productVisibleCount} / ${sortedCampaignProducts().length})`}
          </button>}
        </>}
      </div>}

      {/* DRILL: AD GRUPA DETALJI (OGLASI) */}
      {drillAdGroup&&<div>
        <button onClick={()=>{setDrillAdGroup(null);setAds(null);}} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12,padding:0,marginBottom:10}}>{sr?`← Nazad na ${drillCampaign.campaign_name}`:`← Back to ${drillCampaign.campaign_name}`}</button>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 16px"}}>{drillAdGroup.name}</h3>

        <div style={{fontSize:13,fontWeight:700,color:C.txt,marginBottom:8}}>{sr?"Oglasi":"Ads"}</div>
        {adsLoading&&<div style={{color:C.mut,fontSize:12}}>{sr?"Učitavam...":"Loading..."}</div>}
        {!adsLoading&&ads&&ads.items.length===0&&<div style={{color:C.mut,fontSize:12}}>{sr?"Nema oglasa sa potrošnjom u ovom periodu.":"No ads with spend in this period."}</div>}
        {!adsLoading&&ads&&ads.items.length>0&&<div style={{overflowX:"auto"}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
            <thead>
              <tr style={{color:C.mut,textAlign:"left"}}>
                <th style={{padding:"6px 4px",fontWeight:600}}>{sr?"Oglas":"Ad"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Klikovi":"Clicks"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Impresije":"Impressions"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>Spend</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Prihod":"Revenue"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {ads.items.map((a,i)=><tr key={i} style={{borderTop:`1px solid ${C.brd}`}}>
                <td style={{padding:"7px 4px",color:C.txt}}>{a.name}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{a.clicks.toLocaleString()}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{a.impressions.toLocaleString()}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.txt}}>{fmtMoney(a.spendEUR,"EUR")}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.grn}}>{fmtMoney(a.revenueEUR,"EUR")}</td>
                <td style={{padding:"7px 4px",textAlign:"right",fontWeight:700,color:a.roas>=1?C.grn:C.red}}>{a.roas.toFixed(2)}x</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </div>}
    </>}

    {mode==="byProduct"&&<div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <input value={byProductQuery} onChange={e=>setByProductQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runProductSearch()} placeholder={sr?"Ukucaj naziv proizvoda...":"Type product name..."} style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.03)",color:C.txt,fontSize:13,boxSizing:"border-box"}}/>
        <button onClick={runProductSearch} disabled={byProductLoading||!byProductQuery.trim()} style={{padding:"10px 20px",borderRadius:10,border:"none",background:byProductLoading||!byProductQuery.trim()?"rgba(99,102,241,0.3)":"linear-gradient(135deg,#6366F1,#4f46e5)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{sr?"Pretraži":"Search"}</button>
      </div>

      {byProductLoading&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Tražim...":"Searching..."}</div>}
      {byProductErr==="no_gads"&&<div style={{background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:12,padding:"16px",color:C.txt,fontSize:13}}>🔗 {sr?"Google Ads nije povezan za ovog klijenta.":"Google Ads is not connected for this client."}</div>}
      {byProductErr==="no_ga4"&&<div style={{background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:12,padding:"16px",color:C.txt,fontSize:13}}>🔗 {sr?"GA4 nije povezan za ovog klijenta.":"GA4 is not connected for this client."}</div>}

      {byProductData&&byProductData.noMatch&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Nema podudaranja za taj proizvod u ovom periodu.":"No matches for that product in this period."}</div>}

      {byProductData&&!byProductData.noMatch&&<>
        {byProductData.fxMissing&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,padding:"12px 16px",color:C.red,fontSize:12,marginBottom:12}}>⚠️ {sr?"Kurs za konverziju u EUR trenutno nije dostupan. Deo iznosa je prikazan u originalnoj valuti, pa iznosi i ROAS mogu biti netačni.":"The EUR exchange rate is currently unavailable. Some amounts are in the original currency, so amounts and ROAS may be inaccurate."}</div>}
        <div style={{color:C.mut,fontSize:11,marginBottom:12}}>{sr?"Prihod prikazan je za PRETRAŽENI proizvod. \"ROAS kampanje\" je za CELU kampanju, ne za ovaj proizvod (Google Ads ne prati trošak po pojedinačnom proizvodu).":"Revenue shown is for the SEARCHED product. \"Campaign ROAS\" is for the WHOLE campaign, not this product (Google Ads doesn't track cost per individual product)."}</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
            <thead>
              <tr style={{color:C.mut,textAlign:"left"}}>
                <th style={{padding:"6px 4px",fontWeight:600}}>{sr?"Kampanja":"Campaign"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Pregledi (proizvod)":"Viewed (product)"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Kupljeno (proizvod)":"Purchased (product)"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Prihod (proizvod)":"Revenue (product)"}</th>
                <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"ROAS kampanje":"Campaign ROAS"}</th>
              </tr>
            </thead>
            <tbody>
              {byProductData.results.map((r,i)=><tr key={i} style={{borderTop:`1px solid ${C.brd}`}}>
                <td style={{padding:"7px 4px",color:C.txt}}>{r.campaign_name} <span style={{color:C.mut}}>({r.campaign_id})</span>{r.no_spend_in_period&&<span style={{display:"inline-block",marginLeft:6,color:C.yel,fontSize:10}}>{sr?"bez potrošnje u periodu":"no spend in period"}</span>}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{r.productViewed.toLocaleString()}</td>
                <td style={{padding:"7px 4px",textAlign:"right",fontWeight:600,color:C.txt}}>{r.productPurchased.toLocaleString()}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.grn}}>
                  {fmtMoney(r.productRevenueEUR,"EUR")}
                  {byProductData.showRevenueNative&&<div style={{color:C.mut,fontSize:10}}>≈ {fmtMoney(r.productRevenue,byProductData.currency)}</div>}
                </td>
                <td style={{padding:"7px 4px",textAlign:"right",fontWeight:700,color:r.campaignTotalSpendEUR>0?(r.campaignRoas>=1?C.grn:C.red):C.mut}}>{r.campaignTotalSpendEUR>0?`${r.campaignRoas.toFixed(2)}x`:"–"}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </>}
    </div>}

    {mode==="byKeyword"&&<CiKeywords sr={sr} mob={kwMob} clientId={selectedClient.id} qs={appliedQs}/>}

    {mode==="byCategory"&&<div>
      {categoryListLoading&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Učitavam kategorije...":"Loading categories..."}</div>}
      {!categoryListLoading&&categoryList&&!categoryList.hasCategories&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Ovaj klijent nema podešene kategorije proizvoda u GA4-u.":"This client doesn't have product categories set up in GA4."}</div>}

      {!categoryListLoading&&categoryList&&categoryList.hasCategories&&!selectedCategory&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
        {categoryList.categories.map((c,i)=><button key={i} onClick={()=>openCategory(c.name)} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:10,padding:"12px 16px",textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:C.txt,fontWeight:600,fontSize:13}}>{c.name}</span>
          <span style={{color:C.grn,fontSize:13,fontWeight:700}}>{fmtMoney(c.revenueEUR,"EUR")}</span>
        </button>)}
      </div>}

      {selectedCategory&&<div>
        <button onClick={()=>{setSelectedCategory(null);setCategoryData(null);}} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12,padding:0,marginBottom:10}}>{sr?"← Sve kategorije":"← All categories"}</button>
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 16px"}}>{selectedCategory}</h3>

        {categoryDataLoading&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Učitavam...":"Loading..."}</div>}
        {categoryData&&categoryData.noMatch&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Nema podudaranja za ovu kategoriju u ovom periodu.":"No matches for this category in this period."}</div>}

        {categoryData&&!categoryData.noMatch&&<>
          {categoryData.fxMissing&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,padding:"12px 16px",color:C.red,fontSize:12,marginBottom:12}}>⚠️ {sr?"Kurs za konverziju u EUR trenutno nije dostupan. Deo iznosa je prikazan u originalnoj valuti, pa iznosi i ROAS mogu biti netačni.":"The EUR exchange rate is currently unavailable. Some amounts are in the original currency, so amounts and ROAS may be inaccurate."}</div>}
          <div style={{color:C.mut,fontSize:11,marginBottom:12}}>{sr?"Prihod prikazan je za ovu KATEGORIJU. \"ROAS kampanje\" je za CELU kampanju, ne samo za ovu kategoriju.":"Revenue shown is for this CATEGORY. \"Campaign ROAS\" is for the WHOLE campaign, not just this category."}</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
              <thead>
                <tr style={{color:C.mut,textAlign:"left"}}>
                  <th style={{padding:"6px 4px",fontWeight:600}}>{sr?"Kampanja":"Campaign"}</th>
                  <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Pregledi (kat.)":"Viewed (cat.)"}</th>
                  <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Kupljeno (kat.)":"Purchased (cat.)"}</th>
                  <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"Prihod (kat.)":"Revenue (cat.)"}</th>
                  <th style={{padding:"6px 4px",fontWeight:600,textAlign:"right"}}>{sr?"ROAS kampanje":"Campaign ROAS"}</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.results.map((r,i)=><tr key={i} style={{borderTop:`1px solid ${C.brd}`}}>
                  <td style={{padding:"7px 4px",color:C.txt}}>{r.campaign_name} <span style={{color:C.mut}}>({r.campaign_id})</span>{r.no_spend_in_period&&<span style={{display:"inline-block",marginLeft:6,color:C.yel,fontSize:10}}>{sr?"bez potrošnje u periodu":"no spend in period"}</span>}</td>
                  <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{r.categoryViewed.toLocaleString()}</td>
                  <td style={{padding:"7px 4px",textAlign:"right",fontWeight:600,color:C.txt}}>{r.categoryPurchased.toLocaleString()}</td>
                  <td style={{padding:"7px 4px",textAlign:"right",color:C.grn}}>
                    {fmtMoney(r.categoryRevenueEUR,"EUR")}
                    {categoryData.showRevenueNative&&<div style={{color:C.mut,fontSize:10}}>≈ {fmtMoney(r.categoryRevenue,categoryData.currency)}</div>}
                  </td>
                  <td style={{padding:"7px 4px",textAlign:"right",fontWeight:700,color:r.campaignTotalSpendEUR>0?(r.campaignRoas>=1?C.grn:C.red):C.mut}}>{r.campaignTotalSpendEUR>0?`${r.campaignRoas.toFixed(2)}x`:"–"}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>}
      </div>}
    </div>}
  </div>;
}


// ── INVESTIGATE (mod 16) ─────────────────────────────────────────────────────
// Istraga radi i kad korisnik pređe u drugi modul: stanje i veza sa serverom žive VAN komponente (INV),
// a komponenta se samo "pretplati" na promene. Ništa se ne čuva u bazi – rezultat čeka dok je app otvoren.
const INV={state:null,listeners:new Set(),ctrl:null,last:null};
function invSet(patch){ INV.state=patch===null?null:{...(INV.state||{}),...patch}; INV.listeners.forEach(f=>f(INV.state)); }
function useInv(){
  const [s,setS]=useState(INV.state);
  useEffect(()=>{ INV.listeners.add(setS); setS(INV.state); return()=>{INV.listeners.delete(setS);}; },[]);
  return s;
}
const INV_QTYPES=[
  {k:"revenue_drop",sr:"Prihod je pao",en:"Revenue dropped",qsr:"Zašto je prihod pao?",qen:"Why did revenue drop?"},
  {k:"roas_drop",sr:"ROAS je pao",en:"ROAS dropped",qsr:"Zašto je ROAS pao?",qen:"Why did ROAS drop?"},
  {k:"spend_up",sr:"Potrošnja raste, a prihod ne",en:"Spend up, revenue not",qsr:"Potrošnja raste, a prihod ne – zašto?",qen:"Spend is up but revenue isn't – why?"},
  {k:"other",sr:"Nešto ne štima",en:"Something's off",qsr:"Šta se promenilo i zašto?",qen:"What changed and why?"},
];
function invDateRange(a,b,sr){
  const p=s=>{const [y,m,d]=s.split("-");return {y:+y,m:+m,d:+d};};
  const x=p(a),y=p(b);
  if(sr) return x.m===y.m?`${x.d}.–${y.d}. ${y.m}.`:`${x.d}. ${x.m}.–${y.d}. ${y.m}.`;
  return `${x.d}/${x.m}–${y.d}/${y.m}`;
}
async function invStart({client,days,from,to,qtype,question,lang,campaignId,style}){
  style=style==="simple"?"simple":((INV.last&&INV.last.style)||"expert");
  if(INV.ctrl) try{INV.ctrl.abort();}catch(e){}
  const ctrl=new AbortController(); INV.ctrl=ctrl;
  const sr=lang==="sr";
  invSet(null);
  INV.last={clientId:String(client.id),days,from,to,qtype,question,style};
  pmScrollTop();
  invSet({status:"running",client,qtype,question,lang,days,from,to,style,campaignId:campaignId||null,startedAt:Date.now(),checks:[],period:null,result:null,error:""});
  const qs=new URLSearchParams({client_id:String(client.id),qtype,lang,style});
  if(from&&to){ qs.set("from",from); qs.set("to",to); } else qs.set("days",String(days));
  if(question) qs.set("q",question);
  if(campaignId) qs.set("campaign_id",String(campaignId));
  try{
    const r=await fetch(`/api/investigate?${qs.toString()}`,{signal:ctrl.signal});
    if(!r.ok){
      const d=await r.json().catch(()=>({}));
      const msg=d.error==="no_ga4"?(sr?"GA4 nije povezan za ovog klijenta. Poveži ga u modulu Klijenti.":"GA4 is not connected for this client. Connect it in Clients."):(d.error||(sr?"Greška pri pokretanju istrage":"Could not start the investigation"));
      if(INV.ctrl===ctrl) invSet({status:"error",error:msg});
      return;
    }
    const reader=r.body.getReader(); const dec=new TextDecoder(); let buf=""; let gotResult=false;
    for(;;){
      const {done,value}=await reader.read(); if(done) break;
      buf+=dec.decode(value,{stream:true});
      let i;
      while((i=buf.indexOf("\n"))>=0){
        const line=buf.slice(0,i); buf=buf.slice(i+1);
        if(!line.trim()||INV.ctrl!==ctrl) continue;
        let e; try{ e=JSON.parse(line); }catch(err){ continue; }
        if(e.type==="start") invSet({checks:e.checks.map(c=>({...c,status:"pending",summary:""})),period:e.period,currency:e.currency,eurFactor:e.eurFactor});
        else if(e.type==="check_add"){
          // Drugi krug: server dodaje nove (dublje) provere, ubacuju se pre poslednjeg koraka (AI)
          const cs=[...(INV.state.checks||[])]; const at=cs.findIndex(c=>c.id===e.before);
          const nc={...e.check,status:"pending",summary:""};
          if(at>=0) cs.splice(at,0,nc); else cs.push(nc);
          invSet({checks:cs});
        }
        else if(e.type==="check") invSet({checks:(INV.state.checks||[]).map(c=>c.id===e.id?{...c,status:e.status,summary:e.summary}:c)});
        else if(e.type==="result"){ gotResult=true; pmAnimReset("inv:"); invSet({status:"done",result:e,finishedAt:Date.now()}); if(INV.listeners.size) pmScrollTop(); }
        else if(e.type==="error") invSet({status:"error",error:e.error});
      }
    }
    if(INV.ctrl===ctrl&&!gotResult&&INV.state&&INV.state.status==="running") invSet({status:"error",error:sr?"Veza sa serverom je prekinuta pre kraja istrage. Pokušaj ponovo.":"Connection closed before the investigation finished. Please try again."});
  }catch(e){
    if(e.name==="AbortError") return;
    if(INV.ctrl===ctrl) invSet({status:"error",error:sr?"Nema veze sa serverom. Proveri internet i pokušaj ponovo.":"No connection to the server. Check your internet and try again."});
  }
}
function invCancel(){ if(INV.ctrl) try{INV.ctrl.abort();}catch(e){} INV.ctrl=null; invSet(null); pmScrollTop(); }

// **podebljano** iz AI teksta -> <b>
const InvRich=({text})=><>{String(text||"").split(/\*\*(.+?)\*\*/g).map((p,i)=>i%2?<b key={i} style={{color:"#fff"}}>{p}</b>:<Fragment key={i}>{p}</Fragment>)}</>;

function useNarrow(px){ const [n,setN]=useState(window.innerWidth<px); useEffect(()=>{ const h=()=>setN(window.innerWidth<px); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); },[px]); return n; }

const INV_CSS=`@keyframes invspin{to{transform:rotate(360deg)}}
@keyframes invscan{0%{left:-2px}100%{left:100%}}
.inv-scan{position:absolute;top:0;bottom:0;width:2px;background:linear-gradient(180deg,transparent,#A5B4FC,transparent);animation:invscan 2.2s ease-in-out infinite;opacity:.8}`;

function InvestigateMod({t,lang}){
  const sr=lang==="sr";
  const inv=useInv();
  const narrow=useNarrow(860);
  const [clients,setClients]=useState([]);
  const [clientsLoading,setClientsLoading]=useState(true);
  const L0=INV.last||{};
  const [clientId,setClientId]=useState(L0.clientId||"");
  const [period,setPeriod]=useState(L0.from&&L0.to?"custom":String(L0.days||"7"));
  const [customFrom,setCustomFrom]=useState(L0.from||"");
  const [customTo,setCustomTo]=useState(L0.to||"");
  const [qtype,setQtype]=useState(L0.qtype||"revenue_drop");
  const [style,setStyle]=useState(L0.style||"expert");
  const [rwBusy,setRwBusy]=useState(false);
  const [question,setQuestion]=useState("");
  const [now,setNow]=useState(Date.now());
  const [showAll,setShowAll]=useState(false);
  const [pdfBusy,setPdfBusy]=useState(false);

  useEffect(()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setClientsLoading(false); return; }
    fetch(`/api/clients?user_id=${uid}`).then(r=>r.json()).then(d=>setClients(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setClientsLoading(false));
  },[]);
  // Sat za "proteklo" dok istraga traje
  useEffect(()=>{
    if(!inv||inv.status!=="running") return;
    const id=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(id);
  },[inv&&inv.status]);

  const card={background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:14,padding:"16px 18px"};
  const secT=(c,col)=><div style={{color:col||C.acl,fontSize:11,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>{c}</div>;
  const btn=(primary,disabled)=>({padding:primary?"12px 20px":"9px 16px",borderRadius:10,border:primary?"none":`1px solid ${C.brd}`,background:primary?(disabled?"rgba(99,102,241,0.3)":"linear-gradient(135deg,#6366F1,#4f46e5)"):"rgba(255,255,255,0.04)",color:"#fff",fontSize:13,fontWeight:700,cursor:disabled?"default":"pointer",whiteSpace:"nowrap"});
  const pctCol=v=>v==null?C.mut:v>0?C.grn:v<0?C.red:C.mut;
  const pctTxt=v=>{ if(v==null) return sr?"novo":"new"; const a=Math.abs(v); const s=a<10&&a>0?(Math.round(a*10)/10).toLocaleString(sr?"sr-RS":"en-GB"):Math.round(a).toLocaleString(sr?"sr-RS":"en-GB"); return (v>0?"+":v<0?"−":"")+s+"%"; };
  const header=<>
    <style>{INV_CSS}</style>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>🔎 Investigate</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 20px"}}>{t.m16s}</p>
  </>;

  // ── 1) POČETAK: izbor klijenta, perioda i pitanja ──
  if(!inv){
    const sel=clients.find(c=>String(c.id)===String(clientId));
    const customOk=period!=="custom"||(customFrom&&customTo&&customFrom<=customTo);
    const canStart=!!sel&&customOk;
    const qt=INV_QTYPES.find(x=>x.k===qtype);
    const start=()=>{ if(!canStart) return;
      invStart({client:{id:sel.id,name:sel.name},days:period==="custom"?null:parseInt(period),from:period==="custom"?customFrom:null,to:period==="custom"?customTo:null,qtype,question:question.trim()||(sr?qt.qsr:qt.qen),lang,style}); };
    const chip=(on)=>({padding:"8px 14px",borderRadius:20,border:`1px solid ${on?"rgba(99,102,241,0.6)":C.brd}`,background:on?"rgba(99,102,241,0.18)":"transparent",color:on?"#fff":C.mut,fontSize:12.5,fontWeight:600,cursor:"pointer"});
    return <div>
      {header}
      <div style={{...card,padding:"20px 22px",maxWidth:760}}>
        <Lbl c={sr?"Klijent":"Client"}/>
        {clientsLoading?<div style={{color:C.mut,fontSize:13,marginBottom:18}}>{sr?"Učitavam klijente...":"Loading clients..."}</div>
        :!clients.length?<div style={{color:C.mut,fontSize:13,marginBottom:18}}>{sr?"Još nemaš klijente. Dodaj ih u modulu Klijenti i poveži GA4.":"No clients yet. Add them in Clients and connect GA4."}</div>
        :<select value={clientId} onChange={e=>setClientId(e.target.value)} style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:10,color:C.txt,fontSize:14,marginBottom:18,outline:"none"}}>
          <option value="" style={{background:"#13131f"}}>{sr?"— izaberi klijenta —":"— choose a client —"}</option>
          {clients.map(c=><option key={c.id} value={c.id} style={{background:"#13131f"}}>{c.name}</option>)}
        </select>}

        <Lbl c={sr?"Period":"Period"}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:period==="custom"?10:6}}>
          {[["7",sr?"Poslednjih 7 dana":"Last 7 days"],["14",sr?"14 dana":"14 days"],["30",sr?"30 dana":"30 days"],["custom",sr?"Prilagođeno":"Custom"]].map(([v,l])=><button key={v} onClick={()=>setPeriod(v)} style={chip(period===v)}>{l}</button>)}
        </div>
        {period==="custom"&&<div style={{display:"flex",gap:10,marginBottom:6,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:140}}><DIn v={customFrom} ch={setCustomFrom}/></div>
          <div style={{flex:1,minWidth:140}}><DIn v={customTo} ch={setCustomTo}/></div>
        </div>}
        <div style={{color:C.dim,fontSize:12,marginBottom:18}}>{sr?"Poredi se sa prethodnim periodom iste dužine (i sa istim periodom prošle godine). Najduže 92 dana.":"Compared with the previous period of the same length (and the same period last year). Up to 92 days."}</div>

        <Lbl c={sr?"Šta te zanima?":"What do you want to know?"}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          {INV_QTYPES.map(x=><button key={x.k} onClick={()=>setQtype(x.k)} style={chip(qtype===x.k)}>{sr?x.sr:x.en}</button>)}
        </div>
        <input value={question} onChange={e=>setQuestion(e.target.value.slice(0,300))} onKeyDown={e=>e.key==="Enter"&&start()} placeholder={sr?`Ili napiši svojim rečima (npr. „${qt.qsr}“)`:`Or write it in your own words (e.g. “${qt.qen}”)`} style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:10,color:C.txt,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:18}}/>

        <Lbl c={sr?"Način pisanja":"Writing style"}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
          <button onClick={()=>setStyle("expert")} style={chip(style==="expert")}>{sr?"Stručno (za tim)":"Expert (for the team)"}</button>
          <button onClick={()=>setStyle("simple")} style={chip(style==="simple")}>{sr?"Jednostavno (za klijenta)":"Simple (for the client)"}</button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <button onClick={start} disabled={!canStart} style={btn(true,!canStart)}>🔎 {sr?"Istraži":"Investigate"}</button>
          <span style={{color:C.dim,fontSize:12}}>{sr?"Traje oko 30–60 sekundi. Možeš u međuvremenu da pređeš u drugi modul.":"Takes about 30–60 seconds. You can switch to another module meanwhile."}</span>
        </div>
      </div>
    </div>;
  }

  const rerunInLang=()=>{
    const std=INV_QTYPES.find(x=>x.qsr===inv.question||x.qen===inv.question);
    invStart({client:inv.client,days:inv.days,from:inv.from,to:inv.to,qtype:inv.qtype,question:std?(sr?std.qsr:std.qen):inv.question,lang,campaignId:inv.campaignId,style:(inv.result&&inv.result.style)||inv.style});
  };
  const langBanner=inv.lang&&inv.lang!==lang&&inv.status!=="error"?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"10px 14px",borderRadius:10,border:"1px solid rgba(99,102,241,0.35)",background:"rgba(99,102,241,0.08)",marginBottom:14}}>
    <span style={{color:C.txt,fontSize:13}}>{sr?"Ova istraga je napisana na engleskom.":"This investigation was written in Serbian."}</span>
    <button onClick={rerunInLang} style={{padding:"7px 14px",borderRadius:8,border:"1px solid rgba(99,102,241,0.5)",background:"rgba(99,102,241,0.18)",color:"#fff",fontSize:12.5,fontWeight:700,cursor:"pointer"}}>{sr?"Ponovi na srpskom":"Run again in English"}</button>
  </div>:null;
  const backLink=<button onClick={invCancel} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:12,padding:0,marginBottom:6}}>{sr?"← Nazad (nova istraga)":"← Back (new investigation)"}</button>;
  const periodTxt=inv.period?`${invDateRange(inv.period.curS,inv.period.curE,sr)} ${sr?"u odnosu na":"vs"} ${invDateRange(inv.period.prevS,inv.period.prevE,sr)}`:"";

  // ── 2) GREŠKA ──
  if(inv.status==="error") return <div>
    {backLink}
    {header}
    <div style={{...card,maxWidth:760,borderColor:"rgba(248,113,113,0.35)",background:"rgba(248,113,113,0.06)"}}>
      <div style={{color:C.red,fontWeight:700,fontSize:14,marginBottom:6}}>⚠️ {sr?"Istraga nije uspela":"The investigation failed"}</div>
      <div style={{color:C.txt,fontSize:13,lineHeight:1.6,marginBottom:14}}>{inv.error}</div>
      <button onClick={invCancel} style={btn(false)}>{sr?"Nazad":"Back"}</button>
    </div>
  </div>;

  // ── 3) U TOKU: dosije provera ──
  if(inv.status==="running"){
    const checks=inv.checks||[];
    const total=checks.length||13;
    const done=checks.filter(c=>c.status!=="pending").length;
    const elapsed=Math.max(0,Math.round((now-inv.startedAt)/1000));
    const mm=`${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,"0")}`;
    const remaining=Math.max(5,40-elapsed);
    const activeId=(checks.find(c=>c.status==="pending")||{}).id;
    const icon=(st,active)=>{
      const base={width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,fontWeight:800,boxSizing:"border-box"};
      if(st==="done") return <div style={{...base,background:"rgba(52,211,153,0.15)",border:"1px solid rgba(52,211,153,0.5)",color:C.grn}}>✓</div>;
      if(st==="failed") return <div style={{...base,background:"rgba(248,113,113,0.12)",border:"1px solid rgba(248,113,113,0.45)",color:C.red}}>✗</div>;
      if(st==="skipped") return <div style={{...base,border:`1px solid ${C.brd}`,color:C.mut}}>–</div>;
      if(active) return <div style={{...base,border:"2px solid rgba(165,180,252,0.25)",borderTopColor:C.acl,animation:"invspin 0.9s linear infinite"}}/>;
      return <div style={{...base,border:"1px dashed rgba(255,255,255,0.18)"}}/>;
    };
    return <div>
      {header}
      {langBanner}
      <div style={{...card,padding:narrow?"16px":"22px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:16,fontWeight:800,color:"#fff",marginBottom:4}}>{sr?"Istražujem":"Investigating"}: „{inv.question}“</div>
            <div style={{color:C.mut,fontSize:12.5}}>{inv.client.name}{periodTxt?` · ${periodTxt}`:""}</div>
          </div>
          <button onClick={invCancel} style={btn(false)}>{sr?"Otkaži":"Cancel"}</button>
        </div>
        <div style={{height:6,borderRadius:4,background:"rgba(255,255,255,0.06)",overflow:"hidden",marginBottom:8}}>
          <div style={{height:"100%",width:`${Math.round(done/total*100)}%`,background:"linear-gradient(90deg,#6366F1,#A5B4FC)",transition:"width .4s ease"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",color:C.mut,fontSize:12,marginBottom:16,gap:10,flexWrap:"wrap"}}>
          <span>{done} {sr?"od":"of"} {total} {sr?"provera završeno":"checks done"}</span>
          <span>{sr?"Proteklo":"Elapsed"} {mm}{elapsed<120?` · ${sr?"još oko":"about"} ${remaining} ${sr?"sekundi":"seconds left"}`:""}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(checks.length?checks:[]).map(c=>{
            const active=c.id===activeId;
            return <div key={c.id} className="pm-in" style={{position:"relative",overflow:"hidden",display:"flex",alignItems:narrow?"flex-start":"center",gap:12,padding:"12px 14px",borderRadius:10,border:`1px solid ${active?"rgba(99,102,241,0.55)":C.brd}`,background:active?"rgba(99,102,241,0.08)":"rgba(255,255,255,0.02)",flexWrap:narrow?"wrap":"nowrap"}}>
              {icon(c.status,active)}
              <div style={{width:narrow?"auto":260,flexShrink:0,fontWeight:700,fontSize:13,color:c.status==="pending"&&!active?C.dim:"#fff"}}>{c.label}</div>
              <div style={{flex:1,minWidth:narrow?"100%":0,fontSize:12.5,color:c.status==="failed"?C.red:active?C.acl:C.mut,lineHeight:1.5,paddingLeft:narrow?34:0}}>{c.summary||(active?(sr?"Proveravam...":"Checking..."):"")}</div>
              {active&&<div className="inv-scan"/>}
            </div>;
          })}
        </div>
        <div style={{color:C.dim,fontSize:12,marginTop:14}}>{sr?"Možeš da pređeš u drugi modul – istraga nastavlja da radi i rezultat te čeka ovde.":"You can switch to another module – the investigation keeps running and the result waits here."}</div>
      </div>
    </div>;
  }

  // ── 4) REZULTAT ──
  const R=inv.result||{};
  const T=R.totals;
  const cur=R.currency||"EUR";
  // Kao u ostalim modulima: glavni iznos u EUR, originalna valuta ispod (ako se razlikuje i ako postoji kurs)
  const ef=R.eurFactor;
  const useEur=cur!=="EUR"&&ef>0;
  const fm=v=>useEur?fmtMoney(v*ef,"EUR"):fmtMoney(v,cur);
  const fmNative=v=>useEur?fmtMoney(v,cur):null;
  const dur=R.durationMs?Math.round(R.durationMs/1000):null;
  const stats=T?[
    {l:sr?"Prihod":"Revenue",v:fm(T.cur.revenue),n:T.cur.revenue,fmt:fm,sub:fmNative(T.cur.revenue),p:T.pct.revenue,was:fm(T.prev.revenue)},
    {l:sr?"Porudžbine":"Orders",v:Math.round(T.cur.orders).toLocaleString(sr?"sr-RS":"en-GB"),n:T.cur.orders,fmt:x=>Math.round(x).toLocaleString(sr?"sr-RS":"en-GB"),p:T.pct.orders,was:Math.round(T.prev.orders).toLocaleString(sr?"sr-RS":"en-GB")},
    {l:sr?"Posete":"Sessions",v:Math.round(T.cur.sessions).toLocaleString(sr?"sr-RS":"en-GB"),n:T.cur.sessions,fmt:x=>Math.round(x).toLocaleString(sr?"sr-RS":"en-GB"),p:T.pct.sessions,was:Math.round(T.prev.sessions).toLocaleString(sr?"sr-RS":"en-GB")},
    {l:sr?"Konverzija":"Conversion",v:(T.cur.cr*100).toLocaleString(sr?"sr-RS":"en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})+"%",p:T.pct.cr,was:(T.prev.cr*100).toLocaleString(sr?"sr-RS":"en-GB",{minimumFractionDigits:2,maximumFractionDigits:2})+"%"},
    ...(R.gads?[
      {l:sr?"Potrošnja (Google Ads)":"Spend (Google Ads)",v:fm(R.gads.spendCur),n:R.gads.spendCur,fmt:fm,was:fm(R.gads.spendPrev),p:R.gads.spendPrev>0?(R.gads.spendCur-R.gads.spendPrev)/R.gads.spendPrev*100:null,inv:true},
      {l:"ROAS (Google Ads)",v:R.gads.roasCur.toLocaleString(sr?"sr-RS":"en-GB",{minimumFractionDigits:2,maximumFractionDigits:2}),was:R.gads.roasPrev.toLocaleString(sr?"sr-RS":"en-GB",{minimumFractionDigits:2,maximumFractionDigits:2}),p:R.gads.roasPrev>0?(R.gads.roasCur-R.gads.roasPrev)/R.gads.roasPrev*100:null},
    ]:[])
  ]:[];
  const ai=R.ai;
  const curStyle=R.style||"expert";
  // Ponovo napiši objašnjenje u drugom stilu – samo AI, iz već izračunatih nalaza (nema novih upita ka Google-u)
  const switchStyle=async(st)=>{
    if(st===curStyle||rwBusy||!ai) return;
    const cache=(R.aiByStyle||{})[st];
    if(cache){ invSet({result:{...R,ai:cache,style:st,aiByStyle:{...(R.aiByStyle||{}),[curStyle]:ai}}}); return; }
    setRwBusy(true);
    try{
      const r=await fetch("/api/investigate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:inv.client.id,lang:inv.lang||lang,style:st,period:R.period,question:inv.question,qtype:inv.qtype,findings:R.findings,facts:R.facts,warnings:R.warnings,focus:R.focus})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.ai) throw new Error(d.error||"error");
      if(INV.state&&INV.state.result===R) invSet({result:{...R,ai:d.ai,style:st,aiByStyle:{...(R.aiByStyle||{}),[curStyle]:ai,[st]:d.ai}}});
    }catch(e){ alert(sr?"Objašnjenje nije prepisano. Pokušaj ponovo.":"Could not rewrite the explanation. Please try again."); }
    setRwBusy(false);
  };
  const seg=(on)=>({padding:"6px 12px",border:"none",background:on?"rgba(99,102,241,0.3)":"transparent",color:on?"#fff":C.mut,fontSize:12,fontWeight:700,cursor:rwBusy?"default":"pointer"});
  const styleSwitch=ai&&R.facts?<div style={{display:"inline-flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
    <div style={{display:"inline-flex",border:`1px solid ${C.brd}`,borderRadius:8,overflow:"hidden"}}>
      <button onClick={()=>switchStyle("expert")} style={seg(curStyle==="expert")}>{sr?"Stručno":"Expert"}</button>
      <button onClick={()=>switchStyle("simple")} style={seg(curStyle==="simple")}>{sr?"Za klijenta":"For client"}</button>
    </div>
    {rwBusy&&<span style={{color:C.acl,fontSize:12}}>{sr?"Prepisujem...":"Rewriting..."}</span>}
  </div>:null;
  const byId=Object.fromEntries((R.findings||[]).map(f=>[f.id,f]));
  const evidence=ai?(ai.evidence||[]).map(id=>byId[id]).filter(Boolean):[];
  const confMap={high:[sr?"Visoka sigurnost":"High confidence",C.grn,"rgba(52,211,153,0.12)","rgba(52,211,153,0.4)"],medium:[sr?"Srednja sigurnost":"Medium confidence",C.yel,"rgba(251,191,36,0.1)","rgba(251,191,36,0.4)"],low:[sr?"Niska sigurnost":"Low confidence",C.red,"rgba(248,113,113,0.1)","rgba(248,113,113,0.4)"]};
  const conf=ai&&confMap[ai.confidence]?confMap[ai.confidence]:null;
  // AI se ne broji ovde – za njega postoji posebna poruka ("Objašnjenje nije napisano")
  const failedChecks=(inv.checks||[]).filter(c=>c.status==="failed"&&c.id!=="ai");
  const gadsSkipped=(inv.checks||[]).some(c=>c.id==="gads"&&c.status==="skipped");
  const Nchip=({id})=><span style={{display:"inline-block",minWidth:26,textAlign:"center",padding:"2px 6px",borderRadius:6,border:"1px solid rgba(99,102,241,0.45)",background:"rgba(99,102,241,0.12)",color:C.acl,fontSize:11,fontWeight:800,flexShrink:0}}>{id}</span>;
  const downloadPdf=async()=>{
    if(pdfBusy) return;
    setPdfBusy(true);
    const safe=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"dj").replace(/Đ/g,"Dj").replace(/[^A-Za-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
    try{
      const pm=await rsLoadPdfMake();
      const doc=invPdfDoc({inv,R,stats,ai,evidence,findings:R.findings||[],failedChecks,sr,pctTxt,periodTxt,toEur:v=>useEur?v*ef:v,curSym:useEur?"€":cur});
      // Ugrađeni PDF font nema znak "→" (pojavljuje se kao kvadratić) – zamenjuje se znakom "»"
      const fixStr=x=>typeof x==="string"?x.replace(/\s*→\s*/g," » "):Array.isArray(x)?x.map(fixStr):x&&typeof x==="object"?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,typeof v==="function"?v:fixStr(v)])):x;
      doc.content=fixStr(doc.content);
      pm.createPdf(doc).download(`${safe(inv.client.name)||"klijent"}_istraga_${inv.period?inv.period.curS+"_"+inv.period.curE:"rezultat"}.pdf`);
    }catch(e){ alert(sr?"PDF nije napravljen. Proveri internet vezu i pokušaj ponovo.":"The PDF could not be created. Check your connection and try again."); }
    setPdfBusy(false);
  };
  const findingRow=f=><div key={f.id} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 0",borderTop:`1px solid ${C.brd}`}}><Nchip id={f.id}/><div style={{fontSize:12.5,color:C.txt,lineHeight:1.55}}>{f.text}</div></div>;
  const bullets=(arr)=><div>{(arr||[]).map((x,i)=><div key={i} style={{display:"flex",gap:8,fontSize:13,lineHeight:1.6,color:C.txt,marginBottom:8}}><span style={{color:C.mut}}>›</span><div><InvRich text={x}/></div></div>)}</div>;

  return <div>
    <style>{INV_CSS}</style>
    {backLink}
    {langBanner}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:18}}>
      <div style={{minWidth:0}}>
        <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>🔎 {inv.question}</h2>
        <div style={{color:C.mut,fontSize:12.5}}>{inv.client.name}{periodTxt?` · ${periodTxt}`:""}{dur?` · ${sr?"istraga trajala":"took"} ${dur} s`:""}</div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        {styleSwitch}
        <button onClick={downloadPdf} disabled={pdfBusy} style={{...btn(false),opacity:pdfBusy?0.6:1}}>📄 {pdfBusy?(sr?"Pravim PDF...":"Creating PDF..."):(sr?"Preuzmi PDF":"Download PDF")}</button>
        <button onClick={invCancel} style={btn(false)}>{sr?"Nova istraga":"New investigation"}</button>
      </div>
    </div>

    {stats.length>0&&!R.unavailable&&<InvVisuals R={R} ai={ai} sr={sr} narrow={narrow} stats={stats} conf={conf} toEur={v=>useEur?v*ef:v} curSym={useEur?"€":cur}/>}
    {!R.unavailable&&stats.length>0&&<div style={{color:C.acl,fontSize:11,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase",margin:"22px 0 12px"}}>{sr?"Objašnjenje i dokazi":"Explanation and evidence"}</div>}

    {R.unavailable&&<div style={{...card,borderColor:"rgba(251,191,36,0.35)",background:"rgba(251,191,36,0.06)",marginBottom:16}}>
      <div style={{color:C.yel,fontWeight:700,fontSize:14,marginBottom:6}}>⏳ {sr?"Podaci trenutno nisu dostupni":"Data is not available right now"}</div>
      <div style={{color:C.txt,fontSize:13,lineHeight:1.6}}>{R.unavailable}</div>
    </div>}

    {!R.unavailable&&<div style={{display:"grid",gridTemplateColumns:narrow?"1fr":"1.15fr 1fr",gap:14,alignItems:"start"}}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {ai&&!(stats.length>0)&&<div style={card}>{secT(sr?"Šta se desilo":"What happened")}<div style={{fontSize:13.5,lineHeight:1.7,color:C.txt}}><InvRich text={ai.what}/></div></div>}
        {ai&&<div style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
            <div style={{color:C.acl,fontSize:11,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase"}}>{sr?"Zašto se verovatno dešava":"Why it is likely happening"}</div>
            {conf&&<span style={{padding:"3px 10px",borderRadius:20,fontSize:10.5,fontWeight:800,letterSpacing:"0.6px",textTransform:"uppercase",color:conf[1],background:conf[2],border:`1px solid ${conf[3]}`}}>{conf[0]}</span>}
          </div>
          <div style={{fontSize:13.5,lineHeight:1.7,color:C.txt}}><InvRich text={ai.why}/></div>
        </div>}
        {!ai&&<div style={{...card,borderColor:"rgba(251,191,36,0.35)"}}><div style={{color:C.yel,fontSize:13,lineHeight:1.6}}>{sr?"Objašnjenje nije napisano (AI trenutno nije dostupan). Ispod su nalazi koje je server izračunao.":"The explanation could not be written (AI unavailable). Below are the findings computed by the server."}</div></div>}
        <div style={card}>
          {secT(ai?(sr?"Dokazi":"Evidence"):(sr?"Nalazi":"Findings"))}
          {(ai&&evidence.length?evidence:(R.findings||[]).slice(0,6)).map(findingRow)}
          {(R.findings||[]).length>(ai&&evidence.length?evidence.length:6)&&<button onClick={()=>setShowAll(v=>!v)} style={{marginTop:10,background:"none",border:"none",color:C.acl,fontSize:12,fontWeight:700,cursor:"pointer",padding:0}}>{showAll?(sr?"Sakrij ostale nalaze":"Hide other findings"):(sr?`Prikaži sve nalaze (${R.findings.length})`:`Show all findings (${R.findings.length})`)}</button>}
          {showAll&&<div style={{marginTop:8}}>{(R.findings||[]).filter(f=>!(ai&&evidence.length?evidence:(R.findings||[]).slice(0,6)).includes(f)).map(findingRow)}</div>}
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {ai&&(ai.cannot_confirm||[]).length>0&&<div style={{...card,borderColor:"rgba(251,191,36,0.35)",background:"rgba(251,191,36,0.05)"}}>{secT(sr?"Šta ne možemo da potvrdimo":"What we can't confirm",C.yel)}{bullets(ai.cannot_confirm)}</div>}
        {ai&&(ai.next_steps||[]).length>0&&<div style={card}>{secT(sr?"Šta proveriti sledeće":"What to check next")}{bullets(ai.next_steps)}</div>}
        <div style={card}>
          {secT(sr?"Kako sam došao do ovoga":"How I got here")}
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {(R.checksDone||[]).filter(c=>c.id!=="ai").map(c=><span key={c.id} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${C.brd}`,color:C.mut,fontSize:11.5}}>✓ {c.label}{c.count!=null&&c.count>0?` (${c.count.toLocaleString(sr?"sr-RS":"en-GB")})`:""}</span>)}
          </div>
          {failedChecks.length>0&&<div style={{color:C.yel,fontSize:12,marginTop:10,lineHeight:1.5}}>⚠️ {sr?"Nisu uspele":"Did not complete"}: {failedChecks.map(c=>c.label).join(", ")}. {sr?"Google nije odgovorio na vreme – zaključak je zato manje siguran.":"Google did not respond in time – the conclusion is less certain."}</div>}
          {gadsSkipped&&<div style={{color:C.mut,fontSize:12,marginTop:10,lineHeight:1.5}}>💡 {sr?"Poveži Google Ads za ovog klijenta da bi istraga uključila i potrošnju i ROAS kampanja.":"Connect Google Ads for this client so the investigation includes spend and campaign ROAS."}</div>}
          <div style={{color:C.dim,fontSize:11.5,marginTop:10,lineHeight:1.5}}>{sr?"Sve brojeve je izračunao server iz GA4 i Google Ads podataka; AI ih samo povezuje. Povezanost nije dokaz uzroka.":"All numbers are computed by the server from GA4 and Google Ads data; AI only connects them. Correlation is not proof of cause."}</div>
        </div>
      </div>
    </div>}
  </div>;
}


// ── Investigate: grafički prikaz rezultata (iznad teksta). Sve iz podataka koje server već šalje (R.viz) – nema novih upita.
function InvVisuals({R,ai,sr,narrow,stats,conf,toEur,curSym}){
  const V=R.viz||{}; const T=R.totals; const loc=sr?"sr-RS":"en-GB";
  const card={background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:14,padding:"16px 18px",minWidth:0};
  const title=(t,small,col)=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
    <span style={{color:col||C.acl,fontSize:11,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase"}}>{t}</span>
    {small&&<span style={{color:C.dim,fontSize:11}}>{small}</span>}</div>;
  // Kratak zapis novca (npr. +47,8k €)
  const k=(v,sign)=>{ const e=toEur(v); const a=Math.abs(e); const n=a>=1e6?(a/1e6).toLocaleString(loc,{maximumFractionDigits:1})+"M":a>=1e3?(a/1e3).toLocaleString(loc,{maximumFractionDigits:1})+"k":Math.round(a).toLocaleString(loc); return `${sign?(e>0?"+":e<0?"−":""):(e<0?"−":"")}${n} ${curSym}`; };
  const pc=v=>{ if(v==null||!isFinite(v)) return sr?"novo":"new"; const a=Math.abs(v); return (v>0?"+":v<0?"−":"")+(a<10&&a>0?(Math.round(a*10)/10).toLocaleString(loc):Math.round(a).toLocaleString(loc))+"%"; };
  const pct=(c,p)=>p>0?(c-p)/p*100:null;
  const col=v=>v>0?C.grn:v<0?C.red:C.mut;
  const dR=T?T.cur.revenue-T.prev.revenue:0;

  // ── 1. Glavni zaključak + značke + brojevi
  const chips=[];
  if(V.yoy&&V.yoy.seasonal) chips.push(["📈",`${sr?"Sezona (prošle godine":"Seasonal (last year"} ${pc(V.yoy.lastYearChange)})`,"g"]);
  const topOf=key=>{ const d=V.dims&&V.dims[key]; if(!d||!d.rows||!d.rows.length||!dR) return null; const r=[...d.rows].sort((a,b)=>Math.abs(b.c-b.p)-Math.abs(a.c-a.p))[0]; const sh=(r.c-r.p)/dR; return sh>=0.4&&sh<=1.5?{r,sh}:null; };
  const fc=(V.campaigns||[]).find(c=>c.focus);
  if(fc) chips.push(["🎯",`${fc.name.length>28?fc.name.slice(0,27)+"…":fc.name}: ROAS ${(fc.sp>0?fc.rp/fc.sp:0).toLocaleString(loc,{maximumFractionDigits:2})} → ${(fc.sc>0?fc.rc/fc.sc:0).toLocaleString(loc,{maximumFractionDigits:2})}`,fc.sc>0&&fc.sp>0&&fc.rc/fc.sc<fc.rp/fc.sp?"r":"g"]);
  const td=topOf("devices"); if(td) chips.push(["📱",`${td.r.name} ≈${Math.round(td.sh*100)}% ${sr?"promene":"of change"}`,dR>=0?"g":"r"]);
  const tc=topOf("channels"); if(tc) chips.push(["🔎",`${tc.r.name} ≈${Math.round(tc.sh*100)}% ${sr?"promene":"of change"}`,dR>=0?"g":"r"]);
  if((V.tracking||[]).length) chips.push(["⚠️",sr?"Moguć problem u merenju":"Possible tracking issue","y"]);
  if(V.gone&&V.gone.count>=10) chips.push(["📦",`${V.gone.count} ${sr?"„nestalih“ proizvoda":"“vanished” products"}`,"y"]);
  const chipCol={g:["rgba(52,211,153,0.1)","rgba(52,211,153,0.3)"],r:["rgba(248,113,113,0.1)","rgba(248,113,113,0.35)"],y:["rgba(251,191,36,0.1)","rgba(251,191,36,0.35)"]};
  const hero=<div style={{...card,borderColor:"rgba(99,102,241,0.4)",background:"linear-gradient(135deg,rgba(99,102,241,0.12),rgba(99,102,241,0.03))"}}>
    <div style={{display:"grid",gridTemplateColumns:narrow?"1fr":"1.2fr 1fr",gap:20,alignItems:"center"}}>
      <div style={{minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:8}}>
          <span style={{color:C.acl,fontSize:11,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase"}}>{sr?"Glavni zaključak":"Main conclusion"}</span>
          {conf&&<span style={{padding:"3px 10px",borderRadius:20,fontSize:10.5,fontWeight:800,letterSpacing:"0.6px",textTransform:"uppercase",color:conf[1],background:conf[2],border:`1px solid ${conf[3]}`}}>{conf[0]}</span>}
        </div>
        <div style={{fontSize:narrow?14.5:15.5,lineHeight:1.6,fontWeight:600,color:"#fff"}}>{ai?<InvRich text={ai.what}/>:T?`${sr?"Prihod":"Revenue"} ${pc(T.pct.revenue)}, ${sr?"porudžbine":"orders"} ${pc(T.pct.orders)}, ${sr?"posete":"sessions"} ${pc(T.pct.sessions)}.`:""}</div>
        {chips.length>0&&<div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>{chips.slice(0,4).map(([ic,t,c],i)=><span key={i} style={{padding:"4px 10px",borderRadius:20,background:chipCol[c][0],border:`1px solid ${chipCol[c][1]}`,fontSize:11.5,color:C.txt}}>{ic} {t}</span>)}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
        {stats.map(s=><div key={s.l} style={{padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,minWidth:0}}>
          <div style={{color:C.mut,fontSize:10,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase"}}>{s.l}</div>
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"baseline",columnGap:6,marginTop:3}}><span style={{fontSize:narrow?15:16.5,fontWeight:800,color:"#fff"}}>{s.n!=null&&s.fmt?<AnimNum k={`inv:${s.l}`} value={s.n} format={s.fmt}/>:s.v}</span><span style={{fontSize:12,fontWeight:700,color:s.inv?(s.p>0?C.yel:s.p<0?C.grn:C.mut):col(s.p)}}>{pc(s.p)}</span></div>
          {(s.was||s.sub)&&<div style={{color:C.dim,fontSize:11,marginTop:2}}>{s.was?`${sr?"bilo":"was"} ${s.was}`:""}{s.was&&s.sub?" · ":""}{s.sub||""}</div>}
        </div>)}
      </div>
    </div>
  </div>;

  // ── 2. Most od prihoda (posete × konverzija × korpa)
  let waterfall=null;
  if(T&&R.decomp){
    const steps=[[sr?"Posete":"Traffic",R.decomp.traffic],[sr?"Konverzija":"Conversion",R.decomp.conversion],[sr?"Korpa":"Basket",R.decomp.basket]];
    const run=[T.prev.revenue]; steps.forEach(([,v])=>run.push(run[run.length-1]+v));
    const all=[...run,T.cur.revenue]; const mx=Math.max(...all), mn=Math.min(...all);
    const base=Math.max(0,mn-(mx-mn)*1.6); const H=150, top=30, y=v=>top+H-(v-base)/((mx-base)||1)*H;
    const W=400, bw=56, gap=(W-40-bw*5)/4; const x=i=>30+i*(bw+gap);
    const biggest=[...steps].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]))[0];
    waterfall=<div style={card}>
      {title(sr?"Odakle dolazi promena prihoda":"Where the revenue change comes from",sr?"posete × konverzija × korpa":"traffic × conversion × basket")}
      <svg viewBox={`0 0 ${W} 215`} width="100%" style={{display:"block"}}>
        <line x1="20" y1={top+H} x2={W-5} y2={top+H} stroke="rgba(255,255,255,0.1)"/>
        <rect x={x(0)} y={y(run[0])} width={bw} height={top+H-y(run[0])} rx="4" fill="rgba(165,180,252,0.35)"/>
        <text x={x(0)+bw/2} y={y(run[0])-7} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{k(run[0])}</text>
        {steps.map(([n,v],i)=>{ const a=run[i],b=run[i+1]; const yt=Math.min(y(a),y(b)); const h=Math.max(2,Math.abs(y(a)-y(b)));
          return <g key={n}><line x1={x(i)+bw} y1={y(a)} x2={x(i+1)} y2={y(a)} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3"/>
            <rect x={x(i+1)} y={yt} width={bw} height={h} rx="3" fill={v>=0?C.grn:C.red}/>
            <text x={x(i+1)+bw/2} y={yt-7} textAnchor="middle" fontSize="11" fontWeight="700" fill={v>=0?C.grn:C.red}>{k(v,true)}</text></g>; })}
        <line x1={x(3)+bw} y1={y(run[3])} x2={x(4)} y2={y(run[3])} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3"/>
        <rect x={x(4)} y={y(T.cur.revenue)} width={bw} height={top+H-y(T.cur.revenue)} rx="4" fill="#6366F1"/>
        <text x={x(4)+bw/2} y={y(T.cur.revenue)-7} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{k(T.cur.revenue)}</text>
        {[sr?"Pre":"Before",...steps.map(s=>s[0]),sr?"Sada":"Now"].map((n,i)=><text key={i} x={x(i)+bw/2} y={top+H+16} textAnchor="middle" fontSize="10.5" fill={C.mut}>{n}</text>)}
      </svg>
      <div style={{color:C.mut,fontSize:11.5,lineHeight:1.5}}>{sr?"Najveći uticaj ima":"Biggest effect"}: <b style={{color:"#fff"}}>{biggest[0].toLowerCase()}</b> ({k(biggest[1],true)}).</div>
    </div>;
  }

  // ── 3. Kretanje po danima
  let daily=null;
  const D=V.daily;
  if(D&&D.cur&&D.cur.length>=2){
    const n=D.cur.length; const vals=[...D.cur,...D.prev,...(D.band?D.band.max:[])]; const mx=Math.max(1,...vals);
    const W=520,H=150,top=28,left=8,right=8; const xs=i=>left+(n===1?0:i*(W-left-right)/(n-1)); const ys=v=>top+H-v/mx*H;
    const pts=a=>a.map((v,i)=>`${xs(i)},${ys(v)}`).join(" ");
    const ci=D.changeStart?D.dates.indexOf(D.changeStart):-1;
    const wd=s=>{ const d=new Date(s+"T00:00:00Z"); return n<=14?d.toLocaleDateString(sr?"sr-Latn-RS":"en-GB",{weekday:"short",timeZone:"UTC"}):`${d.getUTCDate()}.${d.getUTCMonth()+1}.`; };
    const every=Math.max(1,Math.ceil(n/8));
    const tot=D.cur.reduce((a,b)=>a+b,0);
    const inBand=D.band&&tot>=D.band.sumMin&&tot<=D.band.sumMax;
    daily=<div style={card}>
      {title(sr?"Kretanje po danima":"Day by day",<span><span style={{color:"#818CF8"}}>━</span> {sr?"ovaj period":"this period"} &nbsp;<span style={{color:"#9ca3af"}}>┅</span> {sr?"prethodni":"previous"}{D.band?<> &nbsp;<span style={{color:"rgba(165,180,252,0.6)"}}>▬</span> {sr?"uobičajeno":"usual range"}</>:null}</span>)}
      <svg viewBox={`0 0 ${W} ${top+H+22}`} width="100%" style={{display:"block"}}>
        {D.band&&<polygon points={`${pts(D.band.max)} ${D.band.min.map((v,i)=>`${xs(n-1-i)},${ys(D.band.min[n-1-i])}`).join(" ")}`} fill="rgba(165,180,252,0.08)"/>}
        <line x1={left} y1={top+H} x2={W-right} y2={top+H} stroke="rgba(255,255,255,0.1)"/>
        <polyline points={pts(D.prev)} fill="none" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 4" opacity="0.8"/>
        <polyline points={pts(D.cur)} fill="none" stroke="#818CF8" strokeWidth="3"/>
        {n<=31&&D.cur.map((v,i)=><circle key={i} cx={xs(i)} cy={ys(v)} r="3" fill="#818CF8"/>)}
        {ci>=0&&<g><line x1={xs(ci)} y1={top-10} x2={xs(ci)} y2={top+H} stroke={C.yel} strokeDasharray="3 3"/><text x={Math.min(xs(ci)+5,W-120)} y={top-12} fontSize="10.5" fontWeight="700" fill={C.yel}>{sr?"promena od":"change from"} {D.changeStart.slice(8,10).replace(/^0/,"")}.{D.changeStart.slice(5,7).replace(/^0/,"")}.</text></g>}
        {D.dates.map((d,i)=>i%every===0||i===n-1?<text key={i} x={xs(i)} y={top+H+15} textAnchor={i===0?"start":i===n-1?"end":"middle"} fontSize="10" fill={C.dim}>{wd(d)}</text>:null)}
      </svg>
      <div style={{color:C.mut,fontSize:11.5,lineHeight:1.5}}>
        {D.changeStart&&ci<0?<>{sr?"Promena počinje":"The change starts"} {D.changeStart.slice(8,10).replace(/^0/,"")}.{D.changeStart.slice(5,7).replace(/^0/,"")}. ({sr?"u prethodnom periodu":"in the previous period"}). </>:null}
        {D.band?<>{sr?"Ukupno je":"In total it is"} <b style={{color:"#fff"}}>{inBand?(sr?"u granicama uobičajenog":"within the usual range"):(sr?"izvan uobičajenog":"outside the usual range")}</b> {sr?"za ovog klijenta":"for this client"} ({sr?"poslednjih":"last"} {D.band.periods} {sr?"perioda":"periods"}: {k(D.band.sumMin)}–{k(D.band.sumMax)}).</>:null}
      </div>
    </div>;
  }

  // ── 4. Gde se promena desila (podeljeno po delovima)
  const drillFor=t=>(V.drills||[]).find(d=>d.type===t);
  const panels=[["channels",sr?"Kanali":"Channels","channel"],["devices",sr?"Uređaji":"Devices","device"],["newret",sr?"Novi i povratni":"New vs returning",null],["categories",sr?"Kategorije":"Categories","category"]]
    .filter(([key])=>V.dims&&V.dims[key]&&V.dims[key].rows&&V.dims[key].rows.length);
  const where=panels.length?<div style={card}>
    {title(sr?"Gde se promena desila":"Where the change happened",sr?"promena prihoda po delovima":"revenue change by segment")}
    <div style={{display:"grid",gridTemplateColumns:narrow?"1fr":`repeat(${Math.min(panels.length,4)},minmax(0,1fr))`,gap:narrow?18:22}}>
      {panels.map(([key,label,dt])=>{ const d=V.dims[key]; const rows=d.rows.slice(0,5); const m=Math.max(1,...rows.map(r=>Math.abs(toEur(r.c-r.p))));
        const dr=dt&&drillFor(dt); const catNote=key==="categories"&&rows.find(r=>r.upc!=null&&Math.abs(r.upc)>=25);
        return <div key={key} style={{minWidth:0}}>
          <div style={{fontWeight:700,fontSize:12.5,marginBottom:6,color:"#fff"}}>{label}</div>
          {rows.map(r=>{ const v=toEur(r.c-r.p); const w=Math.abs(v)/m*48;
            return <div key={r.name} style={{display:"grid",gridTemplateColumns:"minmax(0,1.1fr) minmax(0,1fr) auto",alignItems:"center",gap:8,margin:"6px 0",fontSize:12}}>
              <span title={r.name} style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:C.txt}}>{r.name}</span>
              <div style={{position:"relative",height:12}}><div style={{position:"absolute",left:"50%",top:-3,bottom:-3,borderLeft:"1px dashed rgba(255,255,255,0.18)"}}/>
                <div style={{position:"absolute",top:1,height:10,borderRadius:3,background:v>=0?C.grn:C.red,width:`${Math.max(1,w)}%`,...(v>=0?{left:"50%"}:{right:"50%"})}}/></div>
              <span style={{color:col(v),fontWeight:700,fontSize:11.5,whiteSpace:"nowrap"}}>{k(r.c-r.p,true)}</span>
            </div>; })}
          {d.uniform&&<div style={{fontSize:11,color:C.mut,marginTop:6}}>{sr?"Promena je ravnomerna – nije problem jedne stavke.":"The change is even – not a single-item issue."}</div>}
          {dr&&<div style={{fontSize:11,color:C.acl,marginTop:6,lineHeight:1.45}}>↳ {sr?"Dublje":"Deeper"}: {dr.summary}</div>}
          {catNote&&<div style={{fontSize:11,color:C.acl,marginTop:4,lineHeight:1.45}}>↳ {catNote.name}: {catNote.upc>0?(sr?"skuplji proizvodi":"pricier items"):(sr?"jeftiniji proizvodi":"cheaper items")} ({sr?"cena po komadu":"price per unit"} {pc(catNote.upc)})</div>}
        </div>; })}
    </div>
  </div>:null;

  // ── 5. Koraci kupovine · Provera merenja · Sezona
  const F_=V.funnel||[];
  const funnel=F_.length?<div style={card}>
    {title(sr?"Koraci kupovine":"Purchase steps",sr?"stopa prelaska":"step rate")}
    {(()=>{ const m=Math.max(0.0001,...F_.flatMap(s=>[s.p,s.c])); return F_.map(s=><div key={s.name} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1.3fr) auto",gap:8,alignItems:"center",margin:"8px 0",fontSize:12}}>
      <span style={{color:C.txt}}>{s.name}</span>
      <div><div style={{height:7,width:`${s.p/m*100}%`,background:"rgba(156,163,175,0.55)",borderRadius:3,marginBottom:3}}/><div style={{height:7,width:`${s.c/m*100}%`,background:"#6366F1",borderRadius:3}}/></div>
      <span style={{color:col(s.ch),fontWeight:700}}>{pc(s.ch)}</span></div>); })()}
    <div style={{color:C.dim,fontSize:11,marginTop:8}}><span style={{color:"#9ca3af"}}>▬</span> {sr?"prethodni":"previous"} &nbsp; <span style={{color:"#6366F1"}}>▬</span> {sr?"ovaj period":"this period"}</div>
  </div>:null;
  const trk=V.tracking||[];
  const tracking=V.tracking?(trk.length?<div style={{...card,borderColor:"rgba(251,191,36,0.35)",background:"rgba(251,191,36,0.05)"}}>
    {title(`⚠️ ${sr?"Provera merenja":"Tracking check"}`,null,C.yel)}
    {trk.slice(0,2).map((t,i)=><div key={i} style={{fontSize:12.5,lineHeight:1.55,color:C.txt,marginBottom:8}}>{t}</div>)}
    {trk.length>2&&<div style={{color:C.mut,fontSize:11.5}}>+{trk.length-2} {sr?"još":"more"}</div>}
  </div>:<div style={{...card,borderColor:"rgba(52,211,153,0.3)",background:"rgba(52,211,153,0.04)"}}>
    {title(`✓ ${sr?"Provera merenja":"Tracking check"}`,null,C.grn)}
    <div style={{fontSize:12.5,color:C.txt,lineHeight:1.55}}>{sr?"Nema znakova problema sa merenjem – brojevima se može verovati.":"No signs of tracking problems – the numbers can be trusted."}</div>
  </div>):null;
  const Y=V.yoy;
  const season=Y&&Y.lastYearChange!=null&&Y.nowChange!=null?(()=>{ const m=Math.max(1,Math.abs(Y.lastYearChange),Math.abs(Y.nowChange)); const h=v=>Math.max(4,Math.abs(v)/m*56);
    return <div style={card}>{title(sr?"Sezona":"Seasonality")}
      <div style={{display:"flex",alignItems:"flex-end",gap:16,height:86,padding:"0 6px"}}>
        {[[sr?"prošle god.":"last year",Y.lastYearChange,"rgba(156,163,175,0.5)"],[sr?"sada":"now",Y.nowChange,"#6366F1"]].map(([l,v,c])=><div key={l} style={{flex:1,textAlign:"center"}}>
          <div style={{color:col(v),fontWeight:800,fontSize:13}}>{pc(v)}</div><div style={{height:h(v),background:c,borderRadius:"4px 4px 0 0",marginTop:4}}/><div style={{color:C.mut,fontSize:11,marginTop:4}}>{l}</div></div>)}
      </div>
      <div style={{color:C.mut,fontSize:11.5,marginTop:8,lineHeight:1.5}}>{Y.seasonal?(sr?<>Slična promena kao prošle godine – <b style={{color:"#fff"}}>očekivano</b>.</>:<>Similar change as last year – <b style={{color:"#fff"}}>expected</b>.</>):(sr?"Prošle godine u ovim nedeljama nije bilo slične promene.":"Last year these weeks did not change similarly.")}{Y.vsLastYear!=null?` ${sr?"U odnosu na prošlu godinu":"Vs last year"}: ${pc(Y.vsLastYear)}.`:""}</div>
    </div>; })():null;
  const row5=[funnel,tracking,season].filter(Boolean);

  // ── 6. Kampanje i proizvodi
  const th={color:C.dim,fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:"0.5px",textAlign:"left",padding:"0 6px 6px"};
  const tdS={padding:"8px 6px",borderTop:`1px solid ${C.brd}`,fontSize:12,verticalAlign:"top"};
  const camps=(V.campaigns||[]).length?<div style={{...card,overflowX:"auto"}}>
    {title(sr?"Google Ads kampanje":"Google Ads campaigns",sr?"najveće promene":"biggest changes")}
    <table style={{width:"100%",borderCollapse:"collapse",minWidth:440}}><thead><tr><th style={th}>{sr?"Kampanja":"Campaign"}</th><th style={th}>{sr?"Potrošnja":"Spend"}</th><th style={th}>{sr?"Prihod":"Revenue"}</th><th style={th}>ROAS</th></tr></thead>
    <tbody>{V.campaigns.map(c=>{ const r0=c.sp>0?c.rp/c.sp:0, r1=c.sc>0?c.rc/c.sc:0; const sp=pct(c.sc,c.sp), rp=pct(c.rc,c.rp);
      return <tr key={c.id} style={c.focus?{background:"rgba(99,102,241,0.08)"}:null}>
        <td style={{...tdS,color:"#fff",maxWidth:220}}>{c.focus?"🎯 ":""}{c.name}</td>
        <td style={tdS}>{k(c.sp)} → {k(c.sc)} {sp!=null&&Math.abs(sp)>=1?<span style={{color:sp>0?C.yel:C.grn}}>{pc(sp)}</span>:null}</td>
        <td style={tdS}>{k(c.rp)} → {k(c.rc)} {rp!=null&&Math.abs(rp)>=1?<span style={{color:col(rp)}}>{pc(rp)}</span>:null}</td>
        <td style={{...tdS,color:Math.abs(r1-r0)/(r0||1)>=0.05?col(r1-r0):C.mut,whiteSpace:"nowrap"}}>{r0.toLocaleString(loc,{maximumFractionDigits:2})} → {r1.toLocaleString(loc,{maximumFractionDigits:2})}</td></tr>; })}</tbody></table>
  </div>:null;
  const prods=(V.products||[]).length?<div style={card}>
    {title(sr?"Proizvodi":"Products",sr?"najveće promene prihoda":"biggest revenue changes")}
    <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>{V.products.map((p,i)=>{ const v=p.c-p.p; return <tr key={i}>
      <td style={{...tdS,color:C.txt,borderTop:i?tdS.borderTop:"none"}}>{p.name}</td>
      <td style={{...tdS,color:col(v),textAlign:"right",whiteSpace:"nowrap",borderTop:i?tdS.borderTop:"none"}}>{k(v,true)} <span style={{color:C.mut}}>({pc(pct(p.c,p.p))})</span></td></tr>; })}
      {V.gone&&V.gone.count>0&&<tr><td colSpan={2} style={{...tdS,color:C.yel}}>⚠️ {V.gone.count} {sr?"„nestalih“ proizvoda – ranije donosili":"“vanished” products – previously brought"} {k(V.gone.prevRevenue)}{V.gone.examples&&V.gone.examples.length?<div style={{color:C.mut,fontSize:11,marginTop:3}}>{sr?"npr.":"e.g."} {V.gone.examples.join(", ")}</div>:null}</td></tr>}
    </tbody></table>
  </div>:null;

  const gap={display:"grid",gap:14,marginBottom:14};
  return <>
    <div className="pm-in" style={{marginBottom:14}}>{hero}</div>
    {(waterfall||daily)&&<div className="pm-in" style={{...gap,animationDelay:"90ms",gridTemplateColumns:narrow||!(waterfall&&daily)?"1fr":"1fr 1.35fr"}}>{waterfall}{daily}</div>}
    {where&&<div className="pm-in" style={{marginBottom:14,animationDelay:"180ms"}}>{where}</div>}
    {row5.length>0&&<div className="pm-in" style={{...gap,animationDelay:"260ms",gridTemplateColumns:narrow?"1fr":row5.length===3?"1.2fr 1fr 0.8fr":row5.length===2?"1fr 1fr":"1fr"}}>{funnel}{tracking}{season}</div>}
    {(camps||prods)&&<div className="pm-in" style={{...gap,animationDelay:"330ms",gridTemplateColumns:narrow||!(camps&&prods)?"1fr":"1.2fr 1fr"}}>{camps}{prods}</div>}
  </>;
}

// Pokreće istragu iz drugog modula (CI/PI) sa istim klijentom i periodom i otvara Investigate
function invLaunch(goMod,{client,period,customFrom,customTo,qtype,question,lang,campaignId}){
  const sr=lang==="sr";
  const custom=period==="custom";
  if(custom&&!(customFrom&&customTo)){ alert(sr?"Prvo izaberi period (od–do).":"Choose a period (from–to) first."); return; }
  if(INV.state&&INV.state.status==="running"&&!window.confirm(sr?"Jedna istraga je već u toku. Da je prekinem i pokrenem novu?":"An investigation is already running. Stop it and start a new one?")) return;
  invStart({client:{id:client.id,name:client.name},days:custom?null:Math.min(92,parseInt(period)||7),from:custom?customFrom:null,to:custom?customTo:null,qtype,question,lang,campaignId});
  if(goMod) goMod(16);
}
const invBtnStyle={padding:"6px 12px",borderRadius:8,border:"1px solid rgba(129,140,248,0.5)",background:"rgba(129,140,248,0.12)",color:"#C7D2FE",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"};

// Grafikoni za PDF istrage (pdfmake "canvas" – oblici; sav tekst je pravi tekst sa našim slovima)
function invPdfViz({R,sr,toEur,curSym,forClient}){
  const V=R.viz||{}; const T=R.totals; const loc=sr?"sr-RS":"en-GB";
  const out=[];
  const h2=t=>({text:t.toUpperCase(),fontSize:9.5,bold:true,color:"#4338ca",characterSpacing:0.8,margin:[0,14,0,6]});
  const k=(v,sign)=>{ const e=toEur(v); const a=Math.abs(e); const n=a>=1e6?(a/1e6).toLocaleString(loc,{maximumFractionDigits:1})+"M":a>=1e3?(a/1e3).toLocaleString(loc,{maximumFractionDigits:1})+"k":Math.round(a).toLocaleString(loc); return `${sign?(e>0?"+":e<0?"−":""):(e<0?"−":"")}${n} ${curSym}`; };
  const pc=v=>{ if(v==null||!isFinite(v)) return sr?"novo":"new"; const a=Math.abs(v); return (v>0?"+":v<0?"−":"")+(a<10&&a>0?(Math.round(a*10)/10).toLocaleString(loc):Math.round(a).toLocaleString(loc))+"%"; };
  const GRN="#059669", RED="#dc2626", IND="#6366f1", GRY="#9ca3af", YEL="#d97706";
  const colr=v=>v>0?GRN:v<0?RED:"#6b7280";
  const panel=(stack)=>({table:{widths:["*"],body:[[{stack,margin:[8,6,8,6]}]]},layout:{hLineWidth:()=>0.6,vLineWidth:()=>0.6,hLineColor:()=>"#e5e7eb",vLineColor:()=>"#e5e7eb"}});
  const cap=(t)=>({text:t,fontSize:8.5,bold:true,color:"#4338ca",margin:[0,0,0,5]});

  // Most od prihoda
  let wf=null;
  if(T&&R.decomp){
    const steps=[[sr?"Posete":"Traffic",R.decomp.traffic],[sr?"Konverzija":"Conversion",R.decomp.conversion],[sr?"Korpa":"Basket",R.decomp.basket]];
    const run=[T.prev.revenue]; steps.forEach(([,v])=>run.push(run[run.length-1]+v));
    const all=[...run,T.cur.revenue]; const mx=Math.max(...all), mn=Math.min(...all);
    const base=Math.max(0,mn-(mx-mn)*1.6); const W=235,H=95; const y=v=>H-(v-base)/((mx-base)||1)*H;
    const cw=W/5, bw=cw*0.62, x=i=>i*cw+(cw-bw)/2;
    const shapes=[{type:"line",x1:0,y1:H,x2:W,y2:H,lineWidth:0.5,lineColor:"#e5e7eb"},
      {type:"rect",x:x(0),y:y(run[0]),w:bw,h:H-y(run[0]),color:"#c7d2fe"}];
    steps.forEach(([,v],i)=>{ const a=run[i],b=run[i+1]; shapes.push({type:"rect",x:x(i+1),y:Math.min(y(a),y(b)),w:bw,h:Math.max(1.5,Math.abs(y(a)-y(b))),color:v>=0?"#34d399":"#f87171"}); });
    shapes.push({type:"rect",x:x(4),y:y(T.cur.revenue),w:bw,h:H-y(T.cur.revenue),color:IND});
    const labels=[[sr?"Pre":"Before",k(run[0]),"#111827"],...steps.map(([n,v])=>[n,k(v,true),colr(v)]),[sr?"Sada":"Now",k(T.cur.revenue),"#111827"]];
    wf=panel([cap(sr?"Odakle dolazi promena prihoda":"Where the revenue change comes from"),{canvas:shapes},
      {columns:labels.map(([n,v,c])=>({width:cw,stack:[{text:n,fontSize:7,color:"#6b7280",alignment:"center"},{text:v,fontSize:7.5,bold:true,color:c,alignment:"center"}]})),columnGap:0,margin:[0,3,0,0]}]);
  }
  // Kretanje po danima
  let dy=null; const D=V.daily;
  if(D&&D.cur&&D.cur.length>=2){
    const n=D.cur.length, W=245, H=95; const mx=Math.max(1,...D.cur,...D.prev,...(D.band?D.band.max:[]));
    const xs=i=>i*W/(n-1), ys=v=>H-v/mx*H;
    const shapes=[{type:"line",x1:0,y1:H,x2:W,y2:H,lineWidth:0.5,lineColor:"#e5e7eb"}];
    if(D.band) shapes.push({type:"polyline",closePath:true,color:"#eef2ff",lineWidth:0.1,lineColor:"#eef2ff",points:[...D.band.max.map((v,i)=>({x:xs(i),y:ys(v)})),...D.band.min.map((v,i)=>({x:xs(n-1-i),y:ys(D.band.min[n-1-i])}))]});
    shapes.push({type:"polyline",lineWidth:1.2,lineColor:GRY,dash:{length:3},points:D.prev.map((v,i)=>({x:xs(i),y:ys(v)}))});
    shapes.push({type:"polyline",lineWidth:2,lineColor:IND,points:D.cur.map((v,i)=>({x:xs(i),y:ys(v)}))});
    const ci=D.changeStart?D.dates.indexOf(D.changeStart):-1;
    if(ci>=0) shapes.push({type:"line",x1:xs(ci),y1:0,x2:xs(ci),y2:H,lineWidth:1,lineColor:YEL,dash:{length:2}});
    const d=s=>`${+s.slice(8,10)}.${+s.slice(5,7)}.`;
    const tot=D.cur.reduce((a,b)=>a+b,0); const inBand=D.band&&tot>=D.band.sumMin&&tot<=D.band.sumMax;
    dy=panel([cap(sr?"Kretanje po danima":"Day by day"),{canvas:shapes},
      {columns:[{text:d(D.dates[0]),fontSize:7,color:"#6b7280"},{text:d(D.dates[n-1]),fontSize:7,color:"#6b7280",alignment:"right"}],margin:[0,2,0,2]},
      {text:[{text:sr?"ovaj period":"this period",color:IND,bold:true},"  ·  ",{text:sr?"prethodni (isprekidano)":"previous (dashed)",color:"#6b7280"},...(D.band?["  ·  ",{text:sr?"svetlo polje = uobičajeno":"light area = usual range",color:"#818cf8"}]:[]),...(D.changeStart?["  ·  ",{text:`${sr?"promena od":"change from"} ${d(D.changeStart)}`,color:YEL,bold:true}]:[])],fontSize:7,color:"#6b7280"},
      ...(D.band?[{text:`${sr?"Ukupno":"Total"}: ${inBand?(sr?"u granicama uobičajenog":"within usual range"):(sr?"izvan uobičajenog":"outside usual range")} (${k(D.band.sumMin)}–${k(D.band.sumMax)})`,fontSize:7.5,color:"#374151",margin:[0,3,0,0]}]:[])]);
  }
  if(wf||dy){ out.push(h2(sr?"Pregled u grafikonima":"Visual overview")); out.push({columns:[wf||{text:""},dy||{text:""}],columnGap:10}); }

  // Gde se promena desila (stručna verzija)
  const panels=[["channels",sr?"Kanali":"Channels","channel"],["devices",sr?"Uređaji":"Devices","device"],["newret",sr?"Novi i povratni":"New vs returning",null],["categories",sr?"Kategorije":"Categories","category"]]
    .filter(([key])=>V.dims&&V.dims[key]&&V.dims[key].rows&&V.dims[key].rows.length);
  if(!forClient&&panels.length){
    const BW=70;
    const box=([key,label,dt])=>{ const rows=V.dims[key].rows.slice(0,5); const m=Math.max(1,...rows.map(r=>Math.abs(r.c-r.p)));
      const dr=dt&&(V.drills||[]).find(x=>x.type===dt);
      return panel([cap(label),{table:{widths:["*",BW,48],body:rows.map(r=>{ const v=r.c-r.p; const w=Math.max(1,Math.abs(v)/m*(BW/2-2));
        return [{text:r.name,fontSize:7.5,noWrap:false},{canvas:[{type:"line",x1:BW/2,y1:0,x2:BW/2,y2:9,lineWidth:0.4,lineColor:"#d1d5db"},{type:"rect",x:v>=0?BW/2:BW/2-w,y:1.5,w,h:6,color:v>=0?"#34d399":"#f87171"}],margin:[0,1,0,0]},{text:k(v,true),fontSize:7.5,bold:true,color:colr(v),alignment:"right"}]; })},layout:"noBorders"},
        ...(dr?[{text:`» ${sr?"Dublje":"Deeper"}: ${dr.summary}`,fontSize:7,color:"#4338ca",margin:[0,3,0,0]}]:[])]); };
    out.push(h2(sr?"Gde se promena desila":"Where the change happened"));
    for(let i=0;i<panels.length;i+=2) out.push({columns:[box(panels[i]),panels[i+1]?box(panels[i+1]):{text:""}],columnGap:10,margin:[0,0,0,8]});
  }
  // Koraci kupovine + sezona + merenje
  const row=[];
  if(!forClient&&(V.funnel||[]).length){
    const m=Math.max(0.0001,...V.funnel.flatMap(s=>[s.p,s.c])); const BW=90;
    row.push(panel([cap(sr?"Koraci kupovine":"Purchase steps"),{table:{widths:["*",BW,34],body:V.funnel.map(s=>[{text:s.name,fontSize:7.5},{canvas:[{type:"rect",x:0,y:0,w:Math.max(1,s.p/m*BW),h:4,color:"#d1d5db"},{type:"rect",x:0,y:5.5,w:Math.max(1,s.c/m*BW),h:4,color:IND}],margin:[0,1,0,0]},{text:pc(s.ch),fontSize:7.5,bold:true,color:colr(s.ch),alignment:"right"}])},layout:"noBorders"},
      {text:[{text:sr?"svetlo = prethodni":"light = previous",color:"#9ca3af"},"  ·  ",{text:sr?"plavo = ovaj period":"blue = this period",color:IND}],fontSize:7,color:"#6b7280",margin:[0,3,0,0]}]));
  }
  const Y=V.yoy;
  if(Y&&Y.lastYearChange!=null&&Y.nowChange!=null){
    const m=Math.max(1,Math.abs(Y.lastYearChange),Math.abs(Y.nowChange)); const H=40; const h=v=>Math.max(2,Math.abs(v)/m*H);
    row.push(panel([cap(sr?"Sezona":"Seasonality"),{canvas:[{type:"rect",x:10,y:H-h(Y.lastYearChange),w:40,h:h(Y.lastYearChange),color:"#d1d5db"},{type:"rect",x:70,y:H-h(Y.nowChange),w:40,h:h(Y.nowChange),color:IND}]},
      {columns:[{width:60,text:`${sr?"prošle god.":"last year"}\n${pc(Y.lastYearChange)}`,fontSize:7,alignment:"center",color:"#374151"},{width:60,text:`${sr?"sada":"now"}\n${pc(Y.nowChange)}`,fontSize:7,alignment:"center",color:"#374151"}],margin:[0,2,0,0]},
      {text:Y.seasonal?(sr?"Slična promena kao prošle godine – očekivano.":"Similar change as last year – expected."):(sr?"Prošle godine nije bilo slične promene.":"No similar change last year."),fontSize:7.5,color:"#374151",margin:[0,3,0,0]}]));
  }
  if(row.length){ out.push({columns:row,columnGap:10,margin:[0,8,0,0]}); }
  // Provera merenja u punoj širini (tekst je dug, a adrese stranica se inače ne prelamaju)
  if(!forClient&&V.tracking) out.push({margin:[0,8,0,0],...panel([cap(sr?"Provera merenja":"Tracking check"),{text:V.tracking.length?V.tracking.slice(0,2).map(t=>t.replace(/\//g,"/\u200B")).join("\n\n"):(sr?"Nema znakova problema sa merenjem.":"No signs of tracking problems."),fontSize:7.5,color:V.tracking.length?"#92400e":"#065f46"}])});

  // Kampanje i proizvodi (stručna verzija)
  const th=t=>({text:t,fontSize:7,bold:true,color:"#6b7280"});
  if(!forClient&&(V.campaigns||[]).length){
    out.push(h2(sr?"Google Ads kampanje":"Google Ads campaigns"));
    out.push({table:{headerRows:1,widths:["*",90,90,60],body:[[th(sr?"Kampanja":"Campaign"),th(sr?"Potrošnja":"Spend"),th(sr?"Prihod":"Revenue"),th("ROAS")],
      ...V.campaigns.map(c=>{ const r0=c.sp>0?c.rp/c.sp:0,r1=c.sc>0?c.rc/c.sc:0; return [{text:(c.focus?"» ":"")+c.name,fontSize:7.5,bold:!!c.focus},{text:`${k(c.sp)} → ${k(c.sc)}`,fontSize:7.5},{text:`${k(c.rp)} → ${k(c.rc)}`,fontSize:7.5},{text:`${r0.toLocaleString(loc,{maximumFractionDigits:2})} → ${r1.toLocaleString(loc,{maximumFractionDigits:2})}`,fontSize:7.5,color:Math.abs(r1-r0)/(r0||1)>=0.05?colr(r1-r0):"#374151"}]; })]},
      layout:{hLineWidth:(i)=>i===0?0:0.5,vLineWidth:()=>0,hLineColor:()=>"#e5e7eb",paddingTop:()=>3,paddingBottom:()=>3}});
  }
  if(!forClient&&(V.products||[]).length){
    out.push(h2(sr?"Proizvodi – najveće promene":"Products – biggest changes"));
    out.push({table:{widths:["*",110],body:[...V.products.map(p=>{ const v=p.c-p.p; return [{text:p.name,fontSize:7.5},{text:`${k(v,true)} (${pc(p.p>0?(p.c-p.p)/p.p*100:null)})`,fontSize:7.5,color:colr(v),alignment:"right"}]; }),
      ...(V.gone&&V.gone.count?[[{text:`${V.gone.count} ${sr?"„nestalih“ proizvoda – ranije donosili":"“vanished” products – previously brought"} ${k(V.gone.prevRevenue)}`,fontSize:7.5,color:YEL,colSpan:2},{}]]:[])]},
      layout:{hLineWidth:(i)=>i===0?0:0.5,vLineWidth:()=>0,hLineColor:()=>"#e5e7eb",paddingTop:()=>3,paddingBottom:()=>3}});
  }
  return out;
}

// PDF istrage – isti alat (pdfmake) i stil kao Report Studio
function invPdfDoc({inv,R,stats,ai,evidence,findings,failedChecks,sr,pctTxt,periodTxt,toEur,curSym}){
  const h2=t=>({text:t.toUpperCase(),style:"h2"});
  const confTxt={high:sr?"visoka sigurnost":"high confidence",medium:sr?"srednja sigurnost":"medium confidence",low:sr?"niska sigurnost":"low confidence"};
  const kCell=x=>({stack:[
    {text:x.l.toUpperCase(),fontSize:7.5,bold:true,color:"#6b7280",characterSpacing:0.4},
    {text:x.v,fontSize:14,bold:true,color:"#111827",margin:[0,3,0,1]},
    {text:`${pctTxt(x.p)}${x.sub?`  ·  ${x.sub}`:""}`,fontSize:8,bold:true,color:x.p==null||x.p===0?"#6b7280":((x.p>0)!==!!x.inv?"#059669":"#dc2626")},
  ],fillColor:"#f8fafc",margin:[8,7,8,7]});
  const kRows=[]; for(let i=0;i<stats.length;i+=3){ const r=stats.slice(i,i+3).map(kCell); while(r.length<3) r.push({text:""}); kRows.push(r); }
  const box=(stack,bar,fill)=>({table:{widths:["*"],body:[[{stack,fillColor:fill||"#f5f7ff",margin:[10,8,10,6]}]]},
    layout:{hLineWidth:()=>0,vLineWidth:i=>i===0?3:0,vLineColor:()=>bar||"#6366f1",paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0}});
  const bullets=arr=>(arr||[]).map(x=>({text:["•  ",...rsRich(x)],margin:[2,0,0,3]}));
  const fRow=f=>[{text:f.id,bold:true,color:"#4338ca",fontSize:8.5},{text:f.text,fontSize:8.5}];
  const created=new Date().toLocaleDateString(sr?"sr-RS":"en-GB");
  const done=(R.checksDone||[]).filter(c=>c.id!=="ai").map(c=>c.label+(c.count?` (${c.count.toLocaleString(sr?"sr-RS":"en-GB")})`:"")).join(" · ");
  // Verzija "za klijenta": bez tehničkih dokaza i spiska provera (to je za tim); sve ostalo isto
  const forClient=R.style==="simple"&&!!ai;
  const fl=forClient?[]:(evidence.length?evidence:findings.slice(0,6));
  return {
    pageSize:"A4", pageMargins:[36,36,36,46],
    info:{title:`${inv.client.name} – ${sr?"Istraga":"Investigation"}`},
    defaultStyle:{font:"Roboto",fontSize:9.5,color:"#1f2937",lineHeight:1.25},
    styles:{h2:{fontSize:9.5,bold:true,color:"#4338ca",characterSpacing:0.8,margin:[0,16,0,7]}},
    footer:(cur,total)=>({columns:[
      {text:`${sr?"Izvor: GA4 i Google Ads; brojeve računa server, AI ih samo povezuje. Povezanost nije dokaz uzroka.":"Source: GA4 and Google Ads; numbers computed by the server, AI only connects them. Correlation is not proof of cause."} · ${sr?"Napravljeno":"Created"} ${created}`,fontSize:7,color:"#9ca3af"},
      {text:`${cur} / ${total}`,alignment:"right",fontSize:7.5,color:"#9ca3af",width:40},
    ],margin:[36,14,36,0]}),
    content:[
      {table:{widths:["*"],body:[[{stack:[
        {text:`${sr?"ISTRAGA":"INVESTIGATION"} · ${String(inv.client.name).toUpperCase()}`,fontSize:8,bold:true,color:"#c7d2fe",characterSpacing:1.2},
        {text:inv.question,fontSize:17,bold:true,color:"#ffffff",margin:[0,3,0,4]},
        {text:`${periodTxt}${R.currency&&R.currency!=="EUR"&&R.eurFactor>0?`  ·  ${sr?"iznosi u EUR":"amounts in EUR"}`:""}`,fontSize:9,color:"#e0e7ff"},
      ],fillColor:"#1e1b4b",margin:[14,12,14,12]}]]},layout:"noBorders"},
      ...(stats.length?[h2(sr?"Glavni brojevi":"Key numbers"),{table:{widths:["*","*","*"],body:kRows,dontBreakRows:true},
        layout:{hLineWidth:()=>5,vLineWidth:()=>5,hLineColor:()=>"#ffffff",vLineColor:()=>"#ffffff",paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0}}]:[]),
      ...(!R.unavailable&&R.viz&&toEur?invPdfViz({R,sr,toEur,curSym,forClient:R.style==="simple"&&!!ai}):[]),
      ...(R.unavailable?[h2(sr?"Podaci nisu dostupni":"Data not available"),box([{text:R.unavailable}],"#d97706","#fffbeb")]:[]),
      ...(ai?[
        h2(sr?"Šta se desilo":"What happened"),box([{text:rsRich(ai.what)}]),
        h2(`${sr?"Zašto se verovatno dešava":"Why it is likely happening"}${confTxt[ai.confidence]?` – ${confTxt[ai.confidence]}`:""}`),box([{text:rsRich(ai.why)}]),
      ]:[]),
      ...(fl.length?[h2(ai?(sr?"Dokazi":"Evidence"):(sr?"Nalazi":"Findings")),
        {table:{widths:[24,"*"],body:fl.map(fRow),dontBreakRows:true},
          layout:{hLineWidth:(i,n)=>i===0||i===n.table.body.length?0:0.5,vLineWidth:()=>0,hLineColor:()=>"#e5e7eb",paddingTop:()=>4,paddingBottom:()=>4}}]:[]),
      ...(ai&&(ai.cannot_confirm||[]).length?[h2(sr?"Šta ne možemo da potvrdimo":"What we can't confirm"),box(bullets(ai.cannot_confirm),"#d97706","#fffbeb")]:[]),
      ...(ai&&(ai.next_steps||[]).length?[h2(sr?"Šta proveriti sledeće":"What to check next"),box(bullets(ai.next_steps),"#059669","#f0fdf4")]:[]),
      ...(forClient?[]:[h2(sr?"Kako sam došao do ovoga":"How I got here"),
      {text:done||"–",fontSize:8.5,color:"#4b5563"}]),
      ...(!forClient&&failedChecks.length?[{text:`${sr?"Nisu uspele":"Did not complete"}: ${failedChecks.map(c=>c.label).join(", ")}.`,fontSize:8.5,color:"#b45309",margin:[0,4,0,0]}]:[]),
    ],
  };
}

const MODS=[
  {id:14,icon:"📢",col:"#84CC16",tk:"m14t",sk:"m14s",grp:"an"},
  {id:12,icon:"🛍️",col:"#F43F5E",tk:"m12t",sk:"m12s",grp:"an"},
  {id:13,icon:"💬",col:"#22D3EE",tk:"m13t",sk:"m13s",grp:"an"},
  {id:16,icon:"🔎",col:"#818CF8",tk:"m16t",sk:"m16s",grp:"an"},
  {id:2,icon:"💰",col:"#10B981",tk:"m2t",sk:"m2s",grp:"dw"},
  {id:15,icon:"📑",col:"#F59E0B",tk:"m15t",sk:"m15s",grp:"dw"},
  {id:10,icon:"👥",col:"#A855F7",tk:"m10t",sk:"m10s",grp:"dw"},
  {id:1,icon:"📊",col:"#6366F1",tk:"m1t",sk:"m1s",grp:"dw"},
  // mod=9 (stari bookmarklet/ekstenzija) vodi na uvoz u Report Studio; ne prikazuje se u meniju
  {id:9,icon:"📑",col:"#F59E0B",tk:"m15t",sk:"m15s",grp:"dw",hidden:true},
];
const VISIBLE_MODS=MODS.filter(m=>!m.hidden);
// Male oznake na karticama pocetne strane (sta alat koristi / primer)
const MOD_TAGS={
  14:{sr:["Google Ads","GA4","ROAS"],en:["Google Ads","GA4","ROAS"]},
  12:{sr:["Proizvodi","Korpe","Trendovi"],en:["Products","Carts","Trends"]},
  13:{sr:["„Koji proizvod raste?“"],en:["“Which product is growing?”"]},
  16:{sr:["Prihod","ROAS","Uzroci"],en:["Revenue","ROAS","Causes"]},
  2:{sr:["Meta","Google Ads"],en:["Meta","Google Ads"]},
  15:{sr:["Google Ads","Prodaja po kampanjama","PDF"],en:["Google Ads","Sales by campaign","PDF"]},
  10:{sr:["GA4","Google Ads"],en:["GA4","Google Ads"]},
  1:{sr:["Screenshot","CSV"],en:["Screenshot","CSV"]},
};
// Maksimalna sirina sadrzaja po modulu na racunaru: tabele i izvestaji koriste siroki ekran,
// chat i forme ostaju uze da bi se lako citali
const MOD_WIDTH={14:1320,12:1320,15:1320,2:1320,10:1320,9:1320,13:1040,16:1320,1:920};
const MOD_GROUPS=[{k:"an",tk:"grpAn"},{k:"dw",tk:"grpDw"}];
const gridCols=n=>n<=4?n:3;
const CARD_CSS=`.mc{transition:transform .18s ease,border-color .18s ease}
.mc:hover{transform:translateY(-4px);border-color:var(--c)!important}
.mc .mc-arr{display:inline-block;transition:transform .2s ease}
.mc:hover .mc-arr{transform:translateX(4px)}
.mc .mc-ic{transition:transform .2s ease}
.mc:hover .mc-ic{transform:scale(1.12) rotate(-6deg)}
.st{transition:border-color .18s ease,transform .18s ease}
button.st:hover{transform:translateY(-2px);border-color:rgba(248,113,113,0.6)!important}
@media (hover:none){.mc:hover{transform:none}.mc:hover .mc-ic{transform:none}.mc:hover .mc-arr{transform:none}}
@media (prefers-reduced-motion:reduce){.mc,.mc .mc-ic,.mc .mc-arr,.st{transition:none}.mc:hover,.mc:hover .mc-ic,.mc:hover .mc-arr,button.st:hover{transform:none}}`;

// ── RESPONSIVE HOOK ──────────────────────────────────────────────────────────
function useWindowSize(){
  const [w,setW]=useState(window.innerWidth);
  useEffect(()=>{const h=()=>setW(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  return w;
}

// ── OBAVEŠTENJA: izbor i ukljucivanje push obavestenja ─────────────────────
function NotifModal({lang,notifStatus,onEnable,onClose}){
  const sr=lang==="sr";
  const [prefs,setPrefs]=useState(null);
  const [saving,setSaving]=useState(false);
  const [enabling,setEnabling]=useState(false);
  const [err,setErr]=useState("");
  useEffect(()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setPrefs({budget_digest:true,gads_alerts:true}); return; }
    fetch(`/api/notification-prefs?user_id=${uid}`).then(r=>r.ok?r.json():null).then(d=>setPrefs(d||{budget_digest:true,gads_alerts:true})).catch(()=>setPrefs({budget_digest:true,gads_alerts:true}));
  },[]);
  const toggle=async k=>{
    const next={...prefs,[k]:!prefs[k]};
    setPrefs(next); setSaving(true); setErr("");
    try{
      const uid=await getOrCreateUser();
      const r=await fetch("/api/notification-prefs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:uid,...next})});
      if(!r.ok) throw new Error();
    }catch(e){ setPrefs(prefs); setErr(sr?"Izmena nije sačuvana. Pokušaj ponovo.":"The change was not saved. Please try again."); }
    setSaving(false);
  };
  const enable=async()=>{ setEnabling(true); await onEnable(); setEnabling(false); };
  const isIOS=typeof navigator!=="undefined"&&/iPhone|iPad|iPod/.test(navigator.userAgent||"");
  const items=[
    {k:"budget_digest",t:sr?"Jutarnji pregled budžeta":"Morning budget overview",d:sr?"Svakog radnog dana ujutru: koliko budžeta je u underspend-u, overspend-u, na tempu i koliko nema svež unos potrošnje.":"Every workday morning: how many budgets are underspending, overspending, on pace and how many lack a fresh spend entry."},
    {k:"gads_alerts",t:sr?"Upozorenja za Google Ads kampanje":"Google Ads campaign alerts",d:sr?"Samo kad postoji problem: kampanja je juče stala (a inače troši) ili je potrošila bar 3× više nego inače. Ponedeljkom se proverava i vikend.":"Only when there's a problem: a campaign stopped yesterday (while it normally spends) or spent at least 3× more than usual. On Mondays the weekend is checked too."},
  ];
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" style={{background:"#12121f",border:`1px solid ${C.brd}`,borderRadius:16,padding:"20px",width:"100%",maxWidth:460,color:C.txt}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:17}}>🔔 {sr?"Obaveštenja":"Notifications"}</div>
        <button onClick={onClose} aria-label={sr?"Zatvori":"Close"} style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:8,color:C.txt,padding:"4px 10px",cursor:"pointer"}}>✕</button>
      </div>
      {notifStatus!=="granted"&&<div style={{background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:12,padding:"12px",marginBottom:14,fontSize:13,lineHeight:1.5}}>
        {notifStatus==="denied"
          ?(sr?"Obaveštenja su blokirana u ovom browseru. Dozvoli ih u podešavanjima browsera za ovaj sajt (ikonica katanca pored adrese), pa osveži stranicu.":"Notifications are blocked in this browser. Allow them in the browser's site settings (padlock icon next to the address), then refresh the page.")
          :<>{sr?"Obaveštenja na ovom uređaju još nisu uključena.":"Notifications aren't enabled on this device yet."}
            <div style={{marginTop:10}}><button onClick={enable} disabled={enabling} style={{padding:"9px 14px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#F59E0B,#D97706)",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",opacity:enabling?0.6:1}}>{enabling?"...":(sr?"Uključi na ovom uređaju":"Enable on this device")}</button></div></>}
        {isIOS&&<div style={{color:C.mut,fontSize:12,marginTop:8}}>{sr?"Na iPhone-u obaveštenja rade samo ako je app dodat na početni ekran (Share → Add to Home Screen).":"On iPhone, notifications only work if the app is added to the home screen (Share → Add to Home Screen)."}</div>}
      </div>}
      {notifStatus==="granted"&&<div style={{color:C.grn,fontSize:12,fontWeight:600,marginBottom:12}}>✓ {sr?"Obaveštenja su uključena na ovom uređaju.":"Notifications are enabled on this device."}</div>}
      {!prefs?<div style={{color:C.acl,fontSize:13}}>✦ {sr?"Učitavam...":"Loading..."}</div>:items.map(it=><div key={it.k} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"12px 0",borderTop:`1px solid ${C.brd}`}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14}}>{it.t}</div>
          <div style={{color:C.mut,fontSize:12,lineHeight:1.5,marginTop:3}}>{it.d}</div>
        </div>
        <button role="switch" aria-checked={!!prefs[it.k]} onClick={()=>toggle(it.k)} disabled={saving} aria-label={it.t}
          style={{width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",flexShrink:0,marginTop:2,position:"relative",background:prefs[it.k]?"#10B981":"rgba(255,255,255,0.15)",transition:"background .2s"}}>
          <span style={{position:"absolute",top:3,left:prefs[it.k]?23:3,width:18,height:18,borderRadius:9,background:"#fff",transition:"left .2s"}}/>
        </button>
      </div>)}
      {err&&<div style={{color:C.red,fontSize:12,marginTop:6}}>{err}</div>}
      <div style={{color:C.dim,fontSize:11,marginTop:10,lineHeight:1.5}}>{sr?"Obaveštenja stižu radnim danima ujutru. Izbor važi za sve tvoje uređaje.":"Notifications arrive on workday mornings. The choice applies to all your devices."}</div>
    </div>
  </div>;
}

function MainApp({account}){
  const [lang,setLang]=useState(()=>localStorage.getItem("mat_lang")||"en");
  const [mod,setMod]=useState(()=>{
    const params=new URLSearchParams(window.location.search);
    const m=params.get("mod");
    return m?parseInt(m):null;
  });
  const [showQR,setShowQR]=useState(false);
  const [showNotif,setShowNotif]=useState(false);
  const [notifStatus,setNotifStatus]=useState(()=>
    typeof Notification!=="undefined"?Notification.permission:"default"
  );

  const handleEnableNotif=async()=>{
    const ok=await requestNotificationPermission();
    if(ok){
      setNotifStatus("granted");
    } else {
      setNotifStatus(Notification.permission);
    }
  };

  // Check notification status on mount
  useEffect(()=>{
    if(typeof Notification!=="undefined"){
      setNotifStatus(Notification.permission);
      if(Notification.permission==="granted"){
        subscribeToPush();
      }
    }
  },[]);
  const t=T[lang];
  const w=useWindowSize();
  const isDesktop=w>=1024;

  // Handle UUID from QR scan OR token link OR bookmarklet uid
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const token=params.get("token");
    const uid=params.get("uid");
    if(token){
      localStorage.setItem("mat_user_id",token);
      window.history.replaceState({},"",window.location.pathname);
    } else if(uid){
      // UUID from bookmarklet – restore if localStorage is empty
      if(!localStorage.getItem("mat_user_id")){
        localStorage.setItem("mat_user_id",uid);
      }
      window.history.replaceState({},"",window.location.pathname+"?source=loading&mod=9");
    } else {
      const uuidParam=params.get("uuid");
      if(uuidParam){
        localStorage.setItem("mat_user_id",uuidParam);
        window.history.replaceState({},"",window.location.pathname);
      }
    }
    // Svaki novi posetilac odmah dobija svoj ID (ako ga vec nema)
    getOrCreateUser();
  },[]);

  // Generate QR code when modal opens
  useEffect(()=>{
    if(!showQR) return;
    setTimeout(()=>{
      const el=document.getElementById("qr-container");
      if(!el||el.children.length>0) return;
      const uid=localStorage.getItem("mat_user_id")||"";
      if(!uid) return;
      const url=`${window.location.origin}?uuid=${uid}`;
      try{
        new window.QRCode(el,{
          text:url,width:200,height:200,
          colorDark:"#6366F1",colorLight:"#ffffff",
          correctLevel:window.QRCode?.CorrectLevel?.H
        });
      }catch(e){ el.innerHTML=`<div style="color:#666;font-size:12px;padding:20px">QR nije dostupan.<br/>Link: <a href="${url}" style="color:#6366F1">${url}</a></div>`; }
    },100);
  },[showQR]);

  // QR Modal
  const QRModal=()=>{
    const sr=lang==="sr";
    return <div onClick={()=>setShowQR(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#13131f",border:"1px solid rgba(99,102,241,0.3)",borderRadius:20,padding:28,maxWidth:320,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:24,marginBottom:8}}>📱</div>
        <div style={{color:"#fff",fontWeight:800,fontSize:16,marginBottom:6}}>{sr?"Poveži telefon":"Connect Phone"}</div>
        <div style={{color:"rgba(255,255,255,0.5)",fontSize:13,marginBottom:20,lineHeight:1.5}}>{sr?"Skeniraj QR kod telefonom da vidiš iste klijente i analize":"Scan QR code with your phone to see the same clients and analyses"}</div>
        <div id="qr-container" style={{display:"inline-block",padding:12,background:"#fff",borderRadius:12,marginBottom:16}}/>
        <div style={{color:"rgba(255,255,255,0.4)",fontSize:11,marginBottom:20}}>{sr?"Nakon skeniranja, dodaj app na početni ekran":"After scanning, add app to home screen"}</div>
        <button onClick={()=>setShowQR(false)} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:10,color:"rgba(255,255,255,0.6)",fontSize:13,fontWeight:600,padding:"10px 24px",cursor:"pointer",width:"100%"}}>{sr?"Zatvori":"Close"}</button>
      </div>
    </div>;
  };

  // Sync mod to URL
  const goMod=(id)=>{
    setMod(id);
    pmScrollTop();
    if(id) window.history.pushState({},"",`?mod=${id}`);
    else window.history.pushState({},"",window.location.pathname);
  };

  // Svaki prelaz na drugi modul (i dugme Nazad u pregledaču) počinje od vrha stranice
  useEffect(()=>{ pmScrollTop(); },[mod]);

  // Handle browser back/forward
  useEffect(()=>{
    const handler=()=>{
      const params=new URLSearchParams(window.location.search);
      const m=params.get("mod");
      setMod(m?parseInt(m):null);
    };
    window.addEventListener("popstate",handler);
    return()=>window.removeEventListener("popstate",handler);
  },[]);

  // Save lang preference
  useEffect(()=>{ localStorage.setItem("mat_lang",lang); },[lang]);

  const Comp=mod===1?HealthMod:mod===10?MyClientsMod:mod===12?ProductIntelligenceMod:mod===13?AskDataMod:mod===16?InvestigateMod:mod===14?CampaignsMod:mod===2?BudgetPacingMod:(mod===15||mod===9)?ReportStudioMod:null;
  // Nepostojeci ili obrisani modul (npr. stari link ?mod=3) vodi na pocetni ekran
  const showHome=!mod||!Comp;
  // Pojavljivanje kartica na početnoj: meri se od trenutka otvaranja početne, pa ponovno iscrtavanje (npr. kad stignu podaci)
  // ne pokreće animaciju iz početka nego je samo nastavlja
  if(showHome&&!PM_HOME.on){ PM_HOME.on=true; PM_HOME.t0=Date.now(); } else if(!showHome) PM_HOME.on=false;

  // Pocetna strana: pravi podaci (budzeti tekuceg meseca i broj klijenata)
  const [home,setHome]=useState(null);
  useEffect(()=>{
    if(!showHome) return;
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setHome({clients:0,budgets:0,attention:0,ok:0,bp:null}); return; }
    const d=new Date(); const r=bpMonthRange(d.getFullYear(),d.getMonth());
    let cancelled=false;
    Promise.all([
      fetch(`/api/budgets?user_id=${uid}&from=${r.from}&to=${r.to}`).then(x=>x.ok?x.json():[]).catch(()=>null),
      fetch(`/api/clients?user_id=${uid}`).then(x=>x.ok?x.json():[]).catch(()=>null),
    ]).then(([list,cl])=>{
      if(cancelled) return;
      const budgets=Array.isArray(list)?list:[];
      const c=bpSummary(budgets,bpToday());
      const attention=(c.under||0)+(c.over||0)+(c.no_spend||0);
      const parts=[];
      if(c.under) parts.push(`${c.under} underspend`);
      if(c.over) parts.push(`${c.over} overspend`);
      if(c.no_spend) parts.push(`${c.no_spend} ${lang==="sr"?"bez potrošnje":"no spend"}`);
      if(c.ok) parts.push(`${c.ok} ${lang==="sr"?"na tempu":"on pace"}`);
      setHome({
        clients:Array.isArray(cl)?cl.length:null,
        budgets:Array.isArray(list)?budgets.length:null,
        attention:Array.isArray(list)?attention:null,
        ok:Array.isArray(list)?(c.ok||0):null,
        bp:budgets.length?{text:parts.join(" · ")||`${budgets.length} ${lang==="sr"?"budžeta":"budgets"}`,bad:attention>0}:null,
      });
    });
    return()=>{cancelled=true;};
  },[showHome,lang]);

  const now=new Date();
  const hr=now.getHours();
  const greeting=lang==="sr"?(hr<12?"Dobro jutro":hr<18?"Dobar dan":"Dobro veče"):(hr<12?"Good morning":hr<18?"Good afternoon":"Good evening");
  const dateStr=(s=>s.charAt(0).toUpperCase()+s.slice(1))(now.toLocaleDateString(lang==="sr"?"sr-Latn-RS":"en-GB",{weekday:"long",day:"numeric",month:"long"}));
  const stats=[
    {k:"clients",l:lang==="sr"?"Klijenti":"Clients",v:home?.clients,go:10},
    {k:"budgets",l:lang==="sr"?"Budžeti ovog meseca":"Budgets this month",v:home?.budgets,go:2},
    {k:"attention",l:lang==="sr"?"Traže pažnju":"Need attention",v:home?.attention,go:2,bad:true},
    {k:"ok",l:lang==="sr"?"Na tempu":"On pace",v:home?.ok,go:2,good:true},
  ];
  const StatStrip=({cols})=><div style={{display:"grid",gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap:12}}>
    {stats.map(x=><button key={x.k} className="st" onClick={()=>goMod(x.go)} style={{textAlign:"left",cursor:"pointer",background:"rgba(255,255,255,0.03)",border:`1px solid ${x.bad&&x.v>0?"rgba(248,113,113,0.35)":C.brd}`,borderRadius:14,padding:"14px 16px",color:C.txt}}>
      <div style={{color:"rgba(255,255,255,0.45)",fontSize:12,fontWeight:600}}>{x.l}</div>
      <div style={{fontSize:26,fontWeight:800,marginTop:4,letterSpacing:"-0.5px",color:x.v==null?C.dim:x.bad&&x.v>0?C.red:x.good&&x.v>0?C.grn:"#fff"}}>{home==null?"…":x.v==null?"–":x.v}</div>
    </button>)}
  </div>;

  const ModCard=({m,i,large})=>{
    const tags=(MOD_TAGS[m.id]||{})[lang]||[];
    const invS=m.id===16?INV.state:null;
    const live=m.id===2&&home?.bp?home.bp:invS&&invS.status==="running"?{text:lang==="sr"?`Istraga u toku: ${invS.client.name}…`:`Investigating ${invS.client.name}…`,bad:false}:invS&&invS.status==="done"?{text:lang==="sr"?`Rezultat čeka: ${invS.client.name}`:`Result ready: ${invS.client.name}`,bad:false}:null;
    const extra=m.id===10&&home?.clients!=null?`${home.clients} ${lang==="sr"?(home.clients===1?"klijent":"klijenata"):(home.clients===1?"client":"clients")}`:null;
    // Animacija samo prvih ~1,2 s posle otvaranja početne; zakašnjenje je stalno (ne menja se pri ponovnom iscrtavanju)
    const homeAnim=Date.now()-PM_HOME.t0<1200;
    return <button key={m.id} className={homeAnim?"mc pm-card-in":"mc"} onClick={()=>goMod(m.id)} style={{
      "--c":m.col,...(homeAnim?{animationDelay:`${Math.min(i,8)*45}ms`}:null),
      background:`linear-gradient(145deg,${m.col}24,${m.col}0a 55%,#0d0d1a)`,
      border:`1px solid ${m.col}45`,borderTop:`1px solid ${m.col}70`,
      borderRadius:16,padding:large?"20px 20px 18px":"18px 16px 16px",textAlign:"left",
      cursor:"pointer",display:"flex",flexDirection:"column",width:"100%",height:"100%",boxSizing:"border-box",
      WebkitTapHighlightColor:"transparent",
      boxShadow:`0 4px 24px ${m.col}18`,
    }}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
        <div className="mc-ic" style={{width:large?46:40,height:large?46:40,borderRadius:12,background:`linear-gradient(135deg,${m.col}45,${m.col}20)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:large?23:20,flexShrink:0}}>{m.icon}</div>
        <div style={{color:"#fff",fontWeight:800,fontSize:large?17:15,lineHeight:1.25}}>{t[m.tk]}</div>
      </div>
      <div style={{color:"rgba(255,255,255,0.55)",fontSize:large?13:12,lineHeight:1.5}}>{t[m.sk]}</div>
      {live&&<div style={{color:live.bad?C.red:C.grn,fontSize:12.5,fontWeight:700,lineHeight:1.5,marginTop:8}}>{live.text}</div>}
      {extra&&<div style={{color:"rgba(255,255,255,0.8)",fontSize:12.5,fontWeight:700,marginTop:8}}>{extra}</div>}
      {tags.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>
        {tags.map(tg=><span key={tg} style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.6)",background:"rgba(255,255,255,0.05)",border:`1px solid ${m.col}35`,borderRadius:20,padding:"3px 9px"}}>{tg}</span>)}
      </div>}
      <div style={{marginTop:"auto",paddingTop:14,color:m.col,fontSize:13,fontWeight:700}}>{t.open} <span className="mc-arr">→</span></div>
    </button>;
  };

  const GroupLabel=({g,mb})=><div style={{fontSize:11,fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(255,255,255,0.35)",marginBottom:mb}}>{t[g.tk]}</div>;

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  if(!isDesktop) return <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.txt}}>
    {showQR&&<QRModal/>}
    {showNotif&&<NotifModal lang={lang} notifStatus={notifStatus} onEnable={handleEnableNotif} onClose={()=>setShowNotif(false)}/>}
    <style>{CARD_CSS}</style>
    <div style={{background:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.brd}`,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(10px)"}}>
      <div style={{display:"flex",alignItems:"center",gap:9,cursor:mod?"pointer":"default"}} onClick={()=>goMod(null)}>
        <img src="/logo-64.png" alt="PerfMind" width={32} height={32} style={{width:32,height:32,borderRadius:9,display:"block"}}/>
        <div style={{fontWeight:800,fontSize:15}}><BrandName/></div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        {!showHome&&<button onClick={()=>goMod(null)} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:20,color:"#fff",fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer"}}>{t.back}</button>}
        {account&&account.onTeam&&<button onClick={account.onTeam} style={{background:"rgba(99,102,241,0.2)",border:"none",borderRadius:20,color:C.acl,fontSize:12,fontWeight:600,padding:"7px 12px",cursor:"pointer"}} title={lang==="sr"?"Tim":"Team"} aria-label={lang==="sr"?"Tim":"Team"}>👥</button>}
        <button onClick={()=>setShowNotif(true)} aria-label={lang==="sr"?"Obaveštenja":"Notifications"} style={{background:notifStatus==="granted"?"rgba(52,211,153,0.2)":"rgba(251,191,36,0.2)",border:"none",borderRadius:20,color:notifStatus==="granted"?C.grn:C.yel,fontSize:14,padding:"7px 10px",cursor:"pointer"}} title={lang==="sr"?"Obaveštenja":"Notifications"}>🔔</button>
        {["sr","en"].map(l=><button key={l} onClick={()=>setLang(l)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",background:lang===l?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.07)",color:lang===l?"#A5B4FC":"rgba(255,255,255,0.4)"}}>{l.toUpperCase()}</button>)}
        {account&&<button onClick={account.onLogout} title={(lang==="sr"?"Odjavi se":"Sign out")+(account.email?` (${account.email})`:"")} aria-label={lang==="sr"?"Odjavi se":"Sign out"} style={{background:"rgba(255,255,255,0.07)",border:"none",borderRadius:20,color:"rgba(255,255,255,0.55)",fontSize:13,padding:"6px 10px",cursor:"pointer"}}>⎋</button>}
      </div>
    </div>
    <div style={{maxWidth:580,margin:"0 auto",padding:"0 0 40px"}}>
      {showHome&&<>
        <div style={{padding:"28px 16px 20px",background:"linear-gradient(180deg,rgba(99,102,241,0.08) 0%,transparent 100%)"}}>
          <div style={{color:"rgba(255,255,255,0.45)",fontSize:13,fontWeight:600}}>{dateStr}</div>
          <h1 style={{fontSize:26,fontWeight:900,margin:"4px 0 16px",letterSpacing:"-0.5px",lineHeight:1.2}}>{greeting} 👋</h1>
          <StatStrip cols={2}/>
        </div>
        {MOD_GROUPS.map(g=>{
          const list=VISIBLE_MODS.filter(m=>m.grp===g.k);
          return <div key={g.k} style={{padding:"0 12px",marginBottom:22}}>
            <div style={{paddingLeft:4}}><GroupLabel g={g} mb={10}/></div>
            <div style={{display:"grid",gridTemplateColumns:g.k==="an"?"1fr":"1fr 1fr",gap:12}}>
              {list.map((m,i)=>ModCard({m,i,large:g.k==="an"}))}
            </div>
          </div>;
        })}
        <div style={{padding:"24px 16px 0",textAlign:"center"}}><div style={{color:"rgba(255,255,255,0.2)",fontSize:11}}>PerfMind · v1.0 · by aleksandarpopup</div></div>
      </>}
      {!showHome&&<div style={{padding:"20px 16px"}}><Comp t={t} lang={lang} goMod={goMod} initialTab={mod===9?"import":undefined}/></div>}
    </div>
  </div>;

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  return <div style={{height:"100vh",background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.txt,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {showQR&&<QRModal/>}
    {showNotif&&<NotifModal lang={lang} notifStatus={notifStatus} onEnable={handleEnableNotif} onClose={()=>setShowNotif(false)}/>}
    <style>{CARD_CSS}</style>

    {/* TOP NAV */}
    <div style={{background:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.brd}`,padding:"0 32px",display:"flex",justifyContent:"space-between",alignItems:"center",height:64,flexShrink:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>goMod(null)}>
        <img src="/logo-64.png" alt="PerfMind" width={38} height={38} style={{width:38,height:38,borderRadius:10,display:"block"}}/>
        <div>
          <div style={{fontWeight:800,fontSize:17,letterSpacing:"-0.3px"}}><BrandName/></div>
          <div style={{color:"rgba(255,255,255,0.35)",fontSize:11}}>{t.appSub}</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:20}}>
        {!showHome&&<div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>goMod(null)} style={{background:"rgba(255,255,255,0.08)",border:`1px solid ${C.brd}`,borderRadius:10,color:"rgba(255,255,255,0.7)",fontSize:13,fontWeight:600,padding:"7px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>← {t.back}</button>
          <div style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>
            <span style={{cursor:"pointer",color:"#A5B4FC"}} onClick={()=>goMod(null)}>{lang==="sr"?"Početna":"Home"}</span>
            <span style={{margin:"0 8px",color:"rgba(255,255,255,0.2)"}}>›</span>
            <span style={{color:"#fff",fontWeight:600}}>{t[MODS.find(m=>m.id===mod)?.tk]}</span>
          </div>
        </div>}
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {account&&account.onTeam&&<button onClick={account.onTeam} style={{background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,color:C.acl,fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            👥 {lang==="sr"?"Tim":"Team"}
          </button>}
          <button onClick={()=>setShowNotif(true)} style={{background:notifStatus==="granted"?"rgba(52,211,153,0.12)":"rgba(251,191,36,0.15)",border:`1px solid ${notifStatus==="granted"?"rgba(52,211,153,0.35)":"rgba(251,191,36,0.3)"}`,borderRadius:10,color:notifStatus==="granted"?C.grn:C.yel,fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            🔔 {lang==="sr"?"Obaveštenja":"Notifications"}
          </button>
          {["sr","en"].map(l=><button key={l} onClick={()=>setLang(l)} style={{padding:"7px 16px",borderRadius:20,fontSize:13,fontWeight:700,cursor:"pointer",border:"none",background:lang===l?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.07)",color:lang===l?"#A5B4FC":"rgba(255,255,255,0.4)"}}>{l.toUpperCase()}</button>)}
          {account&&<button onClick={account.onLogout} title={account.email||""} style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:10,color:"rgba(255,255,255,0.6)",fontSize:12,fontWeight:600,padding:"7px 12px",cursor:"pointer"}}>{lang==="sr"?"Odjavi se":"Sign out"}</button>}
        </div>
      </div>
    </div>

    <div style={{display:"flex",flex:1,overflow:"hidden"}}>

      {/* SIDEBAR */}
      <div style={{width:270,background:"rgba(255,255,255,0.015)",borderRight:`1px solid ${C.brd}`,padding:"28px 14px",flexShrink:0,overflowY:"auto",display:"flex",flexDirection:"column",scrollbarWidth:"none",msOverflowStyle:"none"}}>
        <div style={{flex:1}}>
          {MOD_GROUPS.map(g=><div key={g.k} style={{marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(255,255,255,0.25)",margin:"0 0 8px",paddingLeft:10}}>{t[g.tk]}</div>
          {VISIBLE_MODS.filter(m=>m.grp===g.k).map((m,i)=>(
            <button key={m.id} onClick={()=>goMod(m.id)} style={{
              width:"100%",padding:"10px 12px",borderRadius:10,textAlign:"left",cursor:"pointer",
              border:"none",marginBottom:3,display:"flex",alignItems:"center",gap:10,transition:"all 0.15s",
              background:mod===m.id?`${m.col}18`:"transparent",
            }}
            onMouseEnter={e=>{if(mod!==m.id)e.currentTarget.style.background="rgba(255,255,255,0.05)";}}
            onMouseLeave={e=>{if(mod!==m.id)e.currentTarget.style.background="transparent";}}>
              <div style={{width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${m.col}40,${m.col}20)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{m.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:mod===m.id?"#fff":"rgba(255,255,255,0.65)",fontWeight:mod===m.id?700:500,fontSize:13,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t[m.tk]}</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t[m.sk]}</div>
              </div>
              {mod===m.id&&<div style={{width:3,height:20,borderRadius:2,background:m.col,flexShrink:0}}/>}
            </button>
          ))}
          </div>)}
        </div>
        <div style={{paddingTop:20,borderTop:`1px solid ${C.brd}`,textAlign:"center"}}>
          {account&&account.email&&<div style={{color:C.mut,fontSize:11,marginBottom:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={account.email}>{account.email}</div>}
          <div style={{color:"rgba(255,255,255,0.2)",fontSize:11}}>PerfMind · v1.0</div>
          <div style={{color:"rgba(255,255,255,0.15)",fontSize:10,marginTop:3}}>by aleksandarpopup</div>
        </div>
      </div>

      {/* MAIN */}
      <div data-pm-scroll="1" style={{flex:1,overflowY:"auto",minWidth:0}}>
        {showHome&&<div style={{padding:"36px 48px 60px",maxWidth:1320}}>
          <div style={{marginBottom:32}}>
            <div style={{color:"rgba(255,255,255,0.45)",fontSize:14,fontWeight:600}}>{dateStr}</div>
            <h1 style={{fontSize:38,fontWeight:900,margin:"4px 0 20px",letterSpacing:"-1px",lineHeight:1.1}}>{greeting} 👋</h1>
            <StatStrip cols={4}/>
          </div>
          {MOD_GROUPS.map(g=>{
            const list=VISIBLE_MODS.filter(m=>m.grp===g.k);
            return <div key={g.k} style={{marginBottom:34}}>
              <GroupLabel g={g} mb={14}/>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${gridCols(list.length)},minmax(0,1fr))`,gap:18,alignItems:"stretch"}}>
                {list.map((m,i)=>ModCard({m,i,large:g.k==="an"}))}
              </div>
            </div>;
          })}
        </div>}
        {!showHome&&<div style={{padding:"40px 48px 60px",maxWidth:MOD_WIDTH[mod]||1100}}><Comp t={t} lang={lang} goMod={goMod} initialTab={mod===9?"import":undefined}/></div>}
      </div>
    </div>
  </div>;
}

// ── PRIJAVA (Supabase Auth) ──────────────────────────────────────────────────
// Ceo postojeći program je u MainApp i radi kao ranije: i dalje čita ID iz
// localStorage "mat_user_id". Ovaj sloj samo pre toga traži prijavu i u
// "mat_user_id" upisuje ID radnog prostora prijavljenog korisnika.
const SB_URL=import.meta.env.VITE_SUPABASE_URL;
const SB_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=(SB_URL&&SB_KEY)?createClient(SB_URL,SB_KEY):null;
const UUID_RX=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Svaki poziv ka našim /api/ adresama automatski nosi token prijavljenog korisnika
let AUTH_TOKEN=null;
if(typeof window!=="undefined"&&!window.__pmFetchPatched){
  const origFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    try{
      const url=typeof input==="string"?input:(input&&input.url)||"";
      const ours=url.startsWith("/api/")||url.startsWith(window.location.origin+"/api/");
      if(ours&&AUTH_TOKEN){
        const h=new Headers((init&&init.headers)||(typeof input!=="string"&&input.headers)||undefined);
        if(!h.has("Authorization")) h.set("Authorization","Bearer "+AUTH_TOKEN);
        init={...(init||{}),headers:h};
      }
    }catch(e){}
    return origFetch(input,init);
  };
  window.__pmFetchPatched=true;
}

const AUTH_T={
  sr:{
    title:"Prijavite se", sub:"Analitika oglasa i prodaje na jednom mestu",
    google:"Nastavi sa Google-om", or:"ili mejlom", emailPh:"vas@mejl.com", sendLink:"Pošalji link za prijavu",
    sending:"Šaljem...", sent:"Poslali smo link na", sentHint:"Otvorite mejl i kliknite na link. Proverite i Spam.",
    other:"Druga adresa", badEmail:"Upišite ispravnu mejl adresu.",
    loading:"Učitavam...", setupTitle:"Dobro došli u PerfMind",
    setupSub:"Još jedan korak: povežite nalog sa radnim prostorom.",
    claim:"Poveži moje postojeće podatke", claimHint:"Klijenti, budžeti i veze koje već koristite u ovom pregledaču.",
    or2:"ili", createTitle:"Napravi nov radni prostor", wsPh:"Naziv agencije (opciono)", create:"Napravi",
    working:"Radim...", logout:"Odjavi se", signedAs:"Prijavljeni ste kao",
    err:"Nešto nije u redu. Pokušajte ponovo.", retry:"Pokušaj ponovo",
    invited:"Pozvani ste u tim. Prijavite se adresom na koju je stigla pozivnica.",
    alreadyIn:"Vaš nalog je već u radnom prostoru, pa pozivnica nije iskorišćena. Za drugi tim prijavite se drugom mejl adresom."
  },
  en:{
    title:"Sign in", sub:"Ad and sales analytics in one place",
    google:"Continue with Google", or:"or with email", emailPh:"you@email.com", sendLink:"Send sign-in link",
    sending:"Sending...", sent:"We sent a link to", sentHint:"Open the email and click the link. Check Spam too.",
    other:"Use another address", badEmail:"Enter a valid email address.",
    loading:"Loading...", setupTitle:"Welcome to PerfMind",
    setupSub:"One more step: connect your account to a workspace.",
    claim:"Connect my existing data", claimHint:"Clients, budgets and connections you already use in this browser.",
    or2:"or", createTitle:"Create a new workspace", wsPh:"Agency name (optional)", create:"Create",
    working:"Working...", logout:"Sign out", signedAs:"Signed in as",
    err:"Something went wrong. Please try again.", retry:"Try again",
    invited:"You've been invited to a team. Sign in with the address the invitation was sent to.",
    alreadyIn:"Your account is already in a workspace, so the invitation wasn't used. To join another team, sign in with a different email address."
  }
};

const AU={
  page:{minHeight:"100vh",background:"#08080f",color:"#fff",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px"},
  card:{width:"100%",maxWidth:400,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"32px 28px"},
  input:{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,color:"#fff",fontSize:14,padding:"12px 14px",outline:"none"},
  primary:{width:"100%",border:"none",borderRadius:12,padding:"12px 16px",fontSize:14,fontWeight:700,cursor:"pointer",color:"#fff",background:"linear-gradient(135deg,#00B4FF,#7C3AED)"},
  google:{width:"100%",border:"none",borderRadius:12,padding:"12px 16px",fontSize:14,fontWeight:700,cursor:"pointer",color:"#1f1f1f",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:10},
  ghost:{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"11px 16px",fontSize:13,fontWeight:600,cursor:"pointer",color:"rgba(255,255,255,0.8)"},
  muted:{color:"rgba(255,255,255,0.5)",fontSize:13,lineHeight:1.5},
  err:{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.35)",color:"#FCA5A5",borderRadius:10,padding:"10px 12px",fontSize:13,marginTop:14}
};

function AuthHeader({lang,setLang}){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:26}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <img src="/logo-64.png" alt="PerfMind" width={36} height={36} style={{width:36,height:36,borderRadius:10,display:"block"}}/>
      <div style={{fontWeight:800,fontSize:19}}><BrandName/></div>
    </div>
    <div style={{display:"flex",gap:4}}>
      {["sr","en"].map(l=><button key={l} onClick={()=>setLang(l)} style={{padding:"5px 10px",borderRadius:16,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",background:lang===l?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.07)",color:lang===l?"#A5B4FC":"rgba(255,255,255,0.4)"}}>{l.toUpperCase()}</button>)}
    </div>
  </div>;
}

function GoogleIcon(){
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;
}

function LoginScreen({lang,setLang,initialError}){
  const a=AUTH_T[lang];
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [sentTo,setSentTo]=useState(null);
  const [err,setErr]=useState(initialError||null);
  const google=async()=>{
    setErr(null);
    const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});
    if(error) setErr(error.message);
  };
  const sendLink=async(e)=>{
    e.preventDefault(); setErr(null);
    const v=email.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){ setErr(a.badEmail); return; }
    setBusy(true);
    const {error}=await supabase.auth.signInWithOtp({email:v,options:{emailRedirectTo:window.location.origin}});
    setBusy(false);
    if(error) setErr(error.message); else setSentTo(v);
  };
  return <div style={AU.page}><div style={AU.card}>
    <AuthHeader lang={lang} setLang={setLang}/>
    {sentTo?<>
      <div style={{fontSize:30,marginBottom:10}}>✉️</div>
      <div style={{fontWeight:800,fontSize:20,marginBottom:8}}>{a.sent}</div>
      <div style={{fontWeight:700,color:"#7DD3FC",marginBottom:10,wordBreak:"break-all"}}>{sentTo}</div>
      <div style={{...AU.muted,marginBottom:22}}>{a.sentHint}</div>
      <button style={AU.ghost} onClick={()=>{setSentTo(null);setEmail("");}}>{a.other}</button>
    </>:<>
      <div style={{fontWeight:800,fontSize:22,marginBottom:4}}>{a.title}</div>
      <div style={{...AU.muted,marginBottom:22}}>{a.sub}</div>
      {(()=>{ try{ return localStorage.getItem("pm_invite"); }catch(e){ return null; } })()&&<div style={{background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.35)",color:"#C7D2FE",borderRadius:10,padding:"10px 12px",fontSize:13,marginBottom:16}}>{a.invited}</div>}
      <button style={AU.google} onClick={google}><GoogleIcon/>{a.google}</button>
      <div style={{display:"flex",alignItems:"center",gap:10,margin:"18px 0",color:"rgba(255,255,255,0.35)",fontSize:12}}>
        <div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/>{a.or}<div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/>
      </div>
      <form onSubmit={sendLink}>
        <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={a.emailPh} style={{...AU.input,marginBottom:10}}/>
        <button type="submit" disabled={busy} style={{...AU.primary,opacity:busy?0.6:1}}>{busy?a.sending:a.sendLink}</button>
      </form>
    </>}
    {err&&<div style={AU.err}>{err}</div>}
  </div></div>;
}

function SetupScreen({lang,setLang,email,onDone,onLogout,initialError}){
  const a=AUTH_T[lang];
  const legacy=(()=>{ const v=localStorage.getItem("mat_user_id")||""; return UUID_RX.test(v)?v:null; })();
  const [name,setName]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState(initialError||null);
  const run=async(body)=>{
    setBusy(true); setErr(null);
    try{
      const r=await fetch("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      if(!r.ok||!d.workspace) throw new Error(d.error||a.err);
      onDone(d.workspace);
    }catch(e){ setErr(e.message||a.err); setBusy(false); }
  };
  return <div style={AU.page}><div style={AU.card}>
    <AuthHeader lang={lang} setLang={setLang}/>
    <div style={{fontWeight:800,fontSize:21,marginBottom:4}}>{a.setupTitle}</div>
    <div style={{...AU.muted,marginBottom:22}}>{a.setupSub}</div>
    {legacy&&<>
      <button disabled={busy} style={{...AU.primary,opacity:busy?0.6:1}} onClick={()=>run({action:"claim",legacy_id:legacy})}>{busy?a.working:a.claim}</button>
      <div style={{...AU.muted,fontSize:12,marginTop:8}}>{a.claimHint}</div>
      <div style={{display:"flex",alignItems:"center",gap:10,margin:"20px 0",color:"rgba(255,255,255,0.35)",fontSize:12}}>
        <div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/>{a.or2}<div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/>
      </div>
    </>}
    <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>{a.createTitle}</div>
    <input value={name} onChange={e=>setName(e.target.value)} placeholder={a.wsPh} maxLength={80} style={{...AU.input,marginBottom:10}}/>
    <button disabled={busy} style={{...(legacy?AU.ghost:AU.primary),opacity:busy?0.6:1}} onClick={()=>run({action:"create",name})}>{busy?a.working:a.create}</button>
    {err&&<div style={AU.err}>{err}</div>}
    <div style={{...AU.muted,fontSize:12,marginTop:22,display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
      <span>{a.signedAs} <b style={{color:"rgba(255,255,255,0.75)"}}>{email}</b></span>
      <span style={{cursor:"pointer",textDecoration:"underline"}} onClick={onLogout}>{a.logout}</span>
    </div>
  </div></div>;
}

// ── TIM: članovi i pozivnice ─────────────────────────────────────────────────
function TeamModal({lang,onClose}){
  const sr=lang==="sr";
  const [data,setData]=useState(null);
  const [err,setErr]=useState(null);
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false);
  const [lastLink,setLastLink]=useState(null);
  const [copied,setCopied]=useState(false);
  const [wsName,setWsName]=useState("");
  const [nameSaved,setNameSaved]=useState(false);
  const load=async()=>{
    try{
      const r=await fetch("/api/team"); const d=await r.json();
      if(!r.ok) throw new Error(d.error);
      setData(d); setWsName(d.workspace&&d.workspace.name||"");
    }catch(e){ setErr(e.message||(sr?"Greška":"Error")); }
  };
  useEffect(()=>{ load(); },[]);
  const isOwner=data&&data.me&&data.me.role==="owner";
  const invite=async(e)=>{
    e.preventDefault(); setErr(null); setLastLink(null); setCopied(false);
    const v=email.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){ setErr(sr?"Upišite ispravnu mejl adresu.":"Enter a valid email address."); return; }
    setBusy(true);
    try{
      const r=await fetch("/api/team",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"invite",email:v})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error);
      setLastLink({link:d.link,email:d.invite.email,sent:d.emailSent}); setEmail(""); load();
    }catch(e){ setErr(e.message); }
    setBusy(false);
  };
  const del=async(q,confirmText)=>{
    if(!window.confirm(confirmText)) return;
    setErr(null);
    try{
      const r=await fetch(`/api/team?${q}`,{method:"DELETE"}); const d=await r.json();
      if(!r.ok) throw new Error(d.error); load();
    }catch(e){ setErr(e.message); }
  };
  const saveName=async()=>{
    setErr(null);
    try{
      const r=await fetch("/api/team",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"rename",name:wsName})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error); setNameSaved(true); load();
    }catch(e){ setErr(e.message); }
  };
  const copy=async(t)=>{ try{ await navigator.clipboard.writeText(t); setCopied(true); }catch(e){ window.prompt(sr?"Kopirajte link:":"Copy the link:",t); } };
  const fmtD=(s)=>{ try{ return new Date(s).toLocaleDateString(sr?"sr-RS":"en-GB"); }catch(e){ return ""; } };
  const row={display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"};
  const small={fontSize:12,color:"rgba(255,255,255,0.45)"};
  const xBtn={background:"none",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,color:"rgba(255,255,255,0.6)",fontSize:12,padding:"5px 10px",cursor:"pointer",flexShrink:0};
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
    <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:520,maxHeight:"88vh",overflowY:"auto",background:"#101018",border:"1px solid rgba(255,255,255,0.1)",borderRadius:18,padding:"24px 22px",color:"#fff"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{fontWeight:800,fontSize:19}}>👥 {sr?"Tim":"Team"}</div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.07)",border:"none",borderRadius:20,color:"#fff",width:32,height:32,cursor:"pointer",fontSize:16}} aria-label={sr?"Zatvori":"Close"}>✕</button>
      </div>
      {!data&&!err&&<div style={small}>{sr?"Učitavam...":"Loading..."}</div>}
      {data&&<>
        {isOwner&&<div style={{marginBottom:20}}>
          <div style={{...small,marginBottom:6}}>{sr?"Naziv radnog prostora":"Workspace name"}</div>
          <div style={{display:"flex",gap:8}}>
            <input value={wsName} onChange={e=>{setWsName(e.target.value);setNameSaved(false);}} onKeyDown={e=>{ if(e.key==="Enter") saveName(); }} maxLength={80} placeholder={sr?"npr. naziv agencije":"e.g. agency name"} style={{...AU.input,flex:1}}/>
            <button onClick={saveName} style={{...AU.ghost,width:"auto",color:nameSaved?"#6EE7B7":AU.ghost.color}}>{nameSaved?(sr?"Sačuvano ✓":"Saved ✓"):(sr?"Sačuvaj":"Save")}</button>
          </div>
        </div>}
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{sr?"Članovi":"Members"} ({data.members.length})</div>
        {data.members.map(m=><div key={m.id} style={row}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis"}}>{m.email||"—"}{m.isMe&&<span style={{...small,marginLeft:6}}>({sr?"vi":"you"})</span>}</div>
            <div style={small}>{m.role==="owner"?(sr?"Vlasnik":"Owner"):(sr?"Član":"Member")}</div>
          </div>
          {isOwner&&!m.isMe&&<button style={xBtn} onClick={()=>del(`member_id=${m.id}`,sr?`Ukloniti ${m.email} iz tima?`:`Remove ${m.email} from the team?`)}>{sr?"Ukloni":"Remove"}</button>}
        </div>)}
        {isOwner&&<>
          <div style={{fontWeight:700,fontSize:14,margin:"22px 0 8px"}}>{sr?"Pozovi kolegu":"Invite a colleague"}</div>
          <form onSubmit={invite} style={{display:"flex",gap:8}}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={sr?"kolega@agencija.com":"colleague@agency.com"} style={{...AU.input,flex:1}}/>
            <button type="submit" disabled={busy} style={{...AU.primary,width:"auto",opacity:busy?0.6:1}}>{busy?(sr?"Šaljem...":"Sending..."):(sr?"Pozovi":"Invite")}</button>
          </form>
          {lastLink&&<div style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:10,padding:"10px 12px",fontSize:13,marginTop:10,color:"#A7F3D0"}}>
            {lastLink.sent?(sr?`Pozivnica je poslata na ${lastLink.email}.`:`Invitation sent to ${lastLink.email}.`):(sr?`Mejl nije poslat – pošaljite link ručno osobi ${lastLink.email}:`:`Email wasn't sent – send this link to ${lastLink.email} yourself:`)}
            <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
              <code style={{flex:1,fontSize:11,color:"rgba(255,255,255,0.7)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lastLink.link}</code>
              <button style={xBtn} onClick={()=>copy(lastLink.link)}>{copied?(sr?"Kopirano ✓":"Copied ✓"):(sr?"Kopiraj link":"Copy link")}</button>
            </div>
          </div>}
          {data.invites.length>0&&<>
            <div style={{fontWeight:700,fontSize:14,margin:"22px 0 4px"}}>{sr?"Poslate pozivnice":"Pending invitations"}</div>
            {data.invites.map(iv=><div key={iv.id} style={row}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:14,overflow:"hidden",textOverflow:"ellipsis"}}>{iv.email}</div>
                <div style={small}>{sr?"važi do":"valid until"} {fmtD(iv.expires_at)}</div>
              </div>
              <button style={xBtn} onClick={()=>del(`invite_id=${iv.id}`,sr?`Otkazati pozivnicu za ${iv.email}?`:`Cancel the invitation for ${iv.email}?`)}>{sr?"Otkaži":"Cancel"}</button>
            </div>)}
          </>}
        </>}
        {!isOwner&&<div style={{...small,marginTop:16}}>{sr?"Kolege poziva vlasnik radnog prostora.":"Colleagues are invited by the workspace owner."}</div>}
      </>}
      {err&&<div style={AU.err}>{err}</div>}
    </div>
  </div>;
}

export default function App(){
  const [lang,setLangState]=useState(()=>localStorage.getItem("mat_lang")||"en");
  const setLang=(l)=>{ setLangState(l); try{ localStorage.setItem("mat_lang",l); }catch(e){} };
  const [stage,setStage]=useState(supabase?"loading":"ready"); // loading | login | setup | ready | error
  const [email,setEmail]=useState(null);
  const [authErr,setAuthErr]=useState(null);
  const [setupErr,setSetupErr]=useState(null);
  const [showTeam,setShowTeam]=useState(false);
  const readyRef=useRef(false); // kad je aplikacija jednom otvorena, osvežavanje tokena je ne zatvara

  // Stari linkovi (?uuid= / ?token=) – zapamti ID radi povezivanja postojećih podataka i skloni ga iz adrese
  useEffect(()=>{
    if(!supabase) return;
    const params=new URLSearchParams(window.location.search);
    const legacy=params.get("uuid")||params.get("token");
    if(legacy&&UUID_RX.test(legacy)) localStorage.setItem("mat_user_id",legacy);
    const inv=params.get("invite");
    if(inv&&UUID_RX.test(inv)){ try{ localStorage.setItem("pm_invite",inv); }catch(e){} }
    if(params.has("uuid")||params.has("token")||params.has("invite")){
      params.delete("uuid"); params.delete("token"); params.delete("invite");
      const q=params.toString();
      window.history.replaceState({},"",window.location.pathname+(q?"?"+q:"")+window.location.hash);
    }
    // Greška vraćena sa prijave (npr. istekao link)
    const hp=new URLSearchParams(window.location.hash.replace(/^#/,""));
    if(hp.get("error_description")) setAuthErr(hp.get("error_description").replace(/\+/g," "));
  },[]);

  const loadMe=async()=>{
    try{
      const r=await fetch("/api/me");
      if(r.status===401){ setStage("login"); return; }
      const d=await r.json();
      if(!r.ok) throw new Error(d.error);
      setEmail(d.email||null);
      let invite=null; try{ invite=localStorage.getItem("pm_invite"); }catch(e){}
      if(d.workspace){
        if(invite){ try{ localStorage.removeItem("pm_invite"); }catch(e){} window.alert(AUTH_T[lang].alreadyIn); }
        localStorage.setItem("mat_user_id",d.workspace.id); readyRef.current=true; setStage("ready"); return;
      }
      if(invite){
        // Pozivnica u tim: prihvata se automatski posle prijave
        const ar=await fetch("/api/me",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"accept",token:invite})});
        const ad=await ar.json().catch(()=>({}));
        try{ localStorage.removeItem("pm_invite"); }catch(e){}
        if(ar.ok&&ad.workspace){ localStorage.setItem("mat_user_id",ad.workspace.id); readyRef.current=true; setStage("ready"); return; }
        setSetupErr(ad.error||AUTH_T[lang].err);
      }
      setStage("setup");
    }catch(e){ if(!readyRef.current) setStage("error"); }
  };

  useEffect(()=>{
    if(!supabase) return;
    let alive=true;
    supabase.auth.getSession().then(({data})=>{
      if(!alive) return;
      const s=data&&data.session;
      AUTH_TOKEN=s?s.access_token:null;
      if(s) loadMe(); else setStage("login");
    });
    const {data:sub}=supabase.auth.onAuthStateChange((event,session)=>{
      AUTH_TOKEN=session?session.access_token:null;
      if(event==="SIGNED_IN"&&!readyRef.current) loadMe();
      if(event==="SIGNED_OUT"){ readyRef.current=false; setStage("login"); }
    });
    return()=>{ alive=false; sub&&sub.subscription&&sub.subscription.unsubscribe(); };
  },[]);

  const logout=async()=>{
    try{ await supabase.auth.signOut(); }catch(e){}
    AUTH_TOKEN=null;
    localStorage.removeItem("mat_user_id");
    window.location.replace(window.location.origin);
  };

  if(stage==="ready") return <>
    <MainApp account={supabase?{email,onLogout:logout,onTeam:()=>setShowTeam(true)}:null}/>
    {showTeam&&<TeamModal lang={lang} onClose={()=>setShowTeam(false)}/>}
  </>;
  if(stage==="login") return <LoginScreen lang={lang} setLang={setLang} initialError={authErr}/>;
  if(stage==="setup") return <SetupScreen lang={lang} setLang={setLang} email={email} onLogout={logout} initialError={setupErr} onDone={(ws)=>{ localStorage.setItem("mat_user_id",ws.id); readyRef.current=true; setStage("ready"); }}/>;
  if(stage==="error") return <div style={AU.page}><div style={{...AU.card,textAlign:"center"}}>
    <div style={{...AU.muted,marginBottom:16}}>{AUTH_T[lang].err}</div>
    <button style={AU.primary} onClick={()=>{ setStage("loading"); loadMe(); }}>{AUTH_T[lang].retry}</button>
    <div style={{...AU.muted,fontSize:12,marginTop:14,textDecoration:"underline",cursor:"pointer"}} onClick={logout}>{AUTH_T[lang].logout}</div>
  </div></div>;
  return <div style={AU.page}><div style={AU.muted}>{AUTH_T[lang].loading}</div></div>;
}
