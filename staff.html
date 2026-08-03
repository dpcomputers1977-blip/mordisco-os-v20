
const db=supabase.createClient(
  "https://nmmjthqflxwucpmmmrks.supabase.co",
  "sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0"
);
const $=s=>document.querySelector(s);
let staff=[],tables=[],products=[],categories=[],employee=null,employeePin='',currentTable=null,currentOrder=null,cart=[];
const money=n=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function toast(m){const t=$('#commandToast');t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',2800)}
function statusLabel(s){return ({free:'Libre',occupied:'Ocupada',preparing:'Preparando',payment:'Por cobrar'})[s]||s}

async function loadBase(){
  const [a,b,c,d]=await Promise.all([
    db.from('staff').select('id,name,role,active').eq('active',true).in('role',['waiter','cashier','admin']),
    db.from('restaurant_tables').select('*').order('sort_order'),
    db.from('products').select('*,categories(name)').eq('active',true),
    db.from('categories').select('*').eq('active',true).order('sort_order')
  ]);
  if(a.error)return toast(a.error.message);
  if(b.error)return toast(b.error.message);
  staff=a.data||[];tables=(b.data||[]).filter(t=>t.active!==false);products=c.data||[];categories=d.data||[];
  $('#commandEmployee').innerHTML=staff.map(s=>`<option value="${s.id}">${esc(s.name)} — ${s.role==='waiter'?'Mesero':s.role==='cashier'?'Cajero':'Administrador'}</option>`).join('');
  renderTables();fillCategories();
}

async function login(){
  const id=$('#commandEmployee').value,pin=$('#commandPin').value.trim();
  if(!/^\d{4,6}$/.test(pin))return toast('PIN inválido');
  const {data,error}=await db.rpc('verify_staff_pin',{staff_id:id,staff_pin:pin});
  if(error)return toast('No se pudo validar el PIN');
  if(!data)return toast('PIN incorrecto');
  employee=staff.find(s=>s.id===id);
  employeePin=pin;
  $('#commandEmployeeName').textContent=employee.name;
  $('#commandLogin').classList.add('hidden');
  $('#commandApp').classList.remove('hidden');
  renderTables();
}

function renderTables(){
  $('#commandTables').innerHTML=tables.map(t=>`
    <button class="commandTable ${t.status||'free'}" data-id="${t.id}">
      <h3>${esc(t.name)}</h3>
      <span>${Number(t.seats||4)} puestos</span>
      <strong>${statusLabel(t.status||'free')}</strong>
      ${t.current_order_id?'<small>Ver cuenta y cobrar</small>':''}
    </button>`).join('');
  document.querySelectorAll('.commandTable').forEach(b=>b.onclick=()=>openTable(b.dataset.id));
}

function fillCategories(){
  $('#commandCategory').innerHTML='<option value="all">Todas</option>'+
    categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
}

async function openTable(id){
  currentTable=tables.find(t=>String(t.id)===String(id));
  currentOrder=null;cart=[];
  $('#commandTableName').textContent=currentTable.name;
  $('#commandApp').classList.add('hidden');
  $('#commandOrder').classList.remove('hidden');
  renderProducts();renderCart();
  await loadCurrentOrder();
}

async function loadCurrentOrder(){
  const panel=$('#commandCurrentAccount');
  panel.classList.add('hidden');
  if(!currentTable?.current_order_id)return;
  const {data,error}=await db.from('orders')
    .select('id,order_number,total,status,payment_status,payment_method')
    .eq('id',currentTable.current_order_id).maybeSingle();
  if(error)return toast('No se pudo cargar la cuenta');
  currentOrder=data;
  if(!currentOrder)return;
  $('#commandCurrentOrderNumber').textContent=`Pedido #${currentOrder.order_number}`;
  $('#commandCurrentOrderStatus').textContent=currentOrder.payment_status==='paid'?'Pagada en Caja':'Pendiente de cobro en Caja';
  $('#commandCurrentOrderTotal').textContent=money(currentOrder.total);
    panel.classList.remove('hidden');
}

function filteredProducts(){
  const q=$('#commandSearch').value.toLowerCase(),cat=$('#commandCategory').value;
  return products.filter(p=>(cat==='all'||String(p.category_id)===cat)&&(`${p.name} ${p.description||''}`).toLowerCase().includes(q));
}

function renderProducts(){
  $('#commandProducts').innerHTML=filteredProducts().map(p=>`
    <button class="commandProduct" data-id="${p.id}">
      ${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:''}
      <div><b>${esc(p.name)}</b><strong>${money(p.price)}</strong></div>
    </button>`).join('');
  document.querySelectorAll('.commandProduct').forEach(b=>b.onclick=()=>{
    const r=cart.find(x=>String(x.id)===String(b.dataset.id));
    if(r)r.qty++;else cart.push({id:b.dataset.id,qty:1});
    renderCart();
  });
}

function renderCart(){
  let total=0;
  $('#commandCartItems').innerHTML=cart.length?cart.map(r=>{
    const p=products.find(x=>String(x.id)===String(r.id));
    total+=Number(p.price)*r.qty;
    return `<div class="cartLine"><span>${esc(p.name)} × ${r.qty}</span><div><button data-minus="${r.id}">−</button><button data-plus="${r.id}">+</button></div></div>`;
  }).join(''):'Sin productos';
  $('#commandCartTotal').textContent=money(total);
  document.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{
    const r=cart.find(x=>String(x.id)===String(b.dataset.minus));r.qty--;
    cart=cart.filter(x=>x.qty>0);renderCart();
  });
  document.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{
    cart.find(x=>String(x.id)===String(b.dataset.plus)).qty++;renderCart();
  });
}

