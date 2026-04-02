import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = {
  despesa: ["Alimentação","Moradia","Transporte","Saúde","Educação","Lazer",
            "Vestuário","Luz","Água","Internet","Aluguel","Veículo","Supermercado","Outros"],
  receita: ["Salário","Freelance","Investimentos","Aluguel Recebido","Presente","Outros"],
};

const FUND_CATEGORIES = [
  "Emergência","Viagem","Aposentadoria","Casa","Veículo","Educação","Saúde","Investimento","Outros"
];

const CAT_COLORS = {
  "Alimentação":"#f97316","Moradia":"#8b5cf6","Transporte":"#06b6d4","Saúde":"#10b981",
  "Educação":"#3b82f6","Lazer":"#ec4899","Vestuário":"#f59e0b","Luz":"#eab308",
  "Água":"#0ea5e9","Internet":"#6366f1","Aluguel":"#8b5cf6","Veículo":"#f97316",
  "Supermercado":"#14b8a6","Salário":"#22c55e","Freelance":"#a78bfa",
  "Investimentos":"#34d399","Outros":"#94a3b8","Presente":"#f472b6",
  "Aluguel Recebido":"#4ade80",
};

const MONTHS_PT   = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho",
                     "Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fmtBRL  = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const todayStr = () => new Date().toISOString().split("T")[0];

