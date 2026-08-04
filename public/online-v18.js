const SUPABASE_URL="https://nmmjthqflxwucpmmmrks.supabase.co";
const SUPABASE_KEY="sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

let products=[],categories=[],cart=[],category="Todos",search="",onlineExtraOptions=[];
const money=n=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(Number(n||0));
const esc=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

function toast(message){
  const node=document.querySelector("#onlineToast");
  node.textContent=message;
  node.classList.add("show");
  setTimeout(()=>node.classList.remove("show"),3500);
}

async function load(){
  const [productsResult,categoriesResult]=await Promise.all([
    db.from("products").select("*,categories(name)").eq("active",true).order("sort_order"),
    db.from("categories").select("*").eq("active",true).order("sort_order")
  ]);
  if(productsResult.error)return toast(productsResult.error.message);
  products=productsResult.data||[];
  categories=categoriesResult.data||[];
  renderCategories();
  renderProducts();
  renderCart();
}

function renderCategories(){
  const values=["Todos",...categories.map(c=>c.name)];
  document.querySelector("#onlineCategories").innerHTML=values.map(name=>`<button class="${category===name?"active":""}" data-category="${esc(name)}">${esc(name)}</button>`).join("");
  document.querySelectorAll("[data-category]").forEach(button=>button.onclick=()=>{
    category=button.dataset.category;
    renderCategories();
    renderProducts();
  });
}

function renderProducts(){
  const list=products.filter(p=>{
    const text=`${p.name} ${p.description||""}`.toLowerCase();
    return (category==="Todos"||p.categories?.name===category)&&text.includes(search.toLowerCase());
  });
  document.querySelector("#onlineProducts").innerHTML=list.map(p=>`<article class="onlineProduct">
    ${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:"<div style='height:175px;background:#eee7dc'></div>"}
    <div class="onlineProductBody">
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.description||"")}</p>
      <div class="onlineProductFooter"><b>${money(p.price)}</b><button data-add="${p.id}">Agregar</button></div>
    </div>
  </article>`).join("")||"<p>No encontramos productos.</p>";
  document.querySelectorAll("[data-add]").forEach(button=>button.onclick=()=>{
    const id=button.dataset.add;
    const row=cart.find(item=>String(item.id)===String(id));
    if(row)row.qty++;else cart.push({id,qty:1});
    renderCart();
    toast("Producto agregado");
  });
}

function renderCart(){
  const node=document.querySelector("#onlineCartItems");
  if(!cart.length){
    node.innerHTML="<p>Tu carrito está vacío.</p>";
  }else{
    node.innerHTML=cart.map(item=>{
      const p=products.find(product=>String(product.id)===String(item.id));
      return `<div class="onlineCartItem">
        <div><b>${esc(p.name)}</b><small>${money(p.price)} c/u</small></div>
        <div class="onlineQty"><button data-minus="${p.id}">−</button><b>${item.qty}</b><button data-plus="${p.id}">+</button></div>
      </div>`;
    }).join("");
  }

  document.querySelectorAll("[data-minus]").forEach(button=>button.onclick=()=>{
    const row=cart.find(item=>String(item.id)===String(button.dataset.minus));
    row.qty--;
    cart=cart.filter(item=>item.qty>0);
    renderCart();
  });
  document.querySelectorAll("[data-plus]").forEach(button=>button.onclick=()=>{
    cart.find(item=>String(item.id)===String(button.dataset.plus)).qty++;
    renderCart();
  });

  const productsTotal=cart.reduce((sum,item)=>{
    const p=products.find(product=>String(product.id)===String(item.id));
    return sum+Number(p.price)*item.qty;
  },0);
  const extrasTotal=typeof onlineExtrasTotal==="function" ? onlineExtrasTotal() : 0;
  document.querySelector("#onlineTotal").textContent=money(productsTotal+extrasTotal);
}

document.querySelector("#onlineSearch").oninput=event=>{
  search=event.target.value;
  renderProducts();
};

document.querySelector("#onlinePaymentMethod").onchange=event=>{
  const method=event.target.value;
  document.querySelector("#onlineTransferInfo").classList.toggle("hidden",method!=="transfer");
  document.querySelector("#onlineCardInfo").classList.toggle("hidden",method!=="card");
  document.querySelector("#onlinePaymentNotice").textContent={
    cash:"Pagarás en efectivo al recibir o retirar el pedido.",
    transfer:"El pedido quedará pendiente hasta confirmar la transferencia.",
    card:"El negocio confirmará el cobro o te enviará un enlace de pago."
  }[method];
};

