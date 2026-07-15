import { useState, useEffect } from "react";

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
const NIn=({v,ch,ph,sx})=><div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" inputMode="decimal" value={v} onChange={e=>ch(e.target.value)} placeholder={ph} style={{flex:1,padding:"13px 14px",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:10,color:C.txt,fontSize:16,outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor="rgba(99,102,241,0.5)"} onBlur={e=>e.target.style.borderColor=C.brd}/>{sx&&<span style={{color:C.mut,fontSize:13,fontWeight:600,minWidth:20}}>{sx}</span>}</div>;
const DIn=({v,ch})=><input type="date" value={v} onChange={e=>ch(e.target.value)} style={{width:"100%",padding:"13px 12px",background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:10,color:C.txt,fontSize:14,outline:"none",boxSizing:"border-box"}}/>;
const Div=({l})=><div style={{display:"flex",alignItems:"center",gap:10,margin:"22px 0 12px"}}><div style={{height:1,flex:1,background:C.brd}}/>{l&&<span style={{color:C.dim,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",whiteSpace:"nowrap"}}>{l}</span>}<div style={{height:1,flex:1,background:C.brd}}/></div>;
const ST=({c})=><div style={{color:C.dim,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",margin:"20px 0 10px"}}>{c}</div>;
const Btn=({onClick,disabled,children,sec})=><button onClick={onClick} disabled={disabled} style={{padding:"15px 20px",borderRadius:11,fontSize:15,fontWeight:700,cursor:disabled?"not-allowed":"pointer",border:sec?`1px solid ${C.brd}`:"none",background:disabled?"rgba(255,255,255,0.06)":sec?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366F1,#8B5CF6)",color:disabled?"rgba(255,255,255,0.3)":C.txt,width:"100%"}}>{children}</button>;
const SBdg=({l,v,s})=>{ const cfg=SC[s]||{}; return <div style={{background:s?`${cfg.b}80`:C.sur,border:`1px solid ${s?cfg.r:C.brd}`,borderLeft:`3px solid ${s?cfg.c:"rgba(255,255,255,0.1)"}`,borderRadius:10,padding:"12px 14px"}}><div style={{color:C.mut,fontSize:11,marginBottom:4}}>{l}</div><div style={{color:s?cfg.c:C.txt,fontWeight:800,fontSize:18}}>{v}</div></div>; };
const Grid2=({children,mob})=><div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:12,marginBottom:16}}>{children}</div>;
const Grid3=({children,mob})=><div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"1fr 1fr 1fr",gap:12,marginBottom:16}}>{children}</div>;

function Pills({opts,val,ch,multi=false}){
  const arr=multi?(Array.isArray(val)?val:[]):null;
  return <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{opts.map(o=>{ const sel=multi?arr.includes(o):val===o; return <button key={o} onClick={()=>{ if(multi){ch(sel?arr.filter(x=>x!==o):[...arr,o]);}else ch(o); }} style={{padding:"7px 13px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:sel?`1px solid ${C.acc}`:`1px solid ${C.brd}`,background:sel?"rgba(99,102,241,0.2)":C.sur,color:sel?C.acl:C.mut}}>{o}</button>; })}</div>;
}

// ── TRANSLATIONS ────────────────────────────────────────────────────────────
const T={
  sr:{
    appTitle:"Meta Ads Toolkit", appSub:"Profesionalni alati za performance marketing",
    sel:"Odaberi alat", selSub:"Svaki alat možeš koristiti nezavisno", back:"← Nazad",
    m1t:"Campaign Health Check", m1s:"Dijagnoza performansi kampanje",
    m8t:"Report Generator", m8s:"Profesionalni izveštaj sa PDF exportom",
    m9t:"Bookmark Connector", m9s:"Poveži Ads Manager jednim klikom",
    m2t:"Budget Pace Kalkulator", m2s:"Prati tempo potrošnje budžeta",
    m7t:"Budget Scaling Calculator", m7s:"Bezbedno skaliraj budžet kampanje",
    m3t:"Ad Copy Generator", m3s:"Generiši ad tekstove za Meta",
    m4t:"Audience Planner", m4s:"Struktura targetiranja i budžet split",
    m5t:"ROAS & Break-Even", m5s:"Koliki ROAS ti treba za profitabilnost",
    m6t:"Launch Checklist", m6s:"Pixel, CAPI, eventi i sve pre lansiranja",
    analyze:"Analiziraj →", gen:"Generiši →", calc:"Izračunaj →",
    newA:"← Nova analiza", poor:"Kritično", ok:"Prosečno", good:"Odlično",
    nxt:"Dalje →", prv:"←", res:"Rezultati", s1:"Osnove", s2:"Metrike", s3:"Targeting & Kreativa",
    bm_title:"Bookmark Connector",
    bm_sub:"Poveži Ads Manager, Looker Studio ili GA4 jednim klikom – bez screenshota, bez ručnog unosa.",
    bm_step1:"Korak 1 – Jednom: Dodaj bookmark",
    bm_drag:"Prevuci ovo dugme u Bookmarks bar",
    bm_dragSub:"(Bookmark bar je traka sa sačuvanim sajtovima na vrhu browsera)",
    bm_step2:"Korak 2 – Svaki dan: Prikupi podatke",
    bm_howTitle:"Kako koristiti:",
    bm_how1:"Otvori Meta Ads Manager, Looker Studio ili GA4",
    bm_how2:"Klikni na bookmark koji si dodao",
    bm_how3:"App automatski pokupi sve podatke i otvori analizu ovde",
    bm_step3:"Korak 3 – Analiziraj uvezene podatke",
    bm_noData:"Još uvek nema uvezenih podataka.",
    bm_noDataSub:"Dodaj bookmark i klikni ga dok si u Ads Manageru.",
    bm_dataTitle:"Uvezeni podaci",
    bm_source:"Izvor",
    bm_date:"Datum uvoza",
    bm_dateRange:"Period",
    bm_tables:"Tabele",
    bm_rows:"redova",
    bm_analyze:"Analiziraj uvezene podatke →",
    bm_clear:"Obriši podatke",
    bm_analyzing:"Analizira uvezene podatke...",
    bm_works:"Radi sa:",
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
    bTitle:"Budget Pace Kalkulator", bSub:"Unesi budžet i tempo potrošnje po fazama",
    bTot:"Ukupan budžet (€)", bTotPh:"npr. 5000", bSp:"Već potrošeno (€)", bSpPh:"npr. 1200",
    bSt:"Datum početka", bEn:"Datum kraja", bTd:"Današnji datum",
    bAdd:"+ Dodaj fazu", bRem:"Ukloni", bPh:"Faza", bFr:"Od dana", bTo:"Do dana", bPct:"% budžeta",
    bPhT:"Tempo po fazama (opciono)", bPhS:"Podeli kampanju na faze sa različitim tempom potrošnje",
    bRem2:"Preostalo", bDL:"Dana do kraja", bDE:"Proteklih dana",
    bIS:"Idealna potrošnja do danas", bDI:"Idealni daily spend",
    bDN:"Potrebni daily spend", bStat:"Status tempa",
    bON:"Na pravom putu ✓", bOV:"Prekoračenje – uspori ⚠️", bUN:"Underspend – ubrza ⚠️",
    bPS:"Status po fazama", bCP:"Trenutna faza", bPB:"Budžet faze", bPD:"Daily spend faze",
    cTitle:"Ad Copy Generator", cSub:"Unesi informacije i dobij gotove ad tekstove",
    cProd:"Proizvod / Usluga", cProdPh:"npr. Online kurs digitalnog marketinga",
    cAud:"Ciljna publika", cAudPh:"npr. Preduzetnici 25–45",
    cGoal:"Cilj oglasa", cGoals:["Prodaja","Lead generation","Brand awareness","Traffic","App install"],
    cTone:"Ton", cTones:["Profesionalan","Prijatan i opušten","Direktan","Emotivan","Inspirativan"],
    cUSP:"Glavna prednost / USP", cUSPPh:"npr. Jedini kurs sa garantovanim rezultatima",
    cOff:"Ponuda / CTA", cOffPh:"npr. Besplatna probna lekcija",
    cCops:"Generisani ad copy-ji", cPrim:"Primary Text", cHead:"Headline", cCTA:"CTA",
    cCopy:"Kopiraj", cCopd:"Kopirano!",
    aTitle:"Audience Planner", aSub:"Struktura targetiranja i preporučeni budžet split",
    aInd:"Industrija / Niša",
    aInds:["E-commerce / Retail","Lead Gen / B2B","App / SaaS","Ugostiteljstvo / Lokalni","Edukacija / Kursevi","Nekretnine","Zdravlje / Beauty","Ostalo"],
    aGoal:"Primarni cilj", aGoals:["Maksimizovati konverzije","Graditi brand awareness","Generisati leadove","Skalirati postojeće"],
    aMB:"Mesečni budžet (€)", aMBPh:"npr. 3000",
    aPx:"Imaš li pixel podatke?",
    aPxs:["Da, 50+ konverzija/nedelji","Da, ali manje od 50/nedelji","Nedovoljno podataka","Tek počinjem"],
    aCold:"Cold Audience", aWarm:"Warm Audience", aRet:"Retargeting",
    aBSp:"Preporučeni budžet split", aWhy:"Zašto ova struktura?", aTips:"Preporuke za targetiranje",
    rTitle:"ROAS & Break-Even Kalkulator", rSub:"Izračunaj koliki ROAS ti treba za profitabilnost",
    rPP:"Cena proizvoda / AOV (€)", rPPPh:"npr. 89", rCOGS:"COGS (€)", rCOGSPh:"npr. 25",
    rAS:"Mesečni ad spend (€)", rASPh:"npr. 2000", rOC:"Ostali troškovi (€/mes)", rOCPh:"npr. 500",
    rEC:"Očekivane konverzije/mes", rECPh:"npr. 80",
    rMar:"Gross Margin", rBER:"Break-Even ROAS", rBEC:"Maks. CPA",
    rProf:"Profit (trenutni scenario)", rScen:"Scenariji profitabilnosti",
    rROAS:"ROAS", rRev:"Revenue", rPro:"Profit", rSt:"Status",
    lTitle:"Campaign Launch Checklist", lSub:"Sve što treba proveriti pre lansiranja Meta kampanje",
    lProg:"Završeno", lWhy:"Zašto je ovo bitno?", lHow:"Kako instalirati / proveriti?",
    lDone:"Checklist završen! 🎉 Kampanja je spremna za lansiranje.",
    scTitle:"Budget Scaling Calculator", scSub:"Izračunaj bezbedni plan skaliranja budžeta",
    scCurBud:"Trenutni dnevni budžet (€)", scCurBudPh:"npr. 50",
    scTarBud:"Ciljni dnevni budžet (€)", scTarBudPh:"npr. 150",
    scCurROAS:"Trenutni ROAS", scCurROASPh:"npr. 3.2",
    scCurCPA:"Trenutni CPA (€)", scCurCPAPh:"npr. 25",
    scCTR:"Trenutni CTR (%)", scCTRPh:"npr. 1.8",
    scFreq:"Prosečna frekvencija", scFreqPh:"npr. 2.4",
    scPeriod:"Period skaliranja", scPers:["7 dana","14 dana","30 dana"],
    scCalc:"Izračunaj plan →", scNew:"← Novi plan",
    scPlan:"Plan skaliranja po koracima",
    scDay:"Dan", scBud:"Budžet", scInc:"Povećanje",
    scRisk:"Procena rizika", scReady:"Spremnost za skaliranje",
    scExpCPA:"Očekivani CPA tokom skaliranja",
    scExpROAS:"Očekivani ROAS tokom skaliranja",
    scWarn:"Upozorenja pre skaliranja", scTips:"Preporuke",
  },
  en:{
    appTitle:"Meta Ads Toolkit", appSub:"Professional tools for performance marketing",
    sel:"Select a tool", selSub:"Each tool can be used independently", back:"← Back",
    m1t:"Campaign Health Check", m1s:"Diagnose your campaign performance",
    m8t:"Report Generator", m8s:"Professional report with PDF export",
    m9t:"Bookmark Connector", m9s:"Connect Ads Manager with one click",
    m2t:"Budget Pace Calculator", m2s:"Track your budget spending pace",
    m7t:"Budget Scaling Calculator", m7s:"Scale your budget safely without hurting performance",
    m3t:"Ad Copy Generator", m3s:"Generate Meta ad texts",
    m4t:"Audience Planner", m4s:"Targeting structure and budget split",
    m5t:"ROAS & Break-Even", m5s:"Calculate the ROAS you need to be profitable",
    m6t:"Launch Checklist", m6s:"Pixel, CAPI, events and everything before launch",
    analyze:"Analyze →", gen:"Generate →", calc:"Calculate →",
    newA:"← New Analysis", poor:"Critical", ok:"Average", good:"Excellent",
    nxt:"Next →", prv:"←", res:"Results", s1:"Basics", s2:"Metrics", s3:"Targeting & Creative",
    bm_title:"Bookmark Connector",
    bm_sub:"Connect Ads Manager, Looker Studio or GA4 with one click – no screenshots, no manual entry.",
    bm_step1:"Step 1 – Once: Add the bookmark",
    bm_drag:"Drag this button to your Bookmarks bar",
    bm_dragSub:"(The Bookmarks bar is the strip of saved sites at the top of your browser)",
    bm_step2:"Step 2 – Every day: Collect data",
    bm_howTitle:"How to use:",
    bm_how1:"Open Meta Ads Manager, Looker Studio or GA4",
    bm_how2:"Click the bookmark you added",
    bm_how3:"App automatically collects all data and opens analysis here",
    bm_step3:"Step 3 – Analyze imported data",
    bm_noData:"No imported data yet.",
    bm_noDataSub:"Add the bookmark and click it while in Ads Manager.",
    bm_dataTitle:"Imported Data",
    bm_source:"Source",
    bm_date:"Import date",
    bm_dateRange:"Period",
    bm_tables:"Tables",
    bm_rows:"rows",
    bm_analyze:"Analyze imported data →",
    bm_clear:"Clear data",
    bm_analyzing:"Analyzing imported data...",
    bm_works:"Works with:",
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
    bTitle:"Budget Pace Calculator", bSub:"Enter budget and spending pace by phases",
    bTot:"Total Campaign Budget (€)", bTotPh:"e.g. 5000", bSp:"Already Spent (€)", bSpPh:"e.g. 1200",
    bSt:"Campaign Start Date", bEn:"Campaign End Date", bTd:"Today's Date",
    bAdd:"+ Add Phase", bRem:"Remove", bPh:"Phase", bFr:"From day", bTo:"To day", bPct:"% of budget",
    bPhT:"Spending Pace by Phases (optional)", bPhS:"Split campaign into phases with different spending pace",
    bRem2:"Remaining", bDL:"Days remaining", bDE:"Days elapsed",
    bIS:"Ideal spend to date", bDI:"Ideal daily spend",
    bDN:"Required daily spend", bStat:"Pace Status",
    bON:"On track ✓", bOV:"Overspending – slow down ⚠️", bUN:"Underspending – speed up ⚠️",
    bPS:"Phase Status", bCP:"Current Phase", bPB:"Phase Budget", bPD:"Phase daily spend",
    cTitle:"Ad Copy Generator", cSub:"Enter information and get ready-to-use ad texts",
    cProd:"Product / Service", cProdPh:"e.g. Online digital marketing course",
    cAud:"Target Audience", cAudPh:"e.g. Entrepreneurs 25–45",
    cGoal:"Ad Objective", cGoals:["Sales / Conversion","Lead generation","Brand awareness","Website traffic","App install"],
    cTone:"Tone", cTones:["Professional","Friendly & relaxed","Direct & punchy","Emotional","Inspirational"],
    cUSP:"Main Advantage / USP", cUSPPh:"e.g. The only course with guaranteed results",
    cOff:"Offer / CTA", cOffPh:"e.g. Free trial lesson",
    cCops:"Generated Ad Copies", cPrim:"Primary Text", cHead:"Headline", cCTA:"CTA",
    cCopy:"Copy", cCopd:"Copied!",
    aTitle:"Audience Planner", aSub:"Targeting structure and recommended budget split",
    aInd:"Industry / Niche",
    aInds:["E-commerce / Retail","Lead Gen / B2B","App / SaaS","Hospitality / Local","Education / Courses","Real Estate","Health / Beauty","Other"],
    aGoal:"Primary Goal", aGoals:["Maximize conversions","Build brand awareness","Generate leads","Scale existing campaigns"],
    aMB:"Monthly Budget (€)", aMBPh:"e.g. 3000",
    aPx:"Do you have pixel data?",
    aPxs:["Yes, 50+ conversions/week","Yes, but less than 50/week","Not enough data","Just starting"],
    aCold:"Cold Audience", aWarm:"Warm Audience", aRet:"Retargeting",
    aBSp:"Recommended Budget Split", aWhy:"Why this structure?", aTips:"Targeting Recommendations",
    rTitle:"ROAS & Break-Even Calculator", rSub:"Calculate the ROAS you need to be profitable",
    rPP:"Product Price / AOV (€)", rPPPh:"e.g. 89", rCOGS:"COGS (€)", rCOGSPh:"e.g. 25",
    rAS:"Monthly Ad Spend (€)", rASPh:"e.g. 2000", rOC:"Other Costs (€/month)", rOCPh:"e.g. 500",
    rEC:"Expected Conversions/month", rECPh:"e.g. 80",
    rMar:"Gross Margin", rBER:"Break-Even ROAS", rBEC:"Max CPA",
    rProf:"Profit (current scenario)", rScen:"Profitability Scenarios",
    rROAS:"ROAS", rRev:"Revenue", rPro:"Profit", rSt:"Status",
    lTitle:"Campaign Launch Checklist", lSub:"Everything to check before launching a Meta campaign",
    lProg:"Completed", lWhy:"Why is this important?", lHow:"How to install / verify?",
    lDone:"Checklist complete! 🎉 Your campaign is ready to launch.",
    scTitle:"Budget Scaling Calculator", scSub:"Calculate a safe budget scaling plan",
    scCurBud:"Current Daily Budget (€)", scCurBudPh:"e.g. 50",
    scTarBud:"Target Daily Budget (€)", scTarBudPh:"e.g. 150",
    scCurROAS:"Current ROAS", scCurROASPh:"e.g. 3.2",
    scCurCPA:"Current CPA (€)", scCurCPAPh:"e.g. 25",
    scCTR:"Current CTR (%)", scCTRPh:"e.g. 1.8",
    scFreq:"Average Frequency", scFreqPh:"e.g. 2.4",
    scPeriod:"Scaling Period", scPers:["7 days","14 days","30 days"],
    scCalc:"Calculate Plan →", scNew:"← New Plan",
    scPlan:"Step-by-step scaling plan",
    scDay:"Day", scBud:"Budget", scInc:"Increase",
    scRisk:"Risk Assessment", scReady:"Scaling Readiness",
    scExpCPA:"Expected CPA during scaling",
    scExpROAS:"Expected ROAS during scaling",
    scWarn:"Warnings before scaling", scTips:"Recommendations",
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

// ── AD COPIES ───────────────────────────────────────────────────────────────
function genCopies(lang,{prod,aud,usp,off}){
  const sr=lang==="sr"; if(!prod) return [];
  const u=usp||prod; const o=off||(sr?"Saznaj više":"Learn more"); const a=aud||(sr?"vas":"you");
  if(sr) return [
    {l:"Varijanta 1 – Problem/Rešenje",p:`Da li si se ikada zapitao/la zašto ${prod} nije davao rezultate koje si očekivao/la?\n\nVećina greši na istom mestu. Mi smo to promenili:\n\n✅ ${u}\n✅ Rezultati već u prvim nedeljama\n✅ Bez komplikacija\n\n${o} – klikni ispod.`,h:`Zašto ${prod} sada zaista funkcioniše`,c:o},
    {l:"Varijanta 2 – Social Proof",p:`"Nisam verovao/la da će ${prod} zapravo raditi – ali evo me, sa potpuno drugačijim rezultatima."\n\nOvo nam govore svakodnevno ${a} koji su isprobali naš pristup.\n\n${u} – to nas razlikuje.\n\n👉 Pridruži se stotinama koji su već promenili pristup.\n\n${o}`,h:`Šta kažu ${a} o ${prod}`,c:o},
    {l:"Varijanta 3 – Direktna ponuda",p:`${prod} za ${a}.\n\n${u}\n\n${o} – ograničeno vreme.\n\n✔ Bez skrivenih troškova\n✔ Garantovani rezultati\n✔ Počni danas`,h:`${o} – samo danas`,c:o},
    {l:"Varijanta 4 – Benefit-driven",p:`Zamisli da konačno imaš ${prod} koji zaista radi za tebe.\n\nNema više izgubljenog vremena. Nema više kompromisa.\n\n${u} – upravo to smo izgradili.\n\nKako izgleda tvoj uspeh za 30 dana? → ${o}`,h:`${prod} koji zapravo radi za tebe`,c:o},
    {l:"Varijanta 5 – Urgency/FOMO",p:`⏳ Ovo ne traje dugo.\n\n${prod} za ${a} – sa ${u}.\n\nJoš samo nekoliko mesta ostalo ovog meseca.\n\nNe propusti: ${o}`,h:`Poslednji poziv: ${o}`,c:o},
  ];
  return [
    {l:"Variant 1 – Problem/Solution",p:`Have you ever wondered why ${prod} wasn't delivering the results you expected?\n\nMost people make the same mistake. We changed that:\n\n✅ ${u}\n✅ Results in the first weeks\n✅ Simple and straightforward\n\n${o} – click below.`,h:`Why ${prod} finally works`,c:o},
    {l:"Variant 2 – Social Proof",p:`"I didn't believe ${prod} would actually work – but here I am, completely transformed."\n\nThis is what ${a} tell us every day after trying our approach.\n\n${u} – that's what sets us apart.\n\n👉 Join hundreds who've already changed their approach.\n\n${o}`,h:`What ${a} say about ${prod}`,c:o},
    {l:"Variant 3 – Direct Offer",p:`${prod} for ${a}.\n\n${u}\n\n${o} – limited time.\n\n✔ No hidden costs\n✔ Guaranteed results\n✔ Start today`,h:`${o} – today only`,c:o},
    {l:"Variant 4 – Benefit-driven",p:`Imagine finally having a ${prod} that actually works for you.\n\nNo more wasted time. No more compromises.\n\n${u} – that's exactly what we built.\n\nWhat does your success look like in 30 days? → ${o}`,h:`${prod} that actually works for you`,c:o},
    {l:"Variant 5 – Urgency/FOMO",p:`⏳ This won't last long.\n\n${prod} for ${a} – with ${u}.\n\nOnly a few spots remaining this month.\n\nDon't miss it: ${o}`,h:`Last call: ${o}`,c:o},
  ];
}

// ── AUDIENCE PLAN ───────────────────────────────────────────────────────────
function genAudPlan(lang,{ind,mb,px}){
  const sr=lang==="sr"; const b=parseFloat(mb)||1000;
  const hd=px&&(px.includes("50+")||px.includes("manje")||px.includes("less"));
  const cp=hd?40:55,wp=25,rp=hd?35:20;
  const why=sr
    ?(hd?"Imaš pixel podatke, pa Meta može efikasno da optimizuje delivery. Retargeting dobija veći deo budžeta jer konvertuje po nižem CPA od cold audience.":"Bez dovoljno konverzionih podataka, fokus je na cold audience koji gradi bazu za budući retargeting. Kada pixel prikupi 50+ konverzija/nedelji, preraspodeli više budžeta na retargeting.")
    :(hd?"You have pixel data, so Meta can efficiently optimize delivery. Retargeting gets a larger budget share as it converts at lower CPA than cold audiences.":"Without enough conversion data, focus is on cold audience to build the base for future retargeting. When pixel accumulates 50+ conversions/week, reallocate more budget to retargeting.");
  const ecom=ind?.includes("E-commerce")||ind?.includes("Retail");
  const coldT=sr
    ?(ecom?["Lookalike 1–3% od purchase event-a","Interest targeting: šira kategorija + specifičan interes","Broad sa Advantage+ za testiranje","Isključi postojeće kupce iz cold kampanje"]:["Lookalike od top lead-ova ili kupaca","Interest targeting relevantan za tvoju nišu","Broad targeting sa konverzionim ciljem ako imaš podatke","Advantage+ audience za automatsku optimizaciju"])
    :(ecom?["Lookalike 1–3% from purchase events","Interest targeting: broad category + specific interest","Broad with Advantage+ for testing","Exclude existing customers from cold campaign"]:["Lookalike from top leads or buyers","Interest targeting relevant to your niche","Broad targeting with conversion objective if you have data","Advantage+ audience for automatic optimization"]);
  const warmT=sr?["Website visitors (poslednja 30–90 dana)","Video viewers (50–75% videa)","Instagram/Facebook page engagers","Email lista (custom audience)"]:["Website visitors (last 30–90 days)","Video viewers (50–75% of video)","Instagram/Facebook page engagers","Email list (custom audience)"];
  const retT=sr?["Add to Cart bez kupovine – prioritet #1","Initiate Checkout – prioritet #2","Product page viewers (poslednja 7–14 dana)","Past buyers za upsell/cross-sell"]:["Add to Cart without purchase – priority #1","Initiate Checkout – priority #2","Product page viewers (last 7–14 days)","Past buyers for upsell/cross-sell"];
  return {split:{cold:{p:cp,b:Math.round(b*cp/100)},warm:{p:wp,b:Math.round(b*wp/100)},ret:{p:rp,b:Math.round(b*rp/100)}},why,coldT,warmT,retT};
}

// ── CHECKLIST DATA ──────────────────────────────────────────────────────────
function clData(lang){
  const sr=lang==="sr";
  return [
    {cat:sr?"🔵 Meta Pixel":"🔵 Meta Pixel",items:[
      {id:"p1",t:sr?"Pixel je instaliran na svim stranicama sajta":"Pixel is installed on all website pages",w:sr?"Bez pixela, Meta ne može da prati posetioce, optimizuje kampanju za konverzije ili gradi retargeting audience. Pixel je temelj svake Meta kampanje – bez njega si u mraku.":"Without the pixel, Meta can't track visitors, optimize for conversions, or build retargeting audiences. The pixel is the foundation of every Meta campaign – without it, you're operating blind.",h:sr?"Business Manager → Events Manager → Connect Data Source → Web → Meta Pixel → Install manually ili via partner integracija (Shopify, WooCommerce, WordPress plugin, Wix). Partner integracije su najbrže i bez kodiranja.":"Business Manager → Events Manager → Connect Data Source → Web → Meta Pixel → Install manually or via partner integration (Shopify, WooCommerce, WordPress plugin, Wix). Partner integrations are fastest and require no coding."},
      {id:"p2",t:sr?"Pixel events se pravilno beleže (proveri u Events Manager)":"Pixel events are firing correctly (check in Events Manager)",w:sr?"Ako eventi ne pucaju, Meta nema signal za optimizaciju. Kampanja postavljena na Purchase event bez ijedne purchase konverzije ne može da uči i biće drastično neefikasna.":"If events don't fire, Meta has no optimization signal. A campaign set to Purchase event with zero purchase conversions can't learn and will be drastically inefficient.",h:sr?"Events Manager → Test Events tab → otvori sajt u drugom tabu i prođi kroz checkout. Svi eventi treba da se pojave u realnom vremenu unutar 30 sekundi. Proveri i Facebook Pixel Helper Chrome ekstenzijom.":"Events Manager → Test Events tab → open your site in another tab and go through checkout. All events should appear in real time within 30 seconds. Also verify with Facebook Pixel Helper Chrome extension."},
      {id:"p3",t:sr?"Facebook Pixel Helper potvrđuje ispravno paljenje":"Facebook Pixel Helper confirms correct firing",w:sr?"Vizuelna potvrda da pixel radi ispravno na svakoj stranici. Identifikuje duplikate pixela i greške u event kodu koje Events Manager ne prikazuje uvek jasno.":"Visual confirmation that the pixel fires correctly on every page. Identifies pixel duplicates and event code errors that Events Manager doesn't always show clearly.",h:sr?"Instaliraj Chrome ekstenziju 'Meta Pixel Helper' i poseti svake ključne stranice: home, product page, cart, checkout, thank you page. Zelena ikona = pixel radi. Crvena = problem.":"Install Chrome extension 'Meta Pixel Helper' and visit all key pages: home, product page, cart, checkout, thank you page. Green icon = pixel working. Red = problem."},
    ]},
    {cat:sr?"🟣 Conversions API (CAPI)":"🟣 Conversions API (CAPI)",items:[
      {id:"c1",t:sr?"CAPI je postavljen pored pixela (server-side tracking)":"CAPI is set up alongside the pixel (server-side tracking)",w:sr?"iOS14+ i ad blockers blokiraju do 40% pixel signala. CAPI šalje konverzije direktno sa tvog servera do Meta-e, zaobilazeći browser ograničenja. Meta eksplicitno ZAHTEVA CAPI za optimalne rezultate – bez njega kampanje rade sa nepotpunim podacima što direktno povećava CPA i smanjuje ROAS.":"iOS14+ and ad blockers block up to 40% of pixel signals. CAPI sends conversions directly from your server to Meta, bypassing browser restrictions. Meta explicitly REQUIRES CAPI for optimal results – without it, campaigns run on incomplete data which directly increases CPA and reduces ROAS.",h:sr?"3 načina instalacije: (1) Shopify → Meta Sales Channel – automatski, bez koda, preporučeno. (2) Google Tag Manager → Meta CAPI tag template. (3) Direktna API integracija za developerima. Za Shopify, WooCommerce i slične platforme, uvek koristi partner integraciju.":"3 installation methods: (1) Shopify → Meta Sales Channel – automatic, no code, recommended. (2) Google Tag Manager → Meta CAPI tag template. (3) Direct API integration for developers. For Shopify, WooCommerce and similar platforms, always use the partner integration."},
      {id:"c2",t:sr?"Event Match Quality (EMQ) je 6.0 ili više":"Event Match Quality (EMQ) is 6.0 or higher",w:sr?"EMQ meri koliko dobro Meta može da poveže tvoje konverzije sa konkretnim osobama. Viši EMQ = bolje targeting, niži CPA i tačnija atribucija. EMQ ispod 5.0 znači da gubiš značajan deo atribucije i tvoji kampanje su manje efikasne.":"EMQ measures how well Meta can match your conversions to specific people. Higher EMQ = better targeting, lower CPA, and more accurate attribution. EMQ below 5.0 means you're losing significant attribution and your campaigns are less effective.",h:sr?"Events Manager → tvoj dataset → Event Match Quality tab. Da povećaš EMQ: kroz CAPI prosleđuj email, telefon i ime korisnika (hashirano SHA-256 za privatnost). Svaki dodatni customer info parametar povećava EMQ score.":"Events Manager → your dataset → Event Match Quality tab. To improve EMQ: pass email, phone, and customer name through CAPI (hashed SHA-256 for privacy). Each additional customer info parameter increases EMQ score."},
      {id:"c3",t:sr?"Deduplikacija pixela i CAPI je podešena (event_id)":"Pixel and CAPI deduplication is set up (event_id)",w:sr?"Bez deduplikacije, isti purchase se broji dva puta (pixel + CAPI), što iskrivljuje podatke i Meta algoritam dobija pogrešne signale. Videćeš duplirane konverzije i netačan ROAS u reporting-u.":"Without deduplication, the same purchase is counted twice (pixel + CAPI), distorting data and giving Meta's algorithm wrong signals. You'll see duplicate conversions and inaccurate ROAS in reporting.",h:sr?"Dodaj identičan event_id parametar u pixel i CAPI event za svaki isti događaj. Meta automatski deduplicira evente sa istim event_id u roku od 48 sati. Proveri: Events Manager → Overview → Deduplicated events procenat.":"Add an identical event_id parameter to both pixel and CAPI events for each occurrence. Meta automatically deduplicates events with the same event_id within 48 hours. Verify: Events Manager → Overview → Deduplicated events percentage."},
    ]},
    {cat:sr?"🟢 Conversion Events":"🟢 Conversion Events",items:[
      {id:"e1",t:sr?"Purchase event se beleži sa ispravnom vrednošću (value + currency)":"Purchase event fires with correct value (value + currency)",w:sr?"Value parametar omogućava value-based optimization i tačno prikazuje Revenue u Meta Ads Manager-u. Bez value, ROAS u reporting-u je netačan i ne možeš optimizovati za visoko-vredne kupce koji su tvoji profitabilniji korisnici.":"The value parameter enables value-based optimization and accurately shows Revenue in Meta Ads Manager. Without value, ROAS in reporting is inaccurate and you can't optimize for high-value buyers who are your most profitable customers.",h:sr?"Pixel kod: fbq('track', 'Purchase', {value: ORDER_VALUE, currency: 'EUR'}). Ključno: ORDER_VALUE mora biti dinamičan (uzet iz stvarne vrednosti porudžbine), ne hardcoded broj. Proveri u Events Manager da li value parametar stiže.":"Pixel code: fbq('track', 'Purchase', {value: ORDER_VALUE, currency: 'EUR'}). Key: ORDER_VALUE must be dynamic (pulled from actual order value), not hardcoded. Verify in Events Manager that the value parameter is arriving."},
      {id:"e2",t:sr?"AddToCart, InitiateCheckout i ViewContent eventi rade":"AddToCart, InitiateCheckout and ViewContent events work",w:sr?"Ovi eventi grade retargeting audience (ATC bez purchase = najtoplija publika) i pomažu algoritmu da razume ceo funnel koji vodi do purchase, što poboljšava targeting za sve kampanje na nalogu.":"These events build retargeting audiences (ATC without purchase = hottest audience) and help the algorithm understand the full funnel leading to purchase, improving targeting for all campaigns on the account.",h:sr?"Isti proces kao Purchase event. Redosled po stranicama: ViewContent → product page, AddToCart → dugme za dodavanje u korpu, InitiateCheckout → checkout stranica. Purchase → thank you stranica. Proveri sve u Events Manager → Test Events.":"Same process as Purchase event. Page order: ViewContent → product page, AddToCart → add to cart button, InitiateCheckout → checkout page. Purchase → thank you page. Verify all in Events Manager → Test Events."},
      {id:"e3",t:sr?"Optimization event je Purchase (ne Add to Cart)":"Optimization event is Purchase (not Add to Cart)",w:sr?"Ako optimizuješ za ATC, platićeš za klikere koji nikad neće kupiti. Purchase optimization = Meta pronalazi ljude koji su direktno spremni da plate, a ne samo da klikću dugmiće. Razlika u CPA može biti 50–200%.":"If you optimize for ATC, you'll pay for people who'll never buy. Purchase optimization = Meta finds people who are actually ready to pay, not just click buttons. The difference in CPA can be 50–200%.",h:sr?"Ad Set level → Conversion → Conversion event → izaberi Purchase. Ako nemaš 50+ Purchase eventa/nedelji, razmotri optimizaciju za Initiate Checkout ili povećaj budžet da dostigneš taj nivo pre skaliranja.":"Ad Set level → Conversion → Conversion event → select Purchase. If you don't have 50+ Purchase events/week, consider optimizing for Initiate Checkout or increase budget to reach that level before scaling."},
    ]},
    {cat:sr?"⚙️ Podešavanja kampanje":"⚙️ Campaign Settings",items:[
      {id:"s1",t:sr?"Conversion window je ispravno postavljen (7-day click preporučeno)":"Conversion window is set correctly (7-day click recommended)",w:sr?"Conversion window određuje koliko dugo nakon klika Meta pripisuje konverziju kampanji. Previše kratak window potcenjuje rezultate; neprikladna dužina za tvoj buying cycle znači netačnu optimizaciju.":"Conversion window determines how long after a click Meta attributes a conversion to the campaign. Too short a window underreports results; an inappropriate length for your buying cycle means inaccurate optimization.",h:sr?"Ad Set → Conversion → Conversion window → 7-day click (standard za e-com i kratke purchase cikluse). Za B2B i duže sale cikluse razmotri 28-day click. Za impulse buy/direct response može biti 1-day click.":"Ad Set → Conversion → Conversion window → 7-day click (standard for e-com and short purchase cycles). For B2B and longer sales cycles, consider 28-day click. For impulse buy/direct response, 1-day click can work."},
      {id:"s2",t:sr?"Bid strategija je adekvatna cilju (Lowest cost, Cost cap, Bid cap)":"Bid strategy is appropriate for objective (Lowest cost, Cost cap, Bid cap)",w:sr?"Pogrešna bid strategija može potrošiti budžet bez rezultata. Lowest cost = Meta troši što efikasnije prema tvom cilju. Cost cap = ti kontrolišeš max CPA. Bid cap = kontrolišeš max bid u aukciji (napredna opcija).":"Wrong bid strategy can drain budget without results. Lowest cost = Meta spends most efficiently toward your goal. Cost cap = you control max CPA. Bid cap = you control max auction bid (advanced option).",h:sr?"Preporuka: počni sa Lowest cost. Kada kampanja stabilizuje i ima 50+ konverzija/nedelji, uvedi Cost cap postavljen na 20–30% iznad trenutnog CPA-a za postepenu optimizaciju.":"Recommendation: start with Lowest cost. When campaign stabilizes and has 50+ conversions/week, introduce Cost cap set at 20–30% above current CPA for gradual optimization."},
      {id:"s3",t:sr?"Placements su optimizovani (Advantage+ Placements preporučeno)":"Placements are optimized (Advantage+ Placements recommended)",w:sr?"Meta's Advantage+ Placements automatski raspoređuje budžet između Feed, Stories, Reels, Audience Network na osnovu performansi. Manualni placements mogu limitirati doseg i povećati CPM.":"Meta's Advantage+ Placements automatically distributes budget between Feed, Stories, Reels, Audience Network based on performance. Manual placements can limit reach and increase CPM.",h:sr?"Ad Set → Placements → Advantage+ placements (preporučeno za skaliranje). Izuzetak: ako imaš specifičnu 9:16 kreativu za Reels, možeš manuelno izabrati Stories i Reels placement.":"Ad Set → Placements → Advantage+ placements (recommended for scaling). Exception: if you have specific 9:16 creative for Reels, you can manually select Stories and Reels placement."},
    ]},
    {cat:sr?"🎨 Kreativa & Copy":"🎨 Creative & Copy",items:[
      {id:"r1",t:sr?"Kreativa poštuje Meta specs (rezolucija, trajanje, tekst na slici)":"Creative meets Meta specs (resolution, duration, text on image)",w:sr?"Neispravni specs = automatsko smanjenje delivery-ja ili rejection kreative. Previše teksta na slici smanjuje reach. Pogrešan aspect ratio znači cropovanu sliku u nekim placementima.":"Incorrect specs = automatic delivery reduction or creative rejection. Too much text on image reduces reach. Wrong aspect ratio means a cropped image in some placements.",h:sr?"Feed slika: 1080×1080 ili 1080×1350 (4:5). Stories/Reels: 1080×1920 (9:16). Video za Feed: preporučeno 15–30 sec. Video za Reels: max 90 sec. Tekst na slici: max 20% površine. Uvek preview sva placements pre pokretanja.":"Feed image: 1080×1080 or 1080×1350 (4:5). Stories/Reels: 1080×1920 (9:16). Feed video: recommended 15–30 sec. Reels video: max 90 sec. Text on image: max 20% of surface. Always preview all placements before launching."},
      {id:"r2",t:sr?"Testiraš minimum 3 kreativne varijante po ad setu":"Testing minimum 3 creative variants per ad set",w:sr?"Meta troši budžet na top performere – potrebno je minimum 3–5 varijanti da nađeš pobednika. Sa jednom kreativom ne možeš testirati i ne znaš šta rezonuje sa tvojom publikom.":"Meta spends budget on top performers – minimum 3–5 variants needed to find a winner. With one creative you can't test and don't know what resonates with your audience.",h:sr?"Unutar jednog ad set-a dodaj 3–5 različitih ad-ova sa različitim hookom, vizuelom ili copy-jem. Ili koristi Dynamic Creative Testing: upload-uj varijante pa Meta automatski testira kombinacije.":"Within one ad set, add 3–5 different ads with different hooks, visuals or copy. Or use Dynamic Creative Testing: upload variants and Meta automatically tests combinations."},
      {id:"r3",t:sr?"Primary text, headline i CTA su konzistentni i jasni":"Primary text, headline and CTA are consistent and clear",w:sr?"Neusklađenost između copy-ja i vizuala zbunjuje korisnika i smanjuje CTR. CTA mora biti jasan poziv na jednu konkretnu akciju – višestruki CTA-i zbunjuju i smanjuju konverzije.":"Misalignment between copy and visual confuses the user and reduces CTR. CTA must be a clear call to a single specific action – multiple CTAs confuse and reduce conversions.",h:sr?"Pravilo: primary text postavlja kontekst/bol, headline pojačava glavnu poruku/benefit, CTA govori tačno šta se dešava kada klikne. Konzistentnost između ad-a i landing page-a je ključna za conversion rate.":"Rule: primary text sets context/pain, headline reinforces the main message/benefit, CTA tells exactly what happens when they click. Consistency between ad and landing page is key for conversion rate."},
    ]},
    {cat:sr?"📊 Tracking & Atribucija":"📊 Tracking & Attribution",items:[
      {id:"t1",t:sr?"UTM parametri su dodati na sve URL-ove u oglasima":"UTM parameters are added to all ad URLs",w:sr?"UTM parametri omogućavaju Google Analytics i CRM sistemima da vide odakle dolazi trafik. Bez UTM-a, sav Meta trafik se prikazuje kao 'direct' – ne možeš meriti ROI van Meta platforme.":"UTM parameters allow Google Analytics and CRM systems to see where traffic comes from. Without UTMs, all Meta traffic shows as 'direct' – you can't measure ROI outside the Meta platform.",h:sr?"Destination URL format: https://tvojsajt.com/stranica?utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}. Koristi Meta dynamic URL parameters za automatsko popunjavanje.":"Destination URL format: https://yoursite.com/page?utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}. Use Meta dynamic URL parameters for automatic population."},
      {id:"t2",t:sr?"Aggregated Event Measurement je konfigurisan (post iOS14)":"Aggregated Event Measurement is configured (post iOS14)",w:sr?"iOS14 ograničava praćenje Apple korisnika. AEM ti daje prioritet za 8 konverzionih eventa po domenu i omogućava targeting i reporting za iOS korisnike. Bez AEM-a, gubiš deo iOS atribucije.":"iOS14 limits tracking of Apple users. AEM gives you priority for 8 conversion events per domain and enables targeting and reporting for iOS users. Without AEM, you lose a portion of iOS attribution.",h:sr?"Events Manager → Aggregated Event Measurement → Verify your domain (dodaj DNS TXT record ili meta tag) → Konfiguriši prioritet eventa: Purchase = #1, Initiate Checkout = #2, Add to Cart = #3, Lead = #4...":"Events Manager → Aggregated Event Measurement → Verify your domain (add DNS TXT record or meta tag) → Configure event priority: Purchase = #1, Initiate Checkout = #2, Add to Cart = #3, Lead = #4..."},
      {id:"t3",t:sr?"Pixel i CAPI su u istom Dataset-u (nema duplikata)":"Pixel and CAPI are in the same Dataset (no duplicates)",w:sr?"Ako imaš više pixela ili odvojen CAPI dataset, podaci se ne dedupliciraju i brojevi u Ads Manageru su netačni – videćeš duplirane konverzije i pogrešan ROAS.":"If you have multiple pixels or a separate CAPI dataset, data isn't deduplicated and numbers in Ads Manager are inaccurate – you'll see duplicate conversions and incorrect ROAS.",h:sr?"Events Manager → Data Sources → osiguraj da pixel i CAPI šalju evente u isti Dataset ID. U kampanje uvek koristi samo jedan pixel – onaj koji ima CAPI vezu. Izbegavaj kreiranje duplikat pixela.":"Events Manager → Data Sources → ensure pixel and CAPI send events to the same Dataset ID. In campaigns, always use only one pixel – the one connected to CAPI. Avoid creating duplicate pixels."},
    ]},
  ];
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

  const handleScreenshotAnalyze=async()=>{
    if(!screenshot) return;
    setDone(true); setAiLoading(true); setAiAnalysis("");
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:2000,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:"image/jpeg",data:screenshot}},
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

  const reset=()=>{setSt(0);setDone(false);setAiAnalysis("");setMode(null);setScreenshot(null);setScreenshotPreview(null);setScreenshotName("");setF({name:"",goal:"",per:"",bud:"",sp:"",ROAS:"",CTR:"",CPC:"",CPA:"",ConversionRate:"",Revenue:"",audT:"",audS:"",freq:"",crFs:[],crA:"",cpF:""});};
  const ovc=ov?SC[ov]:null;
  const STEPS=[t.s1,t.s2,t.s3];
  const BudBar=()=>br!==null?<div style={{background:C.sur,borderRadius:10,padding:"12px 14px",marginTop:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:C.mut}}>{t.hBudUse}</span><span style={{fontSize:12,fontWeight:700,color:br>0.9?C.grn:br>0.6?C.yel:C.red}}>{Math.round(br*100)}%</span></div><div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(br*100,100)}%`,background:"linear-gradient(90deg,#6366F1,#8B5CF6)",borderRadius:3}}/></div></div>:null;

  // ── REZULTATI (zajednički za oba moda) ──
  if(done) return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 4px"}}>{t.res}</h2>
    {mode==="screenshot"&&screenshotName&&<p style={{color:C.mut,fontSize:12,margin:"0 0 20px"}}>📸 {screenshotName}</p>}
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

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:24}}>{STEPS.map((s,i)=><div key={i} style={{flex:1}}><div style={{height:3,borderRadius:2,background:i<step?"#6366F1":i===step?"linear-gradient(90deg,#6366F1,#8B5CF6)":"rgba(255,255,255,0.08)",marginBottom:5}}/><div style={{fontSize:10,color:i<=step?C.mut:C.dim,fontWeight:600}}>{s}</div></div>)}</div>
    {step===0&&<><h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.hTitle}</h2><p style={{color:C.mut,fontSize:13,margin:"0 0 22px",lineHeight:1.6}}>{t.hSub}</p><Lbl c={t.hName}/><div style={{marginBottom:16}}><TIn v={f.name} ch={v=>set("name",v)} ph={t.hNamePh}/></div><Div l={t.hGoal}/><Pills opts={t.hGoals} val={f.goal} ch={v=>set("goal",v)}/><Div l={t.hPer}/><Pills opts={t.hPers} val={f.per} ch={v=>set("per",v)}/><Div l={t.hBudH}/><div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:4}}><div><Lbl c={t.hBud}/><NIn v={f.bud} ch={v=>set("bud",v)} ph={t.hBudPh} sx="€"/></div><div><Lbl c={t.hSp}/><NIn v={f.sp} ch={v=>set("sp",v)} ph={t.hSpPh} sx="€"/></div></div><BudBar/><div style={{marginTop:22}}><Btn onClick={()=>setSt(1)}>{t.nxt}</Btn></div></>}
    {step===1&&<><h2 style={{fontSize:20,fontWeight:800,margin:"0 0 18px"}}>{t.hMet}</h2><div style={{display:"flex",flexDirection:"column",gap:10}}>{MD.map(({k,l,h,ph,sx})=><div key={k} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:11,padding:"13px 15px"}}><div style={{marginBottom:9}}><span style={{color:C.txt,fontWeight:700,fontSize:13}}>{l}</span><span style={{color:C.dim,fontSize:11,marginLeft:8}}>{h}</span></div><NIn v={f[k]} ch={v=>set(k,v)} ph={ph} sx={sx}/></div>)}</div><div style={{display:"flex",gap:10,marginTop:22}}><div style={{flex:1}}><Btn onClick={()=>setSt(0)} sec>{t.prv}</Btn></div><div style={{flex:4}}><Btn onClick={()=>setSt(2)} disabled={fl<3}>{fl<3?t.hFill:`${t.s3} →`}</Btn></div></div></>}
    {step===2&&<><h2 style={{fontSize:20,fontWeight:800,margin:"0 0 18px"}}>{t.hTarg} & {t.hCr}</h2><Lbl c={t.hAudT}/><Pills opts={t.hAudTs} val={f.audT} ch={v=>set("audT",v)}/><Div l={t.hAudS}/><Pills opts={t.hAudSs} val={f.audS} ch={v=>set("audS",v)}/><Div l={t.hFreq}/><NIn v={f.freq} ch={v=>set("freq",v)} ph={t.hFreqPh} sx="x"/><Div l={t.hCrF}/><Pills opts={t.hCrFs} val={f.crFs} ch={v=>set("crFs",v)} multi={true}/><Div l={t.hCrA}/><Pills opts={t.hCrAs} val={f.crA} ch={v=>set("crA",v)}/><Div l={t.hCopy}/><Pills opts={t.hCopys} val={f.cpF} ch={v=>set("cpF",v)}/><div style={{display:"flex",gap:10,marginTop:24}}><div style={{flex:1}}><Btn onClick={()=>setSt(1)} sec>{t.prv}</Btn></div><div style={{flex:4}}><Btn onClick={handleAnalyze}>{t.analyze}</Btn></div></div></>}
  </div>;
}

// ── MODULE 2: BUDGET PACE ────────────────────────────────────────────────────
function BudgetMod({t,lang}){
  const td=new Date().toISOString().split("T")[0];
  const [tot,setTot]=useState(""); const [sp,setSp]=useState("");
  const [st,setSt]=useState(""); const [en,setEn]=useState(""); const [now,setNow]=useState(td);
  const [phases,setPh]=useState([{fr:"",to:"",pct:""}]);
  const [done,setDone]=useState(false);
  const sr=lang==="sr";
  const addPh=()=>setPh(p=>[...p,{fr:"",to:"",pct:""}]);
  const remPh=i=>setPh(p=>p.filter((_,x)=>x!==i));
  const setPhi=(i,k,v)=>setPh(p=>p.map((ph,x)=>x===i?{...ph,[k]:v}:ph));
  const calc=()=>{
    const T=parseFloat(tot)||0; const S=parseFloat(sp)||0;
    const A=new Date(st); const B=new Date(en); const N=new Date(now);
    if(!T||!st||!en) return null;
    const tD=Math.max(1,Math.round((B-A)/(86400000)));
    const el=Math.max(0,Math.round((N-A)/(86400000)));
    const dl=Math.max(0,tD-el); const rem=T-S;
    const ideal=T*(el/tD); const dIdeal=T/tD;
    const dNeed=dl>0?rem/dl:0;
    const diff=(S-ideal)/Math.max(ideal,1);
    const stat=Math.abs(diff)<0.1?"on":diff>0.1?"over":"under";
    const pRes=phases.filter(p=>p.fr&&p.to&&p.pct).map(p=>{
      const pA=new Date(st); pA.setDate(pA.getDate()+(parseInt(p.fr)-1));
      const pB=new Date(st); pB.setDate(pB.getDate()+(parseInt(p.to)-1));
      const pD=Math.max(1,Math.round((pB-pA)/(86400000)));
      const pBud=T*(parseFloat(p.pct)/100);
      return{fr:p.fr,to:p.to,pct:p.pct,bud:pBud,daily:pBud/pD,days:pD,cur:N>=pA&&N<=pB};
    });
    return{T,S,rem,tD,el,dl,ideal,dIdeal,dNeed,stat,pRes};
  };
  const r=done?calc():null;
  const SI={on:{c:C.grn,l:t.bON,i:"✅"},over:{c:C.red,l:t.bOV,i:"🔴"},under:{c:C.yel,l:t.bUN,i:"⚠️"}};
  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.bTitle}</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 22px"}}>{t.bSub}</p>
    {!done&&<>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
        <div><Lbl c={t.bTot}/><NIn v={tot} ch={setTot} ph={t.bTotPh} sx="€"/></div>
        <div><Lbl c={t.bSp}/><NIn v={sp} ch={setSp} ph={t.bSpPh} sx="€"/></div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
        <div><Lbl c={t.bSt}/><DIn v={st} ch={setSt}/></div>
        <div><Lbl c={t.bEn}/><DIn v={en} ch={setEn}/></div>
        <div><Lbl c={t.bTd}/><DIn v={now} ch={setNow}/></div>
      </div>
      <Div l={t.bPhT}/>
      <p style={{color:C.mut,fontSize:12,margin:"0 0 14px"}}>{t.bPhS}</p>
      {phases.map((ph,i)=><div key={i} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:11,padding:"13px 15px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{color:C.txt,fontWeight:700,fontSize:13}}>{t.bPh} {i+1}</span>{phases.length>1&&<button onClick={()=>remPh(i)} style={{background:"none",border:"none",color:C.red,fontSize:12,cursor:"pointer",fontWeight:600}}>{t.bRem}</button>}</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div><Lbl c={t.bFr}/><NIn v={ph.fr} ch={v=>setPhi(i,"fr",v)} ph="1"/></div>
          <div><Lbl c={t.bTo}/><NIn v={ph.to} ch={v=>setPhi(i,"to",v)} ph="15"/></div>
          <div><Lbl c={t.bPct}/><NIn v={ph.pct} ch={v=>setPhi(i,"pct",v)} ph="40" sx="%"/></div>
        </div>
      </div>)}
      <button onClick={addPh} style={{background:"none",border:`1px dashed ${C.brd}`,borderRadius:10,color:C.acl,fontSize:13,fontWeight:600,cursor:"pointer",width:"100%",padding:"11px",marginBottom:20}}>{t.bAdd}</button>
      <Btn onClick={()=>setDone(true)} disabled={!tot||!st||!en}>{t.calc}</Btn>
    </>}
    {done&&r&&<>
      <div className="g2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <SBdg l={t.bDE} v={`${r.el} ${sr?"dana":"days"}`}/>
        <SBdg l={t.bDL} v={`${r.dl} ${sr?"dana":"days"}`}/>
        <SBdg l={t.bRem2} v={`€${Math.round(r.rem).toLocaleString()}`}/>
        <SBdg l={t.bDI} v={`€${Math.round(r.dIdeal)}/${sr?"dan":"day"}`}/>
      </div>
      <div style={{background:`${SI[r.stat].c}15`,border:`1px solid ${SI[r.stat].c}40`,borderRadius:14,padding:"18px",marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:6}}>{SI[r.stat].i}</div>
        <div style={{color:SI[r.stat].c,fontWeight:800,fontSize:16,marginBottom:4}}>{t.bStat}: {SI[r.stat].l}</div>
        <div style={{color:C.mut,fontSize:13}}>
          {r.stat==="on"&&(sr?`Idealno do danas: €${Math.round(r.ideal).toLocaleString()} · Stvarno: €${Math.round(r.S).toLocaleString()}`:`Ideal to date: €${Math.round(r.ideal).toLocaleString()} · Actual: €${Math.round(r.S).toLocaleString()}`)}
          {r.stat==="over"&&(sr?`Potrošeno €${Math.round(r.S-r.ideal).toLocaleString()} više od plana. Uspori potrošnju.`:`Spent €${Math.round(r.S-r.ideal).toLocaleString()} over plan. Slow down spending.`)}
          {r.stat==="under"&&(sr?`Potrošeno €${Math.round(r.ideal-r.S).toLocaleString()} manje od plana. Ubrzi potrošnju.`:`Spent €${Math.round(r.ideal-r.S).toLocaleString()} under plan. Speed up spending.`)}
        </div>
      </div>
      <div style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:12,padding:"16px",marginBottom:16,textAlign:"center"}}>
        <div style={{color:C.mut,fontSize:11,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:6}}>{t.bDN}</div>
        <div style={{color:C.acl,fontWeight:900,fontSize:32}}>€{Math.round(r.dNeed)}<span style={{fontSize:16,fontWeight:500}}>/{sr?"dan":"day"}</span></div>
        <div style={{color:C.mut,fontSize:12,marginTop:4}}>{sr?`da se iskoristi €${Math.round(r.rem).toLocaleString()} u ${r.dl} dana`:`to spend €${Math.round(r.rem).toLocaleString()} in ${r.dl} days`}</div>
      </div>
      {r.pRes.length>0&&<><ST c={t.bPS}/>{r.pRes.map((ph,i)=><div key={i} style={{background:ph.cur?"rgba(99,102,241,0.1)":C.sur,border:`1px solid ${ph.cur?"rgba(99,102,241,0.3)":C.brd}`,borderRadius:11,padding:"13px 15px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{color:C.txt,fontWeight:700,fontSize:13}}>{t.bPh} {i+1} – {sr?`Dan ${ph.fr}–${ph.to}`:`Day ${ph.fr}–${ph.to}`} ({ph.pct}%)</span>{ph.cur&&<span style={{background:"rgba(99,102,241,0.2)",color:C.acl,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20}}>{t.bCP}</span>}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div style={{color:C.mut,fontSize:12}}>{t.bPB}: <span style={{color:C.txt,fontWeight:700}}>€{Math.round(ph.bud).toLocaleString()}</span></div><div style={{color:C.mut,fontSize:12}}>{t.bPD}: <span style={{color:C.acl,fontWeight:700}}>€{Math.round(ph.daily)}/{sr?"dan":"day"}</span></div></div></div>)}</>}
      <Btn onClick={()=>setDone(false)} sec>{t.newA}</Btn>
    </>}
  </div>;
}

// ── AI HELPER ────────────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

async function callClaude(prompt, lang) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ── MODULE 3: AD COPY (AI) ───────────────────────────────────────────────────
function CopyMod({t,lang}){
  const sr=lang==="sr";
  const [f,setF]=useState({prod:"",aud:"",goal:"",tone:"",usp:"",off:""});
  const [cops,setCops]=useState([]);
  const [done,setDone]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [cpd,setCpd]=useState(null);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));

  const gen=async()=>{
    setLoading(true); setError(""); setCops([]);
    try {
      const prompt = sr
        ? `Ti si ekspert za Meta Ads marketing na srpskom tržištu. Napiši 5 različitih varijanti ad copy-ja za Meta oglase.

Proizvod/Usluga: ${f.prod}
Ciljna publika: ${f.aud||"opšta publika"}
Glavna prednost (USP): ${f.usp||f.prod}
Ponuda/CTA: ${f.off||"Saznaj više"}
Cilj oglasa: ${f.goal||"Prodaja"}
Ton komunikacije: ${f.tone||"Profesionalan"}

Vrati SAMO JSON u ovom formatu, bez ikakvog teksta pre ili posle:
[
  {"l":"Varijanta 1 – Problem/Rešenje","p":"primary text ovde","h":"headline ovde","c":"CTA ovde"},
  {"l":"Varijanta 2 – Social Proof","p":"primary text ovde","h":"headline ovde","c":"CTA ovde"},
  {"l":"Varijanta 3 – Direktna ponuda","p":"primary text ovde","h":"headline ovde","c":"CTA ovde"},
  {"l":"Varijanta 4 – Benefit-driven","p":"primary text ovde","h":"headline ovde","c":"CTA ovde"},
  {"l":"Varijanta 5 – Urgency/FOMO","p":"primary text ovde","h":"headline ovde","c":"CTA ovde"}
]

Svaka varijanta mora biti jedinstvena i kreativna. Primary text 3-5 rečenica. Headline max 10 reči.`
        : `You are a Meta Ads expert. Write 5 different ad copy variants for Meta ads.

Product/Service: ${f.prod}
Target audience: ${f.aud||"general audience"}
Main advantage (USP): ${f.usp||f.prod}
Offer/CTA: ${f.off||"Learn more"}
Ad objective: ${f.goal||"Sales"}
Communication tone: ${f.tone||"Professional"}

Return ONLY JSON in this format, no text before or after:
[
  {"l":"Variant 1 – Problem/Solution","p":"primary text here","h":"headline here","c":"CTA here"},
  {"l":"Variant 2 – Social Proof","p":"primary text here","h":"headline here","c":"CTA here"},
  {"l":"Variant 3 – Direct Offer","p":"primary text here","h":"headline here","c":"CTA here"},
  {"l":"Variant 4 – Benefit-driven","p":"primary text here","h":"headline here","c":"CTA here"},
  {"l":"Variant 5 – Urgency/FOMO","p":"primary text here","h":"headline here","c":"CTA here"}
]

Each variant must be unique and creative. Primary text 3-5 sentences. Headline max 10 words.`;

      const raw = await callClaude(prompt, lang);
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setCops(parsed);
      setDone(true);
    } catch(e) {
      setError(sr?"Greška pri generisanju. Proveri internet konekciju i pokušaj ponovo.":"Error generating copy. Check your internet connection and try again.");
    }
    setLoading(false);
  };

  const cp=(txt,i)=>{ navigator.clipboard?.writeText(txt).then(()=>{setCpd(i);setTimeout(()=>setCpd(null),2000);}); };

  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.cTitle}</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 6px"}}>{t.cSub}</p>
    <div style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10,padding:"10px 14px",marginBottom:20,display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:14}}>✦</span>
      <span style={{color:C.acl,fontSize:12,fontWeight:600}}>{sr?"Svaki put novi, jedinstveni copy":"Unique copy every time"}</span>
    </div>
    {!done&&<>
      <Lbl c={t.cProd}/><div style={{marginBottom:14}}><TIn v={f.prod} ch={v=>set("prod",v)} ph={t.cProdPh}/></div>
      <Lbl c={t.cAud}/><div style={{marginBottom:14}}><TIn v={f.aud} ch={v=>set("aud",v)} ph={t.cAudPh}/></div>
      <Lbl c={t.cUSP}/><div style={{marginBottom:14}}><TIn v={f.usp} ch={v=>set("usp",v)} ph={t.cUSPPh}/></div>
      <Lbl c={t.cOff}/><div style={{marginBottom:16}}><TIn v={f.off} ch={v=>set("off",v)} ph={t.cOffPh}/></div>
      <Lbl c={t.cGoal}/><div style={{marginBottom:14}}><Pills opts={t.cGoals} val={f.goal} ch={v=>set("goal",v)}/></div>
      <Lbl c={t.cTone}/><div style={{marginBottom:22}}><Pills opts={t.cTones} val={f.tone} ch={v=>set("tone",v)}/></div>
      {error&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"12px",marginBottom:16,color:C.red,fontSize:13}}>{error}</div>}
      <Btn onClick={gen} disabled={!f.prod||loading}>
        {loading?(sr?"⏳ Generišem copy...":"⏳ Generating copy..."):t.gen}
      </Btn>
    </>}
    {done&&<>
      <ST c={t.cCops}/>
      {cops.map((c,i)=><div key={i} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,padding:"15px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{color:C.acl,fontWeight:700,fontSize:12}}>{c.l}</span>
          <button onClick={()=>cp(`${c.p}\n\n${c.h}`,i)} style={{background:"rgba(99,102,241,0.2)",border:"none",color:C.acl,fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:20,cursor:"pointer"}}>{cpd===i?t.cCopd:t.cCopy}</button>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{color:C.dim,fontSize:10,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:4}}>{t.cPrim}</div>
          <div style={{color:"rgba(255,255,255,0.75)",fontSize:12,lineHeight:1.7,whiteSpace:"pre-line"}}>{c.p}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><div style={{color:C.dim,fontSize:10,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:4}}>{t.cHead}</div><div style={{color:C.txt,fontSize:13,fontWeight:600}}>{c.h}</div></div>
          <div><div style={{color:C.dim,fontSize:10,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:4}}>{t.cCTA}</div><div style={{color:C.acl,fontSize:13,fontWeight:600}}>{c.c}</div></div>
        </div>
      </div>)}
      <div style={{display:"flex",gap:10,marginTop:4}}>
        <Btn onClick={()=>{setDone(false);setCops([]);}} sec>{t.newA}</Btn>
        <Btn onClick={()=>{setDone(false);setTimeout(gen,100);}}>{sr?"🔄 Generiši ponovo":"🔄 Regenerate"}</Btn>
      </div>
    </>}
  </div>;
}

// ── MODULE 4: AUDIENCE PLANNER ───────────────────────────────────────────────
function AudMod({t,lang}){
  const [f,setF]=useState({ind:"",goal:"",mb:"",px:""});
  const [done,setDone]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const plan=done?genAudPlan(lang,{ind:f.ind,mb:f.mb,px:f.px}):null;
  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.aTitle}</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 22px"}}>{t.aSub}</p>
    {!done&&<><Lbl c={t.aInd}/><div style={{marginBottom:16}}><Pills opts={t.aInds} val={f.ind} ch={v=>set("ind",v)}/></div><Lbl c={t.aGoal}/><div style={{marginBottom:16}}><Pills opts={t.aGoals} val={f.goal} ch={v=>set("goal",v)}/></div><Lbl c={t.aMB}/><div style={{marginBottom:16}}><NIn v={f.mb} ch={v=>set("mb",v)} ph={t.aMBPh} sx="€"/></div><Lbl c={t.aPx}/><div style={{marginBottom:22}}><Pills opts={t.aPxs} val={f.px} ch={v=>set("px",v)}/></div><Btn onClick={()=>setDone(true)} disabled={!f.ind||!f.mb}>{t.calc}</Btn></>}
    {done&&plan&&<>
      <ST c={t.aBSp}/>
      {[["cold",t.aCold,"🧊"],["warm",t.aWarm,"🌡️"],["ret",t.aRet,"🎯"]].map(([k,label,icon])=><div key={k} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:11,padding:"13px 15px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{color:C.txt,fontWeight:700,fontSize:14}}>{icon} {label}</span><div style={{textAlign:"right"}}><span style={{color:C.acl,fontWeight:800,fontSize:16}}>€{plan.split[k].b.toLocaleString()}</span><span style={{color:C.mut,fontSize:12,marginLeft:8}}>{plan.split[k].p}%</span></div></div><div style={{height:4,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${plan.split[k].p}%`,background:"linear-gradient(90deg,#6366F1,#8B5CF6)",borderRadius:2}}/></div></div>)}
      <div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"14px",marginBottom:16}}><div style={{color:C.acl,fontSize:10,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:8}}>{t.aWhy}</div><div style={{color:"rgba(255,255,255,0.65)",fontSize:12,lineHeight:1.7}}>{plan.why}</div></div>
      {[["cold",t.aCold,plan.coldT,"🧊"],["warm",t.aWarm,plan.warmT,"🌡️"],["ret",t.aRet,plan.retT,"🎯"]].map(([k,label,tips,icon])=><div key={k} style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:11,padding:"13px 15px",marginBottom:10}}><div style={{color:C.txt,fontWeight:700,fontSize:13,marginBottom:10}}>{icon} {label} – {t.aTips}</div>{tips.map((tip,i)=><div key={i} style={{color:"rgba(255,255,255,0.65)",fontSize:12,lineHeight:1.6,padding:"4px 0",borderBottom:i<tips.length-1?`1px solid ${C.brd}`:"none"}}>• {tip}</div>)}</div>)}
      <Btn onClick={()=>setDone(false)} sec>{t.newA}</Btn>
    </>}
  </div>;
}

