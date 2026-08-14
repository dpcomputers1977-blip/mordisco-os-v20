const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const SUPABASE_URL='https://nmmjthqflxwucpmmmrks.supabase.co';
const SUPABASE_KEY='sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:'mordisco-amigos-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const interests=['Hamburguesas','Música','Viajes','Cine','Series','Deportes','Café','Fotografía','Mascotas','Videojuegos','Baile','Naturaleza'];
let session=null, profile=null, discovery=[], matches=[], activeFilter='all', authMode='login', activeChatUser=null, activeChatChannel=null;

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(window.toastT);window.toastT=setTimeout(()=>el.classList.remove('show'),3100)}
function openModal(id){$('#'+id)?.classList.add('open');$('#'+id)?.setAttribute('aria-hidden','false')}
function closeModals(){ $$('.modal.open').forEach(m=>m.classList.remove('open')); if(activeChatChannel){db.removeChannel(activeChatChannel);activeChatChannel=null} }
$$('[data-close]').forEach(b=>b.onclick=closeModals);
$$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModals()}));
$('#navToggle').onclick=()=>$('#amNav').classList.toggle('open');

function ageFromDate(date){if(!date)return 0;const b=new Date(date+'T12:00:00');const n=new Date();let a=n.getFullYear()-b.getFullYear();const m=n.getMonth()-b.getMonth();if(m<0||(m===0&&n.getDate()<b.getDate()))a--;return a}
function requireLogin(){if(session)return true;openModal('authModal');toast('Inicia sesión para usar Amigos Mordisco.');return false}
function requireProfile(){if(!requireLogin())return false;if(profile)return true;openProfile();toast('Completa tu perfil para continuar.');return false}
function setSessionUI(){
 const account=$('#accountBtn'), action=$('#mainAction'), note=$('#sessionNote');
 if(!session){account.textContent='❤ Entrar';action.textContent='CREAR MI CUENTA';note.textContent='Inicia sesión para descubrir perfiles reales.';return}
 if(profile){account.textContent=`❤ ${profile.display_name}`;action.textContent='EDITAR MI PERFIL';note.textContent=`Sesión activa como ${profile.display_name}.`}
 else{account.textContent='❤ Completar perfil';action.textContent='CREAR MI PERFIL';note.textContent='Tu cuenta está lista. Completa tu perfil +18.'}
}

function renderInterests(){
 $('#interestList').innerHTML=interests.map(i=>`<label><input type="checkbox" value="${esc(i)}"><span>${esc(i)}</span></label>`).join('');
}
renderInterests();