document.querySelector("#onlineType").onchange=event=>{
  document.querySelector("#onlineAddressWrap").classList.toggle("hidden",event.target.value!=="delivery");
};

document.querySelector("#onlineOrderForm").onsubmit=async event=>{
  event.preventDefault();
  if(!cart.length)return toast("Agrega productos al pedido");

  const type=document.querySelector("#onlineType").value;
  const address=document.querySelector("#onlineAddress").value.trim();
  if(type==="delivery"&&!address)return toast("Escribe la dirección de entrega");

  const button=document.querySelector("#sendOnlineOrder");
  button.disabled=true;
  button.textContent="Enviando...";

  const items=cart.map(item=>({product_id:item.id,quantity:item.qty}));
  const {data,error}=await db.rpc("create_web_order",{
    p_customer_name:document.querySelector("#onlineName").value.trim(),
    p_customer_phone:document.querySelector("#onlinePhone").value.trim(),
    p_customer_address:address,
    p_order_type:type,
    p_notes:document.querySelector("#onlineNotes").value.trim(),
    p_items:items,
    p_payment_method:document.querySelector("#onlinePaymentMethod").value,
    p_extras:selectedOnlineExtras().map(extra=>({extra_id:extra.id}))
  });

  button.disabled=false;
  button.textContent="Enviar pedido";

  if(error)return toast("No se pudo enviar: "+error.message);

  const orderNumber=Array.isArray(data)?data[0]?.order_number:data?.order_number;
  cart=[];
  document.querySelectorAll("[data-extra-option]:checked").forEach(input=>input.checked=false);
  renderCart();
  event.target.reset();
  document.querySelector("#onlineAddressWrap").classList.add("hidden");
  toast(`Pedido #${orderNumber||""} enviado correctamente`);
};

load();

/* ===== BLOQUEO AUTOMÁTICO POR HORARIO ===== */
let onlineBusinessOpen=true;
let onlineBusinessHours=[];

function onlineMinutes(value){
  const [h,m]=String(value||'00:00').slice(0,5).split(':').map(Number);
  return h*60+m;
}

function onlineStatus(rows,date=new Date()){
  const row=rows.find(x=>Number(x.day_of_week)===date.getDay());
  if(!row || row.closed)return {open:false,text:'Hoy no atendemos pedidos en línea.'};
  const current=date.getHours()*60+date.getMinutes();
  const opens=onlineMinutes(row.opens_at);
  const closes=onlineMinutes(row.closes_at);
  if(current<opens)return {open:false,text:`Abrimos hoy a las ${String(row.opens_at).slice(0,5)}.`};
  if(current>=closes)return {open:false,text:`Ya cerramos por hoy. El horario fue hasta las ${String(row.closes_at).slice(0,5)}.`};
  return {open:true,text:`Abierto hasta las ${String(row.closes_at).slice(0,5)}.`};
}

function nextOnlineOpening(rows,date=new Date()){
  for(let offset=0;offset<8;offset++){
    const candidate=new Date(date);
    candidate.setDate(date.getDate()+offset);
    const row=rows.find(x=>Number(x.day_of_week)===candidate.getDay());
    if(!row || row.closed)continue;
    const current=date.getHours()*60+date.getMinutes();
    if(offset===0 && current>=onlineMinutes(row.opens_at))continue;
    const dayName=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][candidate.getDay()];
    return `${offset===0?'Hoy':offset===1?'Mañana':dayName} abrimos a las ${String(row.opens_at).slice(0,5)}.`;
  }
  return '';
}

function applyOnlineOrderingState(){
  const state=onlineStatus(onlineBusinessHours);
  onlineBusinessOpen=state.open;

  const banner=document.querySelector('#onlineClosedBanner');
  const text=document.querySelector('#onlineClosedText');
  const submit=document.querySelector('#onlineSubmit');
  const products=document.querySelector('.onlineProducts') || document.querySelector('#onlineProducts');

  if(state.open){
    banner?.classList.add('hidden');
    if(submit)submit.disabled=false;
    products?.classList.remove('onlineOrderingLocked');
  }else{
    banner?.classList.remove('hidden');
    if(text)text.textContent=`${state.text} ${nextOnlineOpening(onlineBusinessHours)}`;
    if(submit)submit.disabled=true;
    products?.classList.add('onlineOrderingLocked');
  }
}

