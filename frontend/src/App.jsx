import { useState, useCallback, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   R3P DRAWING LIST MANAGER v1.0
   API: /api/register/open, /api/register/save,
        /api/register/import-excel, /api/register/export-full,
        /api/register/export-transmittal-index
   ═══════════════════════════════════════════════════════════════ */

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

// Detect Tauri desktop environment
const isTauri = typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

async function pickFile(filters) {
  if (!isTauri) return null;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    return await open({ multiple: false, filters: filters || [] }) || null;
  } catch { return null; }
}

async function saveFile(filters, defaultPath) {
  if (!isTauri) return null;
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    return await save({ filters: filters || [], defaultPath }) || null;
  } catch { return null; }
}

// ─── Icons ───────────────────────────────────────────────────
const I={
  plus:<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>,
  x:<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>,
  check:<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3,7 6,10 11,4"/></svg>,
  save:<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 13H2.5a1 1 0 01-1-1V2a1 1 0 011-1h7l3 3v8a1 1 0 01-1 1z"/><rect x="4" y="8" width="6" height="4" rx="0.5"/><rect x="4" y="1" width="4" height="3" rx="0.5"/></svg>,
  folder:<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4.5A1.5 1.5 0 013.5 3h3l1.5 1.5H13A1.5 1.5 0 0114.5 6v5.5A1.5 1.5 0 0113 13H3A1.5 1.5 0 011.5 11.5v-7z"/></svg>,
  download:<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10"/></svg>,
  upload:<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 10V2m0 0L5 5m3-3l3 3M3 12h10"/></svg>,
  search:<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="6" r="4"/><line x1="9.5" y1="9.5" x2="13" y2="13"/></svg>,
  dots:<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>,
  spin:<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 2a6 6 0 105.3 3.2"><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.8s" repeatCount="indefinite"/></path></svg>,
  trash:<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4m1.5 0l-.5 8a1 1 0 01-1 1h-5a1 1 0 01-1-1l-.5-8"/></svg>,
  copy:<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="7" height="7" rx="1"/><path d="M5 9H2.5A1.5 1.5 0 011 7.5V2.5A1.5 1.5 0 012.5 1h5A1.5 1.5 0 019 2.5V5"/></svg>,
  edit:<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/></svg>,
  xl:<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1" width="11" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><text x="7" y="9.5" textAnchor="middle" fill="currentColor" fontSize="5" fontWeight="700" fontFamily="sans-serif">XL</text></svg>,
};