function openAuth(mode='login'){
 authMode=mode;$$('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===mode));
 $('#authTitle').textContent=mode==='login'?'Entrar a Amigos Mordisco':'Crear cuenta';
 $('#authSubmit').textContent=mode==='login'?'ENTRAR':'CREAR CUENTA';
 $('#authPassword').autocomplete=mode==='login'?'current-password':'new-password';openModal('authModal');
}
$$('[data-auth-tab]').forEach(b=>b.onclick=()=>openAuth(b.dataset.authTab));
$('#authForm').onsubmit=async e=>{
 e.preventDefault();const email=$('#authEmail').value.trim(),password=$('#authPassword').value;
 $('#authSubmit').disabled=true;
 try{
  if(authMode==='signup'){
   const {data,error}=await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/amigos-mordisco'}});if(error)throw error;
   if(!data.session){closeModals();toast('Cuenta creada. Revisa tu correo para confirmar y luego entra.');return}
   toast('Cuenta creada. Ahora completa tu perfil.');
  }else{
   const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;toast('Bienvenido a Amigos Mordisco.');
  }
  closeModals();await refreshIdentity();if(!profile)openProfile();
 }catch(err){toast(err.message||'No se pudo iniciar sesión.')}finally{$('#authSubmit').disabled=false}
};

async function refreshIdentity(){
 const {data}=await db.auth.getSession();session=data.session||null;profile=null;
 if(session){
  const {data:p,error}=await db.from('amigos_profiles').select('*').eq('user_id',session.user.id).maybeSingle();
  if(!error&&p)profile=p;
 }
 setSessionUI();await Promise.all([loadDiscovery(),loadMatches()]);
}

db.auth.onAuthStateChange(()=>setTimeout(refreshIdentity,0));

async function openProfile(){
 if(!requireLogin())return;
 $('#pName').value=profile?.display_name||'';$('#pBirth').value=profile?.birth_date||'';$('#pLooking').value=profile?.looking_for||'amistad';$('#pCity').value=profile?.city||'Machala';$('#pBio').value=profile?.bio||'';$('#pAdult').checked=!!profile;
 $$('#interestList input').forEach(x=>x.checked=(profile?.interests||[]).includes(x.value));
 const preview=$('#photoPreview');preview.innerHTML=profile?.photo_url?`<img src="${esc(profile.photo_url)}" alt="Foto de perfil">`:'❤';openModal('profileModal');
}
$('#accountBtn').onclick=()=>session?openProfile():openAuth('login');
$('#mainAction').onclick=()=>session?openProfile():openAuth('signup');

async function uploadPhoto(file){
 if(!file)return profile?.photo_url||null;if(file.size>5*1024*1024)throw new Error('La foto no puede superar 5 MB.');
 const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`${session.user.id}/profile-${Date.now()}.${ext}`;
 const {error}=await db.storage.from('amigos-profile-photos').upload(path,file,{upsert:true,contentType:file.type});if(error)throw error;
 return db.storage.from('amigos-profile-photos').getPublicUrl(path).data.publicUrl;
}
$('#pPhoto').onchange=()=>{const f=$('#pPhoto').files?.[0];if(!f)return;const url=URL.createObjectURL(f);$('#photoPreview').innerHTML=`<img src="${url}" alt="Vista previa">`};
$('#profileForm').onsubmit=async e=>{
 e.preventDefault();if(!session)return openAuth('login');
 const birth=$('#pBirth').value;if(ageFromDate(birth)<18)return toast('Amigos Mordisco es únicamente para mayores de 18 años.');
 const selected=$$('#interestList input:checked').map(x=>x.value);if(selected.length<3)return toast('Elige al menos 3 intereses.');
 const button=e.submitter||$('#profileForm .primary');button.disabled=true;
 try{
  const photo_url=await uploadPhoto($('#pPhoto').files?.[0]);
  const row={user_id:session.user.id,display_name:$('#pName').value.trim(),birth_date:birth,city:$('#pCity').value.trim()||'Machala',looking_for:$('#pLooking').value,bio:$('#pBio').value.trim(),interests:selected,photo_url,active:true};
  const {error}=await db.from('amigos_profiles').upsert(row,{onConflict:'user_id'});if(error)throw error;
  closeModals();toast('Perfil guardado. ¡Ya puedes conocer personas!');await refreshIdentity();
 }catch(err){toast(err.message||'No se pudo guardar el perfil.')}finally{button.disabled=false}
};
$('#logoutBtn').onclick=async()=>{await db.auth.signOut();closeModals();toast('Sesión cerrada.');await refreshIdentity()};

function lookingLabel(v){return v==='amistad'?'Amistad':v==='citas'?'Citas':'Amistad y citas'}
function avatarHtml(p){return p.photo_url?`<img src="${esc(p.photo_url)}" alt="${esc(p.display_name)}" loading="lazy">`:`<div class="avatar-fallback">${esc((p.display_name||'?').slice(0,1).toUpperCase())}</div>`}
function filteredDiscovery(){return discovery.filter(p=>activeFilter==='all'||p.looking_for===activeFilter||(activeFilter==='amistad'&&p.looking_for==='ambos')||(activeFilter==='citas'&&p.looking_for==='ambos'))}
function renderDiscovery(){
 const list=filteredDiscovery();$('#peopleGrid').innerHTML=list.map(p=>`<article class="person-card" data-user="${p.user_id}"><div class="person-photo">${avatarHtml(p)}${p.verified?'<span class="verified">✓ Verificado</span>':''}</div><div class="person-body"><h3>${esc(p.display_name)}, ${Number(p.age||0)}</h3><small class="person-meta">📍 ${esc(p.city)} · ${lookingLabel(p.looking_for)}</small><p>${esc(p.bio||'Prefiere presentarse conversando.')}</p><div class="person-tags">${(p.interests||[]).slice(0,4).map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="person-actions"><button class="pass" data-pass="${p.user_id}" title="Pasar">✕</button><button class="like" data-like="${p.user_id}">❤ ME INTERESA</button></div></div></article>`).join('');
 $('#peopleEmpty').classList.toggle('hidden',!!list.length||!session||!profile);
 $$('[data-like]').forEach(b=>b.onclick=()=>swipe(b.dataset.like,'like'));$$('[data-pass]').forEach(b=>b.onclick=()=>swipe(b.dataset.pass,'pass'));
}
async function loadDiscovery(){
 if(!session||!profile){discovery=[];renderDiscovery();return}
 const {data,error}=await db.rpc('amigos_get_discovery',{p_limit:60});if(error){console.warn(error);discovery=[];renderDiscovery();return}
 discovery=data||[];renderDiscovery();
}
async function swipe(userId,decision){
 if(!requireProfile())return;
 const {error}=await db.from('amigos_swipes').upsert({from_user:session.user.id,to_user:userId,decision},{onConflict:'from_user,to_user'});if(error)return toast(error.message);
 const person=discovery.find(p=>p.user_id===userId);discovery=discovery.filter(p=>p.user_id!==userId);renderDiscovery();
 if(decision==='like'){
  const {data:incoming}=await db.from('amigos_swipes').select('id').eq('from_user',userId).eq('to_user',session.user.id).eq('decision','like').maybeSingle();
  if(incoming){$('#matchModalTitle').textContent=`¡Tú y ${person?.display_name||'esta persona'} hicieron Match!`;$('#matchModalText').textContent='Ya pueden conversar y proponer su primera cita en Mordisco.';openModal('matchModal');await loadMatches()}else toast('Interés enviado. Habrá Match solo si la otra persona también te elige.');
 }
}
$$('.filter').forEach(b=>b.onclick=()=>{$$('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeFilter=b.dataset.filter;renderDiscovery()});
$('#refreshPeople').onclick=loadDiscovery;

function renderMatches(){
 $('#matchesGrid').innerHTML=matches.map(p=>`<article class="match-card"><div class="match-avatar">${avatarHtml(p)}</div><div><span class="match-label">❤ MATCH</span><h3>${esc(p.display_name)}, ${Number(p.age||0)}</h3><p>📍 ${esc(p.city)} · ${(p.interests||[]).slice(0,3).map(esc).join(' · ')}</p></div><div class="match-actions"><button class="primary compact" data-chat="${p.user_id}">💬 CHAT</button><button data-date="${p.user_id}">❤ CITA</button></div></article>`).join('');
 $('#matchesEmpty').classList.toggle('hidden',matches.length>0);
 $$('[data-chat]').forEach(b=>b.onclick=()=>openChat(b.dataset.chat));$$('[data-date]').forEach(b=>b.onclick=()=>openDate(b.dataset.date));
}
async function loadMatches(){
 if(!session||!profile){matches=[];renderMatches();return}
 const {data,error}=await db.rpc('amigos_get_matches');if(error){console.warn(error);matches=[];renderMatches();return}matches=data||[];renderMatches();
}
$('#refreshMatches').onclick=loadMatches;$('#goMatches').onclick=()=>{closeModals();location.hash='matches'};

async function openChat(userId){
 if(!requireProfile())return;activeChatUser=matches.find(m=>m.user_id===userId);if(!activeChatUser)return toast('Ese Match ya no está disponible.');
 $('#chatTitle').textContent=`Conversación con ${activeChatUser.display_name}`;openModal('chatModal');await loadMessages();
 activeChatChannel=db.channel(`amigos-chat-${session.user.id}-${userId}-${Date.now()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'amigos_messages'},payload=>{const m=payload.new;if([m.sender,m.receiver].includes(session.user.id)&&[m.sender,m.receiver].includes(userId))loadMessages()}).subscribe();
}
async function loadMessages(){
 if(!activeChatUser)return;const {data,error}=await db.rpc('amigos_get_messages',{p_other_user:activeChatUser.user_id,p_limit:120});
 if(error){$('#chatMessages').innerHTML='<div class="chat-empty">No se pudo cargar la conversación.</div>';return}
 $('#chatMessages').innerHTML=(data||[]).map(m=>`<div class="bubble ${m.sender===session.user.id?'mine':'theirs'}"><span>${esc(m.body)}</span><small>${new Date(m.created_at).toLocaleString('es-EC',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></div>`).join('')||'<div class="chat-empty">Empieza con un saludo respetuoso 👋</div>';$('#chatMessages').scrollTop=$('#chatMessages').scrollHeight;
}
$('#chatForm').onsubmit=async e=>{e.preventDefault();const body=$('#chatInput').value.trim();if(!body||!activeChatUser)return;const {error}=await db.from('amigos_messages').insert({sender:session.user.id,receiver:activeChatUser.user_id,body});if(error)return toast(error.message);$('#chatInput').value='';await loadMessages()};
$('#chatDate').onclick=()=>activeChatUser&&openDate(activeChatUser.user_id);
$('#chatReport').onclick=async()=>{if(!activeChatUser)return;const reason=prompt('Motivo del reporte (acoso, perfil falso, contenido inapropiado, otro):');if(!reason)return;const details=prompt('Detalles opcionales:')||'';const {error}=await db.from('amigos_reports').insert({reporter:session.user.id,reported:activeChatUser.user_id,reason,details});if(error)return toast(error.message);toast('Reporte enviado para revisión.');};
$('#chatBlock').onclick=async()=>{if(!activeChatUser||!confirm(`¿Bloquear a ${activeChatUser.display_name}? Ya no podrán verse ni escribirse.`))return;const {error}=await db.from('amigos_blocks').insert({blocker:session.user.id,blocked:activeChatUser.user_id});if(error)return toast(error.message);closeModals();toast('Perfil bloqueado.');await Promise.all([loadMatches(),loadDiscovery()])};

function openDate(userId){const p=matches.find(m=>m.user_id===userId);if(!p)return toast('Solo puedes proponer una cita a un Match.');activeChatUser=p;closeModals();$('#dateTitle').textContent=`Proponer cita a ${p.display_name}`;const tomorrow=new Date(Date.now()+86400000);$('#dateDay').min=tomorrow.toISOString().slice(0,10);$('#dateDay').value=tomorrow.toISOString().slice(0,10);openModal('dateModal')}
$('#dateForm').onsubmit=async e=>{e.preventDefault();if(!activeChatUser)return;const proposed_at=new Date(`${$('#dateDay').value}T${$('#dateTime').value}:00`).toISOString();const {error}=await db.from('amigos_date_proposals').insert({proposer:session.user.id,invitee:activeChatUser.user_id,proposed_at,message:$('#dateMessage').value.trim()});if(error)return toast(error.message);closeModals();toast('Propuesta enviada. Tu Match podrá aceptarla o rechazarla.')};

const quiz=[
 {q:'¿Cuál sería tu plan ideal para una primera cita?',o:[['Hamburguesa y conversación',22],['Música y algo espontáneo',18],['Cine y luego comer',16],['Actividad al aire libre',15]]},
 {q:'¿Qué valoras más cuando conoces a alguien?',o:[['Que me haga reír',25],['Una conversación profunda',23],['Tener intereses similares',20],['Que sea aventurero/a',18]]},
 {q:'Elige tu energía social',o:[['Me encanta conocer gente',22],['Equilibrio entre salir y descansar',25],['Pocos amigos, muy cercanos',23],['Depende del día',19]]},
 {q:'¿Qué no puede faltar en un buen Match?',o:[['Respeto',28],['Química',24],['Buen humor',23],['Un buen Mordisco',25]]}
];let quizStep=0,quizScore=0;
function showQuiz(){if(quizStep>=quiz.length){const pct=Math.min(99,67+Math.round(quizScore/12));$('#compatPct').textContent=pct;$('#compatName').textContent='Tu afinidad social';$('#compatText').textContent=`${pct}% de energía compatible según este test recreativo.`;closeModals();location.hash='match';toast('¡Test completado!');return}$('#quizTitle').textContent=`Pregunta ${quizStep+1} de ${quiz.length}`;$('#quizQuestion').textContent=quiz[quizStep].q;$('#quizOptions').innerHTML=quiz[quizStep].o.map(([t,s])=>`<button data-score="${s}">${t}</button>`).join('');$$('[data-score]').forEach(b=>b.onclick=()=>{quizScore+=Number(b.dataset.score);quizStep++;showQuiz()})}
$('#startQuiz').onclick=()=>{quizStep=0;quizScore=0;openModal('quizModal');showQuiz()};
$('#dateDemo').onclick=()=>{$('#infoContent').innerHTML='<span class="kicker">PRIMERA CITA EN MORDISCO</span><h2>Así funciona</h2><p>1. Dos personas hacen Match.<br><br>2. Conversan dentro de Amigos Mordisco.<br><br>3. Una propone día y hora.<br><br>4. La otra puede aceptar o rechazar.<br><br>5. Se encuentran en un lugar público: Mordisco.</p><p><b>Importante:</b> no hace falta publicar teléfono, dirección de casa ni ubicación privada.</p>';openModal('infoModal')};
$$('[data-event]').forEach(b=>b.onclick=()=>{localStorage.setItem('amigos_mordisco_event_'+b.dataset.event,'1');b.textContent='❤ ME INTERESA';toast('Interés guardado. Te avisaremos cuando se anuncie la fecha.')});
$('#safetyBtn').onclick=()=>{$('#infoContent').innerHTML='<span class="kicker">SEGURIDAD</span><h2>Conoce personas con criterio</h2><p>Queda por primera vez en lugares públicos como Mordisco. No envíes dinero ni compartas claves, documentos o información financiera. Avísale a una persona de confianza dónde estarás. Si alguien te incomoda, termina la conversación, bloquea y reporta.</p><p>Amigos Mordisco es únicamente para mayores de 18 años.</p>';openModal('infoModal')};

refreshIdentity().catch(err=>{console.error(err);toast('No se pudo conectar con Amigos Mordisco. Revisa que el SQL V41 esté instalado.')});