// ── MODULE 5: ROAS CALC ──────────────────────────────────────────────────────
function RoasMod({t,lang}){
  const [f,setF]=useState({pp:"",cogs:"",as:"",oc:"",ec:""});
  const [done,setDone]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const sr=lang==="sr";
  const calc=()=>{
    const pp=parseFloat(f.pp)||0; const cogs=parseFloat(f.cogs)||0;
    const as=parseFloat(f.as)||0; const oc=parseFloat(f.oc)||0; const ec=parseFloat(f.ec)||0;
    if(!pp||!as) return null;
    const mg=pp-cogs; const mgP=pp>0?(mg/pp)*100:0;
    const rev=pp*ec; const tc=as+oc;
    const gp=mg*ec; const np=gp-tc;
    const beRev=mgP>0?tc/(mgP/100):0;
    const beROAS=as>0?beRev/as:0;
    const crROAS=as>0?rev/as:0;
    const scen=[1.5,2,3,4,5,6].map(roas=>({roas,rev:as*roas,prof:(as*roas*(mgP/100))-tc}));
    return{mg,mgP,rev,np,beRev,beROAS,crROAS,scen,tc};
  };
  const r=done?calc():null;
  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.rTitle}</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 22px"}}>{t.rSub}</p>
    {!done&&<><div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:14}}>
      <div><Lbl c={t.rPP}/><NIn v={f.pp} ch={v=>set("pp",v)} ph={t.rPPPh} sx="€"/></div>
      <div><Lbl c={t.rCOGS}/><NIn v={f.cogs} ch={v=>set("cogs",v)} ph={t.rCOGSPh} sx="€"/></div>
      <div><Lbl c={t.rAS}/><NIn v={f.as} ch={v=>set("as",v)} ph={t.rASPh} sx="€"/></div>
      <div><Lbl c={t.rOC}/><NIn v={f.oc} ch={v=>set("oc",v)} ph={t.rOCPh} sx="€"/></div>
    </div><Lbl c={t.rEC}/><div style={{marginBottom:22}}><NIn v={f.ec} ch={v=>set("ec",v)} ph={t.rECPh}/></div><Btn onClick={()=>setDone(true)} disabled={!f.pp||!f.as}>{t.calc}</Btn></>}
    {done&&r&&<>
      <div className="g2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <SBdg l={t.rMar} v={`${Math.round(r.mgP)}%`} s={r.mgP>40?"good":r.mgP>20?"ok":"poor"}/>
        <SBdg l={t.rBER} v={`${r.beROAS.toFixed(2)}x`}/>
        <SBdg l={t.rBEC} v={`€${Math.round(r.mg)}`}/>
        <SBdg l={t.rProf} v={`€${Math.round(r.np).toLocaleString()}`} s={r.np>0?"good":r.np>-500?"ok":"poor"}/>
      </div>
      <div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"14px",marginBottom:16}}>
        <div style={{color:C.acl,fontSize:12,lineHeight:1.7}}>
          {sr?`Break-even ROAS od ${r.beROAS.toFixed(2)}x znači da moraš ostvariti €${Math.round(r.beRev).toLocaleString()} prihoda na €${Math.round(parseFloat(f.as)).toLocaleString()} ad spend-a da pokriješ sve troškove. Trenutni ROAS scenario: ${r.crROAS.toFixed(2)}x = €${Math.round(r.np).toLocaleString()} ${r.np>=0?"profita":"gubitka"}.`
          :`Break-even ROAS of ${r.beROAS.toFixed(2)}x means you need €${Math.round(r.beRev).toLocaleString()} revenue on €${Math.round(parseFloat(f.as)).toLocaleString()} ad spend to cover all costs. Current ROAS scenario: ${r.crROAS.toFixed(2)}x = €${Math.round(r.np).toLocaleString()} ${r.np>=0?"profit":"loss"}.`}
        </div>
      </div>
      <ST c={t.rScen}/>
      <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",padding:"10px 14px",borderBottom:`1px solid ${C.brd}`}}>
          {[t.rROAS,t.rRev,t.rPro,t.rSt].map((h,i)=><div key={i} style={{color:C.mut,fontSize:10,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase"}}>{h}</div>)}
        </div>
        {r.scen.map((s,i)=>{ const stt=s.prof>0?"good":s.prof>-500?"ok":"poor"; const cfg=SC[stt]; return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",padding:"10px 14px",borderBottom:i<r.scen.length-1?`1px solid ${C.brd}`:"none",background:s.roas>=r.beROAS&&(i===0||r.scen[i-1].roas<r.beROAS)?"rgba(99,102,241,0.1)":"none"}}><div style={{color:C.txt,fontWeight:700,fontSize:13}}>{s.roas}x</div><div style={{color:C.mut,fontSize:12}}>€{Math.round(s.rev).toLocaleString()}</div><div style={{color:cfg.c,fontSize:12,fontWeight:600}}>€{Math.round(s.prof).toLocaleString()}</div><div style={{fontSize:11}}>{s.prof>0?(sr?"✅ Profit":"✅ Profit"):(sr?"❌ Gubitak":"❌ Loss")}</div></div>; })}
      </div>
      <Btn onClick={()=>setDone(false)} sec>{t.newA}</Btn>
    </>}
  </div>;
}

// ── MODULE 6: CHECKLIST ──────────────────────────────────────────────────────
function CheckMod({t,lang}){
  const cl=clData(lang);
  const all=cl.flatMap(c=>c.items);
  const [chk,setChk]=useState({}); const [exp,setExp]=useState({});
  const tog=id=>setChk(c=>({...c,[id]:!c[id]}));
  const togE=id=>setExp(e=>({...e,[id]:!e[id]}));
  const done=Object.values(chk).filter(Boolean).length;
  const pct=Math.round((done/all.length)*100);
  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.lTitle}</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 16px"}}>{t.lSub}</p>
    <div style={{background:C.sur,borderRadius:11,padding:"14px",marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{color:C.mut,fontSize:12,fontWeight:700}}>{t.lProg}</span><span style={{color:pct===100?C.grn:C.acl,fontSize:13,fontWeight:800}}>{done}/{all.length} ({pct}%)</span></div>
      <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct===100?"linear-gradient(90deg,#34D399,#10b981)":"linear-gradient(90deg,#6366F1,#8B5CF6)",borderRadius:3,transition:"width 0.4s"}}/></div>
      {pct===100&&<div style={{color:C.grn,fontWeight:700,fontSize:13,marginTop:10,textAlign:"center"}}>{t.lDone}</div>}
    </div>
    {cl.map(cat=><div key={cat.cat} style={{marginBottom:20}}>
      <ST c={cat.cat}/>
      {cat.items.map(item=><div key={item.id} style={{background:chk[item.id]?"rgba(52,211,153,0.05)":C.sur,border:`1px solid ${chk[item.id]?C.gBr:C.brd}`,borderRadius:11,marginBottom:8,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12,padding:"13px 15px",cursor:"pointer"}} onClick={()=>tog(item.id)}>
          <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${chk[item.id]?C.grn:"rgba(255,255,255,0.2)"}`,background:chk[item.id]?C.grn:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.2s"}}>{chk[item.id]&&<span style={{color:"#000",fontSize:12,fontWeight:900}}>✓</span>}</div>
          <span style={{color:chk[item.id]?"rgba(255,255,255,0.5)":C.txt,fontSize:13,lineHeight:1.5,textDecoration:chk[item.id]?"line-through":"none",flex:1}}>{item.t}</span>
        </div>
        <div style={{padding:"0 15px 10px 47px"}}>
          <button onClick={()=>togE(item.id)} style={{background:"none",border:"none",color:C.acl,fontSize:11,fontWeight:600,cursor:"pointer",padding:0}}>
            {exp[item.id]?`▲ ${lang==="sr"?"Sakrij":"Hide"}`:`▼ ${t.lWhy}`}
          </button>
          {exp[item.id]&&<div style={{marginTop:10}}>
            <div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:9,padding:"10px 12px",marginBottom:8}}>
              <div style={{color:C.acl,fontSize:10,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:5}}>{t.lWhy}</div>
              <div style={{color:"rgba(255,255,255,0.65)",fontSize:12,lineHeight:1.7}}>{item.w}</div>
            </div>
            <div style={{background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.15)",borderRadius:9,padding:"10px 12px"}}>
              <div style={{color:C.grn,fontSize:10,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:5}}>{t.lHow}</div>
              <div style={{color:"rgba(255,255,255,0.65)",fontSize:12,lineHeight:1.7}}>{item.h}</div>
            </div>
          </div>}
        </div>
      </div>)}
    </div>)}
  </div>;
}

// ── MODULE 7: BUDGET SCALING CALCULATOR ─────────────────────────────────────
function ScalingMod({t,lang}){
  const sr=lang==="sr";
  const [f,setF]=useState({curBud:"",tarBud:"",curROAS:"",curCPA:"",ctr:"",freq:"",period:"7 dana"});
  const [done,setDone]=useState(false);
  const set=(k,v)=>setF(x=>({...x,[k]:v}));

  const calc=()=>{
    const cb=parseFloat(f.curBud)||0;
    const tb=parseFloat(f.tarBud)||0;
    const cROAS=parseFloat(f.curROAS)||0;
    const cCPA=parseFloat(f.curCPA)||0;
    const ctr=parseFloat(f.ctr)||0;
    const freq=parseFloat(f.freq)||0;
    const days=f.period.includes("7")?7:f.period.includes("14")?14:30;
    if(!cb||!tb) return null;

    const totalInc=(tb-cb)/cb*100;
    const maxIncPerStep=25;
    const stepDays=3;
    const steps=[];
    let cur=cb;
    let day=1;
    while(cur<tb&&day<=days){
      const inc=Math.min(cur*maxIncPerStep/100, tb-cur);
      const next=Math.min(cur+inc,tb);
      steps.push({day,from:Math.round(cur),to:Math.round(next),pct:Math.round((next-cur)/cur*100)});
      cur=next;
      day+=stepDays;
    }

    // Risk assessment
    const warnings=[];
    const tips=[];

    // Frequency warnings
    if(freq>=4){
      warnings.push(sr?"🔴 Frekvencija "+freq+"x je kritično visoka. Skaliranje budžeta će ubrzati zasićenje publike i povećati CPA. Pre skaliranja obavezno osvoji publiku – dodaj novi LAL ili Broad audience.":"🔴 Frequency "+freq+"x is critically high. Scaling budget will accelerate audience saturation and increase CPA. Before scaling, refresh audience – add new LAL or Broad audience.");
    } else if(freq>=3){
      warnings.push(sr?"⚠️ Frekvencija "+freq+"x je na granici. Prati je tokom skaliranja i reaguj ako pređe 3.5x.":"⚠️ Frequency "+freq+"x is borderline. Monitor it during scaling and react if it exceeds 3.5x.");
    } else if(freq>0){
      tips.push(sr?"✅ Frekvencija "+freq+"x je OK – publika ima prostora za veći budžet.":"✅ Frequency "+freq+"x is fine – audience has room for more budget.");
    }

    // CTR warnings
    if(ctr<0.5){
      warnings.push(sr?"🔴 CTR od "+ctr+"% je prenizak za skaliranje. Povećanje budžeta uz lošu kreativu = veći troškovi, isti loši rezultati. Prvo testiraj novu kreativu, pa skaliraj.":"🔴 CTR of "+ctr+"% is too low for scaling. Increasing budget with poor creative = higher costs, same bad results. First test new creative, then scale.");
    } else if(ctr<1){
      warnings.push(sr?"⚠️ CTR od "+ctr+"% je ispod proseka. Razmotri A/B test nove kreative paralelno sa skaliranjem.":"⚠️ CTR of "+ctr+"% is below average. Consider A/B testing new creative alongside scaling.");
    } else {
      tips.push(sr?"✅ CTR od "+ctr+"% je dobar – kreativa može da podrži veći budžet.":"✅ CTR of "+ctr+"% is good – creative can support higher budget.");
    }

    // ROAS warnings
    if(cROAS<2){
      warnings.push(sr?"🔴 ROAS od "+cROAS+"x je nizak za agresivno skaliranje. Popravi profitabilnost pre nego što povećaš budžet.":"🔴 ROAS of "+cROAS+"x is low for aggressive scaling. Fix profitability before increasing budget.");
    } else if(cROAS>=3){
      tips.push(sr?"✅ ROAS od "+cROAS+"x je solidan – dobra osnova za skaliranje.":"✅ ROAS of "+cROAS+"x is solid – good foundation for scaling.");
    }

    // Scaling aggressiveness
    const daysNeeded=steps.length>0?steps[steps.length-1].day:0;
    if(totalInc>200&&days<=7){
      warnings.push(sr?"🔴 Plan je preagresivan – "+Math.round(totalInc)+"% povećanja za "+days+" dana može resetovati learning phase i destabilizovati kampanju.":"🔴 Plan is too aggressive – "+Math.round(totalInc)+"% increase in "+days+" days can reset the learning phase and destabilize the campaign.");
    } else if(totalInc>100&&days<=7){
      warnings.push(sr?"⚠️ Udvostručavanje budžeta za 7 dana je rizično. Preporučujemo 14-dnevni period za ovaj nivo povećanja.":"⚠️ Doubling budget in 7 days is risky. We recommend a 14-day period for this level of increase.");
    }

    // Expected metrics during scaling
    const cpaIncreasePct=totalInc>100?25:totalInc>50?15:10;
    const roasDropPct=totalInc>100?20:totalInc>50?12:8;
    const expCPALow=Math.round(cCPA*(1+cpaIncreasePct/200)*10)/10;
    const expCPAHigh=Math.round(cCPA*(1+cpaIncreasePct/100)*10)/10;
    const expROASLow=Math.round(cROAS*(1-roasDropPct/100)*10)/10;
    const expROASHigh=Math.round(cROAS*(1-roasDropPct/200)*10)/10;

    // Overall risk
    const risk=warnings.filter(w=>w.includes("🔴")).length>=2?"high":warnings.length>=2?"medium":warnings.length===1?"low":"safe";

    return{steps,warnings,tips,totalInc,days,expCPALow,expCPAHigh,expROASLow,expROASHigh,risk,daysNeeded};
  };

  const r=done?calc():null;
  const riskCfg={
    safe:{c:C.grn,bg:C.gBg,br:C.gBr,l:sr?"Spreman za skaliranje ✅":"Ready to scale ✅",i:"🚀"},
    low:{c:"#60C8FF",bg:"#001a2c",br:"#003a5c",l:sr?"Nizak rizik – pažljivo skaliraj":"Low risk – scale carefully",i:"✅"},
    medium:{c:C.yel,bg:C.yBg,br:C.yBr,l:sr?"Srednji rizik – prati metrike":"Medium risk – monitor metrics",i:"⚠️"},
    high:{c:C.red,bg:C.rBg,br:C.rBr,l:sr?"Visok rizik – nije preporučeno":"High risk – not recommended",i:"🔴"},
  };

  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.scTitle}</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 22px"}}>{t.scSub}</p>
    {!done&&<>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:4}}>
        <div><Lbl c={t.scCurBud}/><NIn v={f.curBud} ch={v=>set("curBud",v)} ph={t.scCurBudPh} sx="€"/></div>
        <div><Lbl c={t.scTarBud}/><NIn v={f.tarBud} ch={v=>set("tarBud",v)} ph={t.scTarBudPh} sx="€"/></div>
        <div><Lbl c={t.scCurROAS}/><NIn v={f.curROAS} ch={v=>set("curROAS",v)} ph={t.scCurROASPh} sx="x"/></div>
        <div><Lbl c={t.scCurCPA}/><NIn v={f.curCPA} ch={v=>set("curCPA",v)} ph={t.scCurCPAPh} sx="€"/></div>
        <div><Lbl c={t.scCTR}/><NIn v={f.ctr} ch={v=>set("ctr",v)} ph={t.scCTRPh} sx="%"/></div>
        <div><Lbl c={t.scFreq}/><NIn v={f.freq} ch={v=>set("freq",v)} ph={t.scFreqPh} sx="x"/></div>
      </div>
      <Div l={t.scPeriod}/>
      <Pills opts={t.scPers} val={f.period} ch={v=>set("period",v)}/>
      <div style={{marginTop:22}}><Btn onClick={()=>setDone(true)} disabled={!f.curBud||!f.tarBud}>{t.scCalc}</Btn></div>
    </>}
    {done&&r&&<>
      {/* Risk badge */}
      <div style={{background:riskCfg[r.risk].bg,border:`1px solid ${riskCfg[r.risk].br}`,borderRadius:14,padding:"18px",marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:30,marginBottom:6}}>{riskCfg[r.risk].i}</div>
        <div style={{color:riskCfg[r.risk].c,fontWeight:800,fontSize:16,marginBottom:4}}>{t.scReady}: {riskCfg[r.risk].l}</div>
        <div style={{color:C.mut,fontSize:13}}>{sr?`€${Math.round(parseFloat(f.curBud))} → €${Math.round(parseFloat(f.tarBud))} · +${Math.round(r.totalInc)}% · ${r.steps.length} koraka`:`€${Math.round(parseFloat(f.curBud))} → €${Math.round(parseFloat(f.tarBud))} · +${Math.round(r.totalInc)}% · ${r.steps.length} steps`}</div>
      </div>

      {/* Warnings */}
      {r.warnings.length>0&&<>
        <ST c={t.scWarn}/>
        <div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:"14px",marginBottom:16}}>
          {r.warnings.map((w,i)=><div key={i} style={{color:"rgba(255,255,255,0.8)",fontSize:12,lineHeight:1.7,padding:"6px 0",borderBottom:i<r.warnings.length-1?`1px solid ${C.brd}`:"none"}}>{w}</div>)}
        </div>
      </>}

      {/* Tips */}
      {r.tips.length>0&&<>
        <ST c={t.scTips}/>
        <div style={{background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:12,padding:"14px",marginBottom:16}}>
          {r.tips.map((tip,i)=><div key={i} style={{color:"rgba(255,255,255,0.75)",fontSize:12,lineHeight:1.7,padding:"5px 0",borderBottom:i<r.tips.length-1?`1px solid ${C.brd}`:"none"}}>{tip}</div>)}
        </div>
      </>}

      {/* Expected metrics */}
      {(parseFloat(f.curCPA)>0||parseFloat(f.curROAS)>0)&&<>
        <ST c={sr?"Očekivane metrike tokom skaliranja":"Expected metrics during scaling"}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {parseFloat(f.curCPA)>0&&<div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:11,padding:"13px"}}>
            <div style={{color:C.mut,fontSize:11,marginBottom:6}}>{t.scExpCPA}</div>
            <div style={{color:C.yel,fontWeight:800,fontSize:16}}>€{r.expCPALow}–{r.expCPAHigh}</div>
            <div style={{color:C.mut,fontSize:11,marginTop:4}}>{sr?"vs trenutnih €"+f.curCPA:"vs current €"+f.curCPA}</div>
          </div>}
          {parseFloat(f.curROAS)>0&&<div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:11,padding:"13px"}}>
            <div style={{color:C.mut,fontSize:11,marginBottom:6}}>{t.scExpROAS}</div>
            <div style={{color:C.yel,fontWeight:800,fontSize:16}}>{r.expROASLow}x–{r.expROASHigh}x</div>
            <div style={{color:C.mut,fontSize:11,marginTop:4}}>{sr?"vs trenutnih "+f.curROAS+"x":"vs current "+f.curROAS+"x"}</div>
          </div>}
        </div>
      </>}

      {/* Step plan */}
      <ST c={t.scPlan}/>
      <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:12,overflow:"hidden",marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",padding:"10px 14px",borderBottom:`1px solid ${C.brd}`}}>
          {[t.scDay,t.scBud,t.scInc].map((h,i)=><div key={i} style={{color:C.mut,fontSize:10,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase"}}>{h}</div>)}
        </div>
        {r.steps.map((s,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",padding:"11px 14px",borderBottom:i<r.steps.length-1?`1px solid ${C.brd}`:"none",background:i===0?"rgba(99,102,241,0.06)":"none"}}>
          <div style={{color:C.txt,fontWeight:700,fontSize:13}}>{s.day}</div>
          <div style={{color:C.acl,fontWeight:700,fontSize:13}}>€{s.to}</div>
          <div style={{color:s.pct>30?C.red:s.pct>20?C.yel:C.grn,fontSize:12,fontWeight:600}}>+{s.pct}%</div>
        </div>)}
        <div style={{padding:"11px 14px",background:"rgba(99,102,241,0.08)",display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
          <div style={{color:C.acl,fontWeight:700,fontSize:12}}>{sr?"Cilj":"Target"}</div>
          <div style={{color:C.grn,fontWeight:800,fontSize:13}}>€{Math.round(parseFloat(f.tarBud))}</div>
          <div style={{color:C.grn,fontSize:12,fontWeight:600}}>✓</div>
        </div>
      </div>

      <Btn onClick={()=>setDone(false)} sec>{t.scNew}</Btn>
    </>}
  </div>;
}

// ── MODULE 8: AI REPORT GENERATOR ────────────────────────────────────────────
function ReportMod({t,lang}){
  const sr=lang==="sr";
  const [type,setType]=useState(null); // null=izbor, "single", "compare"
  const [client,setClient]=useState("");
  const [period,setPeriod]=useState("");
  const [periodA,setPeriodA]=useState("");
  const [periodB,setPeriodB]=useState("");
  const [imgA,setImgA]=useState(null); const [prevA,setPrevA]=useState(null);
  const [imgB,setImgB]=useState(null); const [prevB,setPrevB]=useState(null);
  const [report,setReport]=useState(null);
  const [loading,setLoading]=useState(false);
  const [dragA,setDragA]=useState(false); const [dragB,setDragB]=useState(false);

  const handleFile=(file,setImg,setPrev)=>{
    if(!file||!file.type.startsWith("image/")) return;
    const reader=new FileReader();
    reader.onload=e=>{ setImg(e.target.result.split(",")[1]); setPrev(e.target.result); };
    reader.readAsDataURL(file);
  };

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
      if(type==="single"){
        content.push({type:"image",source:{type:"base64",media_type:"image/jpeg",data:imgA}});
        content.push({type:"text",text:sr
          ?`Ti si senior marketing konsultant. Klijent: "${client||"Nije navedeno"}". Period: "${period||"Nije navedeno"}". Piši isključivo na srpskom jeziku, ekavski (npr. "prosečan" ne "prosječan").

Analiziraj ovaj screenshot i napiši profesionalni izveštaj u JSON formatu:
{
  "execSummary": "2-3 rečenice executive summary za klijenta",
  "metrics": [{"name":"naziv metrike","value":"vrednost koju vidiš"}],
  "issues": ["problem 1","problem 2","problem 3"],
  "good": ["pozitivna stvar 1","pozitivna stvar 2"],
  "actions": ["akcija 1","akcija 2","akcija 3","akcija 4","akcija 5"],
  "strategic": ["preporuka 1","preporuka 2","preporuka 3"]
}
Vrati SAMO JSON, bez teksta pre ili posle.`
          :`You are a senior marketing consultant. Client: "${client||"Not specified"}". Period: "${period||"Not specified"}".

Analyze this screenshot and write a professional report in JSON format:
{
  "execSummary": "2-3 sentence executive summary for the client",
  "metrics": [{"name":"metric name","value":"value you see"}],
  "issues": ["issue 1","issue 2","issue 3"],
  "good": ["positive thing 1","positive thing 2"],
  "actions": ["action 1","action 2","action 3","action 4","action 5"],
  "strategic": ["recommendation 1","recommendation 2","recommendation 3"]
}
Return ONLY JSON, no text before or after.`});
      } else {
        content.push({type:"image",source:{type:"base64",media_type:"image/jpeg",data:imgA}});
        content.push({type:"text",text:sr?`Ovo je screenshot za Period A: ${periodA||"Period A"}`:`This is the screenshot for Period A: ${periodA||"Period A"}`});
        content.push({type:"image",source:{type:"base64",media_type:"image/jpeg",data:imgB}});
        content.push({type:"text",text:sr
          ?`Ovo je screenshot za Period B: ${periodB||"Period B"}. Klijent: "${client||"Nije navedeno"}". Piši isključivo na srpskom jeziku, ekavski (npr. "prosečan" ne "prosječan").

Uporedi ova dva perioda i vrati JSON:
{
  "execSummary": "2-3 rečenice executive summary poređenja",
  "comparison": [{"metric":"naziv metrike","valueA":"vrednost period A","valueB":"vrednost period B","change":"npr. +25%","better":true}],
  "issues": ["problem koji se vidi u poređenju 1","problem 2"],
  "good": ["poboljšanje 1","poboljšanje 2"],
  "actions": ["akcija 1","akcija 2","akcija 3"],
  "strategic": ["preporuka 1","preporuka 2"],
  "aiComment": "3-4 rečenice komentara na poređenje – šta se promenilo i zašto"
}
Za "better": true znači da je Period B bolji za tu metriku, false znači lošiji. Vrati SAMO JSON.`
          :`This is the screenshot for Period B: ${periodB||"Period B"}. Client: "${client||"Not specified"}".

Compare these two periods and return JSON:
{
  "execSummary": "2-3 sentence executive summary of comparison",
  "comparison": [{"metric":"metric name","valueA":"period A value","valueB":"period B value","change":"e.g. +25%","better":true}],
  "issues": ["issue seen in comparison 1","issue 2"],
  "good": ["improvement 1","improvement 2"],
  "actions": ["action 1","action 2","action 3"],
  "strategic": ["recommendation 1","recommendation 2"],
  "aiComment": "3-4 sentence AI comment on comparison – what changed and why"
}
For "better": true means Period B is better for that metric, false means worse. Return ONLY JSON.`});
      }
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2500,messages:[{role:"user",content}]})
      });
      const data=await res.json();
      const raw=data.content?.[0]?.text||"{}";
      const clean=raw.replace(/```json|```/g,"").trim();
      setReport({...JSON.parse(clean),client,period,periodA,periodB,type});
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
    <div style={{color:C.mut,fontSize:13}}>{sr?"Ovo može trajati 20-40 sekundi...":"This may take 20-40 seconds..."}}</div>
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

    {type==="single"&&<><Lbl c={t.rg_period}/><div style={{marginBottom:16}}><TIn v={period} ch={setPeriod} ph={t.rg_periodPh}/></div></>}
    {type==="compare"&&<div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
      <div><Lbl c={t.rg_periodA}/><TIn v={periodA} ch={setPeriodA} ph={t.rg_periodAPh}/></div>
      <div><Lbl c={t.rg_periodB}/><TIn v={periodB} ch={setPeriodB} ph={t.rg_periodBPh}/></div>
    </div>}

    <UploadBox img={imgA} prev={prevA} setImg={setImgA} setPrev={setPrevA} label={type==="compare"?t.rg_uploadA:t.rg_upload} drag={dragA} setDrag={setDragA} id="rgUploadA"/>
    {type==="compare"&&<UploadBox img={imgB} prev={prevB} setImg={setImgB} setPrev={setPrevB} label={t.rg_uploadB} drag={dragB} setDrag={setDragB} id="rgUploadB"/>}

    <Btn onClick={generate} disabled={!imgA||(type==="compare"&&!imgB)}>{t.rg_generate}</Btn>
  </div>;
}

// ── BOOKMARKLET CODE ─────────────────────────────────────────────────────────
const BOOKMARKLET_CODE="javascript:(function(){"+
"var appUrl='https://meta-ads-toolkit-a71e.vercel.app';"+
"var url=window.location.href;var title=document.title;var dateRange='';"+
"var dMatch=url.match(/date[=%3D]+([0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{4}-[0-9]{2}-[0-9]{2})/);"+
"if(dMatch){dateRange=dMatch[1].replace('_',' – ');}"+
"var fb=document.createElement('div');"+
"fb.style.cssText='position:fixed;top:20px;right:20px;z-index:99999;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:white;padding:14px 20px;border-radius:12px;font-family:sans-serif;font-size:14px;font-weight:600;box-shadow:0 8px 32px rgba(99,102,241,0.4)';"+
"fb.textContent='Meta Ads Toolkit – Otvaram...';document.body.appendChild(fb);"+
"var newTab=window.open(appUrl+'?source=screenshot&mod=9','_blank');"+
"fb.textContent='Meta Ads Toolkit – Pravim screenshot...';"+
"var payload={source:url,title:title,dateRange:dateRange,screenshot:null,tables:[],timestamp:new Date().toISOString()};"+
"var script=document.createElement('script');"+
"script.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';"+
"script.onload=function(){"+
"html2canvas(document.body,{scale:0.8,useCORS:true,allowTaint:true,logging:false,height:Math.min(window.innerHeight,1800)}).then(function(canvas){"+
"payload.screenshot=canvas.toDataURL('image/jpeg',0.75).split(',')[1];"+
"try{sessionStorage.setItem('mat_import',JSON.stringify(payload));}catch(e){"+
"try{"+
"payload.screenshot=canvas.toDataURL('image/jpeg',0.4).split(',')[1];"+
"sessionStorage.setItem('mat_import',JSON.stringify(payload));"+
"}catch(e2){payload.screenshot=null;sessionStorage.setItem('mat_import',JSON.stringify(payload));}}"+
"fb.textContent='Meta Ads Toolkit – Gotovo! Proverite novi tab.';"+
"if(newTab)newTab.postMessage({type:'MAT_READY'},'*');"+
"setTimeout(function(){fb.remove();},3000);"+
"}).catch(function(){"+
"payload.screenshot=null;"+
"try{sessionStorage.setItem('mat_import',JSON.stringify(payload));}catch(e){}"+
"fb.textContent='Meta Ads Toolkit – Otvoreno bez screenshota.';"+
"setTimeout(function(){fb.remove();},2000);});"+
"};"+
"script.onerror=function(){"+
"payload.screenshot=null;"+
"try{sessionStorage.setItem('mat_import',JSON.stringify(payload));}catch(e){}"+
"fb.textContent='Meta Ads Toolkit – Otvoreno (bez screenshot podrske).';"+
"setTimeout(function(){fb.remove();},2000);"+
"};"+
"document.head.appendChild(script);"+
"})();";

// ── MODULE 9: BOOKMARK CONNECTOR ─────────────────────────────────────────────
function BookmarkMod({t,lang}){
  const sr=lang==="sr";
  const [importedData,setImportedData]=useState(()=>{
    try{
      const params=new URLSearchParams(window.location.search);
      const source=params.get("source");
      const bmdata=params.get("bmdata");
      if(source==="screenshot"){
        const stored=sessionStorage.getItem("mat_import")||localStorage.getItem("mat_import_temp");
        if(stored){
          sessionStorage.removeItem("mat_import");
          localStorage.removeItem("mat_import_temp");
          const parsed=JSON.parse(stored);
          setTimeout(()=>window.history.replaceState({},"",window.location.pathname+"?mod=9"),100);
          return parsed;
        }
      }
      if(bmdata){
        const parsed=JSON.parse(decodeURIComponent(bmdata));
        setTimeout(()=>window.history.replaceState({},"",window.location.pathname+"?mod=9"),100);
        localStorage.setItem("mat_last_import",JSON.stringify(parsed));
        return parsed;
      }
      const stored=sessionStorage.getItem("mat_import");
      if(stored){ sessionStorage.removeItem("mat_import"); const p=JSON.parse(stored); return p; }
      const saved=localStorage.getItem("mat_last_import");
      if(saved) return JSON.parse(saved);
    }catch(e){}
    return null;
  });
  const [analysis,setAnalysis]=useState("");
  const [loading,setLoading]=useState(false);

  // Listen for postMessage from bookmarklet when screenshot is ready
  useEffect(()=>{
    const handler=(e)=>{
      if(e.data&&e.data.type==="MAT_READY"){
        try{
          const stored=sessionStorage.getItem("mat_import");
          if(stored){
            const parsed=JSON.parse(stored);
            sessionStorage.removeItem("mat_import");
            setImportedData(parsed);
          }
        }catch(err){}
      }
    };
    window.addEventListener("message",handler);
    return()=>window.removeEventListener("message",handler);
  },[]);

  const analyze=async()=>{
    if(!importedData) return;
    setLoading(true); setAnalysis("");
    try{
      const appUrl="https://api.anthropic.com/v1/messages";
      const headers={"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"};
      
      let messages;
      
      // If we have a screenshot, use vision
      if(importedData.screenshot){
        const prompt=sr
          ?`Ti si senior Meta Ads ekspert. Analiziraj ovaj screenshot iz ${importedData.title||"marketing alata"}. Piši isključivo na srpskom jeziku, ekavski.

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
          {type:"image",source:{type:"base64",media_type:"image/jpeg",data:importedData.screenshot}},
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
      setAnalysis(data.content?.[0]?.text||"");
    }catch(e){ setAnalysis(sr?"Greška pri analizi. Pokušaj ponovo.":"Error during analysis. Please try again."); }
    setLoading(false);
  };

  const clear=()=>{ setImportedData(null); setAnalysis(""); localStorage.removeItem("mat_last_import"); };
  const sources=["Meta Ads Manager","Looker Studio","Google Ads","GA4","Whatagraph","Excel Online"];

  return <div>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 6px"}}>{t.bm_title}</h2>
    <p style={{color:C.mut,fontSize:13,margin:"0 0 24px",lineHeight:1.6}}>{t.bm_sub}</p>

    {/* STEP 1 */}
    <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:14,padding:"20px",marginBottom:16}}>
      <div style={{color:C.acl,fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>{t.bm_step1}</div>
      <p style={{color:C.mut,fontSize:13,margin:"0 0 16px"}}>{t.bm_dragSub}</p>
      <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <a href={BOOKMARKLET_CODE} draggable="true" onClick={e=>e.preventDefault()} style={{display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",color:"#fff",padding:"12px 20px",borderRadius:12,fontWeight:700,fontSize:14,textDecoration:"none",boxShadow:"0 4px 20px rgba(99,102,241,0.4)",cursor:"grab",userSelect:"none",flexShrink:0}}>
          📊 Meta Ads Toolkit
        </a>
        <div style={{color:C.mut,fontSize:13}}>← {t.bm_drag}</div>
      </div>
      <div style={{marginTop:14,background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"12px 14px"}}>
        <div style={{color:C.dim,fontSize:11,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",marginBottom:8}}>{t.bm_works}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{sources.map(s=><span key={s} style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${C.brd}`,borderRadius:20,color:C.mut,fontSize:11,fontWeight:600,padding:"4px 10px"}}>{s}</span>)}</div>
      </div>
    </div>

    {/* STEP 2 */}
    <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:14,padding:"20px",marginBottom:16}}>
      <div style={{color:C.mut,fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14}}>{t.bm_step2}</div>
      {[t.bm_how1,t.bm_how2,t.bm_how3].map((step,i)=>(
        <div key={i} style={{display:"flex",gap:12,marginBottom:i<2?12:0,alignItems:"flex-start"}}>
          <div style={{width:24,height:24,borderRadius:"50%",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>{i+1}</div>
          <div style={{color:"rgba(255,255,255,0.75)",fontSize:13,lineHeight:1.5,paddingTop:2}}>{step}</div>
        </div>
      ))}
    </div>

    {/* STEP 3 – Data */}
    <div style={{background:C.sur,border:`1px solid ${C.brd}`,borderRadius:14,padding:"20px"}}>
      <div style={{color:C.mut,fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14}}>{t.bm_step3}</div>
      {!importedData&&!loading&&<div style={{textAlign:"center",padding:"24px 0"}}>
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
          <img src={`data:image/jpeg;base64,${importedData.screenshot}`} alt="screenshot" style={{width:"100%",borderRadius:10,border:`1px solid ${C.brd}`}}/>
        </div>}
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

// ── APP ──────────────────────────────────────────────────────────────────────
const MODS=[
  {id:1,icon:"📊",col:"#6366F1",tk:"m1t",sk:"m1s"},
  {id:8,icon:"📄",col:"#F97316",tk:"m8t",sk:"m8s"},
  {id:9,icon:"🔗",col:"#00D4FF",tk:"m9t",sk:"m9s"},
  {id:2,icon:"💰",col:"#10B981",tk:"m2t",sk:"m2s"},
  {id:7,icon:"🚀",col:"#06B6D4",tk:"m7t",sk:"m7s"},
  {id:3,icon:"✍️",col:"#F59E0B",tk:"m3t",sk:"m3s"},
  {id:4,icon:"🎯",col:"#EC4899",tk:"m4t",sk:"m4s"},
  {id:5,icon:"📈",col:"#8B5CF6",tk:"m5t",sk:"m5s"},
  {id:6,icon:"✅",col:"#34D399",tk:"m6t",sk:"m6s"},
];

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
  const t=T[lang];
  const w=useWindowSize();
  const isDesktop=w>=1024;

  const MOD_COLORS=["#6366F1","#F97316","#00D4FF","#10B981","#06B6D4","#F59E0B","#EC4899","#8B5CF6","#34D399"];
  const Comp=mod===1?HealthMod:mod===8?ReportMod:mod===9?BookmarkMod:mod===2?BudgetMod:mod===7?ScalingMod:mod===3?CopyMod:mod===4?AudMod:mod===5?RoasMod:mod===6?CheckMod:null;

  const ModCard=({m,i,large})=>(
    <button onClick={()=>setMod(m.id)} style={{
      background:`linear-gradient(145deg,${MOD_COLORS[i]}22,${MOD_COLORS[i]}08 60%,#0d0d1a)`,
      border:`1px solid ${MOD_COLORS[i]}45`,borderTop:`1px solid ${MOD_COLORS[i]}70`,
      borderRadius:16,padding:large?"22px 18px":"18px 15px",textAlign:"left",
      cursor:"pointer",display:"block",transition:"all 0.2s",
      WebkitTapHighlightColor:"transparent",
      boxShadow:`0 4px 24px ${MOD_COLORS[i]}20`,
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 12px 40px ${MOD_COLORS[i]}35`;}}
    onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=`0 4px 24px ${MOD_COLORS[i]}20`;}}>
      <div style={{width:large?48:40,height:large?48:40,borderRadius:12,background:`linear-gradient(135deg,${MOD_COLORS[i]}40,${MOD_COLORS[i]}20)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:large?24:20,marginBottom:large?14:12}}>{m.icon}</div>
      <div style={{color:"#fff",fontWeight:700,fontSize:large?15:13,marginBottom:4,lineHeight:1.3}}>{t[m.tk]}</div>
      <div style={{color:"rgba(255,255,255,0.45)",fontSize:large?12:11,lineHeight:1.5,marginBottom:large?14:12}}>{t[m.sk]}</div>
      <div style={{color:MOD_COLORS[i],fontSize:12,fontWeight:700}}>Otvori →</div>
    </button>
  );

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  if(!isDesktop) return <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.txt}}>
    <div style={{background:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.brd}`,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(10px)"}}>
      <div style={{display:"flex",alignItems:"center",gap:9,cursor:mod?"pointer":"default"}} onClick={()=>setMod(null)}>
        <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📊</div>
        <div style={{fontWeight:800,fontSize:15}}>{t.appTitle}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        {mod&&<button onClick={()=>setMod(null)} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:20,color:"#fff",fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer"}}>{t.back}</button>}
        {["sr","en"].map(l=><button key={l} onClick={()=>setLang(l)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",background:lang===l?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.07)",color:lang===l?"#A5B4FC":"rgba(255,255,255,0.4)"}}>{l.toUpperCase()}</button>)}
      </div>
    </div>
    <div style={{maxWidth:580,margin:"0 auto",padding:"0 0 40px"}}>
      {!mod&&<>
        <div style={{padding:"28px 16px 20px",background:"linear-gradient(180deg,rgba(99,102,241,0.08) 0%,transparent 100%)"}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"#A5B4FC",marginBottom:8}}>META ADS TOOLKIT</div>
          <h1 style={{fontSize:26,fontWeight:900,margin:"0 0 6px",letterSpacing:"-0.5px",lineHeight:1.2}}>{t.sel}</h1>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:13,margin:0}}>{t.selSub}</p>
        </div>
        <div style={{padding:"0 12px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {MODS.map((m,i)=><ModCard key={m.id} m={m} i={i} large={false}/>)}
        </div>
        <div style={{padding:"24px 16px 0",textAlign:"center"}}><div style={{color:"rgba(255,255,255,0.2)",fontSize:11}}>Meta Ads Toolkit · v1.0 · by aleksandarpopup</div></div>
      </>}
      {mod&&Comp&&<div style={{padding:"20px 16px"}}><Comp t={t} lang={lang}/></div>}
    </div>
  </div>;

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  return <div style={{height:"100vh",background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.txt,display:"flex",flexDirection:"column",overflow:"hidden"}}>

    {/* TOP NAV */}
    <div style={{background:"rgba(255,255,255,0.02)",borderBottom:`1px solid ${C.brd}`,padding:"0 32px",display:"flex",justifyContent:"space-between",alignItems:"center",height:64,flexShrink:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>setMod(null)}>
        <div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19}}>📊</div>
        <div>
          <div style={{fontWeight:800,fontSize:17,letterSpacing:"-0.3px"}}>{t.appTitle}</div>
          <div style={{color:"rgba(255,255,255,0.35)",fontSize:11}}>{t.appSub}</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:20}}>
        {mod&&<div style={{color:"rgba(255,255,255,0.4)",fontSize:13}}>
          <span style={{cursor:"pointer",color:"#A5B4FC"}} onClick={()=>setMod(null)}>{t.sel}</span>
          <span style={{margin:"0 8px",color:"rgba(255,255,255,0.2)"}}>›</span>
          <span style={{color:"#fff",fontWeight:600}}>{t[MODS.find(m=>m.id===mod)?.tk]}</span>
        </div>}
        <div style={{display:"flex",gap:6}}>
          {["sr","en"].map(l=><button key={l} onClick={()=>setLang(l)} style={{padding:"7px 16px",borderRadius:20,fontSize:13,fontWeight:700,cursor:"pointer",border:"none",background:lang===l?"rgba(99,102,241,0.3)":"rgba(255,255,255,0.07)",color:lang===l?"#A5B4FC":"rgba(255,255,255,0.4)"}}>{l.toUpperCase()}</button>)}
        </div>
      </div>
    </div>

    <div style={{display:"flex",flex:1,overflow:"hidden"}}>

      {/* SIDEBAR */}
      <div style={{width:270,background:"rgba(255,255,255,0.015)",borderRight:`1px solid ${C.brd}`,padding:"28px 14px",flexShrink:0,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(255,255,255,0.2)",marginBottom:10,paddingLeft:10}}>Alati</div>
        <div style={{flex:1}}>
          {MODS.map((m,i)=>(
            <button key={m.id} onClick={()=>setMod(m.id)} style={{
              width:"100%",padding:"10px 12px",borderRadius:10,textAlign:"left",cursor:"pointer",
              border:"none",marginBottom:3,display:"flex",alignItems:"center",gap:10,transition:"all 0.15s",
              background:mod===m.id?`${MOD_COLORS[i]}18`:"transparent",
            }}
            onMouseEnter={e=>{if(mod!==m.id)e.currentTarget.style.background="rgba(255,255,255,0.05)";}}
            onMouseLeave={e=>{if(mod!==m.id)e.currentTarget.style.background="transparent";}}>
              <div style={{width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${MOD_COLORS[i]}40,${MOD_COLORS[i]}20)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{m.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:mod===m.id?"#fff":"rgba(255,255,255,0.65)",fontWeight:mod===m.id?700:500,fontSize:13,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t[m.tk]}</div>
                <div style={{color:"rgba(255,255,255,0.25)",fontSize:11,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t[m.sk]}</div>
              </div>
              {mod===m.id&&<div style={{width:3,height:20,borderRadius:2,background:MOD_COLORS[i],flexShrink:0}}/>}
            </button>
          ))}
        </div>
        <div style={{paddingTop:20,borderTop:`1px solid ${C.brd}`,textAlign:"center"}}>
          <div style={{color:"rgba(255,255,255,0.2)",fontSize:11}}>Meta Ads Toolkit · v1.0</div>
          <div style={{color:"rgba(255,255,255,0.15)",fontSize:10,marginTop:3}}>by aleksandarpopup</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,overflowY:"auto",minWidth:0}}>
        {!mod&&<div style={{padding:"40px 48px 60px",maxWidth:1100}}>
          <div style={{marginBottom:40}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",color:"#A5B4FC",marginBottom:12}}>META ADS TOOLKIT</div>
            <h1 style={{fontSize:42,fontWeight:900,margin:"0 0 10px",letterSpacing:"-1.5px",lineHeight:1.05}}>{t.sel}</h1>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:16,margin:0}}>{t.selSub}</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18,marginBottom:18}}>
            {MODS.slice(0,4).map((m,i)=><ModCard key={m.id} m={m} i={i} large={true}/>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18,marginBottom:18}}>
            {MODS.slice(4,8).map((m,i)=><ModCard key={m.id} m={m} i={i+4} large={true}/>)}
          </div>
          {MODS.slice(8).length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18}}>
            {MODS.slice(8).map((m,i)=><ModCard key={m.id} m={m} i={i+8} large={true}/>)}
          </div>}
        </div>}
        {mod&&Comp&&<div style={{padding:"40px 48px 60px",maxWidth:860}}><Comp t={t} lang={lang}/></div>}
      </div>
    </div>
  </div>;
}