// ─── Tokens ──────────────────────────────────────────────────
const T={
  bg:"#1C1B19",bgEl:"#252420",bgCard:"#2C2B27",bgIn:"#33322D",bgHov:"#3A3934",
  bd:"#3E3D38",bdFoc:"#C4884D",bdSub:"#33322D",
  t1:"#F0ECE4",t2:"#A39E93",t3:"#736E64",tOn:"#1C1B19",
  acc:"#C4884D",accH:"#D4994E",accM:"rgba(196,136,77,0.15)",accB:"rgba(196,136,77,0.3)",
  ok:"#6B9E6B",okBg:"rgba(107,158,107,0.12)",warn:"#C4A24D",warnBg:"rgba(196,162,77,0.12)",
  err:"#B85C5C",errBg:"rgba(184,92,92,0.12)",info:"#5C8EB8",infoBg:"rgba(92,142,184,0.12)",
  fB:"'DM Sans',system-ui,sans-serif",fM:"'JetBrains Mono','SF Mono',monospace",fD:"'Instrument Serif',Georgia,serif",
  r:"6px",rS:"4px",rL:"10px",
};

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg};color:${T.t1};font-family:${T.fB};font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
::selection{background:${T.acc};color:${T.tOn}}
input,select,textarea{font-family:inherit;font-size:inherit}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${T.bd};border-radius:3px}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeIn 0.2s ease}
@keyframes slideDown{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}
.toast-slide-down{animation:slideDown 0.25s ease forwards}
@keyframes progressShrink{from{width:100%}to{width:0%}}
`;

let _id=0;const uid=()=>`_${++_id}_${Date.now()}`;

// ─── Status config ────────────────────────────────────────────
const STATUSES=["NOT CREATED YET","IN DESIGN","READY FOR DRAFTING","READY FOR SUBMITTAL"];
const STATUS_STYLE={
  "NOT CREATED YET":{bg:T.bgIn,t:T.t3,border:T.bdSub},
  "IN DESIGN":{bg:T.infoBg,t:T.info,border:"rgba(92,142,184,0.3)"},
  "READY FOR DRAFTING":{bg:T.warnBg,t:T.warn,border:"rgba(196,162,77,0.3)"},
  "READY FOR SUBMITTAL":{bg:T.okBg,t:T.ok,border:"rgba(107,158,107,0.3)"},
};

// ─── Status screen (shared layout) ───────────────────────────
const statusScreenStyle={
  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
  gap:"12px",minHeight:"100vh",padding:"24px",background:T.bg,color:T.t1,
  fontFamily:T.fB,textAlign:"center",
};

// ─── Primitives ──────────────────────────────────────────────
const SL=({children,sub})=><div style={{marginBottom:sub?"6px":"14px"}}><span style={{fontSize:sub?"10px":"11px",fontWeight:600,fontFamily:T.fM,letterSpacing:"0.08em",textTransform:"uppercase",color:sub?T.t3:T.acc}}>{children}</span></div>;

const TF=({label,value,onChange,placeholder,mono,compact,onKeyDown})=><div style={{flex:1,minWidth:0}}>
  {label&&<label style={{display:"block",fontSize:"12px",fontWeight:500,color:T.t2,marginBottom:"3px"}}>{label}</label>}
  <input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown}
    style={{width:"100%",padding:compact?"5px 10px":"7px 12px",background:T.bgIn,border:`1px solid ${T.bd}`,borderRadius:T.rS,color:T.t1,fontFamily:mono?T.fM:T.fB,fontSize:mono?"13px":"14px",outline:"none",transition:"border-color 0.15s"}}
    onFocus={e=>{e.target.style.borderColor=T.bdFoc}} onBlur={e=>{e.target.style.borderColor=T.bd}}/></div>;

const Card=({children,style})=><div style={{background:T.bgCard,border:`1px solid ${T.bd}`,borderRadius:T.rL,padding:"20px",...style}}>{children}</div>;

const Badge=({children,color="accent"})=>{const m={accent:{bg:T.accM,t:T.acc,b:T.accB},success:{bg:T.okBg,t:T.ok,b:"rgba(107,158,107,0.3)"},warning:{bg:T.warnBg,t:T.warn,b:"rgba(196,162,77,0.3)"},error:{bg:T.errBg,t:T.err,b:"rgba(184,92,92,0.3)"},info:{bg:T.infoBg,t:T.info,b:"rgba(92,142,184,0.3)"},muted:{bg:T.bgIn,t:T.t3,b:T.bdSub}}[color]||{};
  return <span style={{display:"inline-flex",padding:"2px 8px",fontSize:"11px",fontWeight:600,fontFamily:T.fM,letterSpacing:"0.03em",borderRadius:"4px",background:m.bg,color:m.t,border:`1px solid ${m.b}`}}>{children}</span>;};

const Btn=({children,variant="primary",icon,onClick,disabled,style:s})=>{const[h,setH]=useState(false);
  const v={primary:{bg:h&&!disabled?T.accH:T.acc,color:T.tOn,border:"none",fw:600},secondary:{bg:h&&!disabled?T.bgHov:T.bgIn,color:T.t1,border:`1px solid ${T.bd}`,fw:500},ghost:{bg:h&&!disabled?T.bgHov:"transparent",color:T.t2,border:"1px solid transparent",fw:500},danger:{bg:h&&!disabled?"#c44d4d":T.errBg,color:T.err,border:`1px solid ${T.err}`,fw:500}}[variant]||{};
  return <button onClick={onClick} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"7px 14px",borderRadius:T.r,fontSize:"13px",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"all 0.15s",whiteSpace:"nowrap",background:v.bg,color:v.color,border:v.border,fontWeight:v.fw,fontFamily:T.fB,...s}}>
    {icon&&<span style={{display:"flex"}}>{icon}</span>}{children}</button>;};

const Divider=()=><div style={{height:"1px",background:T.bd,margin:"16px 0"}}/>;

// ─── Toast ───────────────────────────────────────────────────
function Toast({message,type,onDismiss,duration}){
  if(!message)return null;
  const iconMap={success:"✓",error:"⚠",info:"ℹ"};
  const c={
    success:{bg:"#1a3a1a",t:"#7fd87f",b:"rgba(107,158,107,0.45)"},
    error:{bg:"#3a1515",t:"#e87070",b:"rgba(184,92,92,0.45)"},
    loading:{bg:"#2d2010",t:T.acc,b:T.accB},
    info:{bg:"#152030",t:"#70a8e8",b:"rgba(92,142,184,0.45)"},
  }[type]||{bg:T.bgCard,t:T.t1,b:T.bd};
  const showProgress=type!=="loading"&&duration>0;
  return <div style={{position:"fixed",top:"70px",left:"50%",transform:"translateX(-50%)",zIndex:9999,minWidth:"320px",maxWidth:"640px",width:"calc(100% - 64px)"}}>
    <div className="toast-slide-down" style={{borderRadius:T.r,background:c.bg,border:`1px solid ${c.b}`,color:c.t,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"14px 20px",fontSize:"14px",fontWeight:500}}>
        <span style={{fontSize:"16px",flexShrink:0,lineHeight:1,display:"flex",alignItems:"center"}}>{type==="loading"?I.spin:(iconMap[type]||"ℹ")}</span>
        <span style={{flex:1}}>{message}</span>
        {type!=="loading"&&<button onClick={onDismiss} style={{background:"none",border:"none",color:c.t,cursor:"pointer",padding:"0 0 0 8px",display:"flex",flexShrink:0,opacity:0.7}} onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity="0.7"}>{I.x}</button>}
      </div>
      {showProgress&&<div style={{height:"3px",background:c.t,opacity:0.5,animation:`progressShrink ${duration}ms linear forwards`}}/>}
    </div>
  </div>;
}

// ─── Header ──────────────────────────────────────────────────
function Header(){
  return <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 32px",borderBottom:`1px solid ${T.bd}`,background:T.bgEl,flexShrink:0}}>
    <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="6" fill={T.acc}/>
        <text x="14" y="19" textAnchor="middle" fill={T.tOn} fontFamily="monospace" fontWeight="700" fontSize="9">R3P</text>
      </svg>
      <div>
        <div style={{fontFamily:T.fD,fontSize:"18px",color:T.t1,letterSpacing:"-0.01em"}}>Drawing List Manager</div>
        <div style={{fontFamily:T.fM,fontSize:"10px",color:T.t3,letterSpacing:"0.12em",textTransform:"uppercase",marginTop:"1px"}}>ROOT3POWER</div>
      </div>
    </div>
  </header>;
}

// ─── Status Badge ─────────────────────────────────────────────
function StatusBadge({status}){
  const s=STATUS_STYLE[status]||STATUS_STYLE["NOT CREATED YET"];
  return <span style={{display:"inline-flex",padding:"3px 10px",fontSize:"11px",fontWeight:600,fontFamily:T.fM,borderRadius:"4px",background:s.bg,color:s.t,border:`1px solid ${s.border}`,whiteSpace:"nowrap"}}>{status}</span>;
}

// ─── Revision Chips ───────────────────────────────────────────
function RevisionChips({revisions,onAdd}){
  return <div style={{display:"flex",alignItems:"center",gap:"4px",flexWrap:"wrap"}}>
    {revisions.map((r,i)=>{
      const isLatest=i===revisions.length-1;
      return <div key={i} title={r.date||""} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"2px 7px",borderRadius:"4px",background:isLatest?T.acc:T.bgIn,border:`1px solid ${isLatest?T.accH:T.bd}`,minWidth:"32px",cursor:"default"}}>
        <span style={{fontFamily:T.fM,fontSize:"11px",fontWeight:600,color:isLatest?T.tOn:T.t2,lineHeight:1.2}}>{r.rev||"—"}</span>
        {r.date&&<span style={{fontFamily:T.fM,fontSize:"9px",color:isLatest?T.tOn:T.t3,lineHeight:1.2}}>{r.date.slice(5).replace("-","/")}</span>}
      </div>;
    })}
    <button onClick={onAdd} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"22px",height:"22px",borderRadius:"4px",background:T.bgHov,border:`1px dashed ${T.bd}`,color:T.t3,cursor:"pointer",fontSize:"14px",flexShrink:0}} title="Add revision">+</button>
  </div>;
}

// ─── Add Revision Modal ───────────────────────────────────────
function AddRevisionModal({open,onClose,onAdd}){
  const[rev,setRev]=useState("A");
  const[date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
  if(!open)return null;
  const submit=()=>{if(!rev.trim())return;onAdd({rev:rev.trim(),date});setRev("A");onClose();};
  return <div style={{position:"fixed",inset:0,zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.6)"}}>
    <div style={{background:T.bgCard,border:`1px solid ${T.bd}`,borderRadius:T.rL,padding:"28px 32px",minWidth:"320px",maxWidth:"400px",width:"calc(100% - 48px)"}}>
      <div style={{fontSize:"15px",fontWeight:600,color:T.t1,marginBottom:"18px"}}>Add Revision</div>
      <div style={{display:"flex",flexDirection:"column",gap:"12px",marginBottom:"20px"}}>
        <TF label="Revision Label (e.g. A, B, C)" value={rev} onChange={setRev} mono compact/>
        <div style={{flex:1}}>
          <label style={{display:"block",fontSize:"12px",fontWeight:500,color:T.t2,marginBottom:"3px"}}>Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:"100%",padding:"5px 10px",background:T.bgIn,border:`1px solid ${T.bd}`,borderRadius:T.rS,color:T.t1,fontFamily:T.fM,fontSize:"13px",outline:"none"}} onFocus={e=>{e.target.style.borderColor=T.bdFoc}} onBlur={e=>{e.target.style.borderColor=T.bd}}/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:"8px"}}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={submit}>Add</Btn>
      </div>
    </div>
  </div>;
}

// ─── Row Actions Menu ─────────────────────────────────────────
function RowMenu({onDuplicate,onDelete,onBumpRevision,onClose}){
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))onClose();};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[onClose]);
  const items=[
    {label:"Duplicate",icon:I.copy,action:onDuplicate},
    {label:"Bump Revision",icon:I.edit,action:onBumpRevision},
    {label:"Delete",icon:I.trash,action:onDelete,danger:true},
  ];
  return <div ref={ref} style={{position:"absolute",right:0,top:"100%",zIndex:1000,background:T.bgCard,border:`1px solid ${T.bd}`,borderRadius:T.r,boxShadow:"0 8px 24px rgba(0,0,0,0.5)",padding:"6px 0",minWidth:"160px"}}>
    {items.map(item=><button key={item.label} onClick={()=>{item.action();onClose();}} style={{display:"flex",alignItems:"center",gap:"8px",width:"100%",padding:"8px 14px",background:"none",border:"none",color:item.danger?T.err:T.t1,cursor:"pointer",fontSize:"13px",textAlign:"left"}} onMouseEnter={e=>{e.currentTarget.style.background=T.bgHov}} onMouseLeave={e=>{e.currentTarget.style.background="none"}}>
      <span style={{display:"flex",flexShrink:0}}>{item.icon}</span>{item.label}
    </button>)}
  </div>;
}

// ─── Drawing Row ──────────────────────────────────────────────
function DrawingRow({drawing,rowNum,onUpdate,onDelete,onDuplicate,isEditing,onStartEdit,onStopEdit}){
  const[menuOpen,setMenuOpen]=useState(false);
  const[editField,setEditField]=useState(null);
  const[editVal,setEditVal]=useState("");
  const[addRevOpen,setAddRevOpen]=useState(false);

  const startEdit=(field,val)=>{setEditField(field);setEditVal(val);onStartEdit&&onStartEdit();};
  const commitEdit=(field)=>{
    const v=editVal.trim();
    onUpdate({...drawing,[field]:v||drawing[field]});
    setEditField(null);
    onStopEdit&&onStopEdit();
  };
  const cancelEdit=()=>{setEditField(null);onStopEdit&&onStopEdit();};

  const cellProps=(field,val,mono=false,minW="60px")=>({
    onClick:()=>{if(editField!==field)startEdit(field,val);},
    style:{padding:"6px 8px",cursor:"text",color:mono?T.acc:T.t1,fontFamily:mono?T.fM:T.fB,fontSize:mono?"12px":"13px",minWidth:minW,position:"relative"},
  });

  const editInput=(field,mono=false)=><input autoFocus value={editVal}
    onChange={e=>setEditVal(e.target.value)}
    onBlur={()=>commitEdit(field)}
    onKeyDown={e=>{if(e.key==="Enter")commitEdit(field);if(e.key==="Escape")cancelEdit();}}
    style={{width:"100%",background:T.bgIn,border:`1px solid ${T.bdFoc}`,borderRadius:T.rS,color:mono?T.acc:T.t1,fontFamily:mono?T.fM:T.fB,fontSize:mono?"12px":"13px",padding:"4px 6px",outline:"none"}}/>;

  const bumpRevision=()=>{
    const revs=drawing.revisions||[];
    const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lastRev=revs.length>0?revs[revs.length-1].rev:"";
    const nextIdx=letters.indexOf(lastRev.toUpperCase())+1;
    const nextRev=nextIdx>0&&nextIdx<letters.length?letters[nextIdx]:letters[0];
    onUpdate({...drawing,revisions:[...revs,{rev:nextRev,date:new Date().toISOString().slice(0,10)}]});
  };

  const rowStyle={
    display:"grid",
    gridTemplateColumns:"40px 180px 1fr 220px 160px 1fr 40px",
    alignItems:"center",
    borderBottom:`1px solid ${T.bdSub}`,
    background:drawing.status==="NOT CREATED YET"?"rgba(0,0,0,0)":undefined,
    opacity:drawing.status==="NOT CREATED YET"?0.6:1,
  };

  return <div style={rowStyle}>
    <div style={{padding:"6px 8px",fontFamily:T.fM,fontSize:"11px",color:T.t3,textAlign:"center"}}>{String(rowNum).padStart(4,"0")}</div>

    <div {...cellProps("drawing_number",drawing.drawing_number,true,"140px")}>
      {editField==="drawing_number"?editInput("drawing_number",true):<span style={{fontFamily:T.fM,fontSize:"12px",color:T.acc}}>{drawing.drawing_number||<span style={{color:T.t3,fontStyle:"italic"}}>—</span>}</span>}
    </div>

    <div {...cellProps("description",drawing.description)}>
      {editField==="description"?editInput("description"):<span>{drawing.description||<span style={{color:T.t3,fontStyle:"italic"}}>—</span>}</span>}
    </div>

    <div style={{padding:"6px 8px"}}>
      <RevisionChips revisions={drawing.revisions||[]} onAdd={()=>setAddRevOpen(true)}/>
      <AddRevisionModal open={addRevOpen} onClose={()=>setAddRevOpen(false)} onAdd={r=>onUpdate({...drawing,revisions:[...(drawing.revisions||[]),r]})}/>
    </div>

    <div style={{padding:"6px 8px"}}>
      <select value={drawing.status||"NOT CREATED YET"} onChange={e=>onUpdate({...drawing,status:e.target.value})}
        style={{width:"100%",padding:"4px 8px",background:T.bgIn,border:`1px solid ${T.bd}`,borderRadius:T.rS,color:STATUS_STYLE[drawing.status]?.t||T.t3,fontSize:"12px",fontFamily:T.fM,fontWeight:600,cursor:"pointer",outline:"none"}}>
        {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
      </select>
    </div>

    <div {...cellProps("notes",drawing.notes||"")}>
      {editField==="notes"?editInput("notes"):<span style={{color:drawing.notes?T.t1:T.t3,fontStyle:drawing.notes?"normal":"italic"}}>{drawing.notes||"—"}</span>}
    </div>

    <div style={{padding:"6px 4px",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <button onClick={()=>setMenuOpen(v=>!v)} style={{background:"none",border:"none",color:T.t3,cursor:"pointer",padding:"4px",borderRadius:T.rS,display:"flex"}} onMouseEnter={e=>{e.currentTarget.style.background=T.bgHov;e.currentTarget.style.color=T.t1}} onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.t3}}>{I.dots}</button>
      {menuOpen&&<RowMenu onDuplicate={onDuplicate} onDelete={onDelete} onBumpRevision={bumpRevision} onClose={()=>setMenuOpen(false)}/>}
    </div>
  </div>;
}

// ─── Paste from Excel Modal ───────────────────────────────────
function PasteModal({open,onClose,onConfirm}){
  const[text,setText]=useState("");
  if(!open)return null;
  const lines=text.trim().split("\n").filter(Boolean);
  const parsed=lines.map(l=>{
    const cols=l.split("\t");
    return{drawing_number:(cols[0]||"").trim(),description:(cols[1]||"").trim(),status:(cols[2]||"NOT CREATED YET").trim().toUpperCase(),notes:null,revisions:[]};
  }).filter(r=>r.drawing_number);
  const confirm=()=>{
    if(parsed.length===0)return;
    onConfirm(parsed.map(r=>({...r,id:uid()})));
    setText("");onClose();
  };
  return <div style={{position:"fixed",inset:0,zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)"}}>
    <div style={{background:T.bgCard,border:`1px solid ${T.bd}`,borderRadius:T.rL,padding:"28px 32px",width:"min(640px,100vw - 32px)",display:"flex",flexDirection:"column",gap:"16px"}}>
      <div style={{fontSize:"15px",fontWeight:600,color:T.t1}}>Paste from Excel</div>
      <div style={{fontSize:"12px",color:T.t2}}>Paste tab-separated rows: Drawing Number ⇥ Description ⇥ Status (optional)</div>
      <textarea value={text} onChange={e=>setText(e.target.value)} rows={8} placeholder={"R3P-25074-E0-0001\tDRAWING INDEX\tREADY FOR SUBMITTAL\nR3P-25074-E0-0002\tSITE PLAN"} style={{width:"100%",background:T.bgIn,border:`1px solid ${T.bd}`,borderRadius:T.rS,color:T.t1,fontFamily:T.fM,fontSize:"12px",padding:"10px",resize:"vertical",outline:"none"}} onFocus={e=>{e.target.style.borderColor=T.bdFoc}} onBlur={e=>{e.target.style.borderColor=T.bd}}/>
      {parsed.length>0&&<div style={{fontSize:"12px",color:T.ok}}>Preview: {parsed.length} row{parsed.length!==1?"s":""} ready to add</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:"8px"}}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={parsed.length===0} onClick={confirm}>Add {parsed.length} Drawing{parsed.length!==1?"s":""}</Btn>
      </div>
    </div>
  </div>;
}

// ─── New Register Modal ───────────────────────────────────────
function NewRegisterModal({open,onClose,onCreate}){
  const[projNum,setProjNum]=useState("R3P-");
  if(!open)return null;
  const create=()=>{if(projNum.trim().length<2)return;onCreate(projNum.trim());onClose();};
  return <div style={{position:"fixed",inset:0,zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.6)"}}>
    <div style={{background:T.bgCard,border:`1px solid ${T.bd}`,borderRadius:T.rL,padding:"28px 32px",minWidth:"320px",width:"min(400px,100vw - 48px)"}}>
      <div style={{fontSize:"15px",fontWeight:600,color:T.t1,marginBottom:"18px"}}>New Register</div>
      <TF label="Project Number" value={projNum} onChange={setProjNum} mono compact onKeyDown={e=>{if(e.key==="Enter")create();if(e.key==="Escape")onClose();}}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:"8px",marginTop:"20px"}}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={projNum.trim().length<2} onClick={create}>Create</Btn>
      </div>
    </div>
  </div>;
}

// ─── Register Card ────────────────────────────────────────────
function RegisterCard({register,filePath,onOpen,onNew,onImport,onSave,onSaveAs,onClose}){
  const loaded=!!register;
  const filename=filePath?filePath.replace(/\\/g,"/").split("/").pop():"";
  const drawingCount=register?register.sets.reduce((s,st)=>s+st.drawings.length,0):0;
  const lastSaved=register?.updated_at?new Date(register.updated_at).toLocaleString():"";
  return <Card>
    <SL>Register</SL>
    {!loaded?<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
      <Btn variant="primary" icon={I.folder} onClick={onOpen}>Open Register</Btn>
      <Btn variant="secondary" icon={I.plus} onClick={onNew}>New Register</Btn>
      <Btn variant="ghost" icon={I.xl} onClick={onImport} style={{fontSize:"12px"}}>Import from Excel</Btn>
    </div>:<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
      <div style={{background:T.bgIn,borderRadius:T.rS,padding:"10px 12px",border:`1px solid ${T.bd}`}}>
        <div style={{fontFamily:T.fM,fontSize:"12px",color:T.acc,fontWeight:600,marginBottom:"3px"}}>{filename}</div>
        <div style={{fontSize:"11px",color:T.t3}}>{drawingCount} drawings · saved {lastSaved}</div>
      </div>
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
        <Btn variant="primary" icon={I.save} onClick={onSave} style={{flex:1,justifyContent:"center"}}>Save</Btn>
        <Btn variant="secondary" onClick={onSaveAs} style={{flex:1,justifyContent:"center"}}>Save As</Btn>
        <Btn variant="ghost" onClick={onClose} style={{flex:1,justifyContent:"center"}}>Close</Btn>
      </div>
    </div>}
  </Card>;
}

// ─── Filter Card ──────────────────────────────────────────────
function FilterCard({search,onSearch,statusFilters,onToggleStatus,familyFilters,onToggleFamily,families,onClear}){
  const hasFilters=search||statusFilters.length>0||familyFilters.length>0;
  return <Card style={{marginTop:"12px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
      <SL sub>Filters</SL>
      {hasFilters&&<button onClick={onClear} style={{background:"none",border:"none",color:T.acc,cursor:"pointer",fontSize:"11px",fontFamily:T.fM}}>Clear</button>}
    </div>
    <div style={{position:"relative",marginBottom:"12px"}}>
      <span style={{position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)",color:T.t3,display:"flex"}}>{I.search}</span>
      <input value={search} onChange={e=>onSearch(e.target.value)} placeholder="Search drawings…" style={{width:"100%",paddingLeft:"32px",padding:"7px 10px 7px 32px",background:T.bgIn,border:`1px solid ${T.bd}`,borderRadius:T.rS,color:T.t1,fontSize:"13px",outline:"none"}} onFocus={e=>{e.target.style.borderColor=T.bdFoc}} onBlur={e=>{e.target.style.borderColor=T.bd}}/>
    </div>
    <div style={{fontSize:"11px",color:T.t3,marginBottom:"6px",fontFamily:T.fM,letterSpacing:"0.06em",textTransform:"uppercase"}}>Status</div>
    <div style={{display:"flex",flexDirection:"column",gap:"4px",marginBottom:"12px"}}>
      {STATUSES.map(s=>{
        const active=statusFilters.includes(s);
        const st=STATUS_STYLE[s];
        return <button key={s} onClick={()=>onToggleStatus(s)} style={{display:"flex",alignItems:"center",gap:"6px",padding:"5px 8px",borderRadius:T.rS,background:active?st.bg:"transparent",border:`1px solid ${active?st.border:T.bdSub}`,color:active?st.t:T.t2,cursor:"pointer",fontSize:"11px",fontFamily:T.fM,fontWeight:active?600:400,textAlign:"left",transition:"all 0.1s"}}>
          {active&&<span style={{display:"flex"}}>{I.check}</span>}{s}
        </button>;
      })}
    </div>
    {families.length>0&&<>
      <div style={{fontSize:"11px",color:T.t3,marginBottom:"6px",fontFamily:T.fM,letterSpacing:"0.06em",textTransform:"uppercase"}}>Family</div>
      <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
        {families.map(f=>{
          const active=familyFilters.includes(f);
          return <button key={f} onClick={()=>onToggleFamily(f)} style={{padding:"3px 10px",borderRadius:T.rS,background:active?T.accM:"transparent",border:`1px solid ${active?T.accB:T.bdSub}`,color:active?T.acc:T.t2,cursor:"pointer",fontSize:"11px",fontFamily:T.fM,fontWeight:active?600:400,transition:"all 0.1s"}}>{f}</button>;
        })}
      </div>
    </>}
  </Card>;
}

// ─── Sidebar Cards ────────────────────────────────────────────
function SidebarCards({drawings,onSave,onExportFull,onExportTransmittal,filtered}){
  const total=drawings.length;
  const readyCount=drawings.filter(d=>d.status==="READY FOR SUBMITTAL").length;
  const readyPct=total?Math.round(readyCount/total*100):0;
  const counts=STATUSES.reduce((acc,s)=>{acc[s]=drawings.filter(d=>d.status===s).length;return acc;},{});
  // Family breakdown from filtered drawings
  const familyMap={};
  filtered.forEach(d=>{
    const m=d.drawing_number?.match(/-([A-Z]\d+)-/i);
    if(m){const f=m[1].toUpperCase();familyMap[f]=(familyMap[f]||0)+1;}
  });
  const families=Object.entries(familyMap).sort((a,b)=>a[0].localeCompare(b[0]));

  return <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
    <Card>
      <SL sub>Readiness</SL>
      <div style={{fontSize:"24px",fontWeight:700,color:readyPct>=80?T.ok:readyPct>=50?T.warn:T.t1,fontFamily:T.fM,marginBottom:"8px"}}>{readyPct}%</div>
      <div style={{height:"6px",background:T.bgIn,borderRadius:"3px",overflow:"hidden",marginBottom:"8px"}}>
        <div style={{height:"100%",width:`${readyPct}%`,background:readyPct>=80?T.ok:readyPct>=50?T.warn:T.acc,borderRadius:"3px",transition:"width 0.3s"}}/>
      </div>
      <div style={{fontSize:"11px",color:T.t2}}>{readyCount} of {total} ready for submittal</div>
    </Card>

    <Card>
      <SL sub>Status Breakdown</SL>
      {STATUSES.map(s=>{
        const c=counts[s]||0;
        const pct=total?Math.round(c/total*100):0;
        const st=STATUS_STYLE[s];
        return <div key={s} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${T.bdSub}`}}>
          <span style={{fontSize:"11px",color:st.t,fontFamily:T.fM,fontWeight:600,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginRight:"8px"}}>{s}</span>
          <span style={{fontSize:"11px",color:T.t2,fontFamily:T.fM,flexShrink:0}}>{c} ({pct}%)</span>
        </div>;
      })}
    </Card>

    {families.length>0&&<Card>
      <SL sub>Family Breakdown</SL>
      {families.map(([fam,cnt])=><div key={fam} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${T.bdSub}`}}>
        <span style={{fontFamily:T.fM,fontSize:"12px",color:T.acc}}>{fam}</span>
        <span style={{fontFamily:T.fM,fontSize:"12px",color:T.t2}}>{cnt}</span>
      </div>)}
    </Card>}

    <Card>
      <SL sub>Actions</SL>
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        <Btn variant="primary" icon={I.save} onClick={onSave} style={{justifyContent:"center"}}>Save Register</Btn>
        <Btn variant="secondary" icon={I.download} onClick={onExportTransmittal} style={{justifyContent:"center"}}>Export for Transmittal</Btn>
        <Btn variant="secondary" icon={I.xl} onClick={onExportFull} style={{justifyContent:"center"}}>Export Full Register</Btn>
      </div>
    </Card>
  </div>;
}

// ─── Drawings Table ───────────────────────────────────────────
function DrawingsTable({drawings,onUpdate,onDelete,onDuplicate,onAdd,onPaste}){
  const [editingRow,setEditingRow]=useState(null);

  return <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
    {/* Column headers */}
    <div style={{display:"grid",gridTemplateColumns:"40px 180px 1fr 220px 160px 1fr 40px",borderBottom:`2px solid ${T.bd}`,padding:"0",flexShrink:0,background:T.bgEl}}>
      {["#","Drawing Number","Description","Revisions","Status","Notes",""].map((h,i)=>(
        <div key={i} style={{padding:"8px 8px",fontSize:"11px",fontWeight:600,color:T.t3,fontFamily:T.fM,letterSpacing:"0.06em",textTransform:"uppercase"}}>{h}</div>
      ))}
    </div>

    {/* Rows */}
    <div style={{flex:1,overflowY:"auto"}}>
      {drawings.length===0?<div style={{padding:"48px",textAlign:"center",color:T.t3,fontSize:"13px"}}>No drawings. Add one below.</div>
      :drawings.map((d,i)=>(
        <div key={d.id||i} style={{background:i%2===1?"rgba(255,255,255,0.008)":"transparent"}} className="fade-in">
          <DrawingRow drawing={d} rowNum={i+1}
            onUpdate={u=>onUpdate(d.id,u)}
            onDelete={()=>onDelete(d.id)}
            onDuplicate={()=>onDuplicate(d)}
            isEditing={editingRow===d.id}
            onStartEdit={()=>setEditingRow(d.id)}
            onStopEdit={()=>setEditingRow(null)}
          />
        </div>
      ))}
    </div>

    {/* Add bar */}
    <div style={{display:"flex",gap:"8px",padding:"12px 16px",borderTop:`1px solid ${T.bd}`,background:T.bgEl,flexShrink:0}}>
      <Btn variant="primary" icon={I.plus} onClick={onAdd}>Add Drawing</Btn>
      <Btn variant="secondary" icon={I.xl} onClick={onPaste}>Paste from Excel</Btn>
    </div>
  </div>;
}

// ─── Main App ─────────────────────────────────────────────────
export default function App(){
  const[backendReady,setBackendReady]=useState(false);
  const[backendFailed,setBackendFailed]=useState(false);
  const[register,setRegister]=useState(null);
  const[filePath,setFilePath]=useState(null);
  const[activeSet,setActiveSet]=useState(null);
  const[newSetInput,setNewSetInput]=useState(false);
  const[newSetName,setNewSetName]=useState("");
  const[search,setSearch]=useState("");
  const[statusFilters,setStatusFilters]=useState([]);
  const[familyFilters,setFamilyFilters]=useState([]);
  const[toast,setToast]=useState(null);
  const[newRegisterOpen,setNewRegisterOpen]=useState(false);
  const[pasteOpen,setPasteOpen]=useState(false);
  const[contextMenu,setContextMenu]=useState(null); // {tab,x,y}
  const searchRef=useRef(null);

  const showToast=(msg,type="info",dur=5000)=>{
    setToast({message:msg,type,duration:type!=="loading"?dur:0});
    if(type!=="loading")setTimeout(()=>setToast(null),dur);
  };

  // ── Backend health polling ────────────────────────────────
  useEffect(()=>{
    let tries=0;const max=40;
    const poll=async()=>{
      try{
        const r=await fetch(`${API}/api/health`);
        if(r.ok){setBackendReady(true);return;}
      }catch{}
      tries++;
      if(tries>=max){setBackendFailed(true);return;}
      setTimeout(poll,500);
    };
    poll();
  },[]);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(()=>{
    const h=e=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="s"){e.preventDefault();if(register)handleSave();}
      if((e.ctrlKey||e.metaKey)&&e.key==="n"){e.preventDefault();if(register&&activeSet)addDrawing();}
      if((e.ctrlKey||e.metaKey)&&e.key==="f"){e.preventDefault();searchRef.current?.focus();}
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[register,activeSet,filePath]);

  // ── Active set helpers ────────────────────────────────────
  const currentSet=register?.sets?.find(s=>s.name===activeSet)||null;
  const currentDrawings=currentSet?.drawings||[];

  useEffect(()=>{
    if(register&&!activeSet&&register.sets.length>0){
      setActiveSet(register.sets[0].name);
    }
  },[register]);

  // ── Family extraction ─────────────────────────────────────
  const families=Array.from(new Set(currentDrawings.map(d=>{
    const m=d.drawing_number?.match(/-([A-Z]\d+)-/i);
    return m?m[1].toUpperCase():null;
  }).filter(Boolean))).sort();

  // ── Filtered drawings ─────────────────────────────────────
  const filtered=currentDrawings.filter(d=>{
    if(search){
      const q=search.toLowerCase();
      if(!(d.drawing_number?.toLowerCase().includes(q)||d.description?.toLowerCase().includes(q)))return false;
    }
    if(statusFilters.length>0&&!statusFilters.includes(d.status))return false;
    if(familyFilters.length>0){
      const m=d.drawing_number?.match(/-([A-Z]\d+)-/i);
      const fam=m?m[1].toUpperCase():null;
      if(!fam||!familyFilters.includes(fam))return false;
    }
    return true;
  });

  // ── Register actions ──────────────────────────────────────
  const handleOpen=async()=>{
    const p=await pickFile([{name:"R3P Drawing Register",extensions:["r3pdrawings","json"]}]);
    if(!p)return;
    showToast("Opening register…","loading");
    try{
      const r=await fetch(`${API}/api/register/open`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:p})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||"Open failed");
      setRegister(d.register);setFilePath(p);setActiveSet(d.register.sets[0]?.name||null);
      showToast(`Opened ${p.split(/[/\\]/).pop()}`,"success",4000);
    }catch(e){showToast(e.message,"error",6000);}
  };

  const handleSave=async(asNew=false)=>{
    let p=asNew?null:filePath;
    if(!p){
      p=await saveFile([{name:"R3P Drawing Register",extensions:["r3pdrawings","json"]}],`${register.project_number||"register"}.r3pdrawings.json`);
      if(!p)return;
    }
    showToast("Saving…","loading");
    try{
      const r=await fetch(`${API}/api/register/save`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:p,register})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||"Save failed");
      setFilePath(p);setRegister(prev=>({...prev,updated_at:new Date().toISOString()}));
      showToast("Register saved","success",3000);
    }catch(e){showToast(e.message,"error",6000);}
  };

  const handleImport=async()=>{
    const p=await pickFile([{name:"Excel Workbook",extensions:["xlsx","xls"]}]);
    if(!p)return;
    showToast("Importing Excel…","loading");
    try{
      const r=await fetch(`${API}/api/register/import-excel`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:p})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||"Import failed");
      setRegister(d.register);setFilePath(null);setActiveSet(d.register.sets[0]?.name||null);
      const warnStr=d.warnings?.length>0?` (${d.warnings.length} warning${d.warnings.length!==1?"s":""})`:""
      showToast(`Imported ${d.drawing_count} drawings${warnStr}`,"success",5000);
    }catch(e){showToast(e.message,"error",6000);}
  };

  const createNewRegister=(projNum)=>{
    setRegister({
      schema_version:1,project_number:projNum,project_name:"",
      updated_at:new Date().toISOString(),
      sets:[{name:"P&C",drawings:[]},{name:"SUB",drawings:[]},{name:"BESS",drawings:[]},{name:"Physicals",drawings:[]}],
    });
    setFilePath(null);
    setActiveSet("P&C");
  };

  const handleExportFull=async()=>{
    const p=await saveFile([{name:"Excel Workbook",extensions:["xlsx"]}],`${register.project_number||"register"}-full.xlsx`);
    if(!p)return;
    showToast("Exporting…","loading");
    try{
      const r=await fetch(`${API}/api/register/export-full`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:p,register})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||"Export failed");
      showToast("Full register exported","success",4000);
    }catch(e){showToast(e.message,"error",6000);}
  };

  const handleExportTransmittal=async()=>{
    if(!activeSet||activeSet==="Overall"){showToast("Select a specific set to export","info",3000);return;}
    const p=await saveFile([{name:"Excel Workbook",extensions:["xlsx"]}],`${register.project_number||"register"}-${activeSet}-transmittal.xlsx`);
    if(!p)return;
    showToast("Exporting transmittal index…","loading");
    try{
      const r=await fetch(`${API}/api/register/export-transmittal-index`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:p,register,set_name:activeSet})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||"Export failed");
      showToast(`Transmittal index exported for ${activeSet}`,"success",4000);
    }catch(e){showToast(e.message,"error",6000);}
  };

  // ── Drawing CRUD ──────────────────────────────────────────
  const updateSetDrawings=(setName,updater)=>{
    setRegister(prev=>({...prev,sets:prev.sets.map(s=>s.name===setName?{...s,drawings:updater(s.drawings)}:s)}));
  };

  const addDrawing=()=>{
    if(!activeSet||activeSet==="Overall")return;
    const newD={id:uid(),drawing_number:"",description:"",status:"NOT CREATED YET",notes:null,revisions:[]};
    updateSetDrawings(activeSet,ds=>[...ds,newD]);
  };

  const updateDrawing=(id,updates)=>{
    if(!activeSet||activeSet==="Overall")return;
    updateSetDrawings(activeSet,ds=>ds.map(d=>d.id===id?{...d,...updates}:d));
  };

  const deleteDrawing=(id)=>{
    if(!activeSet||activeSet==="Overall")return;
    updateSetDrawings(activeSet,ds=>ds.filter(d=>d.id!==id));
  };

  const duplicateDrawing=(drawing)=>{
    if(!activeSet||activeSet==="Overall")return;
    const clone={...drawing,id:uid()};
    updateSetDrawings(activeSet,ds=>{
      const idx=ds.findIndex(d=>d.id===drawing.id);
      return idx>=0?[...ds.slice(0,idx+1),clone,...ds.slice(idx+1)]:[...ds,clone];
    });
  };

  const pasteDrawings=(rows)=>{
    if(!activeSet||activeSet==="Overall")return;
    updateSetDrawings(activeSet,ds=>[...ds,...rows]);
  };

  // ── Set management ────────────────────────────────────────
  const addSet=()=>{
    const name=newSetName.trim();
    if(!name||register.sets.find(s=>s.name===name))return;
    setRegister(prev=>({...prev,sets:[...prev.sets,{name,drawings:[]}]}));
    setActiveSet(name);setNewSetInput(false);setNewSetName("");
  };

  const renameSet=(oldName,newName)=>{
    const n=newName.trim();
    if(!n||n===oldName||register.sets.find(s=>s.name===n))return;
    setRegister(prev=>({...prev,sets:prev.sets.map(s=>s.name===oldName?{...s,name:n}:s)}));
    if(activeSet===oldName)setActiveSet(n);
  };

  const deleteSet=(name)=>{
    setRegister(prev=>({...prev,sets:prev.sets.filter(s=>s.name!==name)}));
    if(activeSet===name)setActiveSet(register.sets.find(s=>s.name!==name)?.name||null);
  };

  // ── Overall (read-only union) ─────────────────────────────
  const overallDrawings=register?.sets?.flatMap(s=>s.drawings)||[];
  const drawingsForView=activeSet==="Overall"?filtered.filter(d=>{
    const oAll=overallDrawings;
    if(search){const q=search.toLowerCase();if(!(d.drawing_number?.toLowerCase().includes(q)||d.description?.toLowerCase().includes(q)))return false;}
    if(statusFilters.length>0&&!statusFilters.includes(d.status))return false;
    return true;
  }):filtered;

  // ─── Render ───────────────────────────────────────────────
  if(!backendReady&&!backendFailed){
    return <div style={statusScreenStyle}>
      <style>{CSS}</style>
      {I.spin}
      <div style={{fontSize:"16px",fontWeight:500}}>Starting local services…</div>
      <div style={{fontSize:"12px",color:T.t2}}>Waiting for backend on port 8001</div>
    </div>;
  }

  if(backendFailed){
    return <div style={statusScreenStyle}>
      <style>{CSS}</style>
      <div style={{fontSize:"24px"}}>⚠</div>
      <div style={{fontSize:"16px",fontWeight:500}}>Backend failed to start</div>
      <div style={{fontSize:"12px",color:T.t2,maxWidth:"400px"}}>
        Start the backend manually: <code style={{fontFamily:T.fM,color:T.acc}}>cd backend && python -m uvicorn app:app --port 8001</code>
      </div>
    </div>;
  }

  const projectNum=register?.project_number||"New";
  const setTabs=register?["Overall",...register.sets.map(s=>s.name)]:[];

  return <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden"}}>
    <style>{CSS}</style>
    <Header/>

    {/* Breadcrumb */}
    <div style={{padding:"8px 32px",borderBottom:`1px solid ${T.bdSub}`,background:T.bgEl,fontSize:"12px",fontFamily:T.fM,color:T.t3,flexShrink:0}}>
      <span>Register</span>
      <span style={{margin:"0 8px",opacity:0.4}}>/</span>
      <span style={{color:T.acc}}>{projectNum}</span>
      {activeSet&&<><span style={{margin:"0 8px",opacity:0.4}}>/</span><span style={{color:T.t2}}>{activeSet}</span></>}
    </div>

    {/* Set tabs */}
    {register&&<div style={{display:"flex",alignItems:"center",gap:"0",padding:"0 32px",borderBottom:`1px solid ${T.bd}`,background:T.bgEl,flexShrink:0,overflowX:"auto"}}>
      {setTabs.map(name=>{
        const isActive=activeSet===name;
        return <div key={name} onContextMenu={name!=="Overall"?e=>{e.preventDefault();setContextMenu({tab:name,x:e.clientX,y:e.clientY});}:undefined}
          style={{display:"inline-flex",alignItems:"center",padding:"10px 16px",cursor:"pointer",borderBottom:`2px solid ${isActive?T.acc:"transparent"}`,color:isActive?T.t1:T.t2,fontSize:"13px",fontFamily:T.fM,fontWeight:isActive?600:400,whiteSpace:"nowrap",transition:"all 0.1s",flexShrink:0}}
          onClick={()=>setActiveSet(name)}>{name}</div>;
      })}
      {newSetInput?<div style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 12px"}}>
        <input autoFocus value={newSetName} onChange={e=>setNewSetName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addSet();if(e.key==="Escape"){setNewSetInput(false);setNewSetName("");}}} placeholder="Set name…" style={{padding:"4px 8px",background:T.bgIn,border:`1px solid ${T.bdFoc}`,borderRadius:T.rS,color:T.t1,fontSize:"12px",fontFamily:T.fM,outline:"none",width:"120px"}}/>
        <Btn variant="primary" onClick={addSet} style={{padding:"4px 8px",fontSize:"12px"}}>Add</Btn>
        <button onClick={()=>{setNewSetInput(false);setNewSetName("");}} style={{background:"none",border:"none",color:T.t3,cursor:"pointer",display:"flex"}}>{I.x}</button>
      </div>:<button onClick={()=>setNewSetInput(true)} style={{display:"inline-flex",alignItems:"center",gap:"4px",padding:"10px 12px",background:"none",border:"none",color:T.t3,cursor:"pointer",fontSize:"12px",fontFamily:T.fM,flexShrink:0}} onMouseEnter={e=>{e.currentTarget.style.color=T.t1}} onMouseLeave={e=>{e.currentTarget.style.color=T.t3}}>{I.plus} New Set</button>}
    </div>}

    {/* Context menu for set tabs */}
    {contextMenu&&<div style={{position:"fixed",left:contextMenu.x,top:contextMenu.y,zIndex:9999,background:T.bgCard,border:`1px solid ${T.bd}`,borderRadius:T.r,boxShadow:"0 8px 24px rgba(0,0,0,0.5)",padding:"6px 0",minWidth:"140px"}} onMouseLeave={()=>setContextMenu(null)}>
      <button onClick={()=>{const n=prompt("Rename set:",contextMenu.tab);if(n)renameSet(contextMenu.tab,n);setContextMenu(null);}} style={{display:"flex",alignItems:"center",gap:"8px",width:"100%",padding:"8px 14px",background:"none",border:"none",color:T.t1,cursor:"pointer",fontSize:"13px"}} onMouseEnter={e=>{e.currentTarget.style.background=T.bgHov}} onMouseLeave={e=>{e.currentTarget.style.background="none"}}>{I.edit} Rename</button>
      <button onClick={()=>{deleteSet(contextMenu.tab);setContextMenu(null);}} style={{display:"flex",alignItems:"center",gap:"8px",width:"100%",padding:"8px 14px",background:"none",border:"none",color:T.err,cursor:"pointer",fontSize:"13px"}} onMouseEnter={e=>{e.currentTarget.style.background=T.bgHov}} onMouseLeave={e=>{e.currentTarget.style.background="none"}}>{I.trash} Delete Set</button>
    </div>}

    {/* Body */}
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      {/* Left column */}
      <div style={{width:"260px",flexShrink:0,padding:"16px",overflowY:"auto",borderRight:`1px solid ${T.bd}`,background:T.bgEl}}>
        <RegisterCard register={register} filePath={filePath} onOpen={handleOpen} onNew={()=>setNewRegisterOpen(true)} onImport={handleImport} onSave={()=>handleSave(false)} onSaveAs={()=>handleSave(true)} onClose={()=>{setRegister(null);setFilePath(null);setActiveSet(null);}}/>
        {register&&<FilterCard search={search} onSearch={setSearch} statusFilters={statusFilters} onToggleStatus={s=>setStatusFilters(prev=>prev.includes(s)?prev.filter(x=>x!==s):[...prev,s])} familyFilters={familyFilters} onToggleFamily={f=>setFamilyFilters(prev=>prev.includes(f)?prev.filter(x=>x!==f):[...prev,f])} families={families} onClear={()=>{setSearch("");setStatusFilters([]);setFamilyFilters([]);}}/>}
      </div>

      {/* Main table area */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {!register?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"16px",color:T.t3}}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="8" y="4" width="32" height="40" rx="3"/><line x1="16" y1="16" x2="32" y2="16"/><line x1="16" y1="23" x2="32" y2="23"/><line x1="16" y1="30" x2="26" y2="30"/></svg>
          <div style={{fontSize:"14px",color:T.t2}}>Open or create a register to get started</div>
        </div>
        :<DrawingsTable drawings={activeSet==="Overall"?overallDrawings.filter(d=>{if(search){const q=search.toLowerCase();return d.drawing_number?.toLowerCase().includes(q)||d.description?.toLowerCase().includes(q);}return true;}).filter(d=>statusFilters.length===0||statusFilters.includes(d.status)).filter(d=>{if(familyFilters.length===0)return true;const m=d.drawing_number?.match(/-([A-Z]\d+)-/i);return m&&familyFilters.includes(m[1].toUpperCase());}):filtered} onUpdate={updateDrawing} onDelete={deleteDrawing} onDuplicate={duplicateDrawing} onAdd={addDrawing} onPaste={()=>setPasteOpen(true)}/>}
      </div>

      {/* Right sidebar */}
      {register&&<div style={{width:"280px",flexShrink:0,padding:"16px",overflowY:"auto",borderLeft:`1px solid ${T.bd}`,background:T.bgEl}}>
        <SidebarCards drawings={activeSet==="Overall"?overallDrawings:currentDrawings} filtered={activeSet==="Overall"?overallDrawings:filtered} onSave={()=>handleSave(false)} onExportFull={handleExportFull} onExportTransmittal={handleExportTransmittal}/>
      </div>}
    </div>

    {/* Footer */}
    <footer style={{display:"flex",justifyContent:"space-between",padding:"10px 32px",borderTop:`1px solid ${T.bdSub}`,fontSize:"11px",fontFamily:T.fM,color:T.t3,flexShrink:0,background:T.bgEl}}>
      <span>Drawing List Manager v1.0</span>
      <span>ROOT3POWER ENGINEERING</span>
    </footer>

    <Toast message={toast?.message} type={toast?.type} onDismiss={()=>setToast(null)} duration={toast?.duration||5000}/>
    <NewRegisterModal open={newRegisterOpen} onClose={()=>setNewRegisterOpen(false)} onCreate={createNewRegister}/>
    <PasteModal open={pasteOpen} onClose={()=>setPasteOpen(false)} onConfirm={pasteDrawings}/>
  </div>;
}