const DEMO_DATA = {
  transactions: [
    {id:1,type:"receita",value:6500,category:"Salário",date:"2026-04-01",desc:"Salário abril"},
    {id:2,type:"despesa",value:1200,category:"Aluguel",date:"2026-04-02",desc:"Aluguel"},
    {id:3,type:"despesa",value:450,category:"Supermercado",date:"2026-04-05",desc:"Mercado"},
    {id:4,type:"despesa",value:180,category:"Luz",date:"2026-04-08",desc:"Conta de luz"},
    {id:5,type:"despesa",value:120,category:"Internet",date:"2026-04-08",desc:"Internet"},
    {id:6,type:"receita",value:6500,category:"Salário",date:"2026-03-01",desc:"Salário março"},
    {id:7,type:"despesa",value:1200,category:"Aluguel",date:"2026-03-02",desc:"Aluguel"},
    {id:8,type:"despesa",value:380,category:"Supermercado",date:"2026-03-10",desc:"Mercado"},
    {id:9,type:"despesa",value:300,category:"Transporte",date:"2026-03-15",desc:"Combustível"},
    {id:10,type:"receita",value:1200,category:"Freelance",date:"2026-03-20",desc:"Projeto web"},
  ],
  funds: [
    {id:1,name:"Reserva de Emergência",balance:3800,goal:20000,color:"#ef4444",category:"Emergência"},
    {id:2,name:"Viagem Europa",balance:1200,goal:5000,color:"#3b82f6",category:"Viagem"},
  ],
  goals: [
    {id:1,name:"Limite de gastos mensais",type:"gasto",period:"mensal",value:3000,startDate:"",category:""},
    {id:2,name:"Economizar em abril",type:"economia",period:"mensal",value:2000,startDate:"",category:""},
  ],
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#07090f;}
  ::-webkit-scrollbar{width:5px;}
  ::-webkit-scrollbar-track{background:#07090f;}
  ::-webkit-scrollbar-thumb{background:#2d3748;border-radius:3px;}
  input,select,textarea{font-family:inherit;}
  .btn{cursor:pointer;border:none;font-family:inherit;font-weight:600;transition:all .18s;}
  .btn:active{transform:scale(.97);}
  .btn:disabled{opacity:.55;cursor:not-allowed;}
  .ifield{background:#141927;border:1.5px solid #1e2a3a;border-radius:11px;padding:12px 14px;color:#e2e8f0;width:100%;font-size:14px;outline:none;transition:border .2s;}
  .ifield:focus{border-color:#6366f1;}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);}
  .mbox{background:#0f1623;border:1px solid #1e2a3a;border-radius:20px;padding:28px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;}
  .nav-btn{cursor:pointer;border:none;background:none;font-family:inherit;transition:all .15s;white-space:nowrap;}
  .tx-row{transition:background .15s;border-radius:10px;}
  .tx-row:hover{background:rgba(255,255,255,.04);}
  .card{transition:transform .2s;}
  .card:hover{transform:translateY(-2px);}
  @keyframes up{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  .anim{animation:up .3s ease;}
  @keyframes shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px);}75%{transform:translateX(6px);}}
  .shake{animation:shake .3s ease;}
  .pbar{height:6px;background:#141e2e;border-radius:100px;overflow:hidden;}
  .pfill{height:100%;border-radius:100px;transition:width .6s ease;}
`;

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {

  // ── Auth state ──────────────────────────────────────────────────────────
  const [user,         setUser]        = useState(null);
  const [authLoading,  setAuthLoading] = useState(true);
  const [authPage,     setAuthPage]    = useState("login");
  const [authForm,     setAuthForm]    = useState({email:"",name:"",password:"",confirm:""});
  const [authErr,      setAuthErr]     = useState("");
  const [authShake,    setAuthShake]   = useState(false);
  const [authWorking,  setAuthWorking] = useState(false);

  // ── App data ────────────────────────────────────────────────────────────
  const [tx,         setTx]         = useState([]);
  const [funds,      setFunds]      = useState([]);
  const [goals,      setGoals]      = useState([]);
  const [customCats, setCustomCats] = useState({despesa:[],receita:[]});
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── Navigation ──────────────────────────────────────────────────────────
  const [page, setPage] = useState("saldo");
  const [curM, setCurM] = useState(new Date().getMonth());
  const [curY, setCurY] = useState(new Date().getFullYear());

  // ── Modal state ─────────────────────────────────────────────────────────
  const [modal,       setModal]       = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [fundModal,   setFundModal]   = useState(null);
  const [fundVal,     setFundVal]     = useState("");
  const [fundAct,     setFundAct]     = useState("add");

  // ── Forms ───────────────────────────────────────────────────────────────
  const [txForm,      setTxForm]      = useState({type:"despesa",value:"",category:"",date:todayStr(),desc:""});
  const [newFund,     setNewFund]     = useState({name:"",goal:"",category:""});
  const [goalForm,    setGoalForm]    = useState({name:"",type:"gasto",period:"mensal",value:"",startDate:"",category:""});
  const [editGoalId,  setEditGoalId]  = useState(null);
  const [newDCat,     setNewDCat]     = useState("");
  const [newRCat,     setNewRCat]     = useState("");

  // ── Refs ────────────────────────────────────────────────────────────────
  const isSaving  = useRef(false);
  const saveTimer = useRef(null);

  // ── Merged categories (default + custom) ────────────────────────────────
  const allCats = {
    despesa: [...DEFAULT_CATEGORIES.despesa, ...customCats.despesa],
    receita: [...DEFAULT_CATEGORIES.receita, ...customCats.receita],
  };

  // ── Firebase Auth listener ───────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) { setTx([]); setFunds([]); setGoals([]); setCustomCats({despesa:[],receita:[]}); setDataLoaded(false); }
    });
    return unsub;
  }, []);

  // ── Firestore real-time listener ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (isSaving.current) return;
      const data = snap.data();
      if (data) {
        setTx(data.transactions || []);
        setFunds(data.funds || []);
        setGoals(data.goals || []);
        setCustomCats(data.categories || {despesa:[],receita:[]});
      } else {
        const initial = {
          transactions: DEMO_DATA.transactions,
          funds:        DEMO_DATA.funds,
          goals:        DEMO_DATA.goals,
          categories:   {despesa:[],receita:[]},
        };
        setTx(initial.transactions);
        setFunds(initial.funds);
        setGoals(initial.goals);
        setCustomCats(initial.categories);
        doSave(user.uid, initial);
      }
      setDataLoaded(true);
    });
    return unsub;
  }, [user]);

  // ── Auto-save (debounced) ────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !dataLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      doSave(user.uid, {transactions:tx, funds, goals, categories:customCats});
    }, 800);
  }, [tx, funds, goals, customCats]);

  const doSave = async (uid, data) => {
    isSaving.current = true;
    try { await setDoc(doc(db, "users", uid), data); }
    finally { setTimeout(() => { isSaving.current = false; }, 600); }
  };

  // ── Auth helpers ─────────────────────────────────────────────────────────
  const errShake = (msg) => {
    setAuthErr(msg);
    setAuthShake(true);
    setTimeout(() => setAuthShake(false), 350);
  };

  const handleLogin = async () => {
    if (!authForm.email || !authForm.password) return errShake("Preencha todos os campos");
    setAuthWorking(true);
    try {
      await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
    } catch (e) {
      const bad = ["auth/invalid-credential","auth/wrong-password","auth/user-not-found"];
      errShake(bad.includes(e.code) ? "E-mail ou senha incorretos" : "Erro ao entrar. Tente novamente.");
    }
    setAuthWorking(false);
  };

  const handleRegister = async () => {
    const {email,name,password,confirm} = authForm;
    if (!email||!name||!password) return errShake("Preencha todos os campos");
    if (password !== confirm)     return errShake("Senhas não coincidem");
    if (password.length < 6)      return errShake("Senha mínima: 6 caracteres");
    setAuthWorking(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, {displayName: name});
    } catch (e) {
      if (e.code === "auth/email-already-in-use") errShake("E-mail já cadastrado");
      else if (e.code === "auth/invalid-email")   errShake("E-mail inválido");
      else errShake("Erro ao criar conta. Tente novamente.");
    }
    setAuthWorking(false);
  };

  const logout = async () => {
    await signOut(auth);
    setPage("saldo");
    setAuthForm({email:"",name:"",password:"",confirm:""});
    setAuthErr("");
  };

  // ── Computed values ───────────────────────────────────────────────────────
  const monthTx = tx.filter(t => {
    const d = new Date(t.date + "T12:00:00");
    return d.getMonth() === curM && d.getFullYear() === curY;
  });
  const receitas = monthTx.filter(t => t.type==="receita").reduce((s,t)=>s+t.value,0);
  const despesas = monthTx.filter(t => t.type==="despesa").reduce((s,t)=>s+t.value,0);
  const saldo    = receitas - despesas;

  const chartData = Array.from({length:6}, (_,i) => {
    const d  = new Date(curY, curM-5+i, 1);
    const m  = d.getMonth(), y = d.getFullYear();
    const t2 = tx.filter(t => { const td=new Date(t.date+"T12:00:00"); return td.getMonth()===m && td.getFullYear()===y; });
    return {
      name: MONTHS_PT[m],
      Receitas: t2.filter(t=>t.type==="receita").reduce((s,t)=>s+t.value,0),
      Despesas: t2.filter(t=>t.type==="despesa").reduce((s,t)=>s+t.value,0),
    };
  });

  const catData = Object.entries(
    monthTx.filter(t=>t.type==="despesa")
      .reduce((a,t)=>{ a[t.category]=(a[t.category]||0)+t.value; return a; }, {})
  ).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,6);

  // ── Goal progress ─────────────────────────────────────────────────────────
  const getGoalProgress = (goal) => {
    const yearTx   = tx.filter(t => new Date(t.date+"T12:00:00").getFullYear() === curY);
    const base     = goal.period === "mensal" ? monthTx : yearTx;
    const filtered = goal.category ? base.filter(t=>t.category===goal.category) : base;
    if (goal.type === "gasto") {
      const spent = filtered.filter(t=>t.type==="despesa").reduce((s,t)=>s+t.value,0);
      return { current:spent, pct: goal.value>0 ? Math.min(100,(spent/goal.value)*100):0, over: spent>goal.value };
    } else {
      const inc   = filtered.filter(t=>t.type==="receita").reduce((s,t)=>s+t.value,0);
      const exp   = filtered.filter(t=>t.type==="despesa").reduce((s,t)=>s+t.value,0);
      const saved = Math.max(0, inc-exp);
      return { current:saved, pct: goal.value>0 ? Math.min(100,(saved/goal.value)*100):0, over: saved>=goal.value };
    }
  };

  // ── Transaction handlers ──────────────────────────────────────────────────
  const addTx = () => {
    if (!txForm.value||!txForm.category||!txForm.date) return;
    setTx(p=>[{...txForm,id:Date.now(),value:parseFloat(txForm.value)},...p]);
    setModal(null);
    setTxForm({type:"despesa",value:"",category:"",date:todayStr(),desc:""});
  };
  const delTx = (id) => setTx(p=>p.filter(t=>t.id!==id));

  // ── Fund handlers ─────────────────────────────────────────────────────────
  const handleFundBalance = () => {
    const v = parseFloat(fundVal);
    if (!v||v<=0) return;
    setFunds(p=>p.map(f=>f.id===fundModal.id
      ? {...f,balance:fundAct==="add"?f.balance+v:Math.max(0,f.balance-v)} : f));
    setFundModal(null); setFundVal("");
  };
  const addFund = () => {
    if (!newFund.name) return;
    const colors = ["#6366f1","#f97316","#10b981","#ec4899","#f59e0b","#06b6d4","#8b5cf6","#14b8a6"];
    setFunds(p=>[...p,{id:Date.now(),name:newFund.name,balance:0,
      goal:parseFloat(newFund.goal)||0,color:colors[p.length%colors.length],
      category:newFund.category||"Outros"}]);
    setNewFund({name:"",goal:"",category:""}); setModal(null);
  };
  const delFund = (id) => setFunds(p=>p.filter(f=>f.id!==id));

  // ── Goal handlers ─────────────────────────────────────────────────────────
  const saveGoal = () => {
    if (!goalForm.name||!goalForm.value) return;
    const g = {...goalForm, value:parseFloat(goalForm.value), category:goalForm.category||null};
    if (editGoalId) {
      setGoals(p=>p.map(x=>x.id===editGoalId ? {...g,id:editGoalId} : x));
    } else {
      setGoals(p=>[...p,{...g,id:Date.now()}]);
    }
    setModal(null);
    setGoalForm({name:"",type:"gasto",period:"mensal",value:"",startDate:"",category:""});
    setEditGoalId(null);
  };
  const delGoal = (id) => setGoals(p=>p.filter(g=>g.id!==id));
  const openEditGoal = (g) => {
    setGoalForm({name:g.name,type:g.type,period:g.period,value:String(g.value),startDate:g.startDate||"",category:g.category||""});
    setEditGoalId(g.id);
    setModal("newgoal");
  };

  // ── Category handlers ─────────────────────────────────────────────────────
  const addCat = (type, name) => {
    const n = name.trim();
    if (!n) return;
    if (allCats[type].includes(n)) return;
    setCustomCats(p=>({...p,[type]:[...p[type],n]}));
  };
  const delCat = (type, name) => {
    if (DEFAULT_CATEGORIES[type].includes(name)) return;
    setCustomCats(p=>({...p,[type]:p[type].filter(c=>c!==name)}));
  };

  // ── Month navigation ──────────────────────────────────────────────────────
  const prevMonth = () => { const d=new Date(curY,curM-1,1); setCurM(d.getMonth()); setCurY(d.getFullYear()); };
  const nextMonth = () => { const d=new Date(curY,curM+1,1); setCurM(d.getMonth()); setCurY(d.getFullYear()); };

  // ── Confirm delete helper ─────────────────────────────────────────────────
  const askDelete = (label, onConfirm) => { setConfirmData({label,onConfirm}); setModal("confirm"); };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{minHeight:"100vh",background:"#07090f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{CSS}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:14}}>💳</div>
        <div style={{color:"#475569",fontSize:14,fontWeight:500}}>Carregando...</div>
      </div>
    </div>
  );

  // ── Auth screen ───────────────────────────────────────────────────────────
  if (!user) return (
    <div style={{minHeight:"100vh",background:"#07090f",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{CSS}</style>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 14px",boxShadow:"0 8px 32px rgba(99,102,241,.35)"}}>💳</div>
          <div style={{fontSize:28,fontWeight:800,color:"#f1f5f9",letterSpacing:"-.6px"}}>Financemês</div>
          <div style={{fontSize:12,color:"#475569",marginTop:5}}>Gestão financeira pessoal</div>
        </div>

        <div style={{display:"flex",background:"#0f1623",borderRadius:13,padding:4,marginBottom:22,border:"1px solid #1e2a3a"}}>
          {["login","register"].map(t=>(
            <button key={t} className="btn" onClick={()=>{setAuthPage(t);setAuthErr("");}}
              style={{flex:1,padding:"9px",borderRadius:10,fontSize:13,background:authPage===t?"#1e2a3a":"none",color:authPage===t?"#e2e8f0":"#475569"}}>
              {t==="login"?"Entrar":"Criar Conta"}
            </button>
          ))}
        </div>

        <div className={authShake?"shake":""} style={{background:"#0f1623",borderRadius:18,padding:22,border:"1px solid #1e2a3a",display:"flex",flexDirection:"column",gap:11}}>
          {authPage==="register" && (
            <div>
              <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>SEU NOME</label>
              <input className="ifield" placeholder="Como quer ser chamado?" value={authForm.name} onChange={e=>setAuthForm(f=>({...f,name:e.target.value}))} />
            </div>
          )}
          <div>
            <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>E-MAIL</label>
            <input className="ifield" type="email" placeholder="seu@email.com" value={authForm.email}
              onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&authPage==="login"&&handleLogin()} />
          </div>
          <div>
            <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>SENHA</label>
            <input className="ifield" type="password" placeholder="••••••••" value={authForm.password}
              onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&(authPage==="login"?handleLogin():null)} />
          </div>
          {authPage==="register" && (
            <div>
              <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>CONFIRMAR SENHA</label>
              <input className="ifield" type="password" placeholder="••••••••" value={authForm.confirm}
                onChange={e=>setAuthForm(f=>({...f,confirm:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&handleRegister()} />
            </div>
          )}
          {authErr && (
            <div style={{background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.25)",borderRadius:9,padding:"9px 13px",fontSize:13,color:"#f87171",textAlign:"center"}}>{authErr}</div>
          )}
          <button className="btn" onClick={authPage==="login"?handleLogin:handleRegister} disabled={authWorking}
            style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"13px",borderRadius:12,fontSize:14,marginTop:2,opacity:authWorking?.7:1}}>
            {authWorking ? "Aguarde..." : authPage==="login" ? "Entrar →" : "Criar Conta →"}
          </button>
        </div>
        <p style={{textAlign:"center",fontSize:11,color:"#1e2a3a",marginTop:18}}>Dados sincronizados em todos os dispositivos 🔒</p>
      </div>
    </div>
  );

  // ── Main App ──────────────────────────────────────────────────────────────
  const totalFunds  = funds.reduce((s,f)=>s+f.balance,0);
  const displayName = user.displayName || user.email || "Usuário";

  return (
    <div style={{minHeight:"100vh",background:"#07090f",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{CSS}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{background:"#0b0f1a",borderBottom:"1px solid #141e2e",padding:"13px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:12,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,boxShadow:"0 4px 14px rgba(99,102,241,.3)"}}>💳</div>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:"#f1f5f9",letterSpacing:"-.3px"}}>Financemês</div>
            <div style={{fontSize:11,color:"#334155"}}>Olá, {displayName.split(" ")[0]}! 👋</div>
          </div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button className="btn"
            onClick={()=>{setTxForm({type:"despesa",value:"",category:"",date:todayStr(),desc:""});setModal("tx");}}
            style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"8px 15px",borderRadius:9,fontSize:13}}>
            + Nova
          </button>
          <button className="btn" onClick={logout} title="Sair"
            style={{background:"#141927",color:"#64748b",padding:"8px 11px",borderRadius:9,fontSize:14}}>↩</button>
        </div>
      </header>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav style={{background:"#0b0f1a",borderBottom:"1px solid #141e2e",padding:"0 16px",display:"flex",gap:0,overflowX:"auto"}}>
        {[
          {id:"saldo",     icon:"📊", l:"Saldo Final"},
          {id:"transacoes",icon:"💸", l:"Transações"},
          {id:"metas",     icon:"🎯", l:"Metas"},
          {id:"reservas",  icon:"🏦", l:"Reservas"},
          {id:"categorias",icon:"🏷️", l:"Categorias"},
        ].map(n=>(
          <button key={n.id} className="nav-btn" onClick={()=>setPage(n.id)}
            style={{color:page===n.id?"#818cf8":"#475569",padding:"11px 13px",fontSize:12,fontWeight:page===n.id?700:400,borderBottom:page===n.id?"2px solid #818cf8":"2px solid transparent"}}>
            {n.icon} {n.l}
          </button>
        ))}
      </nav>

      <main style={{flex:1,padding:"20px 16px",maxWidth:900,margin:"0 auto",width:"100%"}}>

        {/* ═══════════════════════════════════════════════════════════════
            SALDO FINAL
        ═══════════════════════════════════════════════════════════════ */}
        {page==="saldo" && (
          <div className="anim">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div>
                <h1 style={{fontSize:22,fontWeight:800,color:"#f1f5f9",letterSpacing:"-.5px"}}>Saldo Final</h1>
                <p style={{color:"#475569",fontSize:12,marginTop:2}}>{MONTHS_FULL[curM]} de {curY}</p>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button className="btn" onClick={prevMonth} style={{background:"#141927",color:"#94a3b8",padding:"7px 13px",borderRadius:8,fontSize:16}}>‹</button>
                <button className="btn" onClick={nextMonth} style={{background:"#141927",color:"#94a3b8",padding:"7px 13px",borderRadius:8,fontSize:16}}>›</button>
              </div>
            </div>

            {/* Summary cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:11,marginBottom:14}}>
              {[
                {l:"Receitas",  v:receitas, g:"linear-gradient(135deg,#6d28d9,#a855f7)"},
                {l:"Despesas",  v:despesas, g:"linear-gradient(135deg,#c2410c,#f97316)"},
                {l:"Saldo",     v:saldo,    g:saldo>=0?"linear-gradient(135deg,#0e7490,#06b6d4)":"linear-gradient(135deg,#b91c1c,#ef4444)"},
              ].map((c,i)=>(
                <div key={i} className="card" style={{background:c.g,borderRadius:15,padding:"16px 14px"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:7}}>{c.l} do mês</div>
                  <div style={{fontSize:17,fontWeight:800,color:"#fff"}}>{fmtBRL(c.v)}</div>
                </div>
              ))}
            </div>

            {/* Goals summary strip */}
            {goals.filter(g=>g.period==="mensal").length>0 && (
              <div style={{background:"#0f1623",borderRadius:15,padding:"14px 16px",border:"1px solid #141e2e",marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:12,color:"#818cf8",marginBottom:10,letterSpacing:".03em"}}>🎯 METAS DO MÊS</div>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {goals.filter(g=>g.period==="mensal").slice(0,3).map(g=>{
                    const prog  = getGoalProgress(g);
                    const color = prog.over?(g.type==="gasto"?"#ef4444":"#22c55e"):(g.type==="gasto"?"#f97316":"#6366f1");
                    return (
                      <div key={g.id}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                          <span style={{color:"#94a3b8"}}>{g.name}</span>
                          <span style={{color,fontWeight:700}}>{fmtBRL(prog.current)} / {fmtBRL(g.value)}</span>
                        </div>
                        <div className="pbar"><div className="pfill" style={{width:`${prog.pct}%`,background:color}}/></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Charts */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{background:"#0f1623",borderRadius:15,padding:18,border:"1px solid #141e2e"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#f1f5f9",marginBottom:2}}>Evolução Mensal</div>
                <div style={{fontSize:11,color:"#475569",marginBottom:12}}>Últimos 6 meses</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{top:5,right:6,left:-24,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#141e2e" />
                    <XAxis dataKey="name" tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:"#475569",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${v/1000}k`:v} />
                    <Tooltip contentStyle={{background:"#141927",border:"1px solid #1e2a3a",borderRadius:8,fontSize:12}} labelStyle={{color:"#e2e8f0"}} />
                    <Line type="monotone" dataKey="Receitas" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="Despesas" stroke="#f97316" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{background:"#0f1623",borderRadius:15,padding:18,border:"1px solid #141e2e"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#f1f5f9",marginBottom:2}}>Por Categoria</div>
                <div style={{fontSize:11,color:"#475569",marginBottom:8}}>Despesas do mês</div>
                {catData.length>0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={catData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                        {catData.map((e,i)=><Cell key={i} fill={CAT_COLORS[e.name]||"#94a3b8"} />)}
                      </Pie>
                      <Tooltip contentStyle={{background:"#141927",border:"1px solid #1e2a3a",borderRadius:8,fontSize:12}} formatter={v=>fmtBRL(v)} />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:10,color:"#64748b"}} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{height:160,display:"flex",alignItems:"center",justifyContent:"center",color:"#334155",fontSize:13}}>Sem despesas</div>
                )}
              </div>
            </div>

            {/* Recent transactions */}
            <div style={{background:"#0f1623",borderRadius:15,padding:18,border:"1px solid #141e2e",marginTop:12}}>
              <div style={{fontWeight:700,fontSize:13,color:"#f1f5f9",marginBottom:12}}>Transações Recentes</div>
              {monthTx.length===0
                ? <div style={{color:"#334155",fontSize:13,textAlign:"center",padding:"14px 0"}}>Nenhuma transação este mês</div>
                : monthTx.slice(0,5).map(t=>(
                  <div key={t.id} className="tx-row" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 7px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:32,height:32,borderRadius:9,background:t.type==="receita"?"rgba(34,197,94,.12)":"rgba(239,68,68,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                        {t.type==="receita"?"↑":"↓"}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{t.category}</div>
                        <div style={{fontSize:11,color:"#475569"}}>{t.desc||"—"} · {new Date(t.date+"T12:00:00").toLocaleDateString("pt-BR")}</div>
                      </div>
                    </div>
                    <div style={{fontWeight:700,fontSize:13,color:t.type==="receita"?"#4ade80":"#f87171"}}>{t.type==="receita"?"+":"-"}{fmtBRL(t.value)}</div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TRANSAÇÕES
        ═══════════════════════════════════════════════════════════════ */}
        {page==="transacoes" && (
          <div className="anim">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <h1 style={{fontSize:22,fontWeight:800,color:"#f1f5f9",letterSpacing:"-.5px"}}>Transações</h1>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <button className="btn" onClick={prevMonth} style={{background:"#141927",color:"#94a3b8",padding:"6px 12px",borderRadius:8,fontSize:16}}>‹</button>
                <span style={{background:"#141927",padding:"6px 13px",borderRadius:8,fontSize:12,color:"#e2e8f0"}}>{MONTHS_FULL[curM]} {curY}</span>
                <button className="btn" onClick={nextMonth} style={{background:"#141927",color:"#94a3b8",padding:"6px 12px",borderRadius:8,fontSize:16}}>›</button>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:11,marginBottom:14}}>
              {[
                {l:"RECEITAS",v:receitas,c:"#4ade80",bg:"rgba(34,197,94,.08)",i:"↑"},
                {l:"DESPESAS",v:despesas,c:"#f87171",bg:"rgba(239,68,68,.08)",i:"↓"},
                {l:"SALDO",   v:saldo,   c:saldo>=0?"#38bdf8":"#f87171",bg:"rgba(56,189,248,.06)",i:"="},
              ].map((c,i)=>(
                <div key={i} style={{background:"#0f1623",borderRadius:13,padding:"13px",border:"1px solid #141e2e"}}>
                  <div style={{width:28,height:28,borderRadius:7,background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,marginBottom:6}}>{c.i}</div>
                  <div style={{fontSize:10,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:2}}>{c.l}</div>
                  <div style={{fontSize:16,fontWeight:800,color:c.c}}>{fmtBRL(c.v)}</div>
                </div>
              ))}
            </div>

            <div style={{display:"flex",gap:9,marginBottom:12}}>
              <button className="btn" onClick={()=>{setTxForm({type:"receita",value:"",category:"",date:todayStr(),desc:""});setModal("tx");}}
                style={{flex:1,background:"rgba(34,197,94,.1)",color:"#4ade80",padding:"10px",borderRadius:11,fontSize:13,border:"1px solid rgba(34,197,94,.2)"}}>+ Receita</button>
              <button className="btn" onClick={()=>{setTxForm({type:"despesa",value:"",category:"",date:todayStr(),desc:""});setModal("tx");}}
                style={{flex:1,background:"rgba(239,68,68,.1)",color:"#f87171",padding:"10px",borderRadius:11,fontSize:13,border:"1px solid rgba(239,68,68,.2)"}}>+ Despesa</button>
            </div>

            <div style={{background:"#0f1623",borderRadius:15,border:"1px solid #141e2e",overflow:"hidden"}}>
              {monthTx.length===0
                ? <div style={{color:"#334155",fontSize:13,textAlign:"center",padding:"32px 0"}}>Nenhuma transação este mês</div>
                : [...monthTx].sort((a,b)=>new Date(b.date)-new Date(a.date)).map((t,i)=>(
                  <div key={t.id} className="tx-row" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 15px",borderBottom:i<monthTx.length-1?"1px solid #141e2e":"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:36,height:36,borderRadius:11,background:t.type==="receita"?"rgba(34,197,94,.12)":"rgba(239,68,68,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                        {t.type==="receita"?"↑":"↓"}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{t.category}</div>
                        <div style={{fontSize:11,color:"#475569",marginTop:1}}>{t.desc||"—"} · {new Date(t.date+"T12:00:00").toLocaleDateString("pt-BR")}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                      <div style={{fontWeight:700,fontSize:14,color:t.type==="receita"?"#4ade80":"#f87171"}}>{t.type==="receita"?"+":"-"}{fmtBRL(t.value)}</div>
                      <button className="btn" onClick={()=>askDelete(`transação "${t.category} — ${fmtBRL(t.value)}"`,()=>delTx(t.id))}
                        style={{background:"rgba(239,68,68,.1)",color:"#f87171",padding:"4px 8px",borderRadius:7,fontSize:12}}>✕</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            METAS
        ═══════════════════════════════════════════════════════════════ */}
        {page==="metas" && (
          <div className="anim">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div>
                <h1 style={{fontSize:22,fontWeight:800,color:"#f1f5f9",letterSpacing:"-.5px"}}>Metas</h1>
                <p style={{color:"#475569",fontSize:12,marginTop:2}}>Controle seus objetivos financeiros</p>
              </div>
              <button className="btn"
                onClick={()=>{setGoalForm({name:"",type:"gasto",period:"mensal",value:"",startDate:"",category:""});setEditGoalId(null);setModal("newgoal");}}
                style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"8px 15px",borderRadius:9,fontSize:13}}>+ Nova Meta</button>
            </div>

            <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:18}}>
              <button className="btn" onClick={prevMonth} style={{background:"#141927",color:"#94a3b8",padding:"6px 12px",borderRadius:8,fontSize:16}}>‹</button>
              <span style={{background:"#141927",padding:"6px 13px",borderRadius:8,fontSize:12,color:"#e2e8f0"}}>{MONTHS_FULL[curM]} {curY}</span>
              <button className="btn" onClick={nextMonth} style={{background:"#141927",color:"#94a3b8",padding:"6px 12px",borderRadius:8,fontSize:16}}>›</button>
            </div>

            {["mensal","anual"].map(period=>{
              const list = goals.filter(g=>g.period===period);
              if (!list.length) return null;
              return (
                <div key={period} style={{marginBottom:18}}>
                  <div style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".08em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                    {period==="mensal"?"📅 METAS MENSAIS":"📆 METAS ANUAIS — "+curY}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {list.map(g=>{
                      const prog    = getGoalProgress(g);
                      const isGasto = g.type==="gasto";
                      const color   = prog.over?(isGasto?"#ef4444":"#22c55e"):(isGasto?"#f97316":"#6366f1");
                      return (
                        <div key={g.id} style={{background:"#0f1623",borderRadius:14,padding:"15px",border:`1px solid ${prog.over?(isGasto?"rgba(239,68,68,.25)":"rgba(34,197,94,.25)"):"#141e2e"}`}}>
                          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{g.name}</div>
                              <div style={{fontSize:11,color:"#475569",marginTop:3,display:"flex",alignItems:"center",gap:6}}>
                                <span>{isGasto?"💸 Gasto":"💰 Economia"}</span>
                                <span style={{color:"#334155"}}>·</span>
                                <span>{g.category||"Geral"}</span>
                                {prog.over && (
                                  <span style={{color,fontWeight:700,fontSize:11}}>
                                    {isGasto?"⚠ Ultrapassado":"✓ Atingida!"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{display:"flex",gap:6,flexShrink:0}}>
                              <button className="btn" onClick={()=>openEditGoal(g)}
                                style={{background:"rgba(99,102,241,.1)",color:"#818cf8",padding:"4px 9px",borderRadius:7,fontSize:12}}>✎</button>
                              <button className="btn" onClick={()=>askDelete(`meta "${g.name}"`,()=>delGoal(g.id))}
                                style={{background:"rgba(239,68,68,.1)",color:"#f87171",padding:"4px 9px",borderRadius:7,fontSize:12}}>✕</button>
                            </div>
                          </div>
                          <div className="pbar" style={{marginBottom:6}}>
                            <div className="pfill" style={{width:`${prog.pct}%`,background:color}}/>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b"}}>
                            <span style={{color,fontWeight:700}}>{prog.pct.toFixed(1)}%</span>
                            <span>{fmtBRL(prog.current)} / {fmtBRL(g.value)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {goals.length===0 && (
              <div style={{background:"#0f1623",borderRadius:15,padding:"44px 20px",border:"1px solid #141e2e",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:12}}>🎯</div>
                <div style={{color:"#475569",fontSize:14,fontWeight:600}}>Nenhuma meta criada ainda</div>
                <div style={{color:"#334155",fontSize:12,marginTop:5}}>Crie metas para controlar gastos e economias</div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            RESERVAS
        ═══════════════════════════════════════════════════════════════ */}
        {page==="reservas" && (
          <div className="anim">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <div>
                <h1 style={{fontSize:22,fontWeight:800,color:"#f1f5f9",letterSpacing:"-.5px"}}>Reservas</h1>
                <p style={{color:"#475569",fontSize:12,marginTop:2}}>Organize seus fundos e metas de poupança</p>
              </div>
              <button className="btn" onClick={()=>setModal("newfund")}
                style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"8px 15px",borderRadius:9,fontSize:13}}>+ Novo Fundo</button>
            </div>

            <div style={{background:"linear-gradient(135deg,#0f1623,#141e2e)",borderRadius:15,padding:"16px 18px",border:"1px solid #1e2a3a",marginBottom:16,display:"flex",gap:22,alignItems:"center"}}>
              <div>
                <div style={{fontSize:10,color:"#475569",fontWeight:700,marginBottom:3}}>TOTAL GUARDADO</div>
                <div style={{fontSize:24,fontWeight:800,color:"#818cf8"}}>{fmtBRL(totalFunds)}</div>
              </div>
              <div style={{width:1,height:40,background:"#1e2a3a"}}/>
              <div>
                <div style={{fontSize:10,color:"#475569",fontWeight:700,marginBottom:3}}>FUNDOS ATIVOS</div>
                <div style={{fontSize:24,fontWeight:800,color:"#e2e8f0"}}>{funds.length}</div>
              </div>
            </div>

            {funds.length===0 && (
              <div style={{background:"#0f1623",borderRadius:15,padding:"44px 20px",border:"1px solid #141e2e",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:12}}>🏦</div>
                <div style={{color:"#475569",fontSize:14,fontWeight:600}}>Nenhum fundo criado ainda</div>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              {funds.map(f=>{
                const pct = f.goal>0 ? Math.min(100,(f.balance/f.goal)*100) : 0;
                return (
                  <div key={f.id} style={{background:"#0f1623",borderRadius:15,padding:"17px",border:"1px solid #141e2e"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <div style={{width:11,height:11,borderRadius:"50%",background:f.color,flexShrink:0,marginTop:2}}/>
                        <div>
                          <div style={{fontWeight:700,fontSize:14,color:"#f1f5f9"}}>{f.name}</div>
                          {f.category && <div style={{fontSize:11,color:"#475569",marginTop:2}}>{f.category}</div>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontWeight:800,fontSize:17,color:f.color}}>{fmtBRL(f.balance)}</div>
                        <button className="btn" onClick={()=>askDelete(`fundo "${f.name}"`,()=>delFund(f.id))}
                          style={{background:"rgba(239,68,68,.1)",color:"#f87171",padding:"4px 8px",borderRadius:7,fontSize:12}}>✕</button>
                      </div>
                    </div>
                    {f.goal>0 && (
                      <>
                        <div style={{background:"#141e2e",borderRadius:100,height:5,marginBottom:5,overflow:"hidden"}}>
                          <div style={{width:`${pct}%`,height:"100%",background:f.color,borderRadius:100,transition:"width .5s"}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#475569"}}>
                          <span>{pct.toFixed(1)}% da meta</span>
                          <span>Meta: {fmtBRL(f.goal)}</span>
                        </div>
                      </>
                    )}
                    <div style={{display:"flex",gap:8,marginTop:13}}>
                      <button className="btn" onClick={()=>{setFundModal(f);setFundAct("add");setFundVal("");}}
                        style={{flex:1,background:"rgba(99,102,241,.12)",color:"#818cf8",padding:"8px",borderRadius:9,fontSize:13,border:"1px solid rgba(99,102,241,.2)"}}>+ Adicionar</button>
                      <button className="btn" onClick={()=>{setFundModal(f);setFundAct("remove");setFundVal("");}}
                        style={{flex:1,background:"rgba(239,68,68,.1)",color:"#f87171",padding:"8px",borderRadius:9,fontSize:13,border:"1px solid rgba(239,68,68,.2)"}}>− Retirar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            CATEGORIAS
        ═══════════════════════════════════════════════════════════════ */}
        {page==="categorias" && (
          <div className="anim">
            <div style={{marginBottom:18}}>
              <h1 style={{fontSize:22,fontWeight:800,color:"#f1f5f9",letterSpacing:"-.5px"}}>Categorias</h1>
              <p style={{color:"#475569",fontSize:12,marginTop:2}}>Gerencie suas categorias personalizadas</p>
            </div>

            {[
              {type:"despesa", label:"💸 Categorias de Despesa", newVal:newDCat, setNewVal:setNewDCat},
              {type:"receita", label:"💰 Categorias de Receita", newVal:newRCat, setNewVal:setNewRCat},
            ].map(({type,label,newVal,setNewVal})=>(
              <div key={type} style={{background:"#0f1623",borderRadius:15,padding:18,border:"1px solid #141e2e",marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:13,color:"#f1f5f9",marginBottom:14}}>{label}</div>

                {/* Add input */}
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  <input className="ifield" placeholder={`Nova categoria de ${type}...`}
                    value={newVal}
                    onChange={e=>setNewVal(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&newVal.trim()){addCat(type,newVal);setNewVal("");}}}
                    style={{flex:1}}
                  />
                  <button className="btn"
                    onClick={()=>{if(newVal.trim()){addCat(type,newVal);setNewVal("");}}}
                    style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"10px 16px",borderRadius:10,fontSize:14}}>+</button>
                </div>

                {/* Category chips */}
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {allCats[type].map(cat=>{
                    const isDefault = DEFAULT_CATEGORIES[type].includes(cat);
                    return (
                      <div key={cat} style={{display:"flex",alignItems:"center",gap:5,background:isDefault?"#141927":"rgba(99,102,241,.1)",border:`1px solid ${isDefault?"#1e2a3a":"rgba(99,102,241,.25)"}`,borderRadius:8,padding:"5px 10px"}}>
                        <span style={{fontSize:12,color:isDefault?"#64748b":"#818cf8"}}>{cat}</span>
                        {!isDefault && (
                          <button className="btn"
                            onClick={()=>askDelete(`categoria "${cat}"`,()=>delCat(type,cat))}
                            style={{background:"none",color:"#475569",fontSize:11,padding:"0 2px",lineHeight:1,fontWeight:400}}>✕</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{fontSize:11,color:"#334155",marginTop:10}}>
                  Categorias padrão (cinza) não podem ser removidas.
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* ════════════════════════════════════════════════════════════════
          MODAL — Nova Transação
      ════════════════════════════════════════════════════════════════ */}
      {modal==="tx" && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="mbox">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <h2 style={{fontSize:17,fontWeight:700,color:"#f1f5f9"}}>Nova {txForm.type==="despesa"?"Despesa":"Receita"}</h2>
              <button className="btn" onClick={()=>setModal(null)} style={{background:"#141927",color:"#64748b",padding:"5px 10px",borderRadius:7,fontSize:13}}>✕</button>
            </div>
            <div style={{display:"flex",gap:7,marginBottom:13}}>
              {["despesa","receita"].map(t=>(
                <button key={t} className="btn" onClick={()=>setTxForm(f=>({...f,type:t,category:""}))}
                  style={{flex:1,padding:"9px",borderRadius:10,fontSize:13,
                    background:txForm.type===t?(t==="despesa"?"rgba(239,68,68,.18)":"rgba(34,197,94,.18)"):"#141927",
                    color:txForm.type===t?(t==="despesa"?"#f87171":"#4ade80"):"#475569",
                    border:txForm.type===t?`1px solid ${t==="despesa"?"rgba(239,68,68,.35)":"rgba(34,197,94,.35)"}`:"1px solid #1e2a3a"}}>
                  {t==="despesa"?"↓ Despesa":"↑ Receita"}
                </button>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>VALOR (R$) *</label>
                <input className="ifield" type="number" placeholder="0,00" value={txForm.value} onChange={e=>setTxForm(f=>({...f,value:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>CATEGORIA *</label>
                <select className="ifield" value={txForm.category} onChange={e=>setTxForm(f=>({...f,category:e.target.value}))}>
                  <option value="">Selecionar...</option>
                  {allCats[txForm.type].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>DATA *</label>
                <input className="ifield" type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>DESCRIÇÃO (Opcional)</label>
                <input className="ifield" placeholder="Ex: Compras do mês..." value={txForm.desc} onChange={e=>setTxForm(f=>({...f,desc:e.target.value}))}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button className="btn" onClick={()=>setModal(null)} style={{flex:1,background:"#141927",color:"#64748b",padding:"11px",borderRadius:11,fontSize:14}}>Cancelar</button>
              <button className="btn" onClick={addTx}
                style={{flex:2,background:txForm.type==="despesa"?"linear-gradient(135deg,#b91c1c,#ef4444)":"linear-gradient(135deg,#15803d,#22c55e)",color:"#fff",padding:"11px",borderRadius:11,fontSize:14}}>
                Adicionar {txForm.type==="despesa"?"Despesa":"Receita"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL — Fundo (add/remove)
      ════════════════════════════════════════════════════════════════ */}
      {fundModal && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setFundModal(null)}>
          <div className="mbox">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <h2 style={{fontSize:17,fontWeight:700,color:"#f1f5f9"}}>{fundAct==="add"?"Adicionar ao":"Retirar do"} Fundo</h2>
              <button className="btn" onClick={()=>setFundModal(null)} style={{background:"#141927",color:"#64748b",padding:"5px 10px",borderRadius:7,fontSize:13}}>✕</button>
            </div>
            <div style={{background:"#141927",borderRadius:11,padding:"12px",marginBottom:13}}>
              <div style={{fontSize:12,color:"#64748b",marginBottom:3}}>{fundModal.name}</div>
              <div style={{fontSize:12,color:"#64748b"}}>Saldo Atual: <span style={{color:"#e2e8f0",fontWeight:600}}>{fmtBRL(fundModal.balance)}</span></div>
              {fundVal && (
                <div style={{fontSize:12,color:"#64748b",marginTop:3}}>
                  Novo Saldo: <span style={{color:"#818cf8",fontWeight:600}}>{fmtBRL(fundAct==="add"?fundModal.balance+parseFloat(fundVal||0):Math.max(0,fundModal.balance-parseFloat(fundVal||0)))}</span>
                </div>
              )}
            </div>
            <div>
              <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>VALOR (R$)</label>
              <input className="ifield" type="number" placeholder="0,00" value={fundVal} onChange={e=>setFundVal(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleFundBalance()}/>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button className="btn" onClick={()=>setFundModal(null)} style={{flex:1,background:"#141927",color:"#64748b",padding:"11px",borderRadius:11,fontSize:14}}>Cancelar</button>
              <button className="btn" onClick={handleFundBalance}
                style={{flex:2,background:fundAct==="add"?"linear-gradient(135deg,#4f46e5,#7c3aed)":"linear-gradient(135deg,#b91c1c,#ef4444)",color:"#fff",padding:"11px",borderRadius:11,fontSize:14}}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL — Novo Fundo
      ════════════════════════════════════════════════════════════════ */}
      {modal==="newfund" && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="mbox">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <h2 style={{fontSize:17,fontWeight:700,color:"#f1f5f9"}}>Novo Fundo</h2>
              <button className="btn" onClick={()=>setModal(null)} style={{background:"#141927",color:"#64748b",padding:"5px 10px",borderRadius:7,fontSize:13}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>NOME DO FUNDO *</label>
                <input className="ifield" placeholder="Ex: Viagem, Carro novo..." value={newFund.name} onChange={e=>setNewFund(f=>({...f,name:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>CATEGORIA</label>
                <select className="ifield" value={newFund.category} onChange={e=>setNewFund(f=>({...f,category:e.target.value}))}>
                  <option value="">Selecionar...</option>
                  {FUND_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>META (R$) — Opcional</label>
                <input className="ifield" type="number" placeholder="0,00" value={newFund.goal} onChange={e=>setNewFund(f=>({...f,goal:e.target.value}))}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button className="btn" onClick={()=>setModal(null)} style={{flex:1,background:"#141927",color:"#64748b",padding:"11px",borderRadius:11,fontSize:14}}>Cancelar</button>
              <button className="btn" onClick={addFund} style={{flex:2,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"11px",borderRadius:11,fontSize:14}}>Criar Fundo</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL — Nova / Editar Meta
      ════════════════════════════════════════════════════════════════ */}
      {modal==="newgoal" && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="mbox">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <h2 style={{fontSize:17,fontWeight:700,color:"#f1f5f9"}}>{editGoalId?"Editar Meta":"Nova Meta"}</h2>
              <button className="btn" onClick={()=>setModal(null)} style={{background:"#141927",color:"#64748b",padding:"5px 10px",borderRadius:7,fontSize:13}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>NOME DA META *</label>
                <input className="ifield" placeholder="Ex: Limite de alimentação..." value={goalForm.name} onChange={e=>setGoalForm(f=>({...f,name:e.target.value}))}/>
              </div>

              {/* Type toggle */}
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:6,display:"block"}}>TIPO</label>
                <div style={{display:"flex",gap:7}}>
                  {[{v:"gasto",l:"💸 Gasto"},{v:"economia",l:"💰 Economia"}].map(({v,l})=>(
                    <button key={v} className="btn" onClick={()=>setGoalForm(f=>({...f,type:v}))}
                      style={{flex:1,padding:"9px",borderRadius:9,fontSize:13,
                        background:goalForm.type===v?"rgba(99,102,241,.18)":"#141927",
                        color:goalForm.type===v?"#818cf8":"#475569",
                        border:goalForm.type===v?"1px solid rgba(99,102,241,.35)":"1px solid #1e2a3a"}}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Period toggle */}
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:6,display:"block"}}>PERÍODO</label>
                <div style={{display:"flex",gap:7}}>
                  {[{v:"mensal",l:"📅 Mensal"},{v:"anual",l:"📆 Anual"}].map(({v,l})=>(
                    <button key={v} className="btn" onClick={()=>setGoalForm(f=>({...f,period:v}))}
                      style={{flex:1,padding:"9px",borderRadius:9,fontSize:13,
                        background:goalForm.period===v?"rgba(99,102,241,.18)":"#141927",
                        color:goalForm.period===v?"#818cf8":"#475569",
                        border:goalForm.period===v?"1px solid rgba(99,102,241,.35)":"1px solid #1e2a3a"}}>{l}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>VALOR (R$) *</label>
                <input className="ifield" type="number" placeholder="0,00" value={goalForm.value} onChange={e=>setGoalForm(f=>({...f,value:e.target.value}))}/>
              </div>
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>CATEGORIA (Opcional)</label>
                <select className="ifield" value={goalForm.category} onChange={e=>setGoalForm(f=>({...f,category:e.target.value}))}>
                  <option value="">Geral (todas as categorias)</option>
                  {allCats[goalForm.type==="gasto"?"despesa":"receita"].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:"#475569",fontWeight:700,letterSpacing:".05em",marginBottom:5,display:"block"}}>DATA DE INÍCIO (Opcional)</label>
                <input className="ifield" type="date" value={goalForm.startDate} onChange={e=>setGoalForm(f=>({...f,startDate:e.target.value}))}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button className="btn" onClick={()=>setModal(null)} style={{flex:1,background:"#141927",color:"#64748b",padding:"11px",borderRadius:11,fontSize:14}}>Cancelar</button>
              <button className="btn" onClick={saveGoal} style={{flex:2,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",padding:"11px",borderRadius:11,fontSize:14}}>
                {editGoalId?"Salvar Alterações":"Criar Meta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL — Confirmação de Exclusão
      ════════════════════════════════════════════════════════════════ */}
      {modal==="confirm" && confirmData && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="mbox" style={{maxWidth:360}}>
            <div style={{textAlign:"center",padding:"8px 0 22px"}}>
              <div style={{fontSize:40,marginBottom:14}}>🗑️</div>
              <div style={{fontSize:16,fontWeight:700,color:"#f1f5f9",marginBottom:8}}>Confirmar exclusão</div>
              <div style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>
                Deseja excluir a {confirmData.label}?<br/>
                <span style={{color:"#475569",fontSize:12}}>Esta ação não pode ser desfeita.</span>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn" onClick={()=>setModal(null)}
                style={{flex:1,background:"#141927",color:"#64748b",padding:"11px",borderRadius:11,fontSize:14}}>Cancelar</button>
              <button className="btn" onClick={()=>{confirmData.onConfirm();setModal(null);setConfirmData(null);}}
                style={{flex:1,background:"linear-gradient(135deg,#b91c1c,#ef4444)",color:"#fff",padding:"11px",borderRadius:11,fontSize:14}}>Excluir</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