async function sendCommand(){
  if(!employee)return toast('Inicia sesión');
  if(!cart.length)return toast('Agrega productos');
  if(currentTable.current_order_id)return toast('Esta mesa ya tiene una cuenta abierta');

  const total=cart.reduce((s,r)=>{
    const p=products.find(x=>String(x.id)===String(r.id));
    return s+Number(p.price)*r.qty;
  },0);

  const order={
    customer_name:$('#commandCustomer').value.trim()||currentTable.name,
    customer_phone:'',customer_address:'',order_type:'local',
    payment_method:null,payment_status:'unpaid',
    notes:`${currentTable.name}. ${$('#commandNotes').value.trim()}`,
    subtotal:total,delivery_cost:0,total,status:'pending',
    waiter_id:employee.role==='waiter'?employee.id:null,
    cashier_id:employee.role==='cashier'?employee.id:null,
    table_id:currentTable.id
  };

  const {data,error}=await db.from('orders').insert(order).select().single();
  if(error)return toast(error.message);

  const items=cart.map(r=>{
    const p=products.find(x=>String(x.id)===String(r.id));
    return {order_id:data.id,product_id:p.id,product_name:p.name,unit_price:p.price,quantity:r.qty,subtotal:Number(p.price)*r.qty};
  });
  const {error:itemError}=await db.from('order_items').insert(items);
  if(itemError)return toast(itemError.message);

  const {error:tableError}=await db.from('restaurant_tables')
    .update({status:'preparing',current_order_id:data.id,staff_id:employee.id,updated_at:new Date().toISOString()})
    .eq('id',currentTable.id);
  if(tableError)return toast(tableError.message);

  currentTable.current_order_id=data.id;
  currentTable.status='preparing';
  currentOrder=data;
  cart=[];renderCart();renderTables();await loadCurrentOrder();
  toast(`Comanda #${data.order_number} enviada a cocina`);
}


$('#commandLoginBtn').onclick=login;
$('#commandPin').onkeydown=e=>{if(e.key==='Enter')login()};
$('#backTables').onclick=async()=>{
  $('#commandOrder').classList.add('hidden');
  $('#commandApp').classList.remove('hidden');
  const {data}=await db.from('restaurant_tables').select('*').order('sort_order');
  tables=(data||[]).filter(t=>t.active!==false);renderTables();
};
$('#commandSearch').oninput=renderProducts;
$('#commandCategory').onchange=renderProducts;
$('#sendCommand').onclick=sendCommand;
$('#refreshCommand').onclick=()=>location.reload();
$('#logoutCommand').onclick=()=>{employee=null;employeePin='';location.reload()};
loadBase();
