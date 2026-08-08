(() => {
  const SUPABASE_URL='https://nmmjthqflxwucpmmmrks.supabase.co';
  const SUPABASE_KEY='sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0';
  const PHONE_KEY='mordisco_club_phone';
  let dbPromise=null;

  function normalizePhone(v){
    let d=String(v||'').replace(/\D/g,'');
    if(d.startsWith('593')) d='0'+d.slice(3);
    return d;
  }

  function style(){
    if(document.getElementById('mcgp-style'))return;
    const s=document.createElement('style');s.id='mcgp-style';s.textContent=`
      .mcgp-toast{position:fixed;left:50%;top:16px;transform:translateX(-50%) translateY(-20px);z-index:999999;background:#0a1019;color:#fff;border:1px solid #ff8500;border-radius:999px;padding:10px 16px;font:800 13px system-ui;box-shadow:0 12px 35px #000b;opacity:0;transition:.2s;max-width:92vw;text-align:center}.mcgp-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .mcgp-modal{position:fixed;z-index:999998;inset:0;background:#000d;display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui}.mcgp-card{width:min(92vw,420px);background:#0a1019;color:#fff;border:1.5px solid #ff8500;border-radius:22px;padding:20px;text-align:center;box-shadow:0 22px 70px #000}.mcgp-card h2{margin:2px 0 8px}.mcgp-card p{color:#c8d0da;line-height:1.35}.mcgp-card input{width:100%;padding:13px;border-radius:12px;border:1px solid #394657;background:#060a10;color:#fff;font-size:17px}.mcgp-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.mcgp-actions button{border:0;border-radius:12px;padding:12px;font-weight:900}.mcgp-primary{background:#ff7900;color:#fff}.mcgp-secondary{background:#1a2431;color:#fff}.mcgp-status{position:fixed;right:9px;bottom:9px;z-index:99990;background:#07101dea;border:1px solid #ff8500;color:#fff;border-radius:999px;padding:7px 10px;font:800 11px system-ui;cursor:pointer;box-shadow:0 7px 20px #0009}`;
    document.head.appendChild(s);
  }

  function toast(msg){
    style();let el=document.getElementById('mcgp-toast');
    if(!el){el=document.createElement('div');el.id='mcgp-toast';el.className='mcgp-toast';document.body.appendChild(el)}
    el.textContent=msg;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3200);
  }

  async function getDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const make=()=>{try{resolve(window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY))}catch(e){reject(e)}};
      if(window.supabase?.createClient)return make();
      const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';sc.onload=make;sc.onerror=()=>reject(new Error('No se pudo cargar Supabase'));document.head.appendChild(sc);
    });
    return dbPromise;
  }

  async function lookup(phone){
    const db=await getDb();
    const {data,error}=await db.rpc('club_mordisco_lookup',{p_phone:phone});
    if(error)throw error;
    return Array.isArray(data)?data[0]:data;
  }

  function askPhone(){
    style();
    return new Promise(resolve=>{
      const old=document.getElementById('mcgp-modal');if(old)old.remove();
      const m=document.createElement('div');m.id='mcgp-modal';m.className='mcgp-modal';
      m.innerHTML=`<div class="mcgp-card"><div style="font-size:12px;color:#ff9b1b;font-weight:1000">🟠 CLUB MORDISCO</div><h2>Vincula tus puntos</h2><p>Escribe el mismo teléfono que usas en tus pedidos. Así el +1 del juego se suma a tu saldo real.</p><input id="mcgp-phone" inputmode="tel" autocomplete="tel" placeholder="Ej. 09XXXXXXXX"><div id="mcgp-msg" style="min-height:20px;margin-top:8px;color:#ffbc69;font-size:12px"></div><div class="mcgp-actions"><button class="mcgp-secondary" id="mcgp-cancel">Ahora no</button><button class="mcgp-primary" id="mcgp-save">Vincular</button></div></div>`;
      document.body.appendChild(m);
      const inp=m.querySelector('#mcgp-phone'),msg=m.querySelector('#mcgp-msg');
      inp.value=localStorage.getItem(PHONE_KEY)||'';setTimeout(()=>inp.focus(),80);
      m.querySelector('#mcgp-cancel').onclick=()=>{m.remove();resolve(null)};
      m.querySelector('#mcgp-save').onclick=async()=>{
        const phone=normalizePhone(inp.value);if(phone.length<8){msg.textContent='Ingresa un teléfono válido.';return}
        msg.textContent='Verificando…';
        try{
          const customer=await lookup(phone);
          if(!customer){msg.textContent='No encontramos ese teléfono en Club Mordisco.';return}
          localStorage.setItem(PHONE_KEY,phone);m.remove();toast('✅ Club Mordisco vinculado · '+customer.loyalty_points+' puntos');updateStatus();resolve(phone);
        }catch(e){msg.textContent='No se pudo conectar. Revisa Internet e inténtalo otra vez.';console.error(e)}
      };
    });
  }

  async function ensurePhone(){
    const saved=normalizePhone(localStorage.getItem(PHONE_KEY));
    if(saved.length>=8)return saved;
    return await askPhone();
  }

  async function award(game,level){
    try{
      const phone=await ensurePhone();if(!phone){toast('Punto pendiente: vincula Club Mordisco para guardarlo.');return {awarded:false,pending:true}}
      const db=await getDb();
      const {data,error}=await db.rpc('club_mordisco_game_award',{p_phone:phone,p_game:String(game),p_level:Number(level)});
      if(error){
        console.error(error);
        if(String(error.message||'').includes('club_mordisco_game_award')) toast('⚙️ Falta activar el SQL de puntos de juegos en Supabase.');
        else toast('No se pudo guardar el punto.');
        return {awarded:false,error};
      }
      const r=Array.isArray(data)?data[0]:data;
      toast(r?.message|| (r?.awarded?'+1 Mordisco Club Point':'Punto no disponible'));
      updateStatus(r?.balance);
      return r||{awarded:false};
    }catch(e){console.error(e);toast('No se pudo conectar con Club Mordisco.');return {awarded:false,error:e}}
  }

  async function updateStatus(knownBalance){
    const el=document.getElementById('mcgp-status');if(!el)return;
    const phone=normalizePhone(localStorage.getItem(PHONE_KEY));
    if(!phone){el.textContent='🟠 Vincular Club';return}
    if(Number.isFinite(Number(knownBalance))){el.textContent='🟠 '+Number(knownBalance)+' pts';return}
    try{const c=await lookup(phone);el.textContent=c?'🟠 '+Number(c.loyalty_points||0)+' pts':'🟠 Vincular Club'}catch{el.textContent='🟠 Club Mordisco'}
  }

  function mountStatus(){
    style();if(document.getElementById('mcgp-status'))return;
    const b=document.createElement('button');b.id='mcgp-status';b.className='mcgp-status';b.type='button';b.onclick=askPhone;document.body.appendChild(b);updateStatus();
  }

  window.MordiscoClub={award,askPhone,lookup,getPhone:()=>normalizePhone(localStorage.getItem(PHONE_KEY)),mountStatus,toast};
})();
