import { useState, useEffect, useRef } from "react";

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
    appTitle:"Meta Ads Toolkit", appSub:"Profesionalni alati za performance marketing",
    sel:"Odaberi alat", selSub:"Svaki alat možeš koristiti nezavisno", back:"← Nazad",
    m1t:"Health Check", m1s:"Brza dijagnoza kampanje iz screenshota ili CSV-a",
    m8t:"Report Generator", m8s:"Profesionalni izveštaj sa PDF exportom",
    m9t:"Uvoz podataka", m9s:"Analiza uvezenih podataka",
    m2t:"Budget Pacing", m2s:"Tempo potrošnje po klijentu, underspend i overspend na prvi pogled",
    m10t:"Clients", m10s:"Svi klijenti i povezani GA4 i Google Ads nalozi",
    m11t:"Time Machine", m11s:"Izveštaj i grafikon za period",
    m12t:"Product Intelligence", m12s:"Svaki proizvod, od pregleda do prodaje",
    m13t:"Ask Your Data", m13s:"Pitaj bilo šta o podacima klijenta, odgovor za par sekundi",
    m14t:"Campaign Intelligence", m14s:"Šta svaka kampanja stvarno donosi",
    grpAn:"Analitika", grpDw:"Svakodnevni rad", open:"Otvori",
    m15t:"Report Studio", m15s:"Izveštaj za klijenta u par klikova, sa PDF-om",
    analyze:"Analiziraj →", 
    newA:"← Nova analiza", poor:"Kritično", ok:"Prosečno", good:"Odlično",
    nxt:"Dalje →", prv:"←", res:"Rezultati", s1:"Osnove", s2:"Metrike", s3:"Targeting & Kreativa",
    bm_step3:"Uvezeni podaci za analizu",
    bm_noData:"Još uvek nema uvezenih podataka.",
    bm_noDataSub:"Za analizu screenshota ili CSV-a koristi Report Generator.",
    bm_dataTitle:"Uvezeni podaci",
    bm_source:"Izvor",
    bm_date:"Datum uvoza",
    bm_dateRange:"Period",
    bm_tables:"Tabele",
    bm_rows:"redova",
    bm_analyze:"Analiziraj uvezene podatke →",
    bm_clear:"Obriši podatke",
    bm_analyzing:"Analizira uvezene podatke...",
    rg_title:"Report Generator",
    rg_sub:"Profesionalni izveštaj za klijenta sa PDF exportom",
    rg_single:"Single Period Report",
    rg_single_s:"Jedan screenshot – kompletan izveštaj",
    rg_compare:"Period Comparison",
    rg_compare_s:"Dva screenshota – poređenje perioda",
    rg_client:"Naziv klijenta / naloga",
    rg_clientPh:"npr. Fashion Brand d.o.o.",
    rg_period:"Period",
    rg_periodPh:"npr. Jun 2025",
    rg_periodA:"Period A (stariji)",
    rg_periodAPh:"npr. Jun 2024",
    rg_periodB:"Period B (noviji)",
    rg_periodBPh:"npr. Jun 2025",
    rg_upload:"Upload screenshot",
    rg_uploadA:"Upload screenshot – Period A",
    rg_uploadB:"Upload screenshot – Period B",
    rg_drag:"Prevuci screenshot ovde",
    rg_dragSub:"ili klikni da odabereš fajl",
    rg_generate:"Generiši izveštaj →",
    rg_generating:"Generišem izveštaj...",
    rg_pdf:"📥 Izvezi kao PDF",
    rg_newReport:"← Novi izveštaj",
    rg_execSum:"Executive Summary",
    rg_metricsFound:"Identifikovane metrike",
    rg_issues:"Ključni problemi",
    rg_good:"Šta radi dobro",
    rg_actions:"Prioritetne akcije",
    rg_strategic:"Strateške preporuke",
    rg_comparison:"Poređenje perioda",
    rg_metric:"Metrika",
    rg_change:"Promena",
    rg_aiComment:"Komentar",
    rg_generatedBy:"Generisano putem Meta Ads Toolkit",
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
    bIS:"Idealna potrošnja do danas", 
  },
  en:{
    appTitle:"Meta Ads Toolkit", appSub:"Professional tools for performance marketing",
    sel:"Select a tool", selSub:"Each tool can be used independently", back:"← Back",
    m1t:"Health Check", m1s:"Quick campaign diagnosis from a screenshot or CSV",
    m8t:"Report Generator", m8s:"Professional report with PDF export",
    m9t:"Data import", m9s:"Analysis of imported data",
    m2t:"Budget Pacing", m2s:"Spend pace per client, underspend and overspend at a glance",
    m10t:"Clients", m10s:"All clients and connected GA4 and Google Ads accounts",
    m11t:"Time Machine", m11s:"Report and chart for any period",
    m12t:"Product Intelligence", m12s:"Every product, from view to sale",
    m13t:"Ask Your Data", m13s:"Ask anything about your client's data, answers in seconds",
    m14t:"Campaign Intelligence", m14s:"What every campaign really delivers",
    grpAn:"Analytics", grpDw:"Daily work", open:"Open",
    m15t:"Report Studio", m15s:"Client reports in a few clicks, with PDF",
    analyze:"Analyze →", 
    newA:"← New Analysis", poor:"Critical", ok:"Average", good:"Excellent",
    nxt:"Next →", prv:"←", res:"Results", s1:"Basics", s2:"Metrics", s3:"Targeting & Creative",
    bm_step3:"Imported data to analyze",
    bm_noData:"No imported data yet.",
    bm_noDataSub:"To analyze a screenshot or CSV, use Report Generator.",
    bm_dataTitle:"Imported Data",
    bm_source:"Source",
    bm_date:"Import date",
    bm_dateRange:"Period",
    bm_tables:"Tables",
    bm_rows:"rows",
    bm_analyze:"Analyze imported data →",
    bm_clear:"Clear data",
    bm_analyzing:"Analyzing imported data...",
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
    bIS:"Ideal spend to date", 
    rg_title:"AI Report Generator",
    rg_sub:"Professional client report with PDF export",
    rg_single:"Single Period Report",
    rg_single_s:"One screenshot – complete report",
    rg_compare:"Period Comparison",
    rg_compare_s:"Two screenshots – period comparison",
    rg_client:"Client / Account Name",
    rg_clientPh:"e.g. Fashion Brand LLC",
    rg_period:"Period",
    rg_periodPh:"e.g. June 2025",
    rg_periodA:"Period A (older)",
    rg_periodAPh:"e.g. June 2024",
    rg_periodB:"Period B (newer)",
    rg_periodBPh:"e.g. June 2025",
    rg_upload:"Upload screenshot",
    rg_uploadA:"Upload screenshot – Period A",
    rg_uploadB:"Upload screenshot – Period B",
    rg_drag:"Drag screenshot here",
    rg_dragSub:"or click to select file",
    rg_generate:"Generate Report →",
    rg_generating:"Generating report...",
    rg_pdf:"📥 Export as PDF",
    rg_newReport:"← New Report",
    rg_execSum:"Executive Summary",
    rg_metricsFound:"Identified Metrics",
    rg_issues:"Key Issues",
    rg_good:"What's Working",
    rg_actions:"Priority Actions",
    rg_strategic:"Strategic Recommendations",
    rg_comparison:"Period Comparison",
    rg_metric:"Metric",
    rg_change:"Change",
    rg_aiComment:"Comment",
    rg_generatedBy:"Generated by Meta Ads Toolkit",
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
        {[1,2,3,4].map(i=><div key={i} style={{height:12,background:"rgba(255,255,255,0.06)",borderRadius:6,width:i===4?"60%":"100%"}}/>)}
      </div>}
      {aiAnalysis&&!aiLoading&&<MD2 text={aiAnalysis}/>}
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

    {loading&&<div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",color:C.acl,fontSize:13,textAlign:"center"}}>✦ {sr?"Učitavam budžete...":"Loading budgets..."}</div>}
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
      return <div key={b.id} style={{background:C.sur,border:`1px solid ${C.brd}`,borderLeft:`3px solid ${sm.c}`,borderRadius:12,padding:"12px 14px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14}}>{b.clients?.name||"—"}{tab==="all"&&platList.length<=1&&<span style={{color:C.mut,fontWeight:500,fontSize:12}}> · {plat?(plat.k==="other"?(sr?"Ostalo":"Other"):plat.l):b.platform}</span>}</div>
            <div style={{color:C.mut,fontSize:12,marginTop:2}}>{bpParse(b.start_date).toLocaleDateString(sr?"sr-RS":"en-GB")} – {bpParse(b.end_date).toLocaleDateString(sr?"sr-RS":"en-GB")} · {sr?"budžet":"budget"} {fmtMoney(b.total_budget,cur)}{b.note?` · ${b.note}`:""}</div>
          </div>
          <div style={{color:sm.c,fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{sm.l}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(5,1fr)",gap:8,marginTop:10}}>
          {[
            [sr?"Potrošeno":"Spent",calc.spent==null?"–":fmtMoney(calc.spent,cur)],
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
          <option value="" style={{color:"#111"}}>{sr?"— izaberi klijenta —":"— choose a client —"}</option>
          {clients.map(c=><option key={c.id} value={String(c.id)} style={{color:"#111"}}>{c.name}</option>)}
        </select>}
      {!edit&&<div style={{display:"flex",gap:8,marginBottom:12}}>
        <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder={sr?"ili upiši ime novog klijenta":"or type a new client name"} style={{...bpInp,flex:1,width:"auto"}}/>
        <button onClick={addClient} disabled={creatingClient||!newName.trim()} style={{...bpBtn(false),opacity:creatingClient||!newName.trim()?0.5:1}}>{creatingClient?"...":(sr?"+ Novi klijent":"+ New client")}</button>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10,marginBottom:12}}>
        <div><L c={sr?"Platforma":"Platform"}/>
          <select value={platform} onChange={e=>setPlatform(e.target.value)} style={bpInp}>
            {BP_PLATFORMS.map(p=><option key={p.k} value={p.k} style={{color:"#111"}}>{p.k==="other"?(sr?"Ostalo":"Other"):p.l}</option>)}
          </select></div>
        <div><L c={sr?"Valuta":"Currency"}/>
          <select value={currency} onChange={e=>setCurrency(e.target.value)} style={bpInp}>
            {(BP_CURRENCIES.includes(currency)?BP_CURRENCIES:[currency,...BP_CURRENCIES]).map(c=><option key={c} value={c} style={{color:"#111"}}>{c}</option>)}
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

// ── MODULE 15: REPORT STUDIO ─────────────────────────────────────────────────
function ReportStudioMod({t,lang}){
  const sr=lang==="sr";
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

  // PDF: pravo preuzimanje jednim klikom. Izvestaj se slaze kao svetla stranica (van ekrana)
  // i pretvara u PDF fajl pomocu biblioteke html2pdf (ucitava se tek kad zatreba).
  const [pdfBusy,setPdfBusy]=useState(false);
  const loadHtml2Pdf=()=>new Promise((resolve,reject)=>{
    if(window.html2pdf) return resolve(window.html2pdf);
    const ex=document.getElementById("html2pdf-lib");
    if(ex){ ex.addEventListener("load",()=>resolve(window.html2pdf)); ex.addEventListener("error",reject); return; }
    const sc=document.createElement("script");
    sc.id="html2pdf-lib";
    sc.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    sc.onload=()=>window.html2pdf?resolve(window.html2pdf):reject(new Error("html2pdf missing"));
    sc.onerror=reject;
    document.head.appendChild(sc);
  });
  const exportPdf=async()=>{
    if(!rep||!cur||pdfBusy) return;
    setPdfBusy(true);
    const chartEl=document.getElementById("rs-chart-print");
    const chart=chartEl?chartEl.innerHTML:"";
    const mdToHtml=txt=>rsEsc(txt).split("\n").map(l=>l.startsWith("## ")?`<h3>${l.slice(3)}</h3>`:l.startsWith("# ")?`<h3>${l.slice(2)}</h3>`:/^[-*] /.test(l)?`<li>${l.slice(2)}</li>`:/^\d+\. /.test(l)?`<li>${l.replace(/^\d+\. /,"")}</li>`:l.trim()?`<p>${l}</p>`:"").join("").replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
    const rows=camps.map(c=>`<tr><td>${rsEsc(c.campaign_name)}</td><td>${rsNum(c.spendEUR)} €</td><td>${rsNum(c.revenueEUR)} €</td><td>${rsNum(c.roas,2)}</td><td>${rsNum(c.conversions)}</td></tr>`).join("");
    const k=kpis.map(x=>`<div class="k"><div class="l">${rsEsc(x.l)}</div><div class="v">${rsEsc(x.v)}</div>${x.d!=null?`<div class="d">${dText(x.d)} ${sr?"vs prethodni":"vs previous"}</div>`:""}</div>`).join("");
    const css=`.rs-pdf{font-family:Arial,sans-serif;color:#1a1a2e;background:#fff;padding:8px 4px;width:720px}
      .rs-pdf h1{font-size:22px;margin:0 0 4px;color:#1a1a2e}.rs-pdf h2{font-size:15px;margin:20px 0 10px;color:#4338ca}.rs-pdf h3{font-size:14px;margin:12px 0 6px;color:#1a1a2e}
      .rs-pdf .sub{color:#6b7280;font-size:12px}.rs-pdf .g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
      .rs-pdf .k{border:1px solid #e5e7eb;border-radius:8px;padding:9px}.rs-pdf .l{font-size:10px;color:#6b7280;text-transform:uppercase}
      .rs-pdf .v{font-size:16px;font-weight:700;margin-top:4px;color:#1a1a2e}.rs-pdf .d{font-size:10px;color:#6b7280;margin-top:2px}
      .rs-pdf table{width:100%;border-collapse:collapse;font-size:11px}.rs-pdf th,.rs-pdf td{text-align:left;padding:5px 7px;border-bottom:1px solid #e5e7eb;color:#1a1a2e}
      .rs-pdf th{color:#6b7280;font-weight:600}.rs-pdf p,.rs-pdf li{font-size:12px;line-height:1.5;color:#1a1a2e}
      .rs-pdf .chart{border:1px solid #e5e7eb;border-radius:8px;padding:8px}.rs-pdf .foot{margin-top:24px;color:#9ca3af;font-size:10px}`;
    const html=`<style>${css}</style><div class="rs-pdf">
      <h1>${rsEsc(rep.client.name)} – Google Ads ${sr?"izveštaj":"report"}</h1>
      <div class="sub">${rsDate(rep.period.from,sr)} – ${rsDate(rep.period.to,sr)}${rep.prevPeriod?` · ${sr?"poređenje sa":"compared to"} ${rsDate(rep.prevPeriod.from,sr)} – ${rsDate(rep.prevPeriod.to,sr)}`:""} · ${sr?"iznosi u EUR":"amounts in EUR"}</div>
      <h2>${sr?"Glavni pokazatelji":"Key metrics"}</h2><div class="g">${k}</div>
      ${chart?`<h2>${sr?"Potrošnja i prihod po danima":"Spend and revenue by day"}</h2><div class="chart">${chart}</div>`:""}
      ${ai?`<h2>${sr?"Zaključak i preporuke":"Conclusion and recommendations"}</h2>${mdToHtml(ai)}`:""}
      <h2>${sr?"Kampanje":"Campaigns"}</h2><table><tr><th>${sr?"Kampanja":"Campaign"}</th><th>${sr?"Potrošnja":"Spend"}</th><th>${sr?"Prihod":"Revenue"}</th><th>ROAS</th><th>${sr?"Kupovine":"Purchases"}</th></tr>${rows}</table>
      ${unattr&&unattr.revenueEUR>0?`<p class="sub">${sr?"Prihod iz Google Ads kanala bez prepoznate kampanje":"Revenue from Google Ads channels without a recognized campaign"}: ${rsNum(unattr.revenueEUR)} €</p>`:""}
      <div class="foot">${sr?"Izvor: Google Ads (potrošnja) i GA4 (prihod i kupovine)":"Source: Google Ads (spend) and GA4 (revenue and purchases)"}</div></div>`;
    const holder=document.createElement("div");
    holder.style.cssText="position:fixed;left:-10000px;top:0;width:740px;background:#fff;";
    holder.innerHTML=html;
    document.body.appendChild(holder);
    const safe=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"dj").replace(/Đ/g,"Dj").replace(/[^A-Za-z0-9_-]+/g,"_").replace(/^_+|_+$/g,"");
    const filename=`${safe(rep.client.name)||"klijent"}_Google-Ads_${rep.period.from}_${rep.period.to}.pdf`;
    try{
      const h2p=await loadHtml2Pdf();
      await h2p().set({
        margin:[10,10,12,10],
        filename,
        image:{type:"jpeg",quality:0.95},
        html2canvas:{scale:2,backgroundColor:"#ffffff",useCORS:true},
        jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},
        pagebreak:{mode:["css","legacy"],avoid:[".k","tr",".chart","h2","h3","li","p"]},
      }).from(holder.querySelector(".rs-pdf")).save();
    }catch(e){
      alert(sr?"PDF nije napravljen. Proveri internet vezu i pokušaj ponovo.":"The PDF could not be created. Check your connection and try again.");
    }
    document.body.removeChild(holder);
    setPdfBusy(false);
  };

  const clientName=clients.find(c=>String(c.id)===String(clientId))?.name;

  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>📑 Report Studio</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 18px"}}>{t.m15s}</p>

    <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:14,padding:"16px",marginBottom:16}}>
      <div style={{color:C.mut,fontSize:11,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",margin:"0 0 6px"}}>{sr?"Klijent":"Client"}</div>
      {clientsLoading?<div style={{color:C.acl,fontSize:13,marginBottom:12}}>✦ {sr?"Učitavam klijente...":"Loading clients..."}</div>:
        clients.length===0?<div style={{color:C.mut,fontSize:13,marginBottom:12}}>{sr?"Nema klijenata još. Dodaj klijenta u Clients.":"No clients yet. Add a client in Clients."}</div>:
        <select value={clientId} onChange={e=>setClientId(e.target.value)} style={{...bpInp,marginBottom:14}}>
          <option value="" style={{color:"#111"}}>{sr?"— izaberi klijenta —":"— choose a client —"}</option>
          {clients.map(c=><option key={c.id} value={String(c.id)} style={{color:"#111"}}>{c.name}</option>)}
        </select>}
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

    {rep&&cur&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:12}}>
        <div>
          <div style={{fontWeight:800,fontSize:17}}>{rep.client.name||clientName} – Google Ads</div>
          <div style={{color:C.mut,fontSize:12,marginTop:2}}>{rsDate(rep.period.from,sr)} – {rsDate(rep.period.to,sr)}{rep.prevPeriod?` · ${sr?"poređenje sa":"compared to"} ${rsDate(rep.prevPeriod.from,sr)} – ${rsDate(rep.prevPeriod.to,sr)}`:""} · {sr?"iznosi u EUR":"amounts in EUR"}</div>
        </div>
        <button onClick={exportPdf} disabled={pdfBusy} style={{...bpBtn(false),opacity:pdfBusy?0.6:1}}>📄 {pdfBusy?(sr?"Pravim PDF...":"Creating PDF..."):(sr?"Preuzmi PDF":"Download PDF")}</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {kpis.map(x=><div key={x.k} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px"}}>
          <div style={{color:C.dim,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.6px"}}>{x.l}</div>
          <div style={{fontSize:18,fontWeight:800,marginTop:4}}>{x.v}</div>
          {x.d!=null&&<div style={{fontSize:11,fontWeight:700,color:dColor(x.d,x.good),marginTop:2}}>{dText(x.d)}</div>}
        </div>)}
      </div>
      {rep.previous===null&&rep.prevPeriod&&<div style={{color:C.mut,fontSize:12,margin:"-4px 0 12px"}}>{sr?"Podaci za prethodni period nisu dostupni, pa poređenje nije prikazano.":"Data for the previous period isn't available, so the comparison isn't shown."}</div>}

      <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>{sr?"Potrošnja i prihod po danima":"Spend and revenue by day"}</div>
        {rep.daily?<><RsChart daily={rep.daily} sr={sr} forPrint={false}/><div id="rs-chart-print" style={{display:"none"}} aria-hidden="true"><RsChart daily={rep.daily} sr={sr} forPrint={true}/></div></>
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
        {ai&&<div style={{marginTop:10}}><MD2 text={ai}/></div>}
      </div>

      <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px",overflowX:"auto"}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>{sr?"Kampanje":"Campaigns"} · {camps.length}</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:520}}>
          <thead><tr>{[sr?"Kampanja":"Campaign",sr?"Potrošnja":"Spend",sr?"Prihod":"Revenue","ROAS",sr?"Kupovine":"Purchases"].map(h=><th key={h} style={{textAlign:"left",color:C.mut,fontWeight:600,padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{h}</th>)}</tr></thead>
          <tbody>{(showAll?camps:camps.slice(0,15)).map(c=><tr key={c.campaign_id}>
            <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{c.campaign_name}</td>
            <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{rsNum(c.spendEUR)} €</td>
            <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{rsNum(c.revenueEUR)} €</td>
            <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.brd}`,color:c.roas>=1?C.grn:c.spendEUR>0?C.red:C.txt,fontWeight:700}}>{rsNum(c.roas,2)}</td>
            <td style={{padding:"6px 8px",borderBottom:`1px solid ${C.brd}`}}>{rsNum(c.conversions)}</td>
          </tr>)}</tbody>
        </table>
        {camps.length>15&&<button onClick={()=>setShowAll(v=>!v)} style={{...bpBtn(false),marginTop:10}}>{showAll?(sr?"Prikaži manje":"Show less"):(sr?`Prikaži sve (${camps.length})`:`Show all (${camps.length})`)}</button>}
        {unattr&&unattr.revenueEUR>0&&<div style={{color:C.mut,fontSize:12,marginTop:10}}>{sr?"Prihod iz Google Ads kanala bez prepoznate kampanje":"Revenue from Google Ads channels without a recognized campaign"}: {rsNum(unattr.revenueEUR)} €</div>}
      </div>
    </div>}
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

// ── MODULE 8: AI REPORT GENERATOR ────────────────────────────────────────────
function ReportMod({t,lang}){
  const sr=lang==="sr";
  const [type,setType]=useState(null);
  const [inputMode,setInputMode]=useState("screenshot"); // "screenshot" or "csv"
  const [client,setClient]=useState("");
  const [period,setPeriod]=useState("");
  const [periodA,setPeriodA]=useState("");
  const [periodB,setPeriodB]=useState("");
  const [imgA,setImgA]=useState(null); const [prevA,setPrevA]=useState(null);
  const [imgB,setImgB]=useState(null); const [prevB,setPrevB]=useState(null);
  const [csvA,setCsvA]=useState(null); const [csvNameA,setCsvNameA]=useState("");
  const [csvB,setCsvB]=useState(null); const [csvNameB,setCsvNameB]=useState("");
  const [report,setReport]=useState(null);
  const [loading,setLoading]=useState(false);
  const [dragA,setDragA]=useState(false); const [dragB,setDragB]=useState(false);

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

  const handleCSV=(file,setCsv,setName)=>{
    if(!file) return;
    setName(file.name);
    const reader=new FileReader();
    reader.onload=e=>setCsv(e.target.result);
    reader.readAsText(file,"UTF-8");
  };

  const handleFile=(file,setImg,setPrev)=>{
    if(!file||!file.type.startsWith("image/")) return;
    const reader=new FileReader();
    reader.onload=e=>{ setImg(e.target.result.split(",")[1]); setPrev(e.target.result); };
    reader.readAsDataURL(file);
  };

  const CSVBox=({csv,name,setCsv,setName,label,id})=>(
    <div style={{marginBottom:16}}>
      <Lbl c={label}/>
      {!csv
        ?<div onClick={()=>document.getElementById(id).click()}
          style={{border:"2px dashed rgba(255,255,255,0.15)",borderRadius:14,padding:"30px 20px",textAlign:"center",cursor:"pointer",background:"rgba(255,255,255,0.02)",transition:"all 0.2s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#6366F1"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.15)"}>
          <div style={{fontSize:32,marginBottom:8}}>📊</div>
          <div style={{color:C.txt,fontWeight:600,fontSize:14,marginBottom:4}}>{sr?"Klikni da odabereš CSV fajl":"Click to select CSV file"}</div>
          <div style={{color:C.mut,fontSize:12}}>{sr?"Export iz Meta Ads Manager → Export table data → CSV":"Export from Meta Ads Manager → Export table data → CSV"}</div>
        </div>
        :<div style={{background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:12,padding:"14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{color:C.grn,fontWeight:700,fontSize:13}}>✅ {name}</div><div style={{color:C.mut,fontSize:11,marginTop:4}}>{sr?"CSV učitan":"CSV loaded"}</div></div>
          <button onClick={()=>{setCsv(null);setName("");}} style={{background:"none",border:`1px solid ${C.brd}`,borderRadius:8,color:C.mut,fontSize:12,padding:"6px 12px",cursor:"pointer"}}>{sr?"Promeni":"Change"}</button>
        </div>
      }
      <input id={id} type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={e=>handleCSV(e.target.files[0],setCsv,setName)}/>
    </div>
  );

  const UploadBox=({img,prev,setImg,setPrev,label,drag,setDrag,id})=>(
    <div style={{marginBottom:16}}>
      <Lbl c={label}/>
      {!prev
        ? <div
            onDragOver={e=>{e.preventDefault();setDrag(true);}}
            onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0],setImg,setPrev);}}
            onClick={()=>document.getElementById(id).click()}
            style={{border:`2px dashed ${drag?"#6366F1":"rgba(255,255,255,0.15)"}`,borderRadius:14,padding:"30px 20px",textAlign:"center",cursor:"pointer",background:drag?"rgba(99,102,241,0.08)":"rgba(255,255,255,0.02)",transition:"all 0.2s"}}>
            <div style={{fontSize:32,marginBottom:8}}>📂</div>
            <div style={{color:C.txt,fontWeight:600,fontSize:14,marginBottom:4}}>{t.rg_drag}</div>
            <div style={{color:C.mut,fontSize:12}}>{t.rg_dragSub}</div>
          </div>
        : <div>
            <img src={prev} alt="" style={{width:"100%",borderRadius:10,border:`1px solid ${C.brd}`,marginBottom:8}}/>
            <button onClick={()=>{setImg(null);setPrev(null);}} style={{background:"none",border:`1px solid ${C.brd}`,borderRadius:8,color:C.mut,fontSize:12,padding:"6px 14px",cursor:"pointer",width:"100%"}}>{sr?"Promeni sliku":"Change image"}</button>
          </div>
      }
      <input id={id} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0],setImg,setPrev)}/>
    </div>
  );

  const generate=async()=>{
    setLoading(true); setReport(null);
    try {
      const content=[];
      const isCsv=inputMode==="csv";

      if(type==="single"){
        const csvParsed=isCsv&&csvA?parseCSV(csvA):null;
        const csvSummary=csvParsed?`Kolone: ${csvParsed.headers.join(", ")}\n\nPodaci:\n${csvParsed.rows.slice(0,50).map(r=>Object.values(r).join(" | ")).join("\n")}`:"";

        if(!isCsv&&imgA) content.push({type:"image",source:{type:"base64",media_type:getImageMediaType(imgA),data:imgA}});
        content.push({type:"text",text:sr
          ?`Ti si senior marketing konsultant. Klijent: "${client||"Nije navedeno"}". Period: "${period||"Nije navedeno"}". Piši isključivo na srpskom jeziku, ekavski.

${isCsv?`Analiziraj ovaj CSV export iz marketing alata:\n\n${csvSummary}`:"Analiziraj ovaj screenshot."}

Napiši profesionalni izveštaj u JSON formatu:
{
  "execSummary": "2-3 rečenice executive summary za klijenta",
  "metrics": [{"name":"naziv metrike","value":"vrednost"}],
  "issues": ["problem 1","problem 2","problem 3"],
  "good": ["pozitivna stvar 1","pozitivna stvar 2"],
  "actions": ["akcija 1","akcija 2","akcija 3","akcija 4","akcija 5"],
  "strategic": ["preporuka 1","preporuka 2","preporuka 3"]
}
Vrati SAMO JSON, bez teksta pre ili posle.`
          :`You are a senior marketing consultant. Client: "${client||"Not specified"}". Period: "${period||"Not specified"}".

${isCsv?`Analyze this CSV export from Meta Ads Manager:\n\n${csvSummary}`:"Analyze this screenshot."}

Write a professional report in JSON format:
{
  "execSummary": "2-3 sentence executive summary",
  "metrics": [{"name":"metric name","value":"value"}],
  "issues": ["issue 1","issue 2","issue 3"],
  "good": ["positive thing 1","positive thing 2"],
  "actions": ["action 1","action 2","action 3","action 4","action 5"],
  "strategic": ["recommendation 1","recommendation 2","recommendation 3"]
}
Return ONLY JSON, no text before or after.`});
      } else {
        const csvParsedA=isCsv&&csvA?parseCSV(csvA):null;
        const csvParsedB=isCsv&&csvB?parseCSV(csvB):null;
        const csvSumA=csvParsedA?`Kolone: ${csvParsedA.headers.join(", ")}\nPodaci:\n${csvParsedA.rows.slice(0,30).map(r=>Object.values(r).join(" | ")).join("\n")}`:"";
        const csvSumB=csvParsedB?`Kolone: ${csvParsedB.headers.join(", ")}\nPodaci:\n${csvParsedB.rows.slice(0,30).map(r=>Object.values(r).join(" | ")).join("\n")}`:"";

        if(!isCsv){
          content.push({type:"image",source:{type:"base64",media_type:getImageMediaType(imgA),data:imgA}});
          content.push({type:"text",text:sr?`Ovo je screenshot za Period A: ${periodA||"Period A"}`:`This is the screenshot for Period A: ${periodA||"Period A"}`});
          content.push({type:"image",source:{type:"base64",media_type:getImageMediaType(imgB),data:imgB}});
        }
        content.push({type:"text",text:sr
          ?`${isCsv?`Ovo su CSV podaci za Period A (${periodA||"Period A"}):\n${csvSumA}\n\nOvo su CSV podaci za Period B (${periodB||"Period B"}):\n${csvSumB}`:`Ovo je screenshot za Period B: ${periodB||"Period B"}`}. Klijent: "${client||"Nije navedeno"}". Piši isključivo na srpskom jeziku, ekavski.

Uporedi ova dva perioda i vrati JSON:
{
  "execSummary": "2-3 rečenice executive summary poređenja",
  "comparison": [{"metric":"naziv metrike","valueA":"vrednost period A","valueB":"vrednost period B","change":"npr. +25%","better":true}],
  "issues": ["problem 1","problem 2"],
  "good": ["poboljšanje 1","poboljšanje 2"],
  "actions": ["akcija 1","akcija 2","akcija 3"],
  "strategic": ["preporuka 1","preporuka 2"],
  "aiComment": "3-4 rečenice komentara – šta se promenilo i zašto"
}
Za "better": true znači Period B bolji, false znači lošiji. Vrati SAMO JSON.`
          :`${isCsv?`These are CSV data for Period A (${periodA||"Period A"}):\n${csvSumA}\n\nThese are CSV data for Period B (${periodB||"Period B"}):\n${csvSumB}`:`This is the screenshot for Period B: ${periodB||"Period B"}`}. Client: "${client||"Not specified"}".

Compare these two periods and return JSON:
{
  "execSummary": "2-3 sentence executive summary of comparison",
  "comparison": [{"metric":"metric name","valueA":"period A value","valueB":"period B value","change":"e.g. +25%","better":true}],
  "issues": ["issue 1","issue 2"],
  "good": ["improvement 1","improvement 2"],
  "actions": ["action 1","action 2","action 3"],
  "strategic": ["recommendation 1","recommendation 2"],
  "aiComment": "3-4 sentence comment – what changed and why"
}
For "better": true means Period B is better, false means worse. Return ONLY JSON.`});
      }
      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2500,messages:[{role:"user",content}]})
      });
      const data=await res.json();
      const raw=data.content?.[0]?.text||"{}";
      const clean=raw.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      setReport({...parsed,client,period,periodA,periodB,type});
      // Auto-save if client name provided
      if(client&&parsed.execSummary){
        const analysisText=`${parsed.execSummary}\n\n${(parsed.issues||[]).join("\n")}\n\n${(parsed.actions||[]).join("\n")}`;
        let periodFrom=null, periodTo=null;
        if(type==="compare"){
          periodFrom=periodA||null;
          periodTo=periodB||null;
        } else {
          periodFrom=period||null;
          periodTo=periodB||null;
        }
        saveAnalysis({
          clientName:client,
          tool:type==="compare"?"report_compare":"report_single",
          periodFrom,
          periodTo,
          analysisText,
          metrics:parsed.metrics?Object.fromEntries(parsed.metrics.map(m=>[m.name,m.value])):null
        });
      }
    } catch(e){ setReport({error:true}); }
    setLoading(false);
  };

  const exportPDF=()=>{
    const style=document.createElement("style");
    style.textContent=`
      @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { background: #ffffff !important; color: #1a1a2e !important; font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .no-print { display: none !important; }
        #report-content { padding: 24px; background: white; }
        .report-section { margin-bottom: 16px; padding: 14px; border-radius: 8px; page-break-inside: avoid; }
        /* Header */
        #report-content > div:first-child { background: #eef2ff !important; border: 1px solid #c7d2fe !important; }
        .report-title { color: #1e1b4b !important; font-size: 20px !important; font-weight: 900 !important; }
        /* Executive summary */
        #report-content [style*="rgba(99,102,241,0.06)"] { background: #f0f4ff !important; border: 1px solid #c7d2fe !important; }
        /* Section labels */
        [class*="section-label"] { color: #4338ca !important; }
        /* All text */
        [style*="rgba(255,255,255,0.85)"] { color: #1a1a2e !important; }
        [style*="rgba(255,255,255,0.75)"] { color: #374151 !important; }
        [style*="rgba(255,255,255,0.65)"] { color: #4b5563 !important; }
        [style*="color: rgb(255, 255, 255)"] { color: #1a1a2e !important; }
        /* Metric rows */
        [style*="rgba(255,255,255,0.4)"] { color: #6b7280 !important; }
        [style*="rgba(255,255,255,0.2)"] { color: #9ca3af !important; }
        /* Borders */
        [style*="rgba(255,255,255,0.08)"] { border-color: #e5e7eb !important; }
        /* Green sections */
        [style*="rgba(52,211,153,0.06)"] { background: #f0fdf4 !important; border: 1px solid #bbf7d0 !important; }
        [style*="color: rgb(52, 211, 153)"] { color: #15803d !important; }
        /* Red sections */
        [style*="rgba(239,68,68,0.06)"] { background: #fef2f2 !important; border: 1px solid #fecaca !important; }
        [style*="color: rgb(248, 113, 113)"] { color: #dc2626 !important; }
        /* Yellow sections */
        [style*="rgba(251,191,36,0.06)"] { background: #fffbeb !important; border: 1px solid #fde68a !important; }
        [style*="color: rgb(251, 191, 36)"] { color: #d97706 !important; }
        /* Purple/AI sections */
        [style*="rgba(99,102,241,0.08)"] { background: #eef2ff !important; border: 1px solid #c7d2fe !important; }
        [style*="color: rgb(165, 180, 252)"] { color: #4338ca !important; }
        /* Comparison cards */
        [style*="rgba(52,211,153,0.05)"] { background: #f0fdf4 !important; border: 1px solid #bbf7d0 !important; }
        [style*="rgba(248,113,113,0.05)"] { background: #fef2f2 !important; border: 1px solid #fecaca !important; }
        /* Surface */
        [style*="rgba(255,255,255,0.04)"] { background: #f9fafb !important; border: 1px solid #e5e7eb !important; }
        [style*="rgba(255,255,255,0.08)"] { background: #f3f4f6 !important; }
        /* Footer */
        [style*="rgba(255,255,255,0.2)"] { color: #9ca3af !important; }
        /* Metric values */
        [style*="fontWeight:700"] { color: #1a1a2e !important; }
        [style*="fontWeight:800"] { color: #1a1a2e !important; }
        [style*="fontWeight:900"] { color: #1a1a2e !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(()=>document.head.removeChild(style), 1000);
  };

  const reset=()=>{ setType(null);setClient("");setPeriod("");setPeriodA("");setPeriodB(""); setImgA(null);setPrevA(null);setImgB(null);setPrevB(null);setReport(null); };

  // RESULTS
  if(report) return <div>
    <div className="no-print" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{fontSize:20,fontWeight:800,margin:0}}>{t.rg_title}</h2>
      <button onClick={exportPDF} style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,padding:"10px 18px",cursor:"pointer"}}>{t.rg_pdf}</button>
    </div>

    {report.error&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"16px",color:C.red,fontSize:13,marginBottom:16}}>{sr?"Greška pri generisanju izveštaja. Pokušaj ponovo.":"Error generating report. Please try again."}</div>}

    {!report.error&&<div id="report-content">
      {/* Header */}
      <div className="report-section" style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:14,padding:"18px",marginBottom:16}}>
        <div className="report-title" style={{color:C.txt,fontSize:18,fontWeight:900,marginBottom:4}}>📊 {report.client||"Marketing Report"}</div>
        <div style={{color:C.mut,fontSize:12}}>{report.type==="compare"?`${report.periodA} vs ${report.periodB}`:report.period} · {new Date().toLocaleDateString("sr-RS")}</div>
      </div>

      {/* Executive Summary */}
      {report.execSummary&&<div className="report-section" style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"16px",marginBottom:14}}>
        <div className="section-label" style={{color:C.acl,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:8}}>{t.rg_execSum}</div>
        <div style={{color:"rgba(255,255,255,0.85)",fontSize:13,lineHeight:1.8}}>{report.execSummary}</div>
      </div>}

      {/* Comparison table – kartice za mobilni */}
      {report.comparison&&<div className="report-section" style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",marginBottom:14}}>
        <div className="section-label" style={{color:C.mut,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:12}}>📊 {t.rg_comparison}</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {/* Header */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 80px",gap:8,padding:"8px 10px",borderBottom:`1px solid ${C.brd}`}}>
            {[t.rg_metric,report.periodA||"Period A",report.periodB||"Period B",t.rg_change].map((h,i)=>(
              <div key={i} style={{color:C.mut,fontSize:10,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase"}}>{h}</div>
            ))}
          </div>
          {/* Rows kao kartice */}
          {report.comparison.map((row,i)=>(
            <div key={i} style={{background:row.better?"rgba(52,211,153,0.05)":"rgba(248,113,113,0.05)",border:`1px solid ${row.better?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.2)"}`,borderRadius:10,padding:"12px 10px"}}>
              {/* Naziv metrike */}
              <div style={{color:C.txt,fontWeight:700,fontSize:13,marginBottom:10}}>{row.metric}</div>
              {/* Vrednosti */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 80px",gap:8,alignItems:"center"}}>
                <div>
                  <div style={{color:C.dim,fontSize:10,fontWeight:600,marginBottom:3}}>{report.periodA||"Period A"}</div>
                  <div style={{color:C.mut,fontSize:13,fontWeight:600}}>{row.valueA}</div>
                </div>
                <div>
                  <div style={{color:C.dim,fontSize:10,fontWeight:600,marginBottom:3}}>{report.periodB||"Period B"}</div>
                  <div style={{color:C.txt,fontSize:13,fontWeight:700}}>{row.valueB}</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{color:row.better?C.grn:C.red,fontWeight:800,fontSize:14}}>{row.better?"▲":"▼"}</div>
                  <div style={{color:row.better?C.grn:C.red,fontWeight:700,fontSize:12}}>{row.change}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {report.aiComment&&<div style={{marginTop:14,padding:"12px 14px",background:"rgba(99,102,241,0.08)",borderRadius:10,color:"rgba(255,255,255,0.75)",fontSize:12,lineHeight:1.7}}>
          <span style={{color:C.acl,fontWeight:700}}>✦ {t.rg_aiComment}: </span>{report.aiComment}
        </div>}
      </div>}

      {/* Metrics (single) */}
      {report.metrics&&report.metrics.length>0&&<div className="report-section" style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",marginBottom:14}}>
        <div className="section-label" style={{color:C.mut,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>{t.rg_metricsFound}</div>
        {report.metrics.map((m,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<report.metrics.length-1?`1px solid ${C.brd}`:"none"}}>
          <span style={{color:C.mut,fontSize:13}}>{m.name}</span>
          <span style={{color:C.txt,fontWeight:700,fontSize:13}}>{m.value}</span>
        </div>)}
      </div>}

      {/* Issues */}
      {report.issues&&report.issues.length>0&&<div className="report-section" style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:"16px",marginBottom:14}}>
        <div className="section-label" style={{color:C.red,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>{t.rg_issues}</div>
        {report.issues.map((item,i)=><div key={i} style={{color:"rgba(255,255,255,0.75)",fontSize:12,lineHeight:1.7,padding:"5px 0",borderBottom:i<report.issues.length-1?`1px solid rgba(239,68,68,0.1)`:"none"}}>• {item}</div>)}
      </div>}

      {/* Good */}
      {report.good&&report.good.length>0&&<div className="report-section" style={{background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:12,padding:"16px",marginBottom:14}}>
        <div className="section-label" style={{color:C.grn,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>{t.rg_good}</div>
        {report.good.map((item,i)=><div key={i} style={{color:"rgba(255,255,255,0.75)",fontSize:12,lineHeight:1.7,padding:"5px 0",borderBottom:i<report.good.length-1?`1px solid rgba(52,211,153,0.1)`:"none"}}>• {item}</div>)}
      </div>}

      {/* Actions */}
      {report.actions&&report.actions.length>0&&<div className="report-section" style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:12,padding:"16px",marginBottom:14}}>
        <div className="section-label" style={{color:C.yel,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>{t.rg_actions}</div>
        {report.actions.map((item,i)=><div key={i} style={{color:"rgba(255,255,255,0.75)",fontSize:12,lineHeight:1.7,padding:"6px 0",borderBottom:i<report.actions.length-1?`1px solid rgba(251,191,36,0.1)`:"none"}}><span style={{color:C.yel,fontWeight:700,marginRight:8}}>{i+1}.</span>{item}</div>)}
      </div>}

      {/* Strategic */}
      {report.strategic&&report.strategic.length>0&&<div className="report-section" style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"16px",marginBottom:20}}>
        <div className="section-label" style={{color:C.acl,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>{t.rg_strategic}</div>
        {report.strategic.map((item,i)=><div key={i} style={{color:"rgba(255,255,255,0.75)",fontSize:12,lineHeight:1.7,padding:"5px 0",borderBottom:i<report.strategic.length-1?`1px solid rgba(99,102,241,0.1)`:"none"}}>• {item}</div>)}
      </div>}

      {/* Footer */}
      <div style={{textAlign:"center",color:C.dim,fontSize:11,paddingTop:8,borderTop:`1px solid ${C.brd}`}}>{t.rg_generatedBy} · {new Date().toLocaleDateString()}</div>
    </div>}

    <div style={{marginTop:20,display:"flex",gap:10}}>
      <Btn onClick={reset} sec>{t.rg_newReport}</Btn>
      {!report.error&&<Btn onClick={exportPDF}>{t.rg_pdf}</Btn>}
    </div>
  </div>;

  // LOADING
  if(loading) return <div style={{textAlign:"center",padding:"40px 0"}}>
    <div style={{fontSize:36,marginBottom:16}}>✦</div>
    <div style={{color:C.acl,fontWeight:700,fontSize:15,marginBottom:8}}>{t.rg_generating}</div>
    <div style={{color:C.mut,fontSize:13}}>{sr?"Ovo može trajati 20-40 sekundi...":"This may take 20-40 seconds..."}</div>
    <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:8}}>
      {[1,2,3,4,5].map(i=><div key={i} style={{height:12,background:"rgba(255,255,255,0.06)",borderRadius:6,width:i===5?"50%":i===4?"75%":"100%"}}/>)}
    </div>
  </div>;

  // TYPE SELECTION
  if(!type) return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.rg_title}</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 28px",lineHeight:1.6}}>{t.rg_sub}</p>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <button onClick={()=>setType("single")} style={{background:"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(99,102,241,0.08))",border:"1px solid rgba(99,102,241,0.4)",borderRadius:16,padding:"20px",textAlign:"left",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
        <div style={{fontSize:28,marginBottom:10}}>📸</div>
        <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:6}}>{t.rg_single}</div>
        <div style={{color:C.mut,fontSize:13,lineHeight:1.5}}>{t.rg_single_s}</div>
        <div style={{marginTop:12,color:C.acl,fontSize:12,fontWeight:700}}>📥 PDF →</div>
      </button>
      <button onClick={()=>setType("compare")} style={{background:"linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.05))",border:"1px solid rgba(16,185,129,0.3)",borderRadius:16,padding:"20px",textAlign:"left",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
        <div style={{fontSize:28,marginBottom:10}}>📊</div>
        <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:6}}>{t.rg_compare}</div>
        <div style={{color:C.mut,fontSize:13,lineHeight:1.5}}>{t.rg_compare_s}</div>
        <div style={{marginTop:12,color:C.grn,fontSize:12,fontWeight:700}}>📥 PDF →</div>
      </button>
    </div>
  </div>;

  // FORM
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      <button onClick={()=>setType(null)} style={{background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:13,fontWeight:600,padding:0}}>{t.prv}</button>
      <h2 style={{fontSize:18,fontWeight:800,margin:0}}>{type==="single"?t.rg_single:t.rg_compare}</h2>
    </div>

    <Lbl c={t.rg_client}/>
    <div style={{marginBottom:14}}><TIn v={client} ch={setClient} ph={t.rg_clientPh}/></div>

    {type==="single"&&<div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
      <div><Lbl c={sr?"Period od":"Period from"}/><DIn v={period} ch={setPeriod}/></div>
      <div><Lbl c={sr?"Period do":"Period to"}/><DIn v={periodB} ch={setPeriodB}/></div>
    </div>}
    {type==="compare"&&<div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
      <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"14px"}}>
        <div style={{color:C.acl,fontWeight:700,fontSize:12,marginBottom:10}}>Period A</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div><Lbl c={sr?"Od":"From"}/><DIn v={periodA} ch={setPeriodA}/></div>
          <div><Lbl c={sr?"Do":"To"}/><DIn v={periodB} ch={setPeriodB}/></div>
        </div>
      </div>
    </div>}

    {/* Input mode toggle */}
    <div style={{display:"flex",gap:8,marginBottom:20}}>
      <button onClick={()=>setInputMode("screenshot")} style={{flex:1,padding:"10px",borderRadius:10,border:`1px solid ${inputMode==="screenshot"?"rgba(99,102,241,0.6)":C.brd}`,background:inputMode==="screenshot"?"rgba(99,102,241,0.15)":"transparent",color:inputMode==="screenshot"?C.acl:C.mut,fontSize:13,fontWeight:600,cursor:"pointer"}}>
        📸 {sr?"Screenshot":"Screenshot"}
      </button>
      <button onClick={()=>setInputMode("csv")} style={{flex:1,padding:"10px",borderRadius:10,border:`1px solid ${inputMode==="csv"?"rgba(16,185,129,0.6)":C.brd}`,background:inputMode==="csv"?"rgba(16,185,129,0.15)":"transparent",color:inputMode==="csv"?C.grn:C.mut,fontSize:13,fontWeight:600,cursor:"pointer"}}>
        📊 CSV
      </button>
    </div>

    {inputMode==="screenshot"&&<>
      <UploadBox img={imgA} prev={prevA} setImg={setImgA} setPrev={setPrevA} label={type==="compare"?t.rg_uploadA:t.rg_upload} drag={dragA} setDrag={setDragA} id="rgUploadA"/>
      {type==="compare"&&<UploadBox img={imgB} prev={prevB} setImg={setImgB} setPrev={setPrevB} label={t.rg_uploadB} drag={dragB} setDrag={setDragB} id="rgUploadB"/>}
      <Btn onClick={generate} disabled={!imgA||(type==="compare"&&!imgB)}>{t.rg_generate}</Btn>
    </>}

    {inputMode==="csv"&&<>
      {type==="compare"
        ?<><CSVBox csv={csvA} name={csvNameA} setCsv={setCsvA} setName={setCsvNameA} label={sr?"CSV – Period A (stariji)":"CSV – Period A (older)"} id="csvUploadA"/>
          <CSVBox csv={csvB} name={csvNameB} setCsv={setCsvB} setName={setCsvNameB} label={sr?"CSV – Period B (noviji)":"CSV – Period B (newer)"} id="csvUploadB"/>
          <Btn onClick={generate} disabled={!csvA||!csvB}>{t.rg_generate}</Btn></>
        :<><CSVBox csv={csvA} name={csvNameA} setCsv={setCsvA} setName={setCsvNameA} label={sr?"CSV Export iz Meta Ads Managera":"CSV Export from Meta Ads Manager"} id="csvUploadA"/>
          <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px",marginBottom:16}}>
            <div style={{color:C.mut,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{sr?"Kako da exportuješ CSV:":"How to export CSV:"}</div>
            {[sr?"Meta Ads Manager → Export → Export table data → CSV":"Meta Ads Manager → Export → Export table data → CSV",sr?"Looker Studio → Export → CSV":"Looker Studio → Export → CSV",sr?"Google Ads → Download → CSV":"Google Ads → Download → CSV",sr?"Whatagraph, GA4 i drugi alati – koristite njihov CSV export":"Whatagraph, GA4 and other tools – use their CSV export"].map((s,i)=><div key={i} style={{display:"flex",gap:10,marginBottom:6,alignItems:"flex-start"}}><span style={{color:C.acl,fontWeight:700,fontSize:12,minWidth:16}}>•</span><span style={{color:"rgba(255,255,255,0.6)",fontSize:12}}>{s}</span></div>)}
          </div>
          <Btn onClick={generate} disabled={!csvA}>{t.rg_generate}</Btn></>
      }
    </>}
  </div>;
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

async function saveAnalysis({clientName,tool,periodFrom,periodTo,analysisText,metrics}){
  try{
    const userId=await getOrCreateUser();
    if(!clientName||!analysisText) return;
    // Get or create client
    const cr=await fetch("/api/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:userId,name:clientName})});
    const client=await cr.json();
    if(!client.id) return;
    // Save analysis
    await fetch("/api/analyses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      client_id:client.id,user_id:userId,tool,
      period_from:periodFrom||null,period_to:periodTo||null,
      analysis_text:analysisText,metrics:metrics||null
    })});
  }catch(e){ console.log("Save analysis error:",e); }
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

// ── MODULE 9: BOOKMARK CONNECTOR ─────────────────────────────────────────────
function BookmarkMod({t,lang}){
  const sr=lang==="sr";
  const [importedData,setImportedData]=useState(null);
  const [clientName,setClientName]=useState("");
  const [periodFrom,setPeriodFrom]=useState("");
  const [periodTo,setPeriodTo]=useState("");
  const [analysis,setAnalysis]=useState("");
  const [loading,setLoading]=useState(false);
  const [fetchingData,setFetchingData]=useState(false);
  const [clientsList,setClientsList]=useState([]);
  const [showNewClientInput,setShowNewClientInput]=useState(false);

  useEffect(()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid) return;
    fetch(`/api/clients?user_id=${uid}`).then(r=>r.json()).then(d=>setClientsList(Array.isArray(d)?d:[])).catch(()=>{});
  },[]);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const importId=params.get("import_id");
    const source=params.get("source");

    if(importId){
      setFetchingData(true);
      window.history.replaceState({},"",window.location.pathname+"?mod=9");
      fetch(`/api/temp-fetch?id=${importId}`)
        .then(r=>r.json())
        .then(result=>{
          if(result.data){
            setImportedData(result.data);
            localStorage.setItem("mat_last_import",JSON.stringify({...result.data,screenshot:null}));
          }
          setFetchingData(false);
        })
        .catch(()=>setFetchingData(false));
    } else if(source==="loading"){
      // Waiting for redirect with import_id - start polling
      setFetchingData(true);
      window.history.replaceState({},"",window.location.pathname+"?mod=9");
      // Poll every 2 seconds for up to 30 seconds
      let attempts=0;
      const maxAttempts=15;
      const pollInterval=setInterval(async()=>{
        attempts++;
        // Check if URL has been updated with import_id
        const currentParams=new URLSearchParams(window.location.search);
        const newImportId=currentParams.get("import_id");
        if(newImportId){
          clearInterval(pollInterval);
          try{
            const r=await fetch(`/api/temp-fetch?id=${newImportId}`);
            const result=await r.json();
            if(result.data) setImportedData(result.data);
          }catch(e){}
          setFetchingData(false);
          return;
        }
        // Also check sessionStorage
        const stored=sessionStorage.getItem("mat_import");
        if(stored){
          clearInterval(pollInterval);
          try{
            const p=JSON.parse(stored);
            sessionStorage.removeItem("mat_import");
            setImportedData(p);
          }catch(e){}
          setFetchingData(false);
          return;
        }
        if(attempts>=maxAttempts){
          clearInterval(pollInterval);
          setFetchingData(false);
        }
      },2000);
    } else {
      // Check localStorage for previous import
      try{
        const saved=localStorage.getItem("mat_last_import");
        if(saved) setImportedData(JSON.parse(saved));
      }catch(e){}
    }
  },[]);

  const analyze=async()=>{
    if(!importedData) return;
    setLoading(true); setAnalysis("");
    try{
      const appUrl="/api/analyze";
      const headers={"Content-Type":"application/json"};
      
      let messages;
      
      // If we have a screenshot, use vision
      if(importedData.screenshot){
        const prompt=sr
          ?`Ti si senior Meta Ads ekspert. Analiziraj ovaj screenshot iz ${importedData.title||"marketing alata"}. Piši isključivo na srpskom jeziku, ekavski.
${clientName?`\nKlijent: ${clientName}`:""}
Izvor: ${importedData.source}
Period: ${importedData.dateRange||"Nije detektovan"}

Pročitaj sve podatke koji su vidljivi i napiši analizu. NE koristi Markdown. Koristi samo običan tekst:

EXECUTIVE SUMMARY
(Šta vidiš – o čemu se radi, koji je kontekst)

KLJUČNI NALAZI
(Najvažniji podaci – brojke, trendovi, kampanje koje se ističu)

PROBLEMI I PRILIKE
(Šta ne radi dobro, gde ima prostora za poboljšanje)

PRIORITETNE PREPORUKE
(3-5 konkretnih akcija na osnovu ovih podataka)

Budi konkretan i profesionalan. Koristi stvarne brojke sa screenshota.`
          :`You are a senior Meta Ads expert. Analyze this screenshot from ${importedData.title||"a marketing tool"}.

Source: ${importedData.source}
Period: ${importedData.dateRange||"Not detected"}

Read all visible data and write an analysis. Do NOT use Markdown. Plain text only:

EXECUTIVE SUMMARY
KEY FINDINGS
ISSUES AND OPPORTUNITIES
PRIORITY RECOMMENDATIONS

Be specific. Use actual numbers from the screenshot.`;

        messages=[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:getImageMediaType(importedData.screenshot),data:importedData.screenshot}},
          {type:"text",text:prompt}
        ]}];
      } else {
        // Use text data
        const tablesSummary=importedData.tables.slice(0,3).map((tbl,i)=>{
          return `Tabela ${i+1} (${tbl.rows.length} redova):\nKolone: ${tbl.headers.join(", ")}\nPodaci:\n${tbl.rows.slice(0,15).map(r=>Object.values(r).join(" | ")).join("\n")}`;
        }).join("\n\n");
        const prompt=sr
          ?`Ti si senior Meta Ads ekspert. Analiziraj ove uvezene podatke. Piši isključivo na srpskom jeziku, ekavski. NE koristi Markdown.\n\nIzvor: ${importedData.source}\nPeriod: ${importedData.dateRange||"Nije detektovan"}\n\nPODACI:\n${tablesSummary}\n\nEXECUTIVE SUMMARY\nKLJUČNI NALAZI\nPROBLEMI I PRILIKE\nPRIORITETNE PREPORUKE`
          :`You are a senior Meta Ads expert. Analyze this data. Plain text only.\n\nSource: ${importedData.source}\n\nDATA:\n${tablesSummary}\n\nEXECUTIVE SUMMARY\nKEY FINDINGS\nISSUES AND OPPORTUNITIES\nPRIORITY RECOMMENDATIONS`;
        messages=[{role:"user",content:prompt}];
      }

      const res=await fetch(appUrl,{method:"POST",headers,body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,messages})});
      const data=await res.json();
      const result=data.content?.[0]?.text||"";
      setAnalysis(result);
      // Auto-save if client name provided
      if(clientName&&result){
        saveAnalysis({
          clientName,tool:"bookmark",
          periodFrom:periodFrom||null,
          periodTo:periodTo||null,
          analysisText:result
        });
      }
    }catch(e){ setAnalysis(sr?"Greška pri analizi. Pokušaj ponovo.":"Error during analysis. Please try again."); }
    setLoading(false);
  };

  const clear=()=>{ setImportedData(null); setAnalysis(""); localStorage.removeItem("mat_last_import"); };

  if(fetchingData) return <div style={{textAlign:"center",padding:"60px 20px"}}>
    <div style={{fontSize:48,marginBottom:20}}>📊</div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 12px",color:C.txt}}>{sr?"Prikupljam podatke...":"Collecting data..."}</h2>
    <p style={{color:C.mut,fontSize:14,margin:"0 0 32px",lineHeight:1.6}}>{sr?"Učitavam uvezene podatke. Sačekaj trenutak.":"Loading imported data. Please wait a moment."}</p>
    <div style={{maxWidth:300,margin:"0 auto"}}>
      {[1,2,3,4].map(i=><div key={i} style={{height:10,background:"rgba(255,255,255,0.06)",borderRadius:6,marginBottom:10,width:i===4?"60%":"100%"}}/>)}
    </div>
    <p style={{color:C.dim,fontSize:12,marginTop:24}}>{sr?"Ovo može trajati 5-15 sekundi...":"This may take 5-15 seconds..."}</p>
  </div>;

  return <div>
    {/* STEP 3 */}
    <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:14,padding:"20px"}}>
      <div style={{color:C.mut,fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14}}>{t.bm_step3}</div>
      {!importedData&&!loading&&!fetchingData&&<div style={{textAlign:"center",padding:"24px 0"}}>
        <div style={{fontSize:36,marginBottom:10}}>📭</div>
        <div style={{color:C.txt,fontWeight:600,fontSize:14,marginBottom:6}}>{t.bm_noData}</div>
        <div style={{color:C.mut,fontSize:13}}>{t.bm_noDataSub}</div>
      </div>}
      {importedData&&!analysis&&!loading&&<>
        <div style={{background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:12,padding:"14px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{fontSize:18}}>✅</span><span style={{color:C.grn,fontWeight:700,fontSize:14}}>{t.bm_dataTitle}</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <div style={{color:C.mut,fontSize:12}}>{t.bm_source}: <span style={{color:C.txt,fontWeight:600}}>{importedData.title||importedData.source}</span></div>
            {importedData.dateRange&&<div style={{color:C.mut,fontSize:12}}>{t.bm_dateRange}: <span style={{color:C.txt,fontWeight:600}}>{importedData.dateRange}</span></div>}
            <div style={{color:C.mut,fontSize:12}}>{t.bm_date}: <span style={{color:C.txt,fontWeight:600}}>{new Date(importedData.timestamp).toLocaleString(sr?"sr-RS":"en-US")}</span></div>
            {importedData.screenshot
              ? <div style={{color:C.mut,fontSize:12}}>Tip: <span style={{color:C.grn,fontWeight:600}}>Screenshot ✓</span></div>
              : <div style={{color:C.mut,fontSize:12}}>{t.bm_tables}: <span style={{color:C.txt,fontWeight:600}}>{importedData.tables.length} ({importedData.tables.reduce((a,tb)=>a+tb.rows.length,0)} {t.bm_rows})</span></div>
            }
          </div>
        </div>
        {importedData.screenshot&&<div style={{marginBottom:16}}>
          <img src={`data:${getImageMediaType(importedData.screenshot)};base64,${importedData.screenshot}`} alt="screenshot" style={{width:"100%",borderRadius:10,border:`1px solid ${C.brd}`}}/>
        </div>}
        <div style={{marginBottom:14}}>
          <Lbl c={sr?"Naziv klijenta (opciono)":"Client name (optional)"}/>
          {!showNewClientInput&&<select value={clientName} onChange={e=>{
              if(e.target.value==="__new__"){ setShowNewClientInput(true); setClientName(""); }
              else setClientName(e.target.value);
            }} style={{width:"100%",padding:"13px 12px",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:10,color:C.txt,fontSize:14,outline:"none",boxSizing:"border-box"}}>
            <option value="" style={{color:"#111"}}>{sr?"— Bez klijenta —":"— No client —"}</option>
            {clientsList.map(c=><option key={c.id} value={c.name} style={{color:"#111"}}>{c.name}</option>)}
            <option value="__new__" style={{color:"#111"}}>+ {sr?"Novi klijent...":"New client..."}</option>
          </select>}
          {showNewClientInput&&<div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}><TIn v={clientName} ch={setClientName} ph={sr?"npr. Sport Reality MNE":"e.g. Sport Reality MNE"}/></div>
            <button onClick={()=>{setShowNewClientInput(false);setClientName("");}} style={{background:"none",border:`1px solid ${C.brd}`,borderRadius:10,color:C.mut,fontSize:12,padding:"0 14px",cursor:"pointer"}}>{sr?"Odustani":"Cancel"}</button>
          </div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
          <div><Lbl c={sr?"Period od":"Period from"}/><DIn v={periodFrom} ch={setPeriodFrom}/></div>
          <div><Lbl c={sr?"Period do":"Period to"}/><DIn v={periodTo} ch={setPeriodTo}/></div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={analyze}>{t.bm_analyze}</Btn>
          <button onClick={clear} style={{background:"none",border:`1px solid ${C.brd}`,borderRadius:11,color:C.mut,fontSize:13,fontWeight:600,padding:"13px 16px",cursor:"pointer"}}>{t.bm_clear}</button>
        </div>
      </>}
      {loading&&<div style={{textAlign:"center",padding:"24px 0"}}>
        <div style={{fontSize:32,marginBottom:12}}>✦</div>
        <div style={{color:C.acl,fontWeight:700,fontSize:15,marginBottom:16}}>{t.bm_analyzing}</div>
        {[1,2,3,4].map(i=><div key={i} style={{height:12,background:"rgba(255,255,255,0.06)",borderRadius:6,width:i===4?"50%":"100%",marginBottom:8}}/>)}
      </div>}
      {analysis&&!loading&&<>
        <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"16px",marginBottom:16}}>
          <div style={{color:C.acl,fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>Analiza · {importedData?.title||importedData?.source}</div>
          <MD2 text={analysis}/>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>setAnalysis("")} sec>{sr?"← Nazad na podatke":"← Back to data"}</Btn>
          <Btn onClick={clear} sec>{t.bm_clear}</Btn>
        </div>
      </>}
    </div>
  </div>;
}

// ── MODULE 10: MOJI KLIJENTI ─────────────────────────────────────────────────
function MyClientsMod({t,lang,goMod}){
  const sr=lang==="sr";
  const [clients,setClients]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState(null);
  const [analyses,setAnalyses]=useState([]);
  const [loadingA,setLoadingA]=useState(false);
  const [expanded,setExpanded]=useState(null);
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
    setLoadingA(true);
    setAnalyses([]);
    setGa4(null);
    setGa4Loading(true);
    setGads(null);
    setGadsLoading(true);
    fetch(`/api/analyses?client_id=${client.id}&limit=20`)
      .then(r=>r.json())
      .then(data=>{ setAnalyses(Array.isArray(data)?data:[]); setLoadingA(false); })
      .catch(()=>setLoadingA(false));
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
      await fetch("/api/ga4-connect",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({user_id:uid,client_id:ga4Setup.client_id,property_id:prop.property_id,property_name:prop.property_name,refresh_token:ga4Setup.refresh_token})
      });
      setGa4({property_id:prop.property_id,property_name:prop.property_name});
      setGa4Setup(null);
    }catch(e){}
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
      await fetch("/api/google-ads-connect",{
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
      setGads({customer_id:acc.customer_id,manager_id:acc.manager_id,account_name:acc.account_name,currency_code:acc.currency_code});
      setGadsSetup(null);
    }catch(e){}
    setGadsSaving(false);
  };

  const toolLabel=(tool)=>{
    const map={bookmark:sr?"Uvoz":"Import",report_single:"Report Generator",report_compare:"Report Generator (Comparison)"};
    return map[tool]||tool;
  };

  const deleteAnalysis=async(id)=>{
    if(!window.confirm(sr?"Obriši ovu analizu?":"Delete this analysis?")) return;
    try{
      await fetch(`/api/analyses?id=${id}`,{method:"DELETE"});
      setAnalyses(prev=>prev.filter(a=>a.id!==id));
    }catch(e){}
  };

  const deleteClient=async(id)=>{
    if(!window.confirm(sr?"Obriši klijenta i sve njegove analize?":"Delete client and all their analyses?")) return;
    try{
      await fetch(`/api/clients?id=${id}`,{method:"DELETE"});
      setClients(prev=>prev.filter(c=>c.id!==id));
    }catch(e){}
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
      const r=await fetch(`/api/clients?id=${selected.id}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:renameValue.trim()})
      });
      const updated=await r.json();
      if(r.ok&&updated.id){
        setSelected(s=>({...s,name:updated.name}));
        setClients(prev=>prev.map(c=>c.id===updated.id?{...c,name:updated.name}:c));
        setRenaming(false);
      }
    }catch(e){}
    setRenamingSaving(false);
  };

  if(selected) return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      <button onClick={()=>{setSelected(null);setAnalyses([]);}} style={{background:"none",border:"none",color:C.acl,cursor:"pointer",fontSize:13,fontWeight:600,padding:0}}>← {sr?"Svi klijenti":"All clients"}</button>
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
    <p style={{color:C.mut,fontSize:13,margin:"0 0 16px"}}>{sr?"Istorija analiza":"Analysis history"}</p>

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

    {loadingA&&<div style={{textAlign:"center",padding:"24px 0"}}>
      <div style={{color:C.acl,fontSize:14}}>✦ {sr?"Učitavam...":"Loading..."}</div>
    </div>}

    {!loadingA&&analyses.length===0&&<div style={{textAlign:"center",padding:"32px 0"}}>
      <div style={{fontSize:32,marginBottom:10}}>📭</div>
      <div style={{color:C.mut,fontSize:14}}>{sr?"Nema analiza za ovog klijenta.":"No analyses for this client."}</div>
    </div>}

    {analyses.map((a,i)=><div key={a.id} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,marginBottom:10,overflow:"hidden"}}>
      <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div onClick={()=>setExpanded(expanded===i?null:i)} style={{cursor:"pointer",flex:1}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:13}}>{toolLabel(a.tool)}</div>
          <div style={{color:C.mut,fontSize:11,marginTop:3}}>
            {a.period_from&&a.period_to?`${a.period_from} → ${a.period_to}`:a.period_from||""}
            {" · "}{new Date(a.created_at).toLocaleDateString(sr?"sr-RS":"en-US")}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>deleteAnalysis(a.id)} style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,color:C.red,fontSize:11,fontWeight:600,padding:"4px 10px",cursor:"pointer"}}>
            {sr?"Obriši":"Delete"}
          </button>
          <span onClick={()=>setExpanded(expanded===i?null:i)} style={{color:C.mut,fontSize:12,cursor:"pointer"}}>{expanded===i?"▲":"▼"}</span>
        </div>
      </div>
      {expanded===i&&<div style={{padding:"0 16px 16px",borderTop:`1px solid ${C.brd}`}}>
        <div style={{color:"rgba(255,255,255,0.75)",fontSize:12,lineHeight:1.8,whiteSpace:"pre-wrap",paddingTop:12}}>{a.analysis_text}</div>
      </div>}
    </div>)}
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

    {loading&&<div style={{textAlign:"center",padding:"32px 0"}}>
      <div style={{color:C.acl,fontSize:14}}>✦ {sr?"Učitavam klijente...":"Loading clients..."}</div>
    </div>}

    {!loading&&clients.length===0&&<div style={{textAlign:"center",padding:"32px 0"}}>
      <div style={{fontSize:40,marginBottom:12}}>👥</div>
      <div style={{color:C.txt,fontWeight:700,fontSize:15,marginBottom:8}}>{sr?"Još nema klijenata":"No clients yet"}</div>
      <div style={{color:C.mut,fontSize:13,marginBottom:20}}>{sr?"Klikni \"+ Novi klijent\" iznad da dodaš prvog klijenta. Posle ga po želji možeš povezati sa GA4 i Google Ads nalogom.":"Click \"+ New client\" above to add your first client. You can then connect it to GA4 and Google Ads if you want."}</div>
    </div>}

    {!loading&&clients.length>0&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      {clients.map(c=><div key={c.id} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
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

// ── MODULE 11: TIME MACHINE ───────────────────────────────────────────────────
function TimeMachineMod({t,lang}){
  const sr=lang==="sr";
  const [mode,setMode]=useState(null); // null=izbor, "period", "compare"
  const [clients,setClients]=useState([]);
  const [clientsLoading,setClientsLoading]=useState(true);
  const [selectedClient,setSelectedClient]=useState(null);
  const [period,setPeriod]=useState("7");
  const [customFrom,setCustomFrom]=useState("");
  const [customTo,setCustomTo]=useState("");
  const [periodA,setPeriodA]=useState({from:"",to:""});
  const [periodB,setPeriodB]=useState({from:"",to:""});
  const [loading,setLoading]=useState(false);
  const [report,setReport]=useState(null);
  const [chartData,setChartData]=useState([]);

  useEffect(()=>{
    const uid=localStorage.getItem("mat_user_id");
    if(!uid){ setClientsLoading(false); return; }
    fetch(`/api/clients?user_id=${uid}`)
      .then(r=>r.json())
      .then(data=>setClients(Array.isArray(data)?data:[]))
      .catch(()=>{}).finally(()=>setClientsLoading(false));
  },[]);

  const getDateRange=(p)=>{
    const to=new Date();
    const from=new Date();
    from.setDate(from.getDate()-parseInt(p));
    return{
      from:from.toISOString().split("T")[0],
      to:to.toISOString().split("T")[0]
    };
  };

  const extractMetrics=(analysisText)=>{
    const metrics={};
    const patterns=[
      {key:"roas",regex:/ROAS[:\s]+([0-9.,]+)/i},
      {key:"revenue",regex:/revenue[:\s]+[€$]?([0-9.,]+)/i},
      {key:"spend",regex:/spend[:\s]+[€$]?([0-9.,]+)|potrošnja[:\s]+[€$]?([0-9.,]+)/i},
      {key:"cpa",regex:/CPA[:\s]+[€$]?([0-9.,]+)/i},
    ];
    patterns.forEach(({key,regex})=>{
      const m=analysisText.match(regex);
      if(m){
        const val=parseFloat((m[1]||m[2]||"0").replace(",","."));
        if(!isNaN(val)) metrics[key]=val;
      }
    });
    return metrics;
  };

  const generate=async()=>{
    if(!selectedClient) return;
    setLoading(true); setReport(null); setChartData([]);
    try{
      let from,to,fromB,toB;
      if(mode==="period"){
        if(period==="custom"){ from=customFrom; to=customTo; }
        else{ const r=getDateRange(period); from=r.from; to=r.to; }
      } else {
        from=periodA.from; to=periodA.to;
        fromB=periodB.from; toB=periodB.to;
      }

      // Fetch analyses
      const urlA=`/api/analyses?client_id=${selectedClient.id}&from=${from}&to=${to}&limit=50`;
      const resA=await fetch(urlA);
      const analysesA=await resA.json();

      let analysesB=[];
      if(mode==="compare"&&fromB&&toB){
        const urlB=`/api/analyses?client_id=${selectedClient.id}&from=${fromB}&to=${toB}&limit=50`;
        const resB=await fetch(urlB);
        analysesB=await resB.json();
      }

      // Build chart data
      const chartPoints=analysesA
        .filter(a=>a.period_from)
        .map(a=>{
          const m=extractMetrics(a.analysis_text);
          return{date:a.period_from,...m,label:a.period_from};
        })
        .sort((a,b)=>new Date(a.date)-new Date(b.date));
      setChartData(chartPoints);

      // Build prompt
      const summaryA=analysesA.map((a,i)=>
        `Analiza ${i+1} (${a.period_from||"?"} → ${a.period_to||"?"}): ${a.analysis_text.substring(0,2000)}`
      ).join("\n\n---\n\n");

      const summaryB=analysesB.map((a,i)=>
        `Analiza ${i+1} (${a.period_from||"?"} → ${a.period_to||"?"}): ${a.analysis_text.substring(0,2000)}`
      ).join("\n\n---\n\n");

      if(analysesA.length===0){
        setReport({error:true,msg:sr?`Nema analiza za ${selectedClient.name} u ovom periodu. Dodaj analize prvo u Report Generator-u.`:`No analyses for ${selectedClient.name} in this period. Add analyses first in Report Generator.`});
        setLoading(false); return;
      }

      const prompt=sr
        ?`Ti si senior marketing analitičar. Napravi sintetizovani izveštaj za klijenta "${selectedClient.name}".

${mode==="compare"
  ?`PERIOD A (${from} → ${to}) – ${analysesA.length} analiza:\n${summaryA}\n\nPERIOD B (${fromB} → ${toB}) – ${analysesB.length} analiza:\n${summaryB}`
  :`PERIOD (${from} → ${to}) – ${analysesA.length} analiza:\n${summaryA}`}

Piši isključivo na srpskom jeziku, ekavski. NE koristi Markdown.

${mode==="compare"?"POREĐENJE PERIODA\n(Šta se promenilo između perioda A i B, koje metrike su porasle/pale)\n\n":""}EXECUTIVE SUMMARY
(2-3 rečenice – opšta ocena perioda)

KLJUČNI TRENDOVI
(Šta se dešavalo tokom perioda – da li performanse rastu, padaju ili su stabilne)

PROBLEMI
(Šta nije radilo dobro)

ŠTA RADI DOBRO
(Pozitivni trendovi)

PREPORUKE ZA SLEDEĆI PERIOD
(3-5 konkretnih akcija)

Budi konkretan, koristi brojke iz analiza.`
        :`You are a senior marketing analyst. Create a synthesized report for client "${selectedClient.name}".

${mode==="compare"
  ?`PERIOD A (${from} → ${to}) – ${analysesA.length} analyses:\n${summaryA}\n\nPERIOD B (${fromB} → ${toB}) – ${analysesB.length} analyses:\n${summaryB}`
  :`PERIOD (${from} → ${to}) – ${analysesA.length} analyses:\n${summaryA}`}

Do NOT use Markdown. Plain text only.

${mode==="compare"?"PERIOD COMPARISON\n(What changed between periods A and B)\n\n":""}EXECUTIVE SUMMARY
KEY TRENDS
ISSUES
WHAT'S WORKING
RECOMMENDATIONS FOR NEXT PERIOD

Be specific, use numbers from the analyses.`;

      const res=await fetch("/api/analyze",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
      setReport({text:data.content?.[0]?.text||"",client:selectedClient.name,from,to,fromB,toB,count:analysesA.length,countB:analysesB.length,mode});
    }catch(e){ setReport({error:true,msg:sr?"Greška pri generisanju.":"Error generating report."}); }
    setLoading(false);
  };

  // Simple line chart component
  const LineChart=({data,metric,color,label})=>{
    if(!data||data.length<2) return null;
    const vals=data.map(d=>d[metric]).filter(v=>v!=null&&!isNaN(v));
    if(vals.length<2) return null;
    const min=Math.min(...vals);
    const max=Math.max(...vals);
    const range=max-min||1;
    const w=300; const h=80; const pad=10;
    const pts=vals.map((v,i)=>{
      const x=pad+(i/(vals.length-1))*(w-pad*2);
      const y=h-pad-((v-min)/range)*(h-pad*2);
      return`${x},${y}`;
    }).join(" ");
    return <div style={{marginBottom:16}}>
      <div style={{color:C.mut,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:6}}>{label}</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:80,display:"block"}}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {vals.map((v,i)=>{
          const x=pad+(i/(vals.length-1))*(w-pad*2);
          const y=h-pad-((v-min)/range)*(h-pad*2);
          return <g key={i}>
            <circle cx={x} cy={y} r="4" fill={color}/>
            <text x={x} y={y-8} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">{v}</text>
          </g>;
        })}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        {data.filter(d=>d[metric]!=null).map((d,i)=><div key={i} style={{color:C.dim,fontSize:10}}>{d.date}</div>)}
      </div>
    </div>;
  };

  const periods=[{v:"7",l:sr?"7 dana":"7 days"},{v:"14",l:sr?"14 dana":"14 days"},{v:"30",l:sr?"30 dana":"30 days"},{v:"custom",l:sr?"Custom":"Custom"}];

  // REPORT
  if(report) return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 4px"}}>⏱️ Time Machine</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 20px"}}>{report.client} · {report.from} → {report.to}</p>

    {report.error&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"16px",color:C.red,fontSize:13,marginBottom:16}}>{report.msg}</div>}

    {!report.error&&<>
      {/* Charts */}
      {chartData.length>=2&&<div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",marginBottom:16}}>
        <div style={{color:C.acl,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginBottom:14}}>{sr?"Grafikon trendova":"Trend Charts"}</div>
        <LineChart data={chartData} metric="roas" color="#6366F1" label="ROAS"/>
        <LineChart data={chartData} metric="revenue" color="#34D399" label={sr?"Revenue (€)":"Revenue (€)"}/>
        <LineChart data={chartData} metric="spend" color="#F97316" label={sr?"Potrošnja (€)":"Spend (€)"}/>
        <LineChart data={chartData} metric="cpa" color="#F59E0B" label="CPA (€)"/>
      </div>}

      {chartData.length<2&&chartData.length>0&&<div style={{background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:12,padding:"14px",marginBottom:16}}>
        <div style={{color:C.yel,fontSize:12}}>⚠️ {sr?"Samo 1 analiza u periodu – grafikon zahteva 2+ analiza.":"Only 1 analysis in period – chart requires 2+ analyses."}</div>
      </div>}

      {/* Report text */}
      <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"16px",marginBottom:16}}>
        <div style={{color:C.acl,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginBottom:12}}>
          {sr?`Sintetizovani izveštaj · ${report.count} analiza`:`Synthesized report · ${report.count} analyses`}
        </div>
        <MD2 text={report.text}/>
      </div>
    </>}

    <Btn onClick={()=>{setReport(null);setChartData([]);}} sec>{sr?"← Novi izveštaj":"← New Report"}</Btn>
  </div>;

  // LOADING
  if(loading) return <div style={{textAlign:"center",padding:"40px 0"}}>
    <div style={{fontSize:36,marginBottom:16}}>⏱️</div>
    <div style={{color:C.acl,fontWeight:700,fontSize:15,marginBottom:8}}>{sr?"Time Machine analizira...":"Time Machine analyzing..."}</div>
    <div style={{color:C.mut,fontSize:13,marginBottom:20}}>{sr?"Sintetizujem sve analize iz perioda...":"Synthesizing all analyses from the period..."}</div>
    {[1,2,3,4].map(i=><div key={i} style={{height:12,background:"rgba(255,255,255,0.06)",borderRadius:6,width:i===4?"50%":"100%",marginBottom:8,maxWidth:400,margin:"0 auto 8px"}}/>)}
  </div>;

  // FORM
  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>⏱️ Time Machine</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 24px"}}>{t.m11s}</p>

    {/* Izbor klijenta */}
    <div style={{marginBottom:20}}>
      <Lbl c={sr?"Izaberi klijenta":"Select client"}/>
      {clientsLoading
        ?<div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",color:C.acl,fontSize:13,textAlign:"center"}}>
          ✦ {sr?"Učitavam klijente...":"Loading clients..."}
        </div>
        :clients.length===0
        ?<div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"16px",color:C.mut,fontSize:13,textAlign:"center"}}>
          {sr?"Nema klijenata. Dodaj klijenta u Clients ili napravi analizu u Report Generator-u.":"No clients. Add a client in Clients or create an analysis in Report Generator."}
        </div>
        :<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {clients.map(c=><button key={c.id} onClick={()=>setSelectedClient(c)} style={{background:selectedClient?.id===c.id?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.03)",border:`1px solid ${selectedClient?.id===c.id?"rgba(99,102,241,0.5)":C.brd}`,borderRadius:10,padding:"12px 16px",textAlign:"left",cursor:"pointer",color:selectedClient?.id===c.id?C.acl:C.txt,fontWeight:600,fontSize:13}}>
            👤 {c.name}
          </button>)}
        </div>
      }
    </div>

    {selectedClient&&<>
      {/* Izbor moda */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button onClick={()=>setMode("period")} style={{flex:1,padding:"10px",borderRadius:10,border:`1px solid ${mode==="period"?"rgba(99,102,241,0.6)":C.brd}`,background:mode==="period"?"rgba(99,102,241,0.15)":"transparent",color:mode==="period"?C.acl:C.mut,fontSize:13,fontWeight:600,cursor:"pointer"}}>
          📈 {sr?"Period Report":"Period Report"}
        </button>
        <button onClick={()=>setMode("compare")} style={{flex:1,padding:"10px",borderRadius:10,border:`1px solid ${mode==="compare"?"rgba(52,211,153,0.6)":C.brd}`,background:mode==="compare"?"rgba(52,211,153,0.15)":"transparent",color:mode==="compare"?C.grn:C.mut,fontSize:13,fontWeight:600,cursor:"pointer"}}>
          📊 {sr?"Poređenje":"Comparison"}
        </button>
      </div>

      {mode==="period"&&<>
        <Lbl c={sr?"Period":"Period"}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {periods.map(p=><button key={p.v} onClick={()=>setPeriod(p.v)} style={{padding:"8px 16px",borderRadius:20,border:`1px solid ${period===p.v?"rgba(99,102,241,0.6)":C.brd}`,background:period===p.v?"rgba(99,102,241,0.2)":"transparent",color:period===p.v?C.acl:C.mut,fontSize:13,fontWeight:600,cursor:"pointer"}}>{p.l}</button>)}
        </div>
        {period==="custom"&&<div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          <div><Lbl c={sr?"Od":"From"}/><DIn v={customFrom} ch={setCustomFrom}/></div>
          <div><Lbl c={sr?"Do":"To"}/><DIn v={customTo} ch={setCustomTo}/></div>
        </div>}
        <Btn onClick={generate} disabled={period==="custom"&&(!customFrom||!customTo)}>{sr?"⏱️ Generiši izveštaj →":"⏱️ Generate report →"}</Btn>
      </>}

      {mode==="compare"&&<>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
          <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"14px"}}>
            <div style={{color:C.acl,fontWeight:700,fontSize:12,marginBottom:10}}>Period A</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div><Lbl c={sr?"Od":"From"}/><DIn v={periodA.from} ch={v=>setPeriodA(p=>({...p,from:v}))}/></div>
              <div><Lbl c={sr?"Do":"To"}/><DIn v={periodA.to} ch={v=>setPeriodA(p=>({...p,to:v}))}/></div>
            </div>
          </div>
          <div style={{background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:12,padding:"14px"}}>
            <div style={{color:C.grn,fontWeight:700,fontSize:12,marginBottom:10}}>Period B</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div><Lbl c={sr?"Od":"From"}/><DIn v={periodB.from} ch={v=>setPeriodB(p=>({...p,from:v}))}/></div>
              <div><Lbl c={sr?"Do":"To"}/><DIn v={periodB.to} ch={v=>setPeriodB(p=>({...p,to:v}))}/></div>
            </div>
          </div>
        </div>
        <Btn onClick={generate} disabled={!periodA.from||!periodA.to||!periodB.from||!periodB.to}>{sr?"⏱️ Uporedi periode →":"⏱️ Compare periods →"}</Btn>
      </>}
    </>}
  </div>;
}

function ProductIntelligenceMod({t,lang}){
  const sr=lang==="sr";
  const [clients,setClients]=useState([]);
  const [clientsLoading,setClientsLoading]=useState(true);
  const [selectedClient,setSelectedClient]=useState(null);
  const [period,setPeriod]=useState("30");
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

  // Ponovo generiši AI uvid ako korisnik promeni jezik dok su podaci već učitani
  useEffect(()=>{
    if(lastData.current) generateBrief(lastData.current);
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
      generateBrief(d);
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
      </div>
    </div>

    {period==="custom"&&<div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:16,flexWrap:"wrap",background:"rgba(255,255,255,0.02)",border:`1px solid ${C.brd}`,borderRadius:12,padding:"12px 14px"}}>
      <div style={{flex:1,minWidth:140}}><Lbl c={sr?"Od":"From"}/><DIn v={customFrom} ch={setCustomFrom}/></div>
      <div style={{flex:1,minWidth:140}}><Lbl c={sr?"Do":"To"}/><DIn v={customTo} ch={setCustomTo}/></div>
      <button onClick={applyCustom} disabled={!customFrom||!customTo} style={{padding:"12px 18px",borderRadius:10,border:"none",background:!customFrom||!customTo?"rgba(99,102,241,0.3)":"linear-gradient(135deg,#6366F1,#4f46e5)",color:"#fff",fontSize:13,fontWeight:700,cursor:!customFrom||!customTo?"default":"pointer"}}>{sr?"Primeni":"Apply"}</button>
    </div>}

    {loading&&<div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontSize:36,marginBottom:16}}>🛍️</div>
      <div style={{color:C.acl,fontWeight:700,fontSize:15}}>{sr?"Učitavam GA4 podatke...":"Loading GA4 data..."}</div>
    </div>}

    {err==="no_ga4"&&!loading&&<div style={{background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:12,padding:"16px",color:C.txt,fontSize:13,marginBottom:16}}>
      🔗 {sr?"GA4 nije povezan za ovog klijenta. Idi u":"GA4 is not connected for this client. Go to"} <b>Clients</b> {sr?"da ga povežeš.":"to connect it."}
    </div>}
    {err&&err!=="no_ga4"&&!loading&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"16px",color:C.red,fontSize:13,marginBottom:16}}>⚠️ {err}</div>}

    {data&&!loading&&<>
      <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
        <div style={{color:C.acl,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",marginBottom:8}}>{sr?"AI Uvid":"AI Insight"}</div>
        {aiLoading
          ?<div style={{color:C.mut,fontSize:13}}>{sr?"Analiziram...":"Analyzing..."}</div>
          :<div style={{color:C.txt,fontSize:13,lineHeight:1.7}}>
            {aiBrief.split("\n").filter(l=>l.trim()).map((line,i)=>{
              const idx=line.indexOf(":");
              if(idx===-1) return <div key={i}>{line}</div>;
              return <div key={i}><b>{line.slice(0,idx+1)}</b>{line.slice(idx+1)}</div>;
            })}
          </div>
        }
      </div>

      <div style={{color:C.mut,fontSize:12,marginBottom:14}}>
        {fmtMoney(Object.values(data.sourceTotals.paid).reduce((a,b)=>a+b,0)+Object.values(data.sourceTotals.organic).reduce((a,b)=>a+b,0),data.currency)} {sr?"ukupan prihod za period":"total revenue for period"}
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

      {filter==="sources"&&<div style={{marginBottom:10}}>
        <Lbl c={sr?"💰 Plaćeno":"💰 Paid"}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {["meta","google","tiktok"].map(p=><button key={p} onClick={()=>{setPaidOrganic("paid");setSourcePlatform(p);setSearch("");setVisibleCount(50);}} style={{flex:"1 1 100px",padding:"10px",borderRadius:10,border:`1px solid ${paidOrganic==="paid"&&sourcePlatform===p?"rgba(0,212,255,0.6)":C.brd}`,background:paidOrganic==="paid"&&sourcePlatform===p?"rgba(0,212,255,0.15)":"rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"left"}}>
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

      {filter==="categories"&&data.hasCategories===false&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Ovaj klijent nema podešene kategorije proizvoda u GA4-u.":"This client doesn't have product categories set up in GA4."}</div>}

      {rows.length===0&&filter!=="categories"&&(filter!=="sources"||(paidOrganic&&sourcePlatform))&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Nema proizvoda u ovoj kategoriji za izabrani period.":"No products in this category for the selected period."}</div>}

      {visibleRows.length>0&&<div style={{overflowX:"auto"}}>
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
            {visibleRows.map((r,i)=><tr key={i} style={{borderTop:`1px solid ${C.brd}`}}>
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
      {messages.map((m,i)=><div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"80%",background:m.role==="user"?"rgba(99,102,241,0.2)":"rgba(255,255,255,0.05)",border:`1px solid ${m.role==="user"?"rgba(99,102,241,0.4)":C.brd}`,borderRadius:12,padding:"10px 14px",color:C.txt,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.text}</div>)}
      {sending&&<div style={{alignSelf:"flex-start",color:C.mut,fontSize:13}}>{sr?"Razmišljam...":"Thinking..."}</div>}
    </div>

    <div style={{display:"flex",gap:8}}>
      <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={sr?"Postavi pitanje...":"Ask a question..."} disabled={sending} style={{flex:1,padding:"12px 14px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.05)",color:C.txt,fontSize:14,boxSizing:"border-box"}}/>
      <button onClick={send} disabled={sending||!input.trim()} style={{padding:"12px 20px",borderRadius:10,border:"none",background:sending||!input.trim()?"rgba(99,102,241,0.3)":"linear-gradient(135deg,#6366F1,#4f46e5)",color:"#fff",fontSize:13,fontWeight:700,cursor:sending||!input.trim()?"default":"pointer",whiteSpace:"nowrap"}}>{sr?"Pošalji":"Send"}</button>
    </div>
  </div>;
}

function CampaignsMod({t,lang}){
  const sr=lang==="sr";
  const [clients,setClients]=useState([]);
  const [clientsLoading,setClientsLoading]=useState(true);
  const [selectedClient,setSelectedClient]=useState(null);
  const [period,setPeriod]=useState("30");
  const [customFrom,setCustomFrom]=useState("");
  const [customTo,setCustomTo]=useState("");
  const [mode,setMode]=useState("byCampaign"); // byCampaign | byProduct | byCategory
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);
  const [err,setErr]=useState("");
  const [newClientOpen,setNewClientOpen]=useState(false);
  const [newClientName,setNewClientName]=useState("");
  const [creatingClient,setCreatingClient]=useState(false);

  // Drill-down (samo unutar "Po kampanji")
  const [drillCampaign,setDrillCampaign]=useState(null);
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
    {v:"byCategory",l:sr?"📁 Po kategoriji":"📁 By category"}
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
      {loading&&<div style={{textAlign:"center",padding:"40px 0"}}>
        <div style={{fontSize:36,marginBottom:16}}>📢</div>
        <div style={{color:C.acl,fontWeight:700,fontSize:15}}>{sr?"Učitavam podatke...":"Loading data..."}</div>
      </div>}

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
        {(data.showSpendNative||data.showRevenueNative)&&<div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:12,padding:"12px 16px",color:C.yel,fontSize:12,marginBottom:16}}>
          ℹ️ {sr?`Prikazano u EUR kao glavnoj valuti (originalna valuta ispod, malim slovima), konvertovano po kursu iz ${data.rateDate?new Date(data.rateDate).toLocaleDateString("sr-RS"):"?"}.`:`Shown in EUR as the primary currency (original currency below, in small text), converted using the exchange rate from ${data.rateDate?new Date(data.rateDate).toLocaleDateString():"?"}.`}
        </div>}

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:20}}>
          <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px"}}>
            <div style={{color:C.mut,fontSize:11,marginBottom:4}}>{sr?"Ukupan spend":"Total spend"}</div>
            <div style={{color:C.txt,fontSize:18,fontWeight:800}}>{fmtMoney(data.totalSpendEUR,"EUR")}</div>
            {data.showSpendNative&&<div style={{color:C.mut,fontSize:11,marginTop:2}}>≈ {fmtMoney(data.totalSpend,data.gadsCurrency)}</div>}
          </div>
          <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px"}}>
            <div style={{color:C.mut,fontSize:11,marginBottom:4}}>{sr?"Ukupan prihod":"Total revenue"}</div>
            <div style={{color:C.grn,fontSize:18,fontWeight:800}}>{fmtMoney(data.totalRevenueEUR,"EUR")}</div>
            {data.showRevenueNative&&<div style={{color:C.mut,fontSize:11,marginTop:2}}>≈ {fmtMoney(data.totalRevenue,data.currency)}</div>}
          </div>
          <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"14px"}}>
            <div style={{color:C.mut,fontSize:11,marginBottom:4}}>ROAS</div>
            <div style={{color:C.acl,fontSize:18,fontWeight:800}}>{data.totalRoas.toFixed(2)}x</div>
          </div>
        </div>

        {data.campaigns.length===0&&<div style={{color:C.mut,fontSize:13,textAlign:"center",padding:"20px 0"}}>{sr?"Nema kampanja sa potrošnjom u ovom periodu.":"No campaigns with spend in this period."}</div>}

        {data.campaigns.length>0&&<input value={campaignSearch} onChange={e=>setCampaignSearch(e.target.value)} placeholder={sr?"🔍 Pretraži kampanju...":"🔍 Search campaign..."} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1px solid ${C.brd}`,background:"rgba(255,255,255,0.03)",color:C.txt,fontSize:13,marginBottom:10,boxSizing:"border-box"}}/>}

        {data.campaigns.length>0&&<div style={{overflowX:"auto",marginBottom:16}}>
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
              {filteredCampaigns().map((c,i)=><tr key={i} onClick={()=>openCampaign(c)} style={{borderTop:`1px solid ${C.brd}`,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"8px 4px",color:C.acl,textDecoration:"underline"}}>{c.campaign_name} <span style={{color:C.mut}}>({c.campaign_id})</span></td>
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
                <td style={{padding:"8px 4px",textAlign:"right",fontWeight:700,color:c.roas>=1?C.grn:C.red}}>{c.roas.toFixed(2)}x</td>
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
        <h3 style={{fontSize:16,fontWeight:800,margin:"0 0 4px"}}>{drillCampaign.campaign_name}</h3>
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
                <td style={{padding:"7px 4px",color:C.txt}}>{r.campaign_name} <span style={{color:C.mut}}>({r.campaign_id})</span></td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{r.productViewed.toLocaleString()}</td>
                <td style={{padding:"7px 4px",textAlign:"right",fontWeight:600,color:C.txt}}>{r.productPurchased.toLocaleString()}</td>
                <td style={{padding:"7px 4px",textAlign:"right",color:C.grn}}>
                  {fmtMoney(r.productRevenueEUR,"EUR")}
                  {byProductData.showRevenueNative&&<div style={{color:C.mut,fontSize:10}}>≈ {fmtMoney(r.productRevenue,byProductData.currency)}</div>}
                </td>
                <td style={{padding:"7px 4px",textAlign:"right",fontWeight:700,color:r.campaignRoas>=1?C.grn:C.red}}>{r.campaignRoas.toFixed(2)}x</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </>}
    </div>}

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
                  <td style={{padding:"7px 4px",color:C.txt}}>{r.campaign_name} <span style={{color:C.mut}}>({r.campaign_id})</span></td>
                  <td style={{padding:"7px 4px",textAlign:"right",color:C.mut}}>{r.categoryViewed.toLocaleString()}</td>
                  <td style={{padding:"7px 4px",textAlign:"right",fontWeight:600,color:C.txt}}>{r.categoryPurchased.toLocaleString()}</td>
                  <td style={{padding:"7px 4px",textAlign:"right",color:C.grn}}>
                    {fmtMoney(r.categoryRevenueEUR,"EUR")}
                    {categoryData.showRevenueNative&&<div style={{color:C.mut,fontSize:10}}>≈ {fmtMoney(r.categoryRevenue,categoryData.currency)}</div>}
                  </td>
                  <td style={{padding:"7px 4px",textAlign:"right",fontWeight:700,color:r.campaignRoas>=1?C.grn:C.red}}>{r.campaignRoas.toFixed(2)}x</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </>}
      </div>}
    </div>}
  </div>;
}

const MODS=[
  {id:14,icon:"📢",col:"#84CC16",tk:"m14t",sk:"m14s",grp:"an"},
  {id:12,icon:"🛍️",col:"#F43F5E",tk:"m12t",sk:"m12s",grp:"an"},
  {id:13,icon:"💬",col:"#22D3EE",tk:"m13t",sk:"m13s",grp:"an"},
  {id:2,icon:"💰",col:"#10B981",tk:"m2t",sk:"m2s",grp:"dw"},
  {id:15,icon:"📑",col:"#F59E0B",tk:"m15t",sk:"m15s",grp:"dw"},
  {id:8,icon:"📄",col:"#F97316",tk:"m8t",sk:"m8s",grp:"dw"},
  {id:11,icon:"⏱️",col:"#EC4899",tk:"m11t",sk:"m11s",grp:"dw"},
  {id:10,icon:"👥",col:"#A855F7",tk:"m10t",sk:"m10s",grp:"dw"},
  {id:1,icon:"📊",col:"#6366F1",tk:"m1t",sk:"m1s",grp:"dw"},
  // mod=9 ostaje dostupan samo preko adrese (stari bookmarklet/ekstenzija), ne prikazuje se u meniju
  {id:9,icon:"🔗",col:"#00D4FF",tk:"m9t",sk:"m9s",grp:"dw",hidden:true},
];
const VISIBLE_MODS=MODS.filter(m=>!m.hidden);
const MOD_GROUPS=[{k:"an",tk:"grpAn"},{k:"dw",tk:"grpDw"}];
const gridCols=n=>n<=4?n:3;
const CARD_CSS=`.mc{transition:transform .18s ease,border-color .18s ease}
.mc:hover{transform:translateY(-4px);border-color:var(--c)!important}
.mc .mc-op{opacity:0;transform:translateX(-8px);transition:opacity .2s ease,transform .2s ease}
.mc:hover .mc-op,.mc:focus-visible .mc-op{opacity:1;transform:none}
@media (hover:none){.mc:hover{transform:none}.mc .mc-op{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mc,.mc .mc-op{transition:none}.mc:hover{transform:none}}
.mc .mc-ic{transition:transform .2s ease}
.mc:hover .mc-ic{transform:scale(1.12) rotate(-6deg)}
.mc .mc-txt{display:grid}
.mc .mc-txt>*{grid-area:1/1}
.mc .mc-desc,.mc .mc-live{transition:opacity .18s ease}
.mc .mc-live{opacity:0;visibility:hidden}
@media (hover:hover){.mc:hover .mc-desc.has-live{opacity:0;visibility:hidden}.mc:hover .mc-live{opacity:1;visibility:visible}}
@media (hover:none){.mc .mc-txt{display:block}.mc .mc-live{opacity:1;visibility:visible}.mc:hover .mc-ic{transform:none}}
@media (prefers-reduced-motion:reduce){.mc .mc-ic,.mc .mc-desc,.mc .mc-live{transition:none}.mc:hover .mc-ic{transform:none}}`;

// ── RESPONSIVE HOOK ──────────────────────────────────────────────────────────
function useWindowSize(){
  const [w,setW]=useState(window.innerWidth);
  useEffect(()=>{const h=()=>setW(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  return w;
}

export default function App(){
  const [lang,setLang]=useState(()=>localStorage.getItem("mat_lang")||"sr");
  const [mod,setMod]=useState(()=>{
    const params=new URLSearchParams(window.location.search);
    const m=params.get("mod");
    return m?parseInt(m):null;
  });
  const [showQR,setShowQR]=useState(false);
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
    if(id) window.history.pushState({},"",`?mod=${id}`);
    else window.history.pushState({},"",window.location.pathname);
  };

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

  const Comp=mod===1?HealthMod:mod===8?ReportMod:mod===9?BookmarkMod:mod===10?MyClientsMod:mod===11?TimeMachineMod:mod===12?ProductIntelligenceMod:mod===13?AskDataMod:mod===14?CampaignsMod:mod===2?BudgetPacingMod:mod===15?ReportStudioMod:null;
  // Nepostojeci ili obrisani modul (npr. stari link ?mod=3) vodi na pocetni ekran
  const showHome=!mod||!Comp;

  // Ziva kartica Budget Pacing: stanje budzeta za tekuci mesec
  const [bpLive,setBpLive]=useState(null);
  useEffect(()=>{
    if(!showHome) return;
    const uid=localStorage.getItem("mat_user_id");
    if(!uid) return;
    const d=new Date(); const r=bpMonthRange(d.getFullYear(),d.getMonth());
    let cancelled=false;
    fetch(`/api/budgets?user_id=${uid}&from=${r.from}&to=${r.to}`).then(x=>x.ok?x.json():[]).then(list=>{
      if(cancelled||!Array.isArray(list)||!list.length){ if(!cancelled) setBpLive(null); return; }
      const c=bpSummary(list,bpToday());
      const problems=(c.under||0)+(c.over||0)+(c.no_spend||0);
      const parts=[];
      if(c.under) parts.push(`${c.under} underspend`);
      if(c.over) parts.push(`${c.over} overspend`);
      if(c.no_spend) parts.push(`${c.no_spend} ${lang==="sr"?"bez potrošnje":"no spend"}`);
      if(c.ok) parts.push(`${c.ok} ${lang==="sr"?"na tempu":"on pace"}`);
      if(!parts.length) parts.push(`${list.length} ${lang==="sr"?"budžeta":"budgets"}`);
      setBpLive({text:parts.join(" · "),bad:problems>0});
    }).catch(()=>{ if(!cancelled) setBpLive(null); });
    return()=>{cancelled=true;};
  },[showHome,lang]);

  const ModCard=({m,i,large})=>(
    <button className="mc" onClick={()=>goMod(m.id)} style={{
      "--c":m.col,
      background:`linear-gradient(145deg,${m.col}22,${m.col}08 60%,#0d0d1a)`,
      border:`1px solid ${m.col}45`,borderTop:`1px solid ${m.col}70`,
      borderRadius:16,padding:large?"22px 18px":"18px 15px",textAlign:"left",
      cursor:"pointer",display:"block",width:"100%",
      WebkitTapHighlightColor:"transparent",
      boxShadow:`0 4px 24px ${m.col}20`,
    }}>
      <div className="mc-ic" style={{width:large?48:40,height:large?48:40,borderRadius:12,background:`linear-gradient(135deg,${m.col}40,${m.col}20)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:large?24:20,marginBottom:large?14:12}}>{m.icon}</div>
      <div style={{color:"#fff",fontWeight:700,fontSize:large?15:13,marginBottom:4,lineHeight:1.3}}>{t[m.tk]}</div>
      {(()=>{const live=m.id===2&&bpLive?bpLive:null;return <div className="mc-txt" style={{marginBottom:large?14:12}}>
        <div className={live?"mc-desc has-live":"mc-desc"} style={{color:"rgba(255,255,255,0.45)",fontSize:large?12:11,lineHeight:1.5}}>{t[m.sk]}</div>
        {live&&<div className="mc-live" style={{color:live.bad?C.red:C.grn,fontSize:large?12:11,lineHeight:1.5,fontWeight:700}}>{live.text}</div>}
      </div>;})()}
      <div className="mc-op" style={{color:m.col,fontSize:12,fontWeight:700}}>{t.open} →</div>
    </button>
  );

  const GroupLabel=({g,mb})=><div style={{fontSize:11,fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(255,255,255,0.35)",marginBottom:mb}}>{t[g.tk]}</div>;

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  if(!isDesktop) return <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.txt}}>
    {showQR&&<QRModal/>}
    <style>{CARD_CSS}</style>
    <div style={{background:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.brd}`,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(10px)"}}>
      <div style={{display:"flex",alignItems:"center",gap:9,cursor:mod?"pointer":"default"}} onClick={()=>goMod(null)}>
        <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📊</div>
        <div style={{fontWeight:800,fontSize:15}}>{t.appTitle}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        {!showHome&&<button onClick={()=>goMod(null)} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:20,color:"#fff",fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer"}}>{t.back}</button>}
        <button onClick={()=>setShowQR(true)} style={{background:"rgba(99,102,241,0.2)",border:"none",borderRadius:20,color:C.acl,fontSize:12,fontWeight:600,padding:"7px 12px",cursor:"pointer"}} title="Poveži telefon">📱</button>
        <button onClick={handleEnableNotif} style={{background:notifStatus==="granted"?"rgba(52,211,153,0.2)":"rgba(251,191,36,0.2)",border:"none",borderRadius:20,color:notifStatus==="granted"?C.grn:C.yel,fontSize:14,padding:"7px 10px",cursor:"pointer"}} title="Notifikacije">🔔</button>
        {["sr","en"].map(l=><button key={l} onClick={()=>setLang(l)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",background:lang===l?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.07)",color:lang===l?"#A5B4FC":"rgba(255,255,255,0.4)"}}>{l.toUpperCase()}</button>)}
      </div>
    </div>
    <div style={{maxWidth:580,margin:"0 auto",padding:"0 0 40px"}}>
      {showHome&&<>
        <div style={{padding:"28px 16px 20px",background:"linear-gradient(180deg,rgba(99,102,241,0.08) 0%,transparent 100%)"}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"#A5B4FC",marginBottom:8}}>META ADS TOOLKIT</div>
          <h1 style={{fontSize:26,fontWeight:900,margin:"0 0 6px",letterSpacing:"-0.5px",lineHeight:1.2}}>{t.sel}</h1>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:13,margin:0}}>{t.selSub}</p>
        </div>
        {MOD_GROUPS.map(g=>{
          const list=VISIBLE_MODS.filter(m=>m.grp===g.k);
          return <div key={g.k} style={{padding:"0 12px",marginBottom:22}}>
            <div style={{paddingLeft:4}}><GroupLabel g={g} mb={10}/></div>
            <div style={{display:"grid",gridTemplateColumns:g.k==="an"?"1fr":"1fr 1fr",gap:12}}>
              {list.map((m,i)=><ModCard key={m.id} m={m} i={i} large={g.k==="an"}/>)}
            </div>
          </div>;
        })}
        <div style={{padding:"24px 16px 0",textAlign:"center"}}><div style={{color:"rgba(255,255,255,0.2)",fontSize:11}}>Meta Ads Toolkit · v1.0 · by aleksandarpopup</div></div>
      </>}
      {!showHome&&<div style={{padding:"20px 16px"}}><Comp t={t} lang={lang} goMod={goMod}/></div>}
    </div>
  </div>;

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  return <div style={{height:"100vh",background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.txt,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {showQR&&<QRModal/>}
    <style>{CARD_CSS}</style>

    {/* TOP NAV */}
    <div style={{background:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.brd}`,padding:"0 32px",display:"flex",justifyContent:"space-between",alignItems:"center",height:64,flexShrink:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>goMod(null)}>
        <div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19}}>📊</div>
        <div>
          <div style={{fontWeight:800,fontSize:17,letterSpacing:"-0.3px"}}>{t.appTitle}</div>
          <div style={{color:"rgba(255,255,255,0.35)",fontSize:11}}>{t.appSub}</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:20}}>
        {!showHome&&<div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>goMod(null)} style={{background:"rgba(255,255,255,0.08)",border:`1px solid ${C.brd}`,borderRadius:10,color:"rgba(255,255,255,0.7)",fontSize:13,fontWeight:600,padding:"7px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>← {t.back}</button>
          <div style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>
            <span style={{cursor:"pointer",color:"#A5B4FC"}} onClick={()=>goMod(null)}>{t.sel}</span>
            <span style={{margin:"0 8px",color:"rgba(255,255,255,0.2)"}}>›</span>
            <span style={{color:"#fff",fontWeight:600}}>{t[MODS.find(m=>m.id===mod)?.tk]}</span>
          </div>
        </div>}
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={()=>setShowQR(true)} style={{background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,color:C.acl,fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}} title="Poveži telefon">
            📱 {lang==="sr"?"Poveži telefon":"Connect Phone"}
          </button>
          {notifStatus!=="granted"&&<button onClick={handleEnableNotif} style={{background:"rgba(251,191,36,0.15)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:10,color:C.yel,fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:6}} title="Uključi notifikacije">
            🔔 {lang==="sr"?"Notifikacije":"Notifications"}
          </button>}
          {notifStatus==="granted"&&<div style={{color:C.grn,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>🔔 ✓</div>}
          {["sr","en"].map(l=><button key={l} onClick={()=>setLang(l)} style={{padding:"7px 16px",borderRadius:20,fontSize:13,fontWeight:700,cursor:"pointer",border:"none",background:lang===l?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.07)",color:lang===l?"#A5B4FC":"rgba(255,255,255,0.4)"}}>{l.toUpperCase()}</button>)}
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
          {/* Magic Link */}
          <div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10,padding:"12px",marginBottom:12,textAlign:"left"}}>
            <div style={{color:C.acl,fontSize:11,fontWeight:700,marginBottom:6}}>🔐 {lang==="sr"?"Sačuvaj pristup":"Save Access"}</div>
            <div style={{color:C.mut,fontSize:10,marginBottom:8,lineHeight:1.5}}>{lang==="sr"?"Sačuvaj link da ne izgubiš analize:":"Save link to keep your analyses:"}</div>
            <div style={{display:"flex",gap:6}}>
              <input readOnly value={`${window.location.origin}?token=${localStorage.getItem("mat_user_id")||""}`} style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${C.brd}`,borderRadius:6,color:C.txt,fontSize:9,padding:"5px 6px",cursor:"text"}} onClick={e=>e.target.select()}/>
              <button onClick={()=>navigator.clipboard?.writeText(`${window.location.origin}?token=${localStorage.getItem("mat_user_id")||""}`)} style={{background:"rgba(99,102,241,0.3)",border:"none",borderRadius:6,color:C.acl,fontSize:10,fontWeight:700,padding:"5px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>
                {lang==="sr"?"Kopiraj":"Copy"}
              </button>
            </div>
          </div>
          <div style={{color:"rgba(255,255,255,0.2)",fontSize:11}}>Meta Ads Toolkit · v1.0</div>
          <div style={{color:"rgba(255,255,255,0.15)",fontSize:10,marginTop:3}}>by aleksandarpopup</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,overflowY:"auto",minWidth:0}}>
        {showHome&&<div style={{padding:"40px 48px 60px",maxWidth:1100}}>
          <div style={{marginBottom:40}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"#A5B4FC",marginBottom:12}}>META ADS TOOLKIT</div>
            <h1 style={{fontSize:42,fontWeight:900,margin:"0 0 10px",letterSpacing:"-1.5px",lineHeight:1.05}}>{t.sel}</h1>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:16,margin:0}}>{t.selSub}</p>
          </div>
          {MOD_GROUPS.map(g=>{
            const list=VISIBLE_MODS.filter(m=>m.grp===g.k);
            return <div key={g.k} style={{marginBottom:34}}>
              <GroupLabel g={g} mb={14}/>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${gridCols(list.length)},1fr)`,gap:18}}>
                {list.map((m,i)=><ModCard key={m.id} m={m} i={i} large={g.k==="an"}/>)}
              </div>
            </div>;
          })}
        </div>}
        {!showHome&&<div style={{padding:"40px 48px 60px",maxWidth:860}}><Comp t={t} lang={lang} goMod={goMod}/></div>}
      </div>
    </div>
  </div>;
}