async function loadOnlineBusinessHours(){
  try{
    const {data,error}=await db.from('business_hours').select('*').order('sort_order');
    if(error)throw error;
    onlineBusinessHours=data||[];
    applyOnlineOrderingState();
    setInterval(applyOnlineOrderingState,60000);
  }catch(error){
    console.warn('Horarios no disponibles:',error);
    onlineBusinessOpen=false;
    onlineBusinessHours=[];
    const banner=document.querySelector('#onlineClosedBanner');
    const text=document.querySelector('#onlineClosedText');
    banner?.classList.remove('hidden');
    if(text)text.textContent='No se pudo comprobar el horario. Intenta nuevamente o contáctanos.';
    const submit=document.querySelector('#onlineSubmit');
    if(submit)submit.disabled=true;
  }
}

document.addEventListener('DOMContentLoaded',loadOnlineBusinessHours);


/* ===== WHATSAPP DINÁMICO PARA PEDIDOS EN LÍNEA ===== */
async function loadOnlineWhatsapp(){
  try{
    const client=window.mordiscoSupabaseClient || db;
    const {data,error}=await client
      .from('business_settings')
      .select('whatsapp,business_name')
      .limit(1)
      .maybeSingle();

    if(error) throw error;

    const phone=String(data?.whatsapp || '').replace(/\D/g,'');
    if(!phone) return;

    window.MORDISCO_WHATSAPP=phone;

    document.querySelectorAll('a[href*="wa.me"], [data-whatsapp-link]').forEach(link=>{
      const text=encodeURIComponent(`Hola ${data?.business_name || 'Mordisco Fast Food'}, necesito ayuda con mi pedido.`);
      link.href=`https://wa.me/${phone}?text=${text}`;
      link.target='_blank';
      link.rel='noopener noreferrer';
    });
  }catch(error){
    console.warn('No se pudo cargar WhatsApp:',error);
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',loadOnlineWhatsapp,{once:true});
}else{
  loadOnlineWhatsapp();
}


/* ===== EXTRAS Y EMPAQUES EN PEDIDOS ===== */
async function loadOnlineExtraOptions(){
  const node=document.querySelector('#onlineExtraOptions');
  if(!node)return;

  try{
    const {data,error}=await db
      .from('extra_options')
      .select('*,categories(id,name)')
      .eq('active',true)
      .order('featured',{ascending:false})
      .order('sort_order',{ascending:true})
      .order('name',{ascending:true});

    if(error)throw error;

    onlineExtraOptions=data||[];
    renderOnlineExtraOptions();
  }catch(error){
    console.warn('Extras:',error);
    node.innerHTML='<div class="onlineExtraLoading">No hay extras disponibles en este momento.</div>';
  }
}

function renderOnlineExtraOptions(){
  const node=document.querySelector('#onlineExtraOptions');
  if(!node)return;

  if(!onlineExtraOptions.length){
    node.innerHTML='<div class="onlineExtraLoading">No hay extras disponibles.</div>';
    return;
  }

  const groups=[
    {type:'extra',label:'Extras'},
    {type:'packaging',label:'Empaques especiales'}
  ];

  node.innerHTML=groups.map(group=>{
    const options=onlineExtraOptions.filter(x=>x.option_type===group.type);
    if(!options.length)return '';

    return `<div class="onlineExtraGroup">
      <h4>${group.label}</h4>
      ${options.map(option=>`
        <label class="onlineExtraOption">
          <input
            type="checkbox"
            data-extra-option="${option.id}"
            data-extra-price="${Number(option.price||0)}"
            data-extra-name="${esc(option.name)}"
          >
          <span>
            <strong>${esc(option.name)}</strong>
            <small>${esc(option.description||'')}</small>
          </span>
          <span class="onlineExtraPrice">+${money(option.price)}</span>
        </label>
      `).join('')}
    </div>`;
  }).join('');

  node.querySelectorAll('[data-extra-option]').forEach(input=>{
    input.addEventListener('change',renderCart);
  });
}

function selectedOnlineExtras(){
  return [...document.querySelectorAll('[data-extra-option]:checked')].map(input=>({
    id:input.dataset.extraOption,
    name:input.dataset.extraName,
    price:Number(input.dataset.extraPrice||0)
  }));
}

function onlineExtrasTotal(){
  return selectedOnlineExtras().reduce((sum,item)=>sum+item.price,0);
}

/* El total se integra directamente dentro de renderCart().
   Los extras se envían mediante p_extras en create_web_order(). */

function initializeOnlineExtras(){
  loadOnlineExtraOptions();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initializeOnlineExtras,{once:true});
}else{
  initializeOnlineExtras();
}
