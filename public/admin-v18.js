console.info('MORDISCO OS V21 estable cargado correctamente');
window.addEventListener('error',event=>{
  console.error('Error global Mordisco OS:',event.error||event.message);
  const node=document.querySelector('#toast');
  if(node){
    node.textContent='Ocurrió un error: '+(event.error?.message||event.message||'Error desconocido');
    node.classList.add('show');
    setTimeout(()=>node.classList.remove('show'),5000);
  }
});

const SUPABASE_URL='https://nmmjthqflxwucpmmmrks.supabase.co';
const SUPABASE_KEY='sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0';
const db=window.mordiscoSupabaseClient||window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
window.mordiscoSupabaseClient=db;
let products=[],categories=[],settings={},orders=[],cart=[],posCart=[],ingredients=[],inventoryMovements=[],recipes=[],staffMembers=[],tables=[],tableCart=[],kitchenPollHandle=null,kitchenAudioContext=null,kitchenKnownPendingNumbers=new Set(),currentTable=null,currentEmployee=null,currentShift=null,shifts=[],financeMovements=[],financeAccounts=[],businessHours=[],customers=[],promotions=[],contentPages=[],extraOptions=[],cashRegisterState=null,isAdminSession=false,shiftAction='start',selectedCategory='Todos',editingImage='',adminProductQuery='',adminProductFilter='all',orderStatusFilter='all',ordersChannel=null,lastKnownOrderIds=new Set(),kitchenTimerHandle=null,lastReceiptOrder=null,paymentOrderId=null,posDiscountType='none',posDiscountValue=0;
const $$=s=>[...document.querySelectorAll(s)];
const missingElementProxy=new Proxy({},{
  get(_target,property){
    if(property==='classList')return{add(){},remove(){},toggle(){},contains(){return false}};
    if(property==='style')return{};
    if(property==='selectedOptions')return[];
    if(property==='files')return[];
    if(property==='dataset')return{};
    if(property==='value')return'';
    if(property==='checked')return false;
    if(property==='textContent'||property==='innerHTML'||property==='src')return'';
    if(['focus','select','reset','scrollIntoView','addEventListener','click'].includes(property))return()=>{};
    return null;
  },
  set(){return true}
});
const $=s=>document.querySelector(s)||missingElementProxy;
const money=n=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(n||0));
const bind=(selector,event,handler)=>{
  const node=document.querySelector(selector);
  if(node)node.addEventListener(event,handler);
  return node;
};

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

async function closeAdminSession(){
  const button=document.querySelector('#logoutBtn');
  if(button){
    button.disabled=true;
    button.innerHTML='<span>↪</span> Cerrando...';
  }
  try{
    await db.auth.signOut({scope:'local'});
  }catch(error){
    console.warn('Cierre remoto no disponible:',error);
  }finally{
    localStorage.removeItem('mordisco_employee_session');
    sessionStorage.clear();
    window.location.replace('/admin?logout=1&v=18.3');
  }
}

function openPublicStore(){
  window.location.assign('/');
}

bind('#logoutBtn','click',event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  closeAdminSession();
});

bind('#backToStore','click',event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  openPublicStore();
});

function showAdmin(){
  $('#publicView').classList.add('hidden');
  $('#adminView').classList.remove('hidden');
  $('.topbar').classList.add('hidden');
  $('#loginModal').classList.add('hidden');

  const firstButton=$('.sidebar [data-tab="dashboard"]');
  if(firstButton&&typeof firstButton.click==='function')firstButton.click();
}

async function verifyAdmin(showWelcome=true){
  const {data:{session},error:sessionError}=await db.auth.getSession();
  if(sessionError)throw sessionError;

  if(!session){
    isAdminSession=false;
    $('#adminView').classList.add('hidden');
    $('#loginModal').classList.remove('hidden');
    return false;
  }

  const {data:adminRecord,error:adminError}=await db
    .from('admin_users')
    .select('user_id,active')
    .eq('user_id',session.user.id)
    .eq('active',true)
    .maybeSingle();

  if(adminError){
    console.error('No se pudo comprobar admin_users:',adminError);
    await db.auth.signOut({scope:'local'});
    isAdminSession=false;
    $('#adminView').classList.add('hidden');
    $('#loginModal').classList.remove('hidden');
    toast('No se pudo verificar el acceso de administrador');
    return false;
  }

  if(!adminRecord){
    await db.auth.signOut();
    isAdminSession=false;
    $('#adminView').classList.add('hidden');
    $('#loginModal').classList.remove('hidden');
    toast('Esta cuenta no tiene permisos de administrador');
    return false;
  }

  isAdminSession=true;
  currentEmployee=null;
  document.body.classList.remove('employeeMode');
  showAdmin();

  await Promise.allSettled([
    loadOrders(),
    loadInventoryData(),
    loadStaff(),
    loadTables(),
    loadShifts(),
    loadFinance(),
    loadCustomers(),
    loadPromotions(),
    loadContentPages()
  ]);

  renderAll();
  if(showWelcome)toast('Bienvenido al panel de administración');
  return true;
}

async function init(){
  const params=new URLSearchParams(location.search);
  const employeeMode=params.get('employee')==='1';
  const requestedTab=params.get('tab');

  try{
    await Promise.all([loadCategories(),loadProducts(),loadSettings(),loadCashRegisterState()]);
    renderAll();
  }catch(error){
    console.warn('Carga inicial:',error);
  }

  if(employeeMode){
    let savedEmployee=null;
    try{savedEmployee=JSON.parse(localStorage.getItem('mordisco_employee')||'null')}catch{}
    if(!savedEmployee?.id||!savedEmployee?.role){
      location.href='/staff';
      return;
    }
    const {data:freshEmployee}=await db.from('staff').select('id,name,role,active,permissions').eq('id',savedEmployee.id).maybeSingle();
    if(!freshEmployee?.active){
      localStorage.removeItem('mordisco_employee');
      location.href='/staff';
      return;
    }
    savedEmployee=freshEmployee;

    if(savedEmployee.role==='waiter'){
      location.replace('/comandas');
      return;
    }

    currentEmployee=savedEmployee;
    isAdminSession=false;
    document.body.classList.add('employeeMode');
    document.body.dataset.employeeRole=savedEmployee.role;
    $('#loginModal').classList.add('hidden');
    showAdmin();

    await Promise.all([loadOrders(),loadStaff()]);
    renderAll();
    applyEmployeePermissions(savedEmployee);

    const allowed={
      waiter:['tables','orders'],
      cashier:['pos','orders','tables','shifts'],
      kitchen:['kitchen'],
      admin:['dashboard','products','categories','orders','kitchen','pos','inventory','tables','shifts','finance','customers','promotions','pages','staff','extras','settings']
    }[savedEmployee.role]||[];

    const target=allowed.includes(requestedTab)?requestedTab:allowed[0];
    const targetButton=$(`.sidebar [data-tab="${target}"]`);
    if(targetButton)targetButton.click();

    subscribeOrdersRealtime();
    return;
  }

  const {data:{session}}=await db.auth.getSession();
  if(session){
    await verifyAdmin(false);
  }else{
    $('#publicView').classList.add('hidden');
    $('#adminView').classList.add('hidden');
    $('.topbar').classList.add('hidden');
    $('#loginModal').classList.remove('hidden');
  }
}
async function loadCategories(){const {data,error}=await db.from('categories').select('*').order('sort_order');if(error) return toast('Error cargando categorías');categories=data||[]}
async function loadProducts(){const {data,error}=await db.from('products').select('*,categories(name)').order('sort_order');$('#loadingProducts').classList.add('hidden');if(error)return toast('Error cargando productos');products=data||[]}
async function loadSettings(){const {data}=await db.from('business_settings').select('*').eq('id',1).maybeSingle();settings=data||{};applySettings()}
function applySettings(){$('#businessDescription').textContent=settings.description||'El mejor sabor para compartir.';$('#businessAddress').textContent=settings.address||'Dirección por configurar';$('#businessSchedule').textContent=settings.schedule||'Horario por configurar'}
function renderAll(){renderFilters();renderProducts();renderCart();renderAdminProducts();renderAdminCategories();fillCategorySelect();fillSettings();fillPosCategories();renderPosProducts();renderPosCart();fillPosStaff();renderHomePromotions()}
function renderFilters(){const names=['Todos',...categories.filter(c=>c.active).map(c=>c.name)];$('#categoryFilters').innerHTML=names.map(n=>`<button class="${n===selectedCategory?'active':''}" data-cat="${esc(n)}">${esc(n)}</button>`).join('');$$('[data-cat]').forEach(b=>b.onclick=()=>{selectedCategory=b.dataset.cat;renderFilters();renderProducts()})}
function filteredProducts(){const q=$('#searchInput').value.toLowerCase();return products.filter(p=>p.active&&(selectedCategory==='Todos'||p.categories?.name===selectedCategory)&&(`${p.name} ${p.description||''}`).toLowerCase().includes(q))}
function renderProducts(){
  const list=filteredProducts();
  $('#productGrid').innerHTML=list.length?list.map(p=>`<article class="productCard">
    ${p.featured?'<span class="featured">Favorito</span>':''}
    <div class="productImage">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'<div class="noImage">Sin imagen</div>'}</div>
    <div class="productBody">
      <small>${esc(p.categories?.name||'Sin categoría')}</small>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.description||'')}</p>
      <div class="productFoot"><strong>${money(p.price)}</strong><button data-add="${p.id}">+ Agregar</button></div>
    </div>
  </article>`).join(''):'<div class="notice">No hay productos disponibles.</div>';
  $$('[data-add]').forEach(b=>b.onclick=()=>addCart(b.dataset.add));
}
if(document.querySelector('#searchInput'))document.querySelector('#searchInput').oninput=renderProducts;
function addCart(id){const f=cart.find(x=>x.id===id);if(f)f.qty++;else cart.push({id,qty:1});renderCart();openCart()}
function changeQty(id,d){const f=cart.find(x=>x.id===id);if(!f)return;f.qty+=d;cart=cart.filter(x=>x.qty>0);renderCart()}
function totals(){const subtotal=cart.reduce((s,x)=>{const p=products.find(y=>y.id===x.id);return s+(p?Number(p.price)*x.qty:0)},0);const delivery=$('#orderType').value==='delivery'?Number(settings.delivery_cost||0):0;return{subtotal,delivery,total:subtotal+delivery}}
function renderCart(){$('#cartCount').textContent=cart.reduce((s,x)=>s+x.qty,0);$('#cartItems').innerHTML=cart.length?cart.map(x=>{const p=products.find(y=>y.id===x.id);if(!p)return'';return`<div class="cartItem">${p.image_url?`<img src="${esc(p.image_url)}">`:'<div></div>'}<div><b>${esc(p.name)}</b><small>${money(p.price)}</small><div class="qty"><button data-minus="${p.id}">−</button><span>${x.qty}</span><button data-plus="${p.id}">+</button></div></div><b>${money(Number(p.price)*x.qty)}</b></div>`}).join(''):'<p class="notice">Tu carrito está vacío.</p>';$$('[data-minus]').forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1));$$('[data-plus]').forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1));const t=totals();$('#subtotal').textContent=money(t.subtotal);$('#deliveryTotal').textContent=money(t.delivery);$('#grandTotal').textContent=money(t.total)}
function openCart(){$('#cartDrawer').classList.add('open')} if(document.querySelector('#cartBtn'))document.querySelector('#cartBtn').onclick=openCart;if(document.querySelector('#orderNowBtn'))document.querySelector('#orderNowBtn').onclick=openCart;if(document.querySelector('#closeCart'))document.querySelector('#closeCart').onclick=()=>$('#cartDrawer').classList.remove('open');if(document.querySelector('#orderType'))document.querySelector('#orderType').onchange=()=>{renderCart();$('#customerAddress').classList.toggle('hidden',$('#orderType').value!=='delivery')};

$$('.sidebar [data-tab]').forEach(b=>b.onclick=async()=>{const tab=b.dataset.tab;setPosFocusMode(tab==='pos');setCustomersFocusMode(false);$$('.sidebar [data-tab]').forEach(x=>x.classList.toggle('active',x===b));$$('.tab').forEach(x=>x.classList.add('hidden'));$('#tab-'+tab).classList.remove('hidden');$('#adminTitle').textContent={dashboard:'Resumen',products:'Productos',categories:'Categorías',orders:'Pedidos web',kitchen:'Cocina',pos:'POS / Caja',inventory:'Inventario',tables:'Mesas',shifts:'Turnos',staff:'Personal',finance:'Contabilidad',customers:'Clientes',promotions:'Promociones',pages:'Páginas',settings:'Negocio'}[tab];if(tab==='orders'||tab==='kitchen')await loadOrders();if(tab==='dashboard'){await loadOrders();renderMetrics()}if(tab==='kitchen')startKitchenClock();if(tab==='pos'){
      setPosFocusMode(true);
      fillPosCategories();
      renderPosProducts();
      renderPosCart();
      await Promise.all([loadOrders(),loadCustomers()]);
      fillPosCustomers();
      renderPosPendingOrders();
    }if(tab==='inventory')await loadInventoryData();if(tab==='staff'){
    if($('#staffSearch'))$('#staffSearch').value='';
    if($('#staffRoleFilter'))$('#staffRoleFilter').value='all';
    await loadStaff();
  }if(tab==='tables')await loadTables();if(tab==='shifts'){
    await fillAdminShiftEmployees({preserveSelection:true});
    await loadShifts();
    await renderAdminShiftManager();
  }if(tab==='finance')await loadFinance();if(tab==='customers')await loadCustomers();if(tab==='promotions')await loadPromotions();if(tab==='pages')await loadContentPages()});
function fillCategorySelect(){$('#pCategory').innerHTML=categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}

function updatePreview(src){
  $('#pPreview').src=src||'';
  $('#pPreview').classList.toggle('hidden',!src);
  $('#pNoImage').classList.toggle('hidden',!!src);
  $('#removeProductImage').classList.toggle('hidden',!src);
}

function getStoragePathFromPublicUrl(url){
  if(!url)return null;
  const marker='/storage/v1/object/public/product-images/';
  const index=url.indexOf(marker);
  return index>=0?decodeURIComponent(url.slice(index+marker.length)):null;
}

async function removeStoredImage(url){
  const path=getStoragePathFromPublicUrl(url);
  if(!path)return;
  const {error}=await db.storage.from('product-images').remove([path]);
  if(error)console.warn('No se pudo borrar la imagen anterior:',error);
}

function validateProductImage(file){
  if(!file)return;
  const allowed=['image/png','image/jpeg','image/webp'];
  if(!allowed.includes(file.type))throw new Error('La imagen debe ser PNG, JPG o WEBP');
  if(file.size>5*1024*1024)throw new Error('La imagen supera el máximo de 5 MB');
}

async function uploadImage(file){
  if(!file)return editingImage||'';
  validateProductImage(file);

  const extension={
    'image/png':'png',
    'image/jpeg':'jpg',
    'image/webp':'webp'
  }[file.type]||'jpg';

  const path=`products/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const {error}=await db.storage.from('product-images').upload(path,file,{
    cacheControl:'3600',
    upsert:false,
    contentType:file.type
  });

  if(error)throw error;
  return db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

function resetProduct(){
  $('#productForm').reset();
  $('#pId').value='';
  $('#pSort').value=0;
  $('#pActive').checked=true;
  $('#pImageFile').value='';
  editingImage='';
  updatePreview('');

  if($('#productFormHeading'))$('#productFormHeading').textContent='Crear producto';
  if($('#productEditBadge'))$('#productEditBadge').classList.add('hidden');
  if($('#saveProductBtn'))$('#saveProductBtn').textContent='Guardar producto';
}

if(document.querySelector('#clearProduct'))document.querySelector('#clearProduct').onclick=resetProduct;

if(document.querySelector('#removeProductImage'))document.querySelector('#removeProductImage').onclick=()=>{
  editingImage='';
  $('#pImageFile').value='';
  updatePreview('');
};

if(document.querySelector('#pImageFile'))document.querySelector('#pImageFile').onchange=e=>{
  const file=e.target.files[0];
  if(!file)return;

  try{
    validateProductImage(file);
    updatePreview(URL.createObjectURL(file));
  }catch(error){
    e.target.value='';
    updatePreview(editingImage);
    toast(error.message);
  }
};

if(document.querySelector('#productForm'))document.querySelector('#productForm').onsubmit=async e=>{
  e.preventDefault();

  const button=$('#saveProductBtn');
  const id=$('#pId').value;
  const previousProduct=id?products.find(p=>String(p.id)===String(id)):null;
  const previousImage=previousProduct?.image_url||'';
  const selectedFile=$('#pImageFile').files[0];

  button.disabled=true;
  button.textContent=selectedFile?'Subiendo imagen...':'Guardando...';

  try{
    const image=await uploadImage(selectedFile);

    const row={
      name:$('#pName').value.trim(),
      category_id:$('#pCategory').value||null,
      price:Number($('#pPrice').value),
      description:$('#pDescription').value.trim(),
      image_url:image||null,
      featured:$('#pFeatured').checked,
      active:$('#pActive').checked,
      sort_order:Number($('#pSort').value||0)
    };

    const query=id
      ?db.from('products').update(row).eq('id',id)
      :db.from('products').insert(row);

    const {error}=await query;

    if(error){
      if(selectedFile&&image!==previousImage)await removeStoredImage(image);
      throw error;
    }

    if(id&&previousImage&&previousImage!==image){
      await removeStoredImage(previousImage);
    }

    toast(id?'Producto actualizado correctamente':'Producto creado correctamente');
    resetProduct();
    await loadProducts();
    renderAll();
  }catch(error){
    console.error('Error guardando producto:',error);
    toast('No se pudo guardar: '+(error.message||'Error desconocido'));
  }finally{
    button.disabled=false;
    button.textContent=$('#pId').value?'Actualizar producto':'Guardar producto';
  }
};
function getAdminProducts(){
  return products.filter(p=>{
    const text=`${p.name} ${p.description||''} ${p.categories?.name||''}`.toLowerCase();
    const matchesText=text.includes(adminProductQuery.toLowerCase());
    const matchesFilter=adminProductFilter==='all'
      ||(adminProductFilter==='visible'&&p.active)
      ||(adminProductFilter==='hidden'&&!p.active)
      ||(adminProductFilter==='featured'&&p.featured);
    return matchesText&&matchesFilter;
  });
}
function renderAdminProducts(){
  const list=getAdminProducts();
  $('#adminProductCount').textContent=`${list.length} producto${list.length===1?'':'s'}`;
  $('#adminProducts').innerHTML=list.length?list.map(p=>`<article class="adminRow">${p.image_url?`<img src="${esc(p.image_url)}">`:'<div></div>'}<div><b>${esc(p.name)}</b><small>${esc(p.categories?.name||'Sin categoría')} · ${money(p.price)} · ${p.active?'Visible':'Oculto'}${p.featured?' · Destacado':''}</small></div><div class="adminRowActions"><button data-edit-product="${p.id}">Editar</button><button class="dark" data-duplicate-product="${p.id}">Duplicar</button><button class="${p.active?'warning':'success'}" data-toggle-product="${p.id}">${p.active?'Ocultar':'Mostrar'}</button><button class="danger" data-delete-product="${p.id}">Eliminar</button></div></article>`).join(''):'<div class="notice">No hay productos que coincidan con el filtro.</div>';
  $$('[data-edit-product]').forEach(b=>b.onclick=()=>editProduct(b.dataset.editProduct));
  $$('[data-delete-product]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.deleteProduct));
  $$('[data-duplicate-product]').forEach(b=>b.onclick=()=>duplicateProduct(b.dataset.duplicateProduct));
  $$('[data-toggle-product]').forEach(b=>b.onclick=()=>toggleProduct(b.dataset.toggleProduct));
}
async function duplicateProduct(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  const row={name:`${p.name} (copia)`,category_id:p.category_id,price:p.price,description:p.description||'',image_url:p.image_url||'',featured:false,active:false,sort_order:Number(p.sort_order||0)+1};
  const {error}=await db.from('products').insert(row);
  if(error)return toast(error.message);
  await loadProducts(); renderAll(); toast('Producto duplicado como oculto');
}
async function toggleProduct(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  const {error}=await db.from('products').update({active:!p.active}).eq('id',id);
  if(error)return toast(error.message);
  await loadProducts(); renderAll(); toast(p.active?'Producto ocultado':'Producto publicado');
}
function editProduct(id){
  const p=products.find(x=>String(x.id)===String(id));
  if(!p)return toast('Producto no encontrado');

  $('#pId').value=p.id;
  $('#pName').value=p.name;
  $('#pCategory').value=p.category_id||'';
  $('#pPrice').value=p.price;
  $('#pSort').value=p.sort_order||0;
  $('#pDescription').value=p.description||'';
  $('#pFeatured').checked=!!p.featured;
  $('#pActive').checked=!!p.active;
  $('#pImageFile').value='';

  editingImage=p.image_url||'';
  updatePreview(editingImage);

  if($('#productFormHeading'))$('#productFormHeading').textContent=`Editar: ${p.name}`;
  if($('#productEditBadge'))$('#productEditBadge').classList.remove('hidden');
  if($('#saveProductBtn'))$('#saveProductBtn').textContent='Actualizar producto';

  document.getElementById('productForm').scrollIntoView({
    behavior:'smooth',
    block:'start'
  });
}

async function deleteProduct(id){
  const product=products.find(p=>String(p.id)===String(id));
  if(!product)return toast('Producto no encontrado');

  const accepted=confirm(
    `¿Eliminar definitivamente "${product.name}"?\n\n`+
    `Esta acción no se puede deshacer.`
  );
  if(!accepted)return;

  const {error}=await db.from('products').delete().eq('id',id);
  if(error)return toast('No se pudo eliminar: '+error.message);

  if(product.image_url)await removeStoredImage(product.image_url);
  if(String($('#pId').value)===String(id))resetProduct();

  await loadProducts();
  renderAll();
  toast('Producto eliminado correctamente');
}
function resetCategory(){$('#categoryForm').reset();$('#cId').value='';$('#cSort').value=0;$('#cActive').checked=true} if(document.querySelector('#clearCategory'))document.querySelector('#clearCategory').onclick=resetCategory;
if(document.querySelector('#categoryForm'))document.querySelector('#categoryForm').onsubmit=async e=>{e.preventDefault();const id=$('#cId').value,row={name:$('#cName').value.trim(),sort_order:Number($('#cSort').value||0),active:$('#cActive').checked};const {error}=await(id?db.from('categories').update(row).eq('id',id):db.from('categories').insert(row));if(error)return toast(error.message);resetCategory();await loadCategories();renderAll();toast('Categoría guardada')};
function renderAdminCategories(){$('#adminCategories').innerHTML=categories.map(c=>`<article class="adminRow"><div></div><div><b>${esc(c.name)}</b><small>Orden ${c.sort_order} · ${c.active?'Activa':'Oculta'}</small></div><button data-edit-cat="${c.id}">Editar</button><button class="danger" data-delete-cat="${c.id}">Eliminar</button></article>`).join('');$$('[data-edit-cat]').forEach(b=>b.onclick=()=>{const c=categories.find(x=>x.id===b.dataset.editCat);$('#cId').value=c.id;$('#cName').value=c.name;$('#cSort').value=c.sort_order;$('#cActive').checked=c.active});$$('[data-delete-cat]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar categoría? Los productos quedarán sin categoría.'))return;const {error}=await db.from('categories').delete().eq('id',b.dataset.deleteCat);if(error)return toast(error.message);await loadCategories();await loadProducts();renderAll()})}



function renderPosPendingOrders(){
  if(!$('#posPendingOrders'))return;

  const pending=orders
    .filter(o=>(o.payment_status||'unpaid')!=='paid'&&o.status!=='cancelled')
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

  if($('#posPendingCount'))$('#posPendingCount').textContent=pending.length;

  $('#posPendingOrders').innerHTML=pending.length?pending.map(o=>`
    <article class="posPendingCard">
      <div class="posPendingMain">
        <div class="posPendingNumber">
          <small>PEDIDO</small>
          <strong>#${o.order_number}</strong>
        </div>
        <div class="posPendingInfo">
          <h4>${esc(o.customer_name||'Consumidor final')}</h4>
          <p>${o.order_items?.map(i=>`${i.quantity}× ${esc(i.product_name)}`).join(', ')||'Sin detalle'}</p>
          <small>
            ${o.restaurant_tables?.name?`🍽️ ${esc(o.restaurant_tables.name)} · `:''}
            ${orderTypeLabel(o.order_type)} ·
            ${new Date(o.created_at).toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit'})}
          </small>
        </div>
      </div>
      <div class="posPendingPayment">
        <span>Pendiente</span>
        <strong>${money(o.total)}</strong>
        <button class="primary posPayNowBtn" data-pos-pay="${o.id}">Cobrar ahora</button>
      </div>
    </article>
  `).join(''):`<div class="posPendingEmpty">
    <span>✓</span>
    <div><b>No hay pedidos pendientes</b><p>Las órdenes enviadas a cocina aparecerán aquí para cobrarlas.</p></div>
  </div>`;

  $$('[data-pos-pay]').forEach(button=>{
    button.onclick=()=>openChargeOrder(button.dataset.posPay);
  });
}

if($('#refreshPosPending'))if(document.querySelector('#refreshPosPending'))document.querySelector('#refreshPosPending').onclick=async()=>{
  const button=$('#refreshPosPending');
  button.disabled=true;
  button.textContent='Actualizando...';
  await loadOrders();
  button.disabled=false;
  button.textContent='Actualizar';
};

function getChargeCalculation(){
  const order=orders.find(o=>String(o.id)===String(paymentOrderId));
  if(!order)return{subtotal:0,discountType:'none',discountValue:0,discountAmount:0,total:0};

  const subtotal=Number(order.subtotal??order.total??0);
  const discountType=$('#chargeDiscountType')?.value||'none';
  let discountValue=Math.max(0,Number($('#chargeDiscountValue')?.value||0));
  let discountAmount=0;

  if(discountType==='percent'){
    discountValue=Math.min(discountValue,100);
    discountAmount=subtotal*(discountValue/100);
  }else if(discountType==='fixed'){
    discountAmount=Math.min(discountValue,subtotal);
  }

  discountAmount=Math.round(discountAmount*100)/100;
  const total=Math.max(0,Math.round((subtotal-discountAmount)*100)/100);
  return{subtotal,discountType,discountValue,discountAmount,total};
}

function renderChargeCalculation(){
  const calculation=getChargeCalculation();
  $('#chargeSubtotal').textContent=money(calculation.subtotal);
  $('#chargeDiscountAmount').textContent='− '+money(calculation.discountAmount);
  $('#chargeOrderTotal').textContent=money(calculation.total);

  const method=$('#chargePaymentMethod').value;
  const cash=method==='cash';
  $('#chargeReceivedWrap').classList.toggle('hidden',!cash);
  $('.chargeChange').classList.toggle('hidden',!cash);

  if(cash){
    const received=Number($('#chargeReceived').value||0);
    $('#chargeChange').textContent=money(Math.max(0,received-calculation.total));
  }
}

function openChargeOrder(orderId){
  const order=orders.find(o=>String(o.id)===String(orderId));
  if(!order)return toast('No se encontró el pedido');
  if(order.payment_status==='paid')return toast('Este pedido ya está pagado');

  paymentOrderId=orderId;
  $('#chargeOrderTitle').textContent=`Cobrar pedido #${order.order_number}`;
  $('#chargePaymentMethod').value='cash';
  $('#chargeDiscountType').value='none';
  $('#chargeDiscountValue').value='0';
  $('#chargeDiscountValue').disabled=true;
  $('#chargeReceived').value=Number(order.subtotal??order.total).toFixed(2);
  renderChargeCalculation();
  $('#chargeOrderModal').classList.remove('hidden');
}

function updateChargeChange(){
  renderChargeCalculation();
}


/* ===== PRODUCCIÓN: VERIFICACIÓN REAL DEL TURNO DE CAJA ===== */
async function refreshCurrentCashierShift(){
  if(currentEmployee?.role!=='cashier')return null;

  const employeeId=String(currentEmployee.id||'').trim();
  if(!employeeId)return null;

  const {data,error}=await db
    .from('work_shifts')
    .select('*')
    .eq('staff_id',employeeId)
    .eq('status','open')
    .order('started_at',{ascending:false})
    .limit(1)
    .maybeSingle();

  if(error){
    console.error('Error comprobando turno del cajero:',error);
    throw error;
  }

  currentShift=data||null;

  if(currentShift){
    const index=shifts.findIndex(shift=>String(shift.id)===String(currentShift.id));
    if(index>=0){
      shifts[index]=currentShift;
    }else{
      shifts.unshift(currentShift);
    }
  }

  return currentShift;
}

async function confirmChargeOrder(){
  const order=orders.find(o=>String(o.id)===String(paymentOrderId));
  if(!order)return toast('No se encontró el pedido');

  if(currentEmployee?.role==='cashier'){
    const confirmButton=$('#confirmChargeOrder');
    const previousText=confirmButton?.textContent||'Confirmar cobro';

    if(confirmButton){
      confirmButton.disabled=true;
      confirmButton.textContent='Verificando turno...';
    }

    try{
      await refreshCurrentCashierShift();
    }catch(error){
      if(confirmButton){
        confirmButton.disabled=false;
        confirmButton.textContent=previousText;
      }
      return toast('No se pudo comprobar el turno: '+(error.message||'Error de conexión'));
    }

    if(confirmButton){
      confirmButton.disabled=false;
      confirmButton.textContent=previousText;
    }

    if(!currentShift){
      return toast('El administrador debe abrir tu turno antes de cobrar');
    }
  }

  const calculation=getChargeCalculation();
  const method=$('#chargePaymentMethod').value;
  const received=method==='cash'?Number($('#chargeReceived').value||0):calculation.total;

  if(method==='cash'&&received<calculation.total){
    return toast('El efectivo recibido es menor al total final');
  }

  const button=$('#confirmChargeOrder');
  button.disabled=true;
  button.textContent='Procesando...';

  let rpcResult;
  try{
    rpcResult=await db.rpc('pay_order_with_discount',{
      p_order_id:order.id,
      p_payment_method:method,
      p_received:received,
      p_cashier_id:currentEmployee?.role==='cashier'?currentEmployee.id:(order.cashier_id||null),
      p_discount_type:calculation.discountType,
      p_discount_value:calculation.discountValue
    });
  }catch(error){
    rpcResult={error};
  }finally{
    button.disabled=false;
    button.textContent='Confirmar cobro';
  }

  if(rpcResult?.error){
    console.error('Error cobrando con descuento:',rpcResult.error);
    return toast('No se pudo cobrar: '+(rpcResult.error.message||'Error desconocido'));
  }

  const paidOrder={
    ...order,
    subtotal:calculation.subtotal,
    discount_type:calculation.discountType,
    discount_value:calculation.discountValue,
    discount_amount:calculation.discountAmount,
    total:calculation.total,
    payment_method:method,
    payment_status:'paid',
    cashier_name:currentEmployee?.name||order.cashier?.name||'Administrador'
  };

  lastReceiptOrder={order:paidOrder,items:order.order_items||[],received};
  $('#receiptContent').innerHTML=buildReceipt(paidOrder,order.order_items||[],received);
  $('#chargeOrderModal').classList.add('hidden');
  $('#receiptModal').classList.remove('hidden');

  await Promise.all([loadOrders(),loadFinance()]);
  renderPosPendingOrders();
  if(typeof loadShifts==='function')await loadShifts();
  toast(`Pedido #${order.order_number} cobrado correctamente`);
}

if(document.querySelector('#chargeDiscountType'))document.querySelector('#chargeDiscountType').onchange=()=>{
  const type=$('#chargeDiscountType').value;
  $('#chargeDiscountValue').disabled=type==='none';
  if(type==='none')$('#chargeDiscountValue').value='0';
  renderChargeCalculation();
};
if(document.querySelector('#chargeDiscountValue'))document.querySelector('#chargeDiscountValue').oninput=renderChargeCalculation;
if(document.querySelector('#chargePaymentMethod'))document.querySelector('#chargePaymentMethod').onchange=renderChargeCalculation;
if(document.querySelector('#chargeReceived'))document.querySelector('#chargeReceived').oninput=renderChargeCalculation;
if(document.querySelector('#confirmChargeOrder'))document.querySelector('#confirmChargeOrder').onclick=confirmChargeOrder;

async function deleteSale(orderId){
  if(!isAdminSession){
    return toast('Solo un administrador autenticado puede eliminar ventas');
  }

  const order=orders.find(o=>String(o.id)===String(orderId));
  if(!order)return toast('No se encontró la venta');

  const accepted=confirm(
    `¿Eliminar definitivamente la venta #${order.order_number||order.id}?\n\n`+
    `Total: ${money(order.total)}\n`+
    `Cliente: ${order.customer_name||'Sin cliente'}\n\n`+
    `La venta y su ingreso contable relacionado serán eliminados.`
  );
  if(!accepted)return;

  const {error}=await db.rpc('delete_order_admin',{p_order_id:orderId});
  if(error)return toast('No se pudo eliminar la venta: '+error.message);

  toast('Venta eliminada correctamente');
  await Promise.all([loadOrders(),loadFinance()]);
  if(typeof loadShifts==='function')await loadShifts();
}

async function loadOrders(){
  const {data,error}=await db.from('orders').select('*,order_items(*)').order('created_at',{ascending:false}).limit(100);
  if(error){
    console.error('Error cargando pedidos:',error);
    return toast('Error cargando pedidos: '+error.message);
  }

  orders=data||[];

  const staffIds=[...new Set(orders.flatMap(o=>[o.cashier_id,o.waiter_id]).filter(Boolean))];
  const tableIds=[...new Set(orders.map(o=>o.table_id).filter(Boolean))];

  let staffMap={},tableMap={};

  if(staffIds.length){
    const {data:staffData,error:staffError}=await db.from('staff').select('id,name').in('id',staffIds);
    if(staffError)console.warn('No se pudieron cargar nombres del personal:',staffError);
    else staffMap=Object.fromEntries((staffData||[]).map(s=>[s.id,s]));
  }

  if(tableIds.length){
    const {data:tableData,error:tableError}=await db.from('restaurant_tables').select('id,name').in('id',tableIds);
    if(tableError)console.warn('No se pudieron cargar nombres de mesas:',tableError);
    else tableMap=Object.fromEntries((tableData||[]).map(t=>[t.id,t]));
  }

  orders=orders.map(o=>({
    ...o,
    cashier:o.cashier_id?staffMap[o.cashier_id]||null:null,
    waiter:o.waiter_id?staffMap[o.waiter_id]||null:null,
    restaurant_tables:o.table_id?tableMap[o.table_id]||null:null
  }));

  renderOrders();
  renderMetrics();
  renderKitchen();
  renderPosPendingOrders();
}
const statusLabels={pending:'Pendiente',confirmed:'Confirmado',preparing:'Preparando',ready:'Listo',delivered:'Entregado',cancelled:'Cancelado'};
function getFilteredOrders(){return orderStatusFilter==='all'?orders:orders.filter(o=>o.status===orderStatusFilter)}
function renderOrders(){
  const list=getFilteredOrders();
  $('#adminOrders').innerHTML=list.length?list.map(o=>`<article class="orderCard">
    <small>Pedido #${o.order_number}</small>
    <h3>${esc(o.customer_name)}</h3>
    <p>${o.order_items?.map(i=>`${i.quantity}× ${esc(i.product_name)}`).join(', ')||''}</p>
    <p>${esc(o.customer_phone||'Sin teléfono')} · ${esc(orderTypeLabel(o.order_type))}</p>
    <p class="orderStaff">${o.cashier?.name?`💵 Cajero: ${esc(o.cashier.name)}`:'💵 Cajero: pendiente'}${o.waiter?.name?` · 🧑‍🍽️ Mesero: ${esc(o.waiter.name)}`:''}${o.restaurant_tables?.name?` · 🍽️ ${esc(o.restaurant_tables.name)}`:''}</p>
    <div class="orderPaymentStatus ${o.payment_status==='paid'?'paid':'unpaid'}">${o.payment_status==='paid'?'✓ Pagada':'⏳ Pendiente de pago'}</div>
    <strong>${money(o.total)}</strong>
    <p>${new Date(o.created_at).toLocaleString('es-EC')}</p>
    <div class="orderActions">
      <select data-status="${o.id}">${Object.entries(statusLabels).map(([value,label])=>`<option ${value===o.status?'selected':''} value="${value}">${label}</option>`).join('')}</select>
      ${(isAdminSession||currentEmployee?.role==='cashier')&&o.payment_status!=='paid'?`<button class="primary chargeOrderBtn" data-charge-order="${o.id}">Cobrar</button>`:''}
      ${isAdminSession?`<button class="danger deleteSaleBtn" data-delete-order="${o.id}">Eliminar venta</button>`:''}
    </div>
  </article>`).join(''):'<div class="notice">No hay pedidos con ese estado.</div>';

  $$('[data-status]').forEach(s=>s.onchange=async()=>{
    const {error}=await db.from('orders').update({status:s.value}).eq('id',s.dataset.status);
    if(error)toast(error.message);
    else{toast('Estado actualizado');await loadOrders()}
  });

  $$('[data-charge-order]').forEach(b=>b.onclick=()=>openChargeOrder(b.dataset.chargeOrder));
  $$('[data-delete-order]').forEach(b=>b.onclick=()=>deleteSale(b.dataset.deleteOrder));
}
function elapsedLabel(createdAt){
  const mins=Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/60000));
  if(mins<60)return `${mins} min`;
  const h=Math.floor(mins/60),m=mins%60;
  return `${h}h ${m}m`;
}
function orderTypeLabel(type){return({delivery:'Delivery',pickup:'Retiro',local:'En local'})[type]||type}
function kitchenCard(o){
  const mins=Math.max(0,Math.floor((Date.now()-new Date(o.created_at).getTime())/60000));
  const late=mins>=20&&o.status!=='ready';
  let actions='';
  if(o.status==='pending'||o.status==='confirmed'){
    actions=`<button class="primary" data-kitchen-order="${o.order_number}" data-next-status="preparing">Empezar preparación</button><button class="danger" data-kitchen-order="${o.order_number}" data-next-status="cancelled">Cancelar</button>`;
  }else if(o.status==='preparing'){
    actions=`<button class="success" data-kitchen-order="${o.order_number}" data-next-status="ready">Marcar como listo</button>`;
  }else if(o.status==='ready'){
    actions=`<button class="dark" data-kitchen-order="${o.order_number}" data-next-status="delivered">Entregar pedido</button>`;
  }
  return `<article class="kitchenCard ${late?'isLate':''}">
    <div class="kitchenCardHead"><h3>#${o.order_number}</h3><span class="kitchenTimer" data-created-at="${o.created_at}">${elapsedLabel(o.created_at)}</span></div>
    <p class="kitchenCustomer">${esc(o.customer_name)}</p>
    <p class="kitchenMeta">${orderTypeLabel(o.order_type)} · ${new Date(o.created_at).toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit'})}</p>
    <ul class="kitchenItems">${(o.order_items||[]).length
      ? (o.order_items||[]).map(i=>`<li><b>${Number(i.quantity||1)} × ${esc(i.product_name||i.name||'Producto')}</b>${i.notes?`<small> — ${esc(i.notes)}</small>`:''}</li>`).join('')
      : '<li class="kitchenNoItems">Sin detalle de productos</li>'
    }</ul>
    ${o.notes?`<div class="kitchenNotes"><b>Nota:</b> ${esc(o.notes)}</div>`:''}
    <div class="kitchenCardActions">${actions}</div>
  </article>`;
}
function renderKitchen(){
  const pending=orders.filter(o=>['pending','confirmed'].includes(o.status));
  const preparing=orders.filter(o=>o.status==='preparing');
  const ready=orders.filter(o=>o.status==='ready');
  $('#kitchenPendingCount').textContent=pending.length;
  $('#kitchenPreparingCount').textContent=preparing.length;
  $('#kitchenReadyCount').textContent=ready.length;
  $('#kitchenPending').innerHTML=pending.length?pending.map(kitchenCard).join(''):'<div class="kitchenEmpty">Sin pedidos nuevos</div>';
  $('#kitchenPreparing').innerHTML=preparing.length?preparing.map(kitchenCard).join(''):'<div class="kitchenEmpty">Nada en preparación</div>';
  $('#kitchenReady').innerHTML=ready.length?ready.map(kitchenCard).join(''):'<div class="kitchenEmpty">No hay pedidos listos</div>';
  $$('[data-kitchen-order]').forEach(b=>b.onclick=()=>updateKitchenStatus(Number(b.dataset.kitchenOrder),b.dataset.nextStatus,b));
}
async function updateKitchenStatus(orderNumber,status,button=null){
  const allowedStatuses=['preparing','ready','delivered','cancelled'];
  if(!allowedStatuses.includes(status)){
    return toast('Estado de cocina no permitido');
  }

  if(!Number.isFinite(Number(orderNumber))){
    return toast('Número de pedido inválido');
  }

  const originalText=button?.textContent||'';
  if(button){
    button.disabled=true;
    button.textContent='Procesando...';
  }

  const orderIndex=orders.findIndex(order=>
    Number(order.order_number)===Number(orderNumber)
  );
  const previousStatus=orderIndex>=0?orders[orderIndex].status:null;

  const {data,error}=await db.rpc('kitchen_set_status_by_number',{
    p_order_number:Number(orderNumber),
    p_new_status:status
  });

  if(error){
    if(button){
      button.disabled=false;
      button.textContent=originalText;
    }
    return toast('No se pudo actualizar: '+error.message);
  }

  if(!data||data.updated!==true){
    if(button){
      button.disabled=false;
      button.textContent=originalText;
    }
    return toast('Supabase no confirmó el cambio del pedido');
  }

  if(orderIndex>=0){
    orders[orderIndex]={...orders[orderIndex],status:data.status||status};
    renderKitchen();
  }

  toast(`Pedido #${orderNumber} actualizado: ${statusLabels[status]||status}`);
  await loadKitchenOrdersReliable({notify:false});

  const confirmed=orders.find(order=>
    Number(order.order_number)===Number(orderNumber)
  );

  if(!confirmed||confirmed.status!==(data.status||status)){
    toast('El pedido cambió, pero la pantalla necesita actualizarse');
  }
}
function startKitchenClock(){
  clearInterval(kitchenTimerHandle);
  kitchenTimerHandle=setInterval(()=>{
    $$('[data-created-at]').forEach(el=>el.textContent=elapsedLabel(el.dataset.createdAt));
  },30000);
}
function playKitchenAlert(){
  kitchenPlaySound(false);
}
function subscribeOrdersRealtime(){
  if(ordersChannel)db.removeChannel(ordersChannel);
  lastKnownOrderIds=new Set(orders.map(o=>o.id));
  ordersChannel=db.channel('mordisco-orders-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'orders'},async payload=>{
      const isNew=payload.eventType==='INSERT'&&!lastKnownOrderIds.has(payload.new?.id);
      await loadOrders();
      if(isNew){playKitchenAlert();toast(`Nuevo pedido #${payload.new.order_number||''}`)}
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'order_items'},async()=>{await loadOrders()})
    .subscribe();
}

function renderMetrics(){
  const valid=orders.filter(o=>o.status!=='cancelled');
  const today=new Date().toISOString().slice(0,10);
  const todaySales=valid.filter(o=>String(o.created_at).slice(0,10)===today).reduce((s,o)=>s+Number(o.total),0);
  $('#metricOrders').textContent=orders.length;
  $('#metricSales').textContent=money(valid.reduce((s,o)=>s+Number(o.total),0));
  $('#metricToday').textContent=money(todaySales);
  $('#metricPending').textContent=orders.filter(o=>['pending','confirmed','preparing'].includes(o.status)).length;
  $('#metricProducts').textContent=products.filter(p=>p.active).length;
  $('#metricCategories').textContent=categories.length;
  renderDashboardExtras();
}
function renderDashboardExtras(){
  const recent=orders.slice(0,5);
  $('#recentOrders').innerHTML=recent.length?recent.map(o=>`<div class="miniOrder"><div><b>#${o.order_number} · ${esc(o.customer_name)}</b><small>${new Date(o.created_at).toLocaleString('es-EC')}</small></div><div><span class="statusBadge status-${o.status}">${statusLabels[o.status]||o.status}</span><strong>${money(o.total)}</strong></div></div>`).join(''):'<p class="emptySmall">Todavía no hay pedidos.</p>';
  const featured=products.filter(p=>p.featured&&p.active).slice(0,6);
  $('#featuredSummary').innerHTML=featured.length?featured.map(p=>`<div class="miniProduct"><span>${esc(p.name)}</span><strong>${money(p.price)}</strong></div>`).join(''):'<p class="emptySmall">No hay productos destacados.</p>';
}
if(document.querySelector('#refreshOrders'))document.querySelector('#refreshOrders').onclick=loadOrders;
if(document.querySelector('#refreshKitchen'))document.querySelector('#refreshKitchen').onclick=loadOrders;
if(document.querySelector('#fullscreenKitchen'))document.querySelector('#fullscreenKitchen').onclick=()=>{const board=$('#kitchenBoard');if(!document.fullscreenElement)board.requestFullscreen?.();else document.exitFullscreen?.()};
if(document.querySelector('#dashboardRefresh'))document.querySelector('#dashboardRefresh').onclick=loadOrders;
if(document.querySelector('#adminProductSearch'))document.querySelector('#adminProductSearch').oninput=e=>{adminProductQuery=e.target.value;renderAdminProducts()};
if(document.querySelector('#adminProductFilter'))document.querySelector('#adminProductFilter').onchange=e=>{adminProductFilter=e.target.value;renderAdminProducts()};
if(document.querySelector('#orderStatusFilter'))document.querySelector('#orderStatusFilter').onchange=e=>{orderStatusFilter=e.target.value;renderOrders()};
if(document.querySelector('#refreshOrders'))document.querySelector('#refreshOrders').onclick=async()=>{await loadOrders();toast('Pedidos actualizados')};

function fillPosCategories(){
  const current=$('#posCategory')?.value||'all';
  if(!$('#posCategory'))return;
  $('#posCategory').innerHTML='<option value="all">Todas las categorías</option>'+categories.filter(c=>c.active).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#posCategory').value=[...$('#posCategory').options].some(o=>o.value===current)?current:'all';
  renderPosCategoryChips();
}

/* ===== CATEGORÍAS COMPACTAS EN POS ===== */
function renderPosCategoryChips(){
  const container=$('#posCategoryChips');
  const select=$('#posCategory');
  if(!container||!select)return;

  const current=select.value||'all';
  const options=[
    {id:'all',name:'Todos'},
    ...categories.filter(category=>category.active).map(category=>({
      id:String(category.id),
      name:category.name
    }))
  ];

  container.innerHTML=options.map(option=>`
    <button type="button"
      class="categoryChip ${String(option.id)===String(current)?'active':''}"
      data-pos-category-chip="${esc(option.id)}">
      ${esc(option.name)}
    </button>
  `).join('');

  $$('[data-pos-category-chip]').forEach(button=>{
    button.onclick=()=>{
      select.value=button.dataset.posCategoryChip;
      renderPosCategoryChips();
      renderPosProducts();
    };
  });
}

function getPosProducts(){
  const q=($('#posSearch')?.value||'').trim().toLowerCase();
  const category=$('#posCategory')?.value||'all';
  return products.filter(p=>p.active&&(category==='all'||String(p.category_id)===String(category))&&(`${p.name} ${p.description||''}`).toLowerCase().includes(q));
}
function renderPosProducts(){
  if(!$('#posProducts'))return;
  const list=getPosProducts();
  $('#posProducts').innerHTML=list.length?list.map(p=>`<button class="posProduct" data-pos-add="${p.id}">
    ${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'<div class="posProductNoImage">Sin imagen</div>'}
    <span class="posProductInfo"><small>${esc(p.categories?.name||'Sin categoría')}</small><b>${esc(p.name)}</b><strong>${money(p.price)}</strong></span>
  </button>`).join(''):'<div class="notice">No hay productos disponibles.</div>';
  $$('[data-pos-add]').forEach(b=>b.onclick=()=>addPosItem(b.dataset.posAdd));
}
function addPosItem(id){
  const item=posCart.find(x=>String(x.id)===String(id));
  if(item)item.qty++;
  else posCart.push({id,qty:1});
  renderPosCart();
}
function changePosQty(id,delta){
  const item=posCart.find(x=>String(x.id)===String(id));
  if(!item)return;
  item.qty+=delta;
  posCart=posCart.filter(x=>x.qty>0);
  renderPosCart();
}
function removePosItem(id){
  posCart=posCart.filter(x=>String(x.id)!==String(id));
  renderPosCart();
}
function posTotals(){
  const subtotal=posCart.reduce((sum,item)=>{
    const p=products.find(x=>String(x.id)===String(item.id));
    return sum+(p?Number(p.price)*item.qty:0);
  },0);

  const rawValue=Math.max(0,Number(posDiscountValue||0));
  const discountAmount=posDiscountType==='percent'
    ?Math.min(subtotal,subtotal*Math.min(rawValue,100)/100)
    :posDiscountType==='fixed'
      ?Math.min(subtotal,rawValue)
      :0;

  return{
    subtotal,
    discountAmount,
    total:Math.max(0,subtotal-discountAmount)
  };
}
function updatePosChange(){
  if(!$('#posReceived'))return;
  const total=posTotals().total;
  const received=Number($('#posReceived').value||0);
  const cash=$('#posPayment').value==='cash';
  $('#posReceivedWrap').classList.toggle('hidden',!cash);
  $('#posChange').textContent=money(cash?Math.max(0,received-total):0);
}
function renderPosCart(){
  if(!$('#posCart'))return;
  $('#posCart').innerHTML=posCart.length?posCart.map(item=>{
    const p=products.find(x=>String(x.id)===String(item.id));
    if(!p)return'';
    return `<div class="posCartRow">
      <div class="posCartRowMain"><b>${esc(p.name)}</b><small>${money(p.price)} c/u</small>
        <div class="posQty"><button data-pos-minus="${p.id}">−</button><span>${item.qty}</span><button data-pos-plus="${p.id}">+</button></div>
      </div>
      <div class="posCartPrice">${money(Number(p.price)*item.qty)}<button class="posRemove" data-pos-remove="${p.id}">Eliminar</button></div>
    </div>`;
  }).join(''):'<div class="posEmpty">Selecciona productos para comenzar.</div>';
  $$('[data-pos-minus]').forEach(b=>b.onclick=()=>changePosQty(b.dataset.posMinus,-1));
  $$('[data-pos-plus]').forEach(b=>b.onclick=()=>changePosQty(b.dataset.posPlus,1));
  $$('[data-pos-remove]').forEach(b=>b.onclick=()=>removePosItem(b.dataset.posRemove));
  const total=posTotals();
  $('#posSubtotal').textContent=money(total.subtotal);
  $('#posDiscountAmount').textContent=money(total.discountAmount);
  $('#posTotal').textContent=money(total.total);
  $('#posHeaderTotal').textContent=money(total.total);
  updatePosChange();
}
function resetPosSale(){
  posCart=[];
  posDiscountType='none';
  posDiscountValue=0;
  $('#posDiscountType').value='none';
  $('#posDiscountValue').value='0';
  $('#posCustomer').value='';
  $('#posPhone').value='';
  $('#posOrderType').value='local';$('#posCashier').value=currentEmployee?.role==='cashier'?currentEmployee.id:'';$('#posWaiter').value='';
  if($('#posPayment'))$('#posPayment').value='cash';
  if($('#posReceived'))$('#posReceived').value='0';
  $('#posNotes').value='';
  renderPosCart();
}
function paymentLabel(value){return({cash:'Efectivo',card:'Tarjeta',transfer:'Transferencia',deuna:'DeUna',ahorita:'Ahorita'})[value]||value}
function buildReceipt(order,items,received){
  const change=order.payment_method==='cash'?Math.max(0,Number(received)-Number(order.total)):0;
  return `<div class="receiptBrand">
    <h2>${esc(settings.business_name||'MORDISCO FAST FOOD')}</h2>
    <p>Comprobante de venta</p>
    <p>${new Date(order.created_at||Date.now()).toLocaleString('es-EC')}</p>
  </div>
  <div class="receiptLine"></div>
  <p><b>Pedido #${order.order_number}</b></p>
  <p>Cliente: ${esc(order.customer_name)}</p>
  <p>Cajero: ${esc(order.cashier_name||$('#posCashier').selectedOptions[0]?.textContent||'No registrado')}</p>
  ${order.waiter_name?`<p>Mesero: ${esc(order.waiter_name)}</p>`:''}
  <p>Tipo: ${orderTypeLabel(order.order_type)}</p>
  <div class="receiptLine"></div>
  ${items.map(i=>`<div class="receiptItem"><span>${i.quantity} × ${esc(i.product_name)}</span><b>${money(i.subtotal)}</b></div>`).join('')}
  <div class="receiptLine"></div>
  <div class="receiptSummary">
    <div><span>Subtotal</span><b>${money(order.subtotal)}</b></div>
    ${Number(order.discount_amount||0)>0?`<div class="receiptDiscount"><span>Descuento${order.discount_type==='percent'?` (${Number(order.discount_value)}%)`:''}</span><b>− ${money(order.discount_amount)}</b></div>`:''}
    <div class="receiptGrand"><span>TOTAL</span><b>${money(order.total)}</b></div>
    <div><span>Pago</span><b>${paymentLabel(order.payment_method)}</b></div>
    ${order.payment_method==='cash'?`<div><span>Recibido</span><b>${money(received)}</b></div><div><span>Cambio</span><b>${money(change)}</b></div>`:''}
  </div>
  <div class="receiptLine"></div>
  <p>¡Gracias por tu compra!</p>`;
}
async function completePosSale(){
  if(!posCart.length)return toast('Agrega al menos un producto');

  const totals=posTotals();
  const order={
    customer_name:$('#posCustomer').value.trim()||'Consumidor final',
    customer_phone:$('#posPhone').value.trim(),
    customer_address:'',
    order_type:$('#posOrderType').value,
    payment_method:null,
    payment_status:'unpaid',
    notes:$('#posNotes').value.trim(),
    cashier_id:null,
    waiter_id:$('#posWaiter').value||null,
    subtotal:totals.subtotal,
    discount_type:posDiscountType,
    discount_value:Number(posDiscountValue||0),
    discount_amount:totals.discountAmount,
    delivery_cost:0,
    total:totals.total,
    status:'pending'
  };

  const sendBtn=$('#posCharge');
  sendBtn.disabled=true;
  sendBtn.textContent='Enviando...';

  const {data,error}=await db.from('orders').insert(order).select().single();
  if(error){
    sendBtn.disabled=false;
    sendBtn.textContent='Enviar a cocina';
    return toast('No se pudo crear la orden: '+error.message);
  }

  const items=posCart.map(item=>{
    const p=products.find(x=>String(x.id)===String(item.id));
    return{
      order_id:data.id,
      product_id:p.id,
      product_name:p.name,
      unit_price:p.price,
      quantity:item.qty,
      subtotal:Number(p.price)*item.qty
    };
  });

  const {error:itemError}=await db.from('order_items').insert(items);
  sendBtn.disabled=false;
  sendBtn.textContent='Enviar a cocina';

  if(itemError)return toast('La orden se creó, pero fallaron los detalles: '+itemError.message);

  resetPosSale();
  await loadOrders();
  renderPosPendingOrders();toast(`Pedido #${data.order_number} enviado a cocina. Ya aparece abajo para cobrar después.`);
}
if(document.querySelector('#posSearch'))document.querySelector('#posSearch').oninput=renderPosProducts;
if(document.querySelector('#posCategory'))document.querySelector('#posCategory').onchange=renderPosProducts;
if(document.querySelector('#posCashier'))document.querySelector('#posCashier').onchange=()=>{if($('#activeCashierName'))$('#activeCashierName').textContent=$('#posCashier').selectedOptions[0]?.textContent||'Sin seleccionar'};
if(document.querySelector('#posClear'))document.querySelector('#posClear').onclick=()=>{if(!posCart.length||confirm('¿Vaciar la venta actual?'))resetPosSale()};
if(document.querySelector('#posDiscountType'))document.querySelector('#posDiscountType').onchange=e=>{
  posDiscountType=e.target.value;
  if(posDiscountType==='none'){
    posDiscountValue=0;
    $('#posDiscountValue').value='0';
  }
  renderPosCart();
};
if(document.querySelector('#posDiscountValue'))document.querySelector('#posDiscountValue').oninput=e=>{
  posDiscountValue=Math.max(0,Number(e.target.value||0));
  renderPosCart();
};
$$('[data-pos-discount]').forEach(button=>button.onclick=()=>{
  posDiscountType='percent';
  posDiscountValue=Number(button.dataset.posDiscount||0);
  $('#posDiscountType').value='percent';
  $('#posDiscountValue').value=String(posDiscountValue);
  renderPosCart();
});

if(document.querySelector('#posCharge'))document.querySelector('#posCharge').onclick=completePosSale;
if(document.querySelector('#printReceipt'))document.querySelector('#printReceipt').onclick=()=>window.print();


async function loadInventoryData(){
  const [ingRes,movRes,recRes]=await Promise.all([
    db.from('ingredients').select('*').order('name'),
    db.from('inventory_movements').select('*,ingredients(name,unit)').order('created_at',{ascending:false}).limit(100),
    db.from('product_recipes').select('*,ingredients(name,unit,cost_per_unit),products(name)').order('created_at')
  ]);
  if(ingRes.error)return toast('Primero ejecuta el SQL de Inventario en Supabase');
  ingredients=ingRes.data||[];
  inventoryMovements=movRes.data||[];
  recipes=recRes.data||[];
  fillInventorySelects();
  renderIngredientList();
  renderMovementList();
  renderRecipeList();
  renderInventorySummary();
}
function renderInventorySummary(){
  if(!$('#inventoryTotalCount'))return;
  const active=ingredients.filter(i=>i.active);
  const low=active.filter(i=>Number(i.current_stock)<=Number(i.minimum_stock));
  const value=active.reduce((sum,i)=>sum+Number(i.current_stock)*Number(i.cost_per_unit),0);
  $('#inventoryTotalCount').textContent=active.length;
  $('#inventoryLowCount').textContent=low.length;
  $('#inventoryValue').textContent=money(value);
}
function fillInventorySelects(){
  const ingredientOptions=ingredients.filter(i=>i.active).map(i=>`<option value="${i.id}">${esc(i.name)} (${esc(i.unit)})</option>`).join('');
  $('#movementIngredient').innerHTML=ingredientOptions;
  $('#recipeIngredient').innerHTML=ingredientOptions;
  const productOptions=products.filter(p=>p.active).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('#recipeProduct').innerHTML=productOptions;
  const current=$('#recipeProductFilter').value||'all';
  $('#recipeProductFilter').innerHTML='<option value="all">Todos los productos</option>'+productOptions;
  $('#recipeProductFilter').value=[...$('#recipeProductFilter').options].some(o=>o.value===current)?current:'all';
}
function resetIngredientForm(){
  $('#ingredientForm').reset();
  $('#ingredientId').value='';
  $('#ingredientActive').checked=true;
  $('#ingredientCost').value='0';
  $('#ingredientStock').value='0';
  $('#ingredientMinimum').value='0';
}
function renderIngredientList(){
  if(!$('#ingredientList'))return;
  const q=($('#ingredientSearch').value||'').trim().toLowerCase();
  const list=ingredients.filter(i=>i.name.toLowerCase().includes(q));
  $('#ingredientList').innerHTML=list.length?list.map(i=>{
    const low=Number(i.current_stock)<=Number(i.minimum_stock);
    return `<article class="ingredientRow ${low?'lowStock':''}">
      <div class="ingredientName"><b>${esc(i.name)}</b><small>${i.active?'Activo':'Inactivo'} · ${esc(i.unit)}</small></div>
      <div><span class="stockBadge ${low?'low':''}">${Number(i.current_stock).toLocaleString('es-EC')} ${esc(i.unit)}</span><small>${low?' Stock bajo':' Disponible'}</small></div>
      <div class="ingredientValue"><b>${money(Number(i.current_stock)*Number(i.cost_per_unit))}</b><small>${money(i.cost_per_unit)} / ${esc(i.unit)}</small></div>
      <div class="rowActions"><button class="dark" data-edit-ingredient="${i.id}">Editar</button><button class="danger" data-delete-ingredient="${i.id}">Eliminar</button></div>
    </article>`;
  }).join(''):'<div class="inventoryEmpty">No hay ingredientes registrados.</div>';
  $$('[data-edit-ingredient]').forEach(b=>b.onclick=()=>editIngredient(b.dataset.editIngredient));
  $$('[data-delete-ingredient]').forEach(b=>b.onclick=()=>deleteIngredient(b.dataset.deleteIngredient));
}
function editIngredient(id){
  const i=ingredients.find(x=>String(x.id)===String(id));if(!i)return;
  $('#ingredientId').value=i.id;$('#ingredientName').value=i.name;$('#ingredientUnit').value=i.unit;
  $('#ingredientCost').value=i.cost_per_unit;$('#ingredientStock').value=i.current_stock;
  $('#ingredientMinimum').value=i.minimum_stock;$('#ingredientActive').checked=i.active;
  $('#ingredientName').focus();
}
async function deleteIngredient(id){
  if(!confirm('¿Eliminar este ingrediente? También se eliminará de las recetas.'))return;
  const {error}=await db.from('ingredients').delete().eq('id',id);
  if(error)return toast(error.message);
  toast('Ingrediente eliminado');await loadInventoryData();
}
if(document.querySelector('#ingredientForm'))document.querySelector('#ingredientForm').onsubmit=async e=>{
  e.preventDefault();
  const id=$('#ingredientId').value;
  const payload={name:$('#ingredientName').value.trim(),unit:$('#ingredientUnit').value,cost_per_unit:Number($('#ingredientCost').value||0),current_stock:Number($('#ingredientStock').value||0),minimum_stock:Number($('#ingredientMinimum').value||0),active:$('#ingredientActive').checked};
  const res=id?await db.from('ingredients').update(payload).eq('id',id):await db.from('ingredients').insert(payload);
  if(res.error)return toast(res.error.message);
  toast(id?'Ingrediente actualizado':'Ingrediente creado');resetIngredientForm();await loadInventoryData();
};
if(document.querySelector('#clearIngredient'))document.querySelector('#clearIngredient').onclick=resetIngredientForm;
if(document.querySelector('#ingredientSearch'))document.querySelector('#ingredientSearch').oninput=renderIngredientList;

function movementTypeLabel(type){return({purchase:'Compra',adjustment_in:'Ajuste entrada',waste:'Merma',adjustment_out:'Ajuste salida',sale:'Venta'})[type]||type}
function movementIsIn(type){return ['purchase','adjustment_in'].includes(type)}
function renderMovementList(){
  if(!$('#movementList'))return;
  $('#movementList').innerHTML=inventoryMovements.length?inventoryMovements.map(m=>{
    const incoming=Number(m.quantity)>0;
    return `<article class="movementRow"><div><h4>${esc(m.ingredients?.name||'Ingrediente eliminado')}</h4><p>${movementTypeLabel(m.movement_type)} · ${new Date(m.created_at).toLocaleString('es-EC')}${m.supplier?` · ${esc(m.supplier)}`:''}${m.note?` · ${esc(m.note)}`:''}</p></div><div class="movementAmount ${incoming?'in':'out'}">${incoming?'+':''}${Number(m.quantity).toLocaleString('es-EC')} ${esc(m.ingredients?.unit||'')}</div></article>`;
  }).join(''):'<div class="inventoryEmpty">Todavía no hay movimientos.</div>';
}
if(document.querySelector('#movementForm'))document.querySelector('#movementForm').onsubmit=async e=>{
  e.preventDefault();
  const type=$('#movementType').value;
  const raw=Number($('#movementQuantity').value||0);
  const quantity=movementIsIn(type)?raw:-raw;
  const payload={ingredient_id:$('#movementIngredient').value,movement_type:type,quantity,unit_cost:Number($('#movementUnitCost').value||0),supplier:$('#movementSupplier').value.trim(),note:$('#movementNote').value.trim()};
  const {error}=await db.rpc('register_inventory_movement',payload);
  if(error)return toast(error.message);
  $('#movementForm').reset();$('#movementUnitCost').value='0';
  toast('Movimiento registrado');await loadInventoryData();
};
if(document.querySelector('#refreshMovements'))document.querySelector('#refreshMovements').onclick=loadInventoryData;

function renderRecipeList(){
  if(!$('#recipeList'))return;
  const filter=$('#recipeProductFilter').value||'all';
  const list=filter==='all'?recipes:recipes.filter(r=>String(r.product_id)===String(filter));
  const grouped={};
  list.forEach(r=>{(grouped[r.product_id]??=[]).push(r)});
  const cards=Object.values(grouped).map(group=>{
    const productName=group[0].products?.name||'Producto';
    const recipeCost=group.reduce((sum,r)=>sum+Number(r.quantity)*Number(r.ingredients?.cost_per_unit||0),0);
    return `<article class="recipeCard"><header class="recipeCardHead"><h4>${esc(productName)}</h4><b>Costo: ${money(recipeCost)}</b></header><div class="recipeItems">${group.map(r=>`<div class="recipeItem"><span>${esc(r.ingredients?.name||'Ingrediente')}</span><b>${Number(r.quantity).toLocaleString('es-EC')} ${esc(r.ingredients?.unit||'')}</b><button class="danger" data-delete-recipe="${r.id}">Quitar</button></div>`).join('')}</div></article>`;
  });
  $('#recipeList').innerHTML=cards.length?cards.join(''):'<div class="inventoryEmpty">No hay recetas configuradas para esta selección.</div>';
  $$('[data-delete-recipe]').forEach(b=>b.onclick=()=>deleteRecipe(b.dataset.deleteRecipe));
}
if(document.querySelector('#recipeForm'))document.querySelector('#recipeForm').onsubmit=async e=>{
  e.preventDefault();
  const payload={product_id:$('#recipeProduct').value,ingredient_id:$('#recipeIngredient').value,quantity:Number($('#recipeQuantity').value||0)};
  const {error}=await db.from('product_recipes').upsert(payload,{onConflict:'product_id,ingredient_id'});
  if(error)return toast(error.message);
  $('#recipeQuantity').value='';
  toast('Receta actualizada');await loadInventoryData();
};
async function deleteRecipe(id){
  const {error}=await db.from('product_recipes').delete().eq('id',id);
  if(error)return toast(error.message);
  toast('Ingrediente quitado de la receta');await loadInventoryData();
}
if(document.querySelector('#recipeProductFilter'))document.querySelector('#recipeProductFilter').onchange=renderRecipeList;
$$('[data-inventory-view]').forEach(b=>b.onclick=()=>{
  $$('[data-inventory-view]').forEach(x=>x.classList.toggle('active',x===b));
  $$('.inventoryView').forEach(x=>x.classList.add('hidden'));
  $('#inventoryView'+b.dataset.inventoryView.charAt(0).toUpperCase()+b.dataset.inventoryView.slice(1)).classList.remove('hidden');
});





async function fillAdminShiftEmployees({preserveSelection=true}={}){
  const select=$('#adminShiftEmployee');
  if(!select||!isAdminSession)return [];

  const previous=preserveSelection?select.value:'';
  select.disabled=true;
  select.innerHTML='<option value="">Cargando empleados...</option>';

  const {data,error}=await db
    .from('staff')
    .select('id,name,role,phone,active,permissions,created_at,updated_at')
    .eq('active',true)
    .order('name');

  if(error){
    console.error('Error cargando empleados para Turnos:',error);
    select.innerHTML='<option value="">No se pudieron cargar empleados</option>';
    select.disabled=false;
    $('#adminShiftStatus').textContent='Error cargando empleados: '+error.message;
    return [];
  }

  const roleAliases={
    cajero:'cashier',
    cashier:'cashier',
    cocina:'kitchen',
    kitchen:'kitchen',
    mesero:'waiter',
    waiter:'waiter'
  };

  const eligible=(data||[])
    .map(member=>({
      ...member,
      role:roleAliases[String(member.role||'').toLowerCase()]||member.role
    }))
    .filter(member=>member.active&&member.role!=='admin');

  // Mantiene la misma fuente para Personal, Caja y Turnos.
  staffMembers=[
    ...staffMembers.filter(existing=>
      !eligible.some(member=>String(member.id)===String(existing.id))
    ),
    ...eligible
  ].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));

  select.innerHTML='<option value="">Selecciona un empleado</option>'+
    eligible.map(member=>`
      <option value="${member.id}">
        ${esc(member.name)} — ${staffRoleLabel(member.role)}
      </option>
    `).join('');

  if(previous&&eligible.some(member=>String(member.id)===String(previous))){
    select.value=previous;
  }

  select.disabled=false;

  if(!eligible.length){
    $('#adminShiftStatus').textContent='No hay empleados activos disponibles.';
  }

  return eligible;
}

function selectedAdminShift(){
  const employeeId=$('#adminShiftEmployee').value;
  return shifts.find(shift=>
    String(shift.staff_id)===String(employeeId)&&shift.status==='open'
  )||null;
}

async function renderAdminShiftManager({reloadEmployees=false}={}){
  if(!isAdminSession||!$('#adminShiftEmployee'))return;

  if(reloadEmployees||!$('#adminShiftEmployee').options.length||
     $('#adminShiftEmployee').options[0]?.textContent.includes('Cargando')){
    await fillAdminShiftEmployees();
  }

  const employeeId=$('#adminShiftEmployee').value;
  const employee=staffMembers.find(member=>String(member.id)===String(employeeId));
  const openShift=selectedAdminShift();
  const status=$('#adminShiftStatus');

  if(!employee){
    status.textContent=$('#adminShiftEmployee').options.length>1
      ? 'Selecciona un empleado.'
      : 'No hay empleados activos disponibles.';
    $('#adminOpenShiftBtn').disabled=true;
    $('#adminCloseShiftBtn').disabled=true;
    return;
  }

  if(openShift){
    status.innerHTML=`Turno abierto para <strong>${esc(employee.name)}</strong> desde ${new Date(openShift.started_at).toLocaleString('es-EC')}. Efectivo inicial: ${money(openShift.opening_cash||0)}.`;
    $('#adminOpenShiftBtn').disabled=true;
    $('#adminCloseShiftBtn').disabled=false;
  }else{
    status.innerHTML=`<strong>${esc(employee.name)}</strong> no tiene un turno abierto.`;
    $('#adminOpenShiftBtn').disabled=false;
    $('#adminCloseShiftBtn').disabled=true;
  }
}

async function adminOpenEmployeeShift(){
  if(!isAdminSession)return toast('Solo el administrador puede abrir turnos');

  const employeeId=$('#adminShiftEmployee').value;
  if(!employeeId)return toast('Selecciona un empleado');

  const openingCash=Math.max(Number($('#adminShiftOpeningCash').value||0),0);
  const {error}=await db.rpc('admin_open_work_shift',{
    p_employee_id:employeeId,
    p_initial_cash:openingCash
  });

  if(error)return toast(error.message);
  toast('Turno abierto. El empleado ya puede trabajar y cobrar.');
  await loadShifts();
}

async function adminCloseEmployeeShift(){
  if(!isAdminSession)return toast('Solo el administrador puede cerrar turnos');

  const employeeId=$('#adminShiftEmployee').value;
  if(!employeeId)return toast('Selecciona un empleado');

  const closingCash=Math.max(Number($('#adminShiftClosingCash').value||0),0);
  const accepted=confirm('¿Cerrar el turno del empleado seleccionado?');
  if(!accepted)return;

  const {error}=await db.rpc('admin_close_work_shift',{
    p_employee_id:employeeId,
    p_counted_cash:closingCash
  });

  if(error)return toast(error.message);
  toast('Turno cerrado correctamente.');

  if($('#adminShiftClosingCash')){
    $('#adminShiftClosingCash').value='0';
  }

  await loadShifts();
  await renderAdminShiftManager();
}

$('#adminShiftEmployee')?.addEventListener('change',()=>renderAdminShiftManager());
$('#adminOpenShiftBtn')?.addEventListener('click',adminOpenEmployeeShift);
$('#adminCloseShiftBtn')?.addEventListener('click',adminCloseEmployeeShift);
$('#adminRefreshShiftBtn')?.addEventListener('click',async()=>{
  await fillAdminShiftEmployees();
  await loadShifts();
  await renderAdminShiftManager();
});

async function loadShifts(){
  const today=new Date();
  today.setHours(0,0,0,0);

  // Carga todos los turnos abiertos, aunque hayan empezado en días anteriores.
  const [openResult,todayResult]=await Promise.all([
    db
      .from('work_shifts')
      .select('*,staff(name,role)')
      .eq('status','open')
      .order('started_at',{ascending:false}),
    db
      .from('work_shifts')
      .select('*,staff(name,role)')
      .gte('started_at',today.toISOString())
      .order('started_at',{ascending:false})
  ]);

  const error=openResult.error||todayResult.error;
  if(error){
    console.error(error);
    return toast('Error cargando turnos: '+error.message);
  }

  const merged=[...(openResult.data||[]),...(todayResult.data||[])];
  const unique=new Map();

  merged.forEach(shift=>{
    unique.set(String(shift.id),shift);
  });

  shifts=[...unique.values()].sort(
    (a,b)=>new Date(b.started_at)-new Date(a.started_at)
  );

  currentShift=currentEmployee
    ? shifts.find(shift=>
        String(shift.staff_id)===String(currentEmployee.id)&&
        shift.status==='open'
      )||null
    : null;

  renderShifts();
  await renderAdminShiftManager();
}
function renderShifts(){
  if(!$('#shiftHistoryBody'))return;
  $('#openShiftCount').textContent=shifts.filter(s=>s.status==='open').length;
  $('#shiftSalesCount').textContent=shifts.reduce((n,s)=>n+Number(s.sales_count||0),0);
  $('#shiftSalesTotal').textContent=money(shifts.reduce((n,s)=>n+Number(s.sales_total||0),0));

  const c=$('#currentShiftCard');
  if(!currentEmployee){
    c.className='panel currentShiftCard closed';
    c.innerHTML=isAdminSession
      ? '<h3>El administrador controla los turnos desde el panel superior.</h3><p>Selecciona un empleado para abrir o cerrar su turno.</p>'
      : '<h3>Inicia sesión como empleado para administrar tu turno.</h3>';
  }else if(currentShift){
    c.className='panel currentShiftCard active';
    c.innerHTML=`<h3>Turno activo — ${esc(currentEmployee.name)}</h3>
      <p>Inicio: ${new Date(currentShift.started_at).toLocaleString()}</p>
      <div class="shiftSummaryGrid">
        <div><span>Efectivo inicial</span><strong>${money(currentShift.opening_cash||0)}</strong></div>
        <div><span>Ventas</span><strong>${currentShift.sales_count||0}</strong></div>
        <div><span>Total cobrado</span><strong>${money(currentShift.sales_total||0)}</strong></div>
        <div><span>Estado</span><strong>Abierto</strong></div>
      </div>`;
  }else{
    c.className='panel currentShiftCard closed';
    c.innerHTML=`<h3>${esc(currentEmployee.name)}</h3><p>No tienes un turno abierto.</p>`;
  }

  $('#shiftHistoryBody').innerHTML=shifts.length?shifts.map(s=>`<tr>
    <td>${esc(s.staff?.name||'Empleado')}</td>
    <td>${staffRoleLabel(s.staff?.role||'')}</td>
    <td>${new Date(s.started_at).toLocaleString()}</td>
    <td>${s.ended_at?new Date(s.ended_at).toLocaleString():'—'}</td>
    <td>${s.sales_count||0}</td>
    <td>${money(s.sales_total||0)}</td>
    <td>${s.status==='open'?'Abierto':'Cerrado'}</td>
  </tr>`).join(''):'<tr><td colspan="7">No hay turnos registrados hoy.</td></tr>';
}
function openShiftModal(action){
  if(!currentEmployee)return toast('Primero inicia sesión como empleado');
  shiftAction=action;
  $('#shiftPinTitle').textContent=action==='start'?'Iniciar turno':'Cerrar turno';
  $('#shiftPinHelp').textContent=action==='start'?'Confirma tu PIN y registra el efectivo inicial.':'Confirma tu PIN y registra el efectivo contado al cierre.';
  $('#openingCashLabel').classList.toggle('hidden',action!=='start');
  $('#closingCashLabel').classList.toggle('hidden',action!=='close');
  $('#shiftPinInput').value='';
  $('#shiftPinModal').classList.remove('hidden');
}
if(document.querySelector('#startShiftBtn'))document.querySelector('#startShiftBtn').onclick=()=>{if(currentShift)return toast('Ya tienes un turno abierto');openShiftModal('start')};
if(document.querySelector('#closeShiftBtn'))document.querySelector('#closeShiftBtn').onclick=()=>{if(!currentShift)return toast('No tienes un turno abierto');openShiftModal('close')};
if(document.querySelector('#refreshShiftsBtn'))document.querySelector('#refreshShiftsBtn').onclick=loadShifts;
if(document.querySelector('#shiftPinConfirm'))document.querySelector('#shiftPinConfirm').onclick=async()=>{
  const pin=$('#shiftPinInput').value.trim();
  if(!/^\d{4,6}$/.test(pin))return toast('Ingresa un PIN válido');
  if(shiftAction==='start'){
    const {data,error}=await db.rpc('start_work_shift',{employee_id:currentEmployee.id,employee_pin:pin,initial_cash:Number($('#openingCashInput').value||0)});
    if(error)return toast(error.message);
    toast('Turno iniciado correctamente');
  }else{
    const {data,error}=await db.rpc('close_work_shift',{employee_id:currentEmployee.id,employee_pin:pin,counted_cash:Number($('#closingCashInput').value||0)});
    if(error)return toast(error.message);
    toast('Turno cerrado correctamente');
  }
  $('#shiftPinModal').classList.add('hidden');
  await loadShifts();
};
$$('[data-close="shiftPinModal"]').forEach(b=>b.onclick=()=>$('#shiftPinModal').classList.add('hidden'));

function tableStatusLabel(status){return({free:'Libre',occupied:'Ocupada',preparing:'Preparando',payment:'Por cobrar'})[status]||status}
async function loadTables(){
  const {data,error}=await db.from('restaurant_tables').select('*,staff(name)').order('sort_order');
  if(error)return toast('Primero ejecuta el SQL V9 en Supabase');
  tables=data||[];renderTables();
}
function tableTypeLabel(type){
  return type==='bar'?'Barra':'Mesa';
}

function tableTypeIcon(type){
  return type==='bar'?'▰':'▣';
}

function renderTables(){
  if(!$('#tablesGrid'))return;

  $('#tablesFreeCount').textContent=tables.filter(t=>t.status==='free').length;
  $('#tablesBusyCount').textContent=tables.filter(t=>['occupied','preparing'].includes(t.status)).length;
  $('#tablesPaymentCount').textContent=tables.filter(t=>t.status==='payment').length;

  $('#tablesGrid').innerHTML=tables.length?tables.map(t=>`
    <article class="tableCardWrap ${t.status}">
      <button class="tableCard ${t.status}" data-open-table="${t.id}">
        <span class="tableTypeBadge ${t.service_type==='bar'?'bar':''}">
          ${tableTypeIcon(t.service_type)} ${tableTypeLabel(t.service_type)}
        </span>
        <h3>${esc(t.name)}</h3>
        <p>${Number(t.seats||1)} ${Number(t.seats||1)===1?'puesto':'puestos'}</p>
        <strong>${tableStatusLabel(t.status)}</strong>
        <div class="tableMeta">
          ${t.staff?.name?`Mesero: ${esc(t.staff.name)}`:'Sin mesero asignado'}
        </div>
      </button>
      ${isAdminSession?`
        <button class="tableEditBtn" type="button" data-edit-table="${t.id}">
          Editar
        </button>
      `:''}
    </article>
  `).join(''):'<div class="inventoryEmpty">No hay mesas ni barras. Crea el primer espacio.</div>';

  $$('[data-open-table]').forEach(button=>{
    button.onclick=()=>openTableOrder(button.dataset.openTable);
  });

  $$('[data-edit-table]').forEach(button=>{
    button.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      openTableManager(button.dataset.editTable);
    };
  });
}
if(document.querySelector('#createTableBtn'))document.querySelector('#createTableBtn').onclick=async()=>{
  if(!isAdminSession)return toast('Solo el administrador puede crear espacios');

  const name=$('#newTableName').value.trim();
  const serviceType=$('#newTableType').value||'table';
  const seats=Math.max(1,Number($('#newTableSeats').value||1));

  if(!name)return toast('Escribe el nombre del espacio');

  const {data,error}=await db.rpc('admin_save_service_point',{
    p_id:null,
    p_name:name,
    p_seats:seats,
    p_service_type:serviceType,
    p_sort_order:tables.length+1
  });

  if(error)return toast('No se pudo crear: '+error.message);

  $('#newTableName').value='';
  $('#newTableSeats').value=serviceType==='bar'?'1':'4';
  toast(serviceType==='bar'?'Barra creada':'Mesa creada');
  await loadTables();
};

function openTableManager(id){
  if(!isAdminSession)return;

  const table=tables.find(item=>String(item.id)===String(id));
  if(!table)return toast('Espacio no encontrado');

  $('#editTableId').value=table.id;
  $('#editTableType').value=table.service_type||'table';
  $('#editTableName').value=table.name||'';
  $('#editTableSeats').value=Number(table.seats||1);

  const locked=table.status!=='free';
  $('#deleteTableBtn').disabled=locked;
  $('#tableManageMessage').textContent=locked
    ? 'Este espacio tiene una orden activa. Puedes editarlo, pero no eliminarlo hasta liberarlo.'
    : 'Puedes modificar o eliminar este espacio porque está libre.';

  $('#tableManageModal').classList.remove('hidden');
}

$('#saveTableChangesBtn')?.addEventListener('click',async()=>{
  const id=$('#editTableId').value;
  const name=$('#editTableName').value.trim();
  const serviceType=$('#editTableType').value||'table';
  const seats=Math.max(1,Number($('#editTableSeats').value||1));
  const current=tables.find(item=>String(item.id)===String(id));

  if(!name)return toast('Escribe el nombre del espacio');

  const {error}=await db.rpc('admin_save_service_point',{
    p_id:id,
    p_name:name,
    p_seats:seats,
    p_service_type:serviceType,
    p_sort_order:Number(current?.sort_order||tables.length)
  });

  if(error)return toast('No se pudo guardar: '+error.message);

  $('#tableManageModal').classList.add('hidden');
  toast('Espacio actualizado');
  await loadTables();
});

$('#deleteTableBtn')?.addEventListener('click',async()=>{
  const id=$('#editTableId').value;
  const table=tables.find(item=>String(item.id)===String(id));

  if(!table)return;
  if(table.status!=='free'){
    return toast('Primero libera este espacio');
  }

  if(!confirm(`¿Eliminar definitivamente ${table.name}?`))return;

  const {error}=await db.rpc('admin_delete_service_point',{
    p_id:id
  });

  if(error)return toast('No se pudo eliminar: '+error.message);

  $('#tableManageModal').classList.add('hidden');
  toast('Espacio eliminado');
  await loadTables();
});

$('#newTableType')?.addEventListener('change',event=>{
  const isBar=event.target.value==='bar';
  if(isBar){
    if(!$('#newTableName').value.trim())$('#newTableName').value='Barra';
    $('#newTableSeats').value='1';
  }else{
    if($('#newTableName').value.trim()==='Barra')$('#newTableName').value='';
    $('#newTableSeats').value='4';
  }
});

$$('[data-close="tableManageModal"]').forEach(button=>{
  button.onclick=()=>$('#tableManageModal').classList.add('hidden');
});

function fillTableSelectors(){
  $('#tableCategory').innerHTML='<option value="all">Todas las categorías</option>'+categories.filter(c=>c.active).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
}
function getTableProducts(){
  const q=($('#tableProductSearch').value||'').toLowerCase(),cat=$('#tableCategory').value||'all';
  return products.filter(p=>p.active&&(cat==='all'||String(p.category_id)===String(cat))&&(`${p.name} ${p.description||''}`).toLowerCase().includes(q));
}
function renderTableProducts(){
  const list=getTableProducts();
  $('#tableProducts').innerHTML=list.map(p=>`<button class="posProduct" data-table-add="${p.id}">
    ${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'<div class="posProductNoImage">Sin imagen</div>'}
    <span class="posProductInfo"><small>${esc(p.categories?.name||'')}</small><b>${esc(p.name)}</b><strong>${money(p.price)}</strong></span>
  </button>`).join('');
  $$('[data-table-add]').forEach(b=>b.onclick=()=>{const r=tableCart.find(x=>String(x.id)===String(b.dataset.tableAdd));if(r)r.qty++;else tableCart.push({id:b.dataset.tableAdd,qty:1});renderTableCart()});
}
function renderTableCart(){
  const total=tableCart.reduce((s,r)=>{const p=products.find(x=>String(x.id)===String(r.id));return s+(p?Number(p.price)*r.qty:0)},0);
  $('#tableTotal').textContent=money(total);
  $('#tableCart').innerHTML=tableCart.length?tableCart.map(r=>{const p=products.find(x=>String(x.id)===String(r.id));return `<div class="posCartRow"><div class="posCartRowMain"><b>${esc(p.name)}</b><div class="posQty"><button data-table-minus="${p.id}">−</button><span>${r.qty}</span><button data-table-plus="${p.id}">+</button></div></div><div class="posCartPrice">${money(Number(p.price)*r.qty)}</div></div>`}).join(''):'<div class="posEmpty">Selecciona productos.</div>';
  $$('[data-table-minus]').forEach(b=>b.onclick=()=>{const r=tableCart.find(x=>String(x.id)===String(b.dataset.tableMinus));r.qty--;tableCart=tableCart.filter(x=>x.qty>0);renderTableCart()});
  $$('[data-table-plus]').forEach(b=>b.onclick=()=>{tableCart.find(x=>String(x.id)===String(b.dataset.tablePlus)).qty++;renderTableCart()});
}
async function openTableOrder(id){
  currentTable=tables.find(t=>String(t.id)===String(id));if(!currentTable)return;
  tableCart=[];fillTableSelectors();renderTableProducts();renderTableCart();
  $('#tableOrderTitle').textContent=currentTable.name;$('#tableOrderStatus').textContent=tableStatusLabel(currentTable.status);
  $('#tableCustomer').value='';$('#tableNotes').value='';$('#tableOrderModal').classList.remove('hidden');
}
if(document.querySelector('#tableProductSearch'))document.querySelector('#tableProductSearch').oninput=renderTableProducts;if(document.querySelector('#tableCategory'))document.querySelector('#tableCategory').onchange=renderTableProducts;
if(document.querySelector('#sendTableOrder'))document.querySelector('#sendTableOrder').onclick=async()=>{
  if(!currentTable||!tableCart.length)return toast('Agrega productos');
  const total=tableCart.reduce((s,r)=>{const p=products.find(x=>String(x.id)===String(r.id));return s+Number(p.price)*r.qty},0);
  const order={customer_name:$('#tableCustomer').value.trim()||currentTable.name,customer_phone:'',customer_address:'',order_type:'local',payment_method:null,payment_status:'unpaid',notes:`${currentTable.name}. ${$('#tableNotes').value.trim()}`.trim(),subtotal:total,delivery_cost:0,total,status:'pending',waiter_id:currentEmployee?.role==='waiter'?currentEmployee.id:(currentTable.staff_id||null),table_id:currentTable.id};
  const {data,error}=await db.from('orders').insert(order).select().single();if(error)return toast(error.message);
  const items=tableCart.map(r=>{const p=products.find(x=>String(x.id)===String(r.id));return{order_id:data.id,product_id:p.id,product_name:p.name,unit_price:p.price,quantity:r.qty,subtotal:Number(p.price)*r.qty}});
  const {error:itemError}=await db.from('order_items').insert(items);if(itemError)return toast(itemError.message);
  await db.from('restaurant_tables').update({status:'preparing',current_order_id:data.id,staff_id:order.waiter_id,updated_at:new Date().toISOString()}).eq('id',currentTable.id);
  toast(`Comanda #${data.order_number} enviada a cocina`);$('#tableOrderModal').classList.add('hidden');await loadTables();await loadOrders();
};
if(document.querySelector('#markTablePayment'))document.querySelector('#markTablePayment').onclick=async()=>{if(!currentTable)return;await db.from('restaurant_tables').update({status:'payment',updated_at:new Date().toISOString()}).eq('id',currentTable.id);toast('Mesa pendiente de cobro');$('#tableOrderModal').classList.add('hidden');await loadTables()};
if(document.querySelector('#freeTable'))document.querySelector('#freeTable').onclick=async()=>{if(!currentTable)return;await db.from('restaurant_tables').update({status:'free',current_order_id:null,staff_id:null,updated_at:new Date().toISOString()}).eq('id',currentTable.id);toast('Mesa liberada');$('#tableOrderModal').classList.add('hidden');await loadTables()};


const DEFAULT_ROLE_PERMISSIONS={
  waiter:['comandas'],
  cashier:['pos'],
  kitchen:['kitchen']
};

function normalizePermissions(value,role){
  const valid=['pos','kitchen','orders','tables','shifts','customers','comandas'];
  const list=Array.isArray(value)?value:[];
  const clean=[...new Set(list.filter(item=>valid.includes(item)))];
  return clean.length?clean:(DEFAULT_ROLE_PERMISSIONS[role]||[]);
}

function selectedStaffPermissions(){
  const role=$('#staffRole').value;
  if(role==='waiter')return ['comandas'];
  return $$('[name="staffPermission"]:checked').map(input=>input.value);
}

function applyRolePermissionDefaults(role,permissions=null){
  const selected=normalizePermissions(permissions,role);
  $$('[name="staffPermission"]').forEach(input=>{
    input.checked=selected.includes(input.value);
    input.disabled=role==='waiter';
  });
}

function staffRoleLabel(role){return({waiter:'Mesero',cashier:'Cajero',kitchen:'Cocina'})[role]||role}
function staffRoleIcon(role){return({waiter:'🧑‍🍽️',cashier:'💵',kitchen:'👨‍🍳'})[role]||'👤'}
async function loadStaff(){
  const {data,error}=await db.from('staff').select('id,name,role,phone,active,permissions,created_at,updated_at').order('name');
  if(error){
    console.error('Error cargando personal:',error);
    return toast('Error cargando personal: '+error.message);
  }
  staffMembers=data||[];

  if($('#staffSearch')){
    const currentSearch=$('#staffSearch').value.trim();
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentSearch))$('#staffSearch').value='';
  }
  if($('#staffPhone')){
    const currentPhone=$('#staffPhone').value.trim();
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentPhone))$('#staffPhone').value='';
  }

  renderStaff();
  fillPosStaff();
  fillEmployeeLogin();
  if($('#adminShiftEmployee')&&isAdminSession){
    await fillAdminShiftEmployees({preserveSelection:true});
  }
}
function renderStaff(){
  if(!$('#staffList'))return;
  let q=($('#staffSearch')?.value||'').trim().toLowerCase();
  const role=$('#staffRoleFilter')?.value||'all';

  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)){
    q='';
    if($('#staffSearch'))$('#staffSearch').value='';
  }

  const list=staffMembers.filter(s=>
    (role==='all'||s.role===role)&&
    (`${s.name} ${s.phone||''} ${staffRoleLabel(s.role)}`).toLowerCase().includes(q)
  );
  const active=staffMembers.filter(s=>s.active);
  $('#staffActiveCount').textContent=active.length;
  $('#staffWaiterCount').textContent=active.filter(s=>s.role==='waiter').length;
  $('#staffCashierCount').textContent=active.filter(s=>s.role==='cashier').length;
  $('#staffList').innerHTML=list.length?list.map(s=>`<article class="staffCard ${s.active?'':'staffInactive'}">
    <div class="staffIdentity"><div class="staffAvatar">${staffRoleIcon(s.role)}</div><div><h4>${esc(s.name)}</h4><p>${esc(s.phone||'Sin teléfono')} · ${s.active?'Activo':'Inactivo'}</p></div></div>
    <span class="staffRoleBadge ${s.role}">${staffRoleLabel(s.role)}</span>
    <div class="staffPermissionSummary">${normalizePermissions(s.permissions,s.role).map(p=>`<small>${esc({pos:'Caja',kitchen:'Cocina',orders:'Pedidos',tables:'Mesas',shifts:'Turnos',customers:'Clientes',comandas:'Comandas'}[p]||p)}</small>`).join('')}</div>
    <div class="staffActions"><button class="dark" data-edit-staff="${s.id}">Editar</button><button class="${s.active?'warning':'success'}" data-toggle-staff="${s.id}" data-active="${s.active}">${s.active?'Desactivar':'Activar'}</button><button class="danger" data-delete-staff="${s.id}">Eliminar</button></div>
  </article>`).join(''):'<div class="inventoryEmpty">No hay empleados registrados.</div>';
  $$('[data-edit-staff]').forEach(b=>b.onclick=()=>editStaff(b.dataset.editStaff));
  $$('[data-toggle-staff]').forEach(b=>b.onclick=()=>toggleStaff(b.dataset.toggleStaff,b.dataset.active==='true'));
  $$('[data-delete-staff]').forEach(b=>b.onclick=()=>deleteStaff(b.dataset.deleteStaff));
}
function fillPosStaff(){
  if(!$('#posCashier')||!$('#posWaiter'))return;
  const cashierCurrent=$('#posCashier').value;
  const waiterCurrent=$('#posWaiter').value;
  $('#posCashier').innerHTML='<option value="">Seleccionar cajero</option>'+staffMembers.filter(s=>s.active&&s.role==='cashier').map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  $('#posWaiter').innerHTML='<option value="">Sin mesero</option>'+staffMembers.filter(s=>s.active&&s.role==='waiter').map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  const forcedCashier=currentEmployee?.role==='cashier'?currentEmployee.id:cashierCurrent;
  $('#posCashier').value=[...$('#posCashier').options].some(o=>o.value===forcedCashier)?forcedCashier:'';
  $('#posCashier').disabled=currentEmployee?.role==='cashier';
  $('#posWaiter').value=[...$('#posWaiter').options].some(o=>o.value===waiterCurrent)?waiterCurrent:'';
  if($('#activeCashierName'))$('#activeCashierName').textContent=currentEmployee?.role==='cashier'?currentEmployee.name:($('#posCashier').selectedOptions[0]?.textContent||'Sin seleccionar');
}
function resetStaffForm(){
  $('#staffForm').reset();$('#staffId').value='';$('#staffActive').checked=true;$('#staffPin').value='';
  applyRolePermissionDefaults($('#staffRole').value);
}
function editStaff(id){
  const s=staffMembers.find(x=>String(x.id)===String(id));if(!s)return;
  $('#staffId').value=s.id;$('#staffName').value=s.name;$('#staffRole').value=s.role;$('#staffPhone').value=s.phone||'';$('#staffActive').checked=s.active;$('#staffPin').value='';applyRolePermissionDefaults(s.role,s.permissions);$('#staffName').focus();
}
async function toggleStaff(id,isActive){
  const {error}=await db.from('staff').update({active:!isActive,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return toast(error.message);
  toast(isActive?'Empleado desactivado':'Empleado activado');await loadStaff();
}
async function deleteStaff(id){
  const employee=staffMembers.find(s=>String(s.id)===String(id));
  if(!employee)return;
  if(currentEmployee&&String(currentEmployee.id)===String(id)){
    return toast('No puedes eliminar al empleado que tiene la sesión abierta');
  }
  const accepted=confirm(`¿Eliminar definitivamente a ${employee.name}?\n\nSus ventas y pedidos anteriores se conservarán, pero ya no podrá iniciar sesión.`);
  if(!accepted)return;
  const {error}=await db.from('staff').delete().eq('id',id);
  if(error)return toast('No se pudo eliminar: '+error.message);
  if(String($('#staffId').value)===String(id))resetStaffForm();
  toast('Empleado eliminado');
  await loadStaff();
}
if(document.querySelector('#staffForm'))document.querySelector('#staffForm').onsubmit=async e=>{
  e.preventDefault();
  const id=$('#staffId').value;
  const pin=$('#staffPin').value.trim();
  if(!id&&!/^\d{4,6}$/.test(pin))return toast('El PIN debe tener entre 4 y 6 números');
  if(id&&pin&&!/^\d{4,6}$/.test(pin))return toast('El PIN debe tener entre 4 y 6 números');
  const payload={staff_id:id||null,staff_name:$('#staffName').value.trim(),staff_role:$('#staffRole').value,staff_phone:$('#staffPhone').value.trim()||null,staff_pin:pin||null,staff_active:$('#staffActive').checked};
  const {data:savedId,error}=await db.rpc('save_staff_member',payload);
  if(error)return toast(error.message);
  const employeeId=id||savedId;
  if(employeeId){
    const {error:permissionError}=await db.from('staff').update({
      permissions:selectedStaffPermissions(),
      updated_at:new Date().toISOString()
    }).eq('id',employeeId);
    if(permissionError)return toast('Empleado guardado, pero no se pudieron guardar permisos: '+permissionError.message);
  }
  toast(id?'Empleado actualizado':'Empleado creado');resetStaffForm();await loadStaff();
};
if(document.querySelector('#staffRole'))document.querySelector('#staffRole').onchange=()=>{
  applyRolePermissionDefaults($('#staffRole').value);
};
if(document.querySelector('#clearStaff'))document.querySelector('#clearStaff').onclick=resetStaffForm;
if(document.querySelector('#staffSearch'))document.querySelector('#staffSearch').oninput=renderStaff;
if(document.querySelector('#staffRoleFilter'))document.querySelector('#staffRoleFilter').onchange=renderStaff;
if($('#clearStaffSearch'))if(document.querySelector('#clearStaffSearch'))document.querySelector('#clearStaffSearch').onclick=()=>{
  $('#staffSearch').value='';
  $('#staffRoleFilter').value='all';
  renderStaff();
};


function fillEmployeeLogin(){
  if(!$('#employeeLoginStaff'))return;
  $('#employeeLoginStaff').innerHTML=staffMembers.filter(s=>s.active).map(s=>`<option value="${s.id}">${esc(s.name)} — ${staffRoleLabel(s.role)}</option>`).join('');
}
function applyEmployeePermissions(employee){
  currentEmployee=employee;

  const roleDefaults={
    cashier:['pos'],
    kitchen:['kitchen'],
    waiter:['comandas'],
    admin:[
      'dashboard','products','categories','orders','kitchen','pos',
      'inventory','tables','shifts','finance','customers',
      'promotions','pages','staff','extras','settings'
    ]
  };

  const savedPermissions=Array.isArray(employee.permissions)
    ? employee.permissions.filter(Boolean)
    : [];

  employee.permissions=savedPermissions.length
    ? [...new Set(savedPermissions)]
    : (roleDefaults[employee.role]||[]);

  localStorage.setItem('mordisco_employee',JSON.stringify(employee));
  document.body.classList.add('employeeMode');
  document.body.dataset.employeeRole=employee.role;

  if(employee.role==='waiter'&&employee.permissions.includes('comandas')){
    location.replace('/comandas');
    return;
  }

  if(employee.role==='cashier'){
    setTimeout(()=>{
      if($('#posCashier')){
        $('#posCashier').value=employee.id;
        $('#posCashier').disabled=true;
      }
      if($('#activeCashierName')){
        $('#activeCashierName').textContent=employee.name;
      }
    },0);
  }

  const allowed=employee.permissions.filter(permission=>permission!=='comandas');

  $$('.sidebar [data-tab]').forEach(button=>{
    const permitted=allowed.includes(button.dataset.tab);
    button.hidden=!permitted;
    button.classList.toggle('employeeAllowed',permitted);
    button.classList.toggle('roleRestricted',!permitted);
    button.style.setProperty('display',permitted?'flex':'none','important');
    button.setAttribute('aria-hidden',String(!permitted));
    button.tabIndex=permitted?0:-1;
  });

  $$('#adminView .tab').forEach(section=>{
    const tabName=section.id?.replace(/^tab-/,'');
    if(tabName&&!allowed.includes(tabName)){
      section.classList.add('hidden');
      section.setAttribute('aria-hidden','true');
    }
  });

  $('#logoutBtn').textContent='Cerrar sesión';

  const preferred=employee.role==='cashier'&&allowed.includes('pos')
    ? 'pos'
    : employee.role==='kitchen'&&allowed.includes('kitchen')
      ? 'kitchen'
      : allowed[0];

  const first=preferred?$(`.sidebar [data-tab="${preferred}"]`):null;
  if(first){
    first.hidden=false;
    first.style.setProperty('display','flex','important');
    first.click();
  }else{
    toast('Este empleado no tiene módulos habilitados. Asigna permisos desde Personal.');
  }
}
async function loginEmployee(){
  const id=$('#employeeLoginStaff').value,pin=$('#employeeLoginPin').value.trim();
  if(!id||!/^\d{4,6}$/.test(pin))return toast('Ingresa un PIN válido');
  const {data,error}=await db.rpc('verify_staff_pin',{staff_id:id,staff_pin:pin});
  if(error||!data)return toast('PIN incorrecto');
  const employee=staffMembers.find(s=>String(s.id)===String(id));if(!employee)return;
  $('#employeeLoginModal').classList.add('hidden');$('#employeeLoginPin').value='';
  $('#publicView').classList.add('hidden');$('#adminView').classList.remove('hidden');
  applyEmployeePermissions(employee);await loadShifts();toast(`Bienvenido, ${employee.name}`);
}
$('#employeeAccessBtn')?.addEventListener('click',async()=>{await loadStaff();fillEmployeeLogin();$('#employeeLoginModal').classList.remove('hidden')});
if(document.querySelector('#employeeLoginSubmit'))document.querySelector('#employeeLoginSubmit').onclick=loginEmployee;
if(document.querySelector('#employeeLoginPin'))document.querySelector('#employeeLoginPin').onkeydown=e=>{if(e.key==='Enter')loginEmployee()};

function fillSettings(){$('#sName').value=settings.business_name||'';$('#sWhatsapp').value=settings.whatsapp||'';$('#sDescription').value=settings.description||'';$('#sAddress').value=settings.address||'';$('#sSchedule').value=settings.schedule||'';$('#sDelivery').value=settings.delivery_cost||0;$('#sMinimum').value=settings.minimum_order||0;$('#sAccepting').checked=settings.accepting_orders!==false}
if(document.querySelector('#settingsForm'))document.querySelector('#settingsForm').onsubmit=async e=>{e.preventDefault();const row={id:1,business_name:$('#sName').value,whatsapp:$('#sWhatsapp').value,description:$('#sDescription').value,address:$('#sAddress').value,schedule:$('#sSchedule').value,delivery_cost:Number($('#sDelivery').value||0),minimum_order:Number($('#sMinimum').value||0),accepting_orders:$('#sAccepting').checked};const {error}=await db.from('business_settings').upsert(row);if(error)return toast(error.message);settings=row;applySettings();toast('Configuración guardada en la nube')};

function isoToday(){return new Date().toISOString().slice(0,10)}
function methodLabel(v){return ({cash:'Efectivo',transfer:'Transferencia',card:'Tarjeta',deuna:'DeUna',ahorita:'Ahorita',other:'Otro'})[v]||v}
function tierLabel(v){return ({new:'Nuevo',frequent:'Frecuente',vip:'VIP'})[v]||v}
function slugify(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}

/* CONTABILIDAD */
async function loadFinance(){
  const month=$('#financeMonth')?.value||new Date().toISOString().slice(0,7);
  const start=month+'-01', end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),1).toISOString().slice(0,10);
  const {data,error}=await db.from('financial_movements').select('*,staff(name)').gte('movement_date',start).lt('movement_date',end).order('movement_date',{ascending:false}).order('created_at',{ascending:false});
  if(error)return toast('Error cargando contabilidad: '+error.message);
  financeMovements=data||[];renderFinance();
}
function renderFinance(){
  if(!$('#financeBody'))return;
  const income=financeMovements.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount),0);
  const expense=financeMovements.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount),0);
  $('#financeIncome').textContent=money(income);$('#financeExpense').textContent=money(expense);$('#financeBalance').textContent=money(income-expense);
  $('#financeBody').innerHTML=financeMovements.length?financeMovements.map(x=>`<tr>
    <td>${x.movement_date}</td><td>${x.type==='income'?'Ingreso':'Egreso'}</td><td>${esc(x.category)}</td>
    <td>${esc(x.description)}<small>${x.reference?` · ${esc(x.reference)}`:''}${x.staff?.name?` · ${esc(x.staff.name)}`:''}</small></td>
    <td>${methodLabel(x.payment_method)}</td><td class="${x.type==='income'?'positive':'negative'}">${x.type==='income'?'+':'−'}${money(x.amount)}</td>
    <td><button data-fin-edit="${x.id}">Editar</button> <button class="danger" data-fin-delete="${x.id}">Eliminar</button></td></tr>`).join(''):'<tr><td colspan="7">No hay movimientos en este mes.</td></tr>';
  $$('[data-fin-edit]').forEach(b=>b.onclick=()=>editFinance(b.dataset.finEdit));
  $$('[data-fin-delete]').forEach(b=>b.onclick=()=>deleteFinance(b.dataset.finDelete));
}
function resetFinance(){ $('#financeForm').reset();$('#financeId').value='';$('#financeDate').value=isoToday(); }
function editFinance(id){const x=financeMovements.find(v=>v.id===id);if(!x)return;$('#financeId').value=x.id;$('#financeType').value=x.type;$('#financeCategory').value=x.category;$('#financeAmount').value=x.amount;$('#financeMethod').value=x.payment_method;$('#financeDate').value=x.movement_date;$('#financeReference').value=x.reference||'';$('#financeDescription').value=x.description}
async function deleteFinance(id){if(!confirm('¿Eliminar este movimiento?'))return;const {error}=await db.from('financial_movements').delete().eq('id',id);if(error)return toast(error.message);await loadFinance()}
if($('#financeForm'))if(document.querySelector('#financeForm'))document.querySelector('#financeForm').onsubmit=async e=>{e.preventDefault();const id=$('#financeId').value;const row={type:$('#financeType').value,category:$('#financeCategory').value,amount:Number($('#financeAmount').value),payment_method:$('#financeMethod').value,movement_date:$('#financeDate').value,reference:$('#financeReference').value.trim(),description:$('#financeDescription').value.trim(),staff_id:currentEmployee?.id||null};const q=id?db.from('financial_movements').update(row).eq('id',id):db.from('financial_movements').insert(row);const {error}=await q;if(error)return toast(error.message);toast('Movimiento guardado');resetFinance();await loadFinance()};
if($('#clearFinance'))if(document.querySelector('#clearFinance'))document.querySelector('#clearFinance').onclick=resetFinance;
if($('#refreshFinance'))if(document.querySelector('#refreshFinance'))document.querySelector('#refreshFinance').onclick=loadFinance;
if($('#financeMonth')){$('#financeMonth').value=new Date().toISOString().slice(0,7);if(document.querySelector('#financeMonth'))document.querySelector('#financeMonth').onchange=loadFinance}
if($('#financeDate'))$('#financeDate').value=isoToday();

/* CLIENTES */

function fillPosCustomers(){
  const list=$('#posCustomerList');
  if(!list)return;

  const activeCustomers=customers.filter(customer=>customer.active!==false);
  list.innerHTML=activeCustomers.map(customer=>
    `<option value="${esc(customer.full_name)}" data-phone="${esc(customer.phone||'')}">${esc(customer.phone||customer.email||'Cliente registrado')}</option>`
  ).join('');
}

function syncSelectedPosCustomer(){
  const name=$('#posCustomer')?.value.trim().toLowerCase();
  if(!name)return;

  const customer=customers.find(item=>
    String(item.full_name||'').trim().toLowerCase()===name
  );

  if(customer&&$('#posPhone')){
    $('#posPhone').value=customer.phone||'';
  }
}

async function loadCustomers(){
  const {data,error}=await db.from('customers').select('*').order('updated_at',{ascending:false});
  if(error)return toast('Error cargando clientes: '+error.message);customers=data||[];renderCustomers();fillPosCustomers();
}
function filteredCustomers(){const q=($('#customerAdminSearch')?.value||'').toLowerCase();return customers.filter(c=>`${c.full_name} ${c.phone||''} ${c.email||''}`.toLowerCase().includes(q))}
function renderCustomers(){
  if(!$('#customerAdminList'))return;
  $('#customerCount').textContent=customers.length;$('#frequentCount').textContent=customers.filter(c=>c.tier==='frequent').length;$('#vipCount').textContent=customers.filter(c=>c.tier==='vip').length;
  $('#customerAdminList').innerHTML=filteredCustomers().map(c=>`<article class="customerCardAdmin">
    <div><b>${esc(c.full_name)}</b> <span class="customerTag">${tierLabel(c.tier)}</span>
    <small>📱 ${esc(c.phone||'Sin teléfono')} · ✉ ${esc(c.email||'Sin correo')}</small>
    <small>${c.order_count||0} pedidos · ${money(c.total_spent||0)} gastados · ${c.loyalty_points||0} puntos</small></div>
    <div><button data-customer-edit="${c.id}">Editar</button><button class="danger" data-customer-delete="${c.id}">Eliminar</button>${c.phone?`<a class="dark miniButton" target="_blank" href="https://wa.me/${String(c.phone).replace(/\D/g,'')}">WhatsApp</a>`:''}</div>
  </article>`).join('')||'<p>No hay clientes registrados.</p>';
  $$('[data-customer-edit]').forEach(b=>b.onclick=()=>editCustomer(b.dataset.customerEdit));$$('[data-customer-delete]').forEach(b=>b.onclick=()=>deleteCustomer(b.dataset.customerDelete));
}
function resetCustomer(){ $('#customerFormAdmin').reset();$('#customerIdAdmin').value='';$('#customerActiveAdmin').checked=true;$('#customerPoints').value=0; }
function editCustomer(id){const c=customers.find(v=>v.id===id);if(!c)return;$('#customerIdAdmin').value=c.id;$('#customerFullName').value=c.full_name;$('#customerPhoneAdmin').value=c.phone||'';$('#customerEmailAdmin').value=c.email||'';$('#customerBirthday').value=c.birthday||'';$('#customerAddressAdmin').value=c.address||'';$('#customerTier').value=c.tier||'new';$('#customerPoints').value=c.loyalty_points||0;$('#customerNotesAdmin').value=c.notes||'';$('#customerActiveAdmin').checked=c.active!==false}
async function deleteCustomer(id){if(!confirm('¿Eliminar este cliente?'))return;const {error}=await db.from('customers').delete().eq('id',id);if(error)return toast(error.message);await loadCustomers()}
if($('#customerFormAdmin'))if(document.querySelector('#customerFormAdmin'))document.querySelector('#customerFormAdmin').onsubmit=async e=>{e.preventDefault();const id=$('#customerIdAdmin').value;const row={full_name:$('#customerFullName').value.trim(),phone:$('#customerPhoneAdmin').value.trim(),email:$('#customerEmailAdmin').value.trim()||null,birthday:$('#customerBirthday').value||null,address:$('#customerAddressAdmin').value.trim(),tier:$('#customerTier').value,loyalty_points:Number($('#customerPoints').value||0),notes:$('#customerNotesAdmin').value.trim(),active:$('#customerActiveAdmin').checked};const q=id?db.from('customers').update(row).eq('id',id):db.from('customers').insert(row);const {error}=await q;if(error)return toast(error.message);toast('Cliente guardado');resetCustomer();await loadCustomers()};
if($('#clearCustomerAdmin'))if(document.querySelector('#clearCustomerAdmin'))document.querySelector('#clearCustomerAdmin').onclick=resetCustomer;
if($('#customerAdminSearch'))if(document.querySelector('#customerAdminSearch'))document.querySelector('#customerAdminSearch').oninput=renderCustomers;

/* PROMOCIONES */
let editingPromotionImage='';

async function loadPromotions(renderAdmin=true){
  const {data,error}=await db.from('promotions').select('*').order('sort_order').order('created_at',{ascending:false});
  if(error){
    console.warn('Error cargando promociones:',error);
    return;
  }
  promotions=data||[];
  renderHomePromotions();
  if(renderAdmin)renderAdminPromotions();
}

function promotionValid(p){
  const now=isoToday();
  return p.active&&(!p.starts_on||p.starts_on<=now)&&(!p.ends_on||p.ends_on>=now);
}

function promotionCard(p){
  return `<article class="promotionCard">
    ${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.title)}">`:''}
    <div class="promotionCardBody">
      ${p.badge?`<span class="promotionBadge">${esc(p.badge)}</span>`:''}
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.description)}</p>
      ${p.promo_price!=null?`<b class="promotionPrice">${money(p.promo_price)}</b>`:''}
      ${p.link_url?`<p><a href="${esc(p.link_url)}">Ver promoción →</a></p>`:''}
    </div>
  </article>`;
}

function renderHomePromotions(){
  const node=document.querySelector('#homePromotions');
  if(!node)return;
  const list=promotions.filter(p=>p.featured&&promotionValid(p)).slice(0,6);
  node.innerHTML=list.map(promotionCard).join('')||'<p class="notice">Próximamente tendremos nuevas promociones.</p>';
}

function renderAdminPromotions(){
  const node=document.querySelector('#adminPromotionList');
  if(!node)return;

  node.innerHTML=promotions.map(p=>`<article class="adminRow">
    <div>${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.title)}">`:'<div></div>'}</div>
    <div>
      <b>${esc(p.title)}</b>
      <small>${p.active?'Publicada':'Oculta'} · ${p.featured?'Destacada':'Normal'}</small>
    </div>
    <div class="adminRowActions">
      <button data-promo-edit="${p.id}">Editar</button>
      <button class="${p.active?'warning':'success'}" data-promo-toggle="${p.id}">${p.active?'Ocultar':'Publicar'}</button>
      <button class="danger" data-promo-delete="${p.id}">Eliminar</button>
    </div>
  </article>`).join('')||'<p>No hay promociones.</p>';

  $$('[data-promo-edit]').forEach(b=>b.onclick=()=>editPromotion(b.dataset.promoEdit));
  $$('[data-promo-toggle]').forEach(b=>b.onclick=()=>togglePromotion(b.dataset.promoToggle));
  $$('[data-promo-delete]').forEach(b=>b.onclick=()=>deletePromotion(b.dataset.promoDelete));
}

function updatePromotionPreview(src){
  const image=document.querySelector('#promotionPreviewImage');
  const empty=document.querySelector('#promotionNoImage');
  const remove=document.querySelector('#removePromotionImage');
  if(image){
    image.src=src||'';
    image.classList.toggle('hidden',!src);
  }
  empty?.classList.toggle('hidden',!!src);
  remove?.classList.toggle('hidden',!src);
}

function validatePromotionImage(file){
  if(!file)return;
  const allowed=['image/png','image/jpeg','image/webp'];
  if(!allowed.includes(file.type))throw new Error('La imagen debe ser PNG, JPG o WEBP');
  if(file.size>5*1024*1024)throw new Error('La imagen supera el máximo de 5 MB');
}

async function uploadPromotionImage(file){
  if(!file)return editingPromotionImage||'';
  validatePromotionImage(file);

  const extension={
    'image/png':'png',
    'image/jpeg':'jpg',
    'image/webp':'webp'
  }[file.type]||'jpg';

  const path=`promotions/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const {error}=await db.storage.from('product-images').upload(path,file,{
    cacheControl:'3600',
    upsert:false,
    contentType:file.type
  });
  if(error)throw error;
  return db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

function resetPromotion(){
  document.querySelector('#promotionForm')?.reset();
  $('#promotionId').value='';
  $('#promotionImage').value='';
  $('#promotionActive').checked=true;
  $('#promotionSort').value=0;
  $('#promotionImageFile').value='';
  editingPromotionImage='';
  updatePromotionPreview('');
  if(document.querySelector('#savePromotionBtn'))$('#savePromotionBtn').textContent='Guardar promoción';
}

function editPromotion(id){
  const p=promotions.find(v=>String(v.id)===String(id));
  if(!p)return;

  $('#promotionId').value=p.id;
  $('#promotionTitle').value=p.title;
  $('#promotionBadge').value=p.badge||'';
  $('#promotionDescription').value=p.description;
  $('#promotionPrice').value=p.promo_price??'';
  $('#promotionImage').value=p.image_url||'';
  $('#promotionStart').value=p.starts_on||'';
  $('#promotionEnd').value=p.ends_on||'';
  $('#promotionLink').value=p.link_url||'';
  $('#promotionSort').value=p.sort_order||0;
  $('#promotionFeatured').checked=!!p.featured;
  $('#promotionActive').checked=!!p.active;
  $('#promotionImageFile').value='';

  editingPromotionImage=p.image_url||'';
  updatePromotionPreview(editingPromotionImage);
  $('#savePromotionBtn').textContent='Actualizar promoción';
  document.querySelector('#promotionForm')?.scrollIntoView({behavior:'smooth',block:'start'});
}

async function togglePromotion(id){
  const p=promotions.find(v=>String(v.id)===String(id));
  if(!p)return;
  const {error}=await db.from('promotions').update({active:!p.active}).eq('id',id);
  if(error)return toast('No se pudo cambiar: '+error.message);
  await loadPromotions();
  toast(p.active?'Promoción ocultada':'Promoción publicada');
}

async function deletePromotion(id){
  const p=promotions.find(v=>String(v.id)===String(id));
  if(!p||!confirm(`¿Eliminar la promoción "${p.title}"?`))return;

  const {error}=await db.from('promotions').delete().eq('id',id);
  if(error)return toast('No se pudo eliminar: '+error.message);

  if(p.image_url)await removeStoredImage(p.image_url);
  if(String($('#promotionId').value)===String(id))resetPromotion();
  await loadPromotions();
  toast('Promoción eliminada');
}

if(document.querySelector('#promotionImageFile')){
  document.querySelector('#promotionImageFile').onchange=event=>{
    const file=event.target.files[0];
    if(!file)return;
    try{
      validatePromotionImage(file);
      updatePromotionPreview(URL.createObjectURL(file));
    }catch(error){
      event.target.value='';
      updatePromotionPreview(editingPromotionImage);
      toast(error.message);
    }
  };
}

if(document.querySelector('#removePromotionImage')){
  document.querySelector('#removePromotionImage').onclick=()=>{
    editingPromotionImage='';
    $('#promotionImage').value='';
    $('#promotionImageFile').value='';
    updatePromotionPreview('');
  };
}

if(document.querySelector('#clearPromotion')){
  document.querySelector('#clearPromotion').onclick=resetPromotion;
}

if(document.querySelector('#promotionForm')){
  document.querySelector('#promotionForm').onsubmit=async event=>{
    event.preventDefault();

    const button=$('#savePromotionBtn');
    const id=$('#promotionId').value;
    const previous=promotions.find(p=>String(p.id)===String(id));
    const previousImage=previous?.image_url||'';
    const file=$('#promotionImageFile').files[0];

    button.disabled=true;
    button.textContent=file?'Subiendo imagen...':'Guardando...';

    try{
      const imageUrl=await uploadPromotionImage(file);
      const row={
        title:$('#promotionTitle').value.trim(),
        badge:$('#promotionBadge').value.trim(),
        description:$('#promotionDescription').value.trim(),
        promo_price:$('#promotionPrice').value===''?null:Number($('#promotionPrice').value),
        image_url:imageUrl||null,
        starts_on:$('#promotionStart').value||null,
        ends_on:$('#promotionEnd').value||null,
        link_url:$('#promotionLink').value.trim(),
        sort_order:Number($('#promotionSort').value||0),
        featured:$('#promotionFeatured').checked,
        active:$('#promotionActive').checked
      };

      const query=id
        ?db.from('promotions').update(row).eq('id',id)
        :db.from('promotions').insert(row);

      const {error}=await query;
      if(error)throw error;

      if(id&&previousImage&&previousImage!==imageUrl){
        await removeStoredImage(previousImage);
      }

      toast(id?'Promoción actualizada':'Promoción creada');
      resetPromotion();
      await loadPromotions();
    }catch(error){
      console.error('Error guardando promoción:',error);
      toast('No se pudo guardar: '+(error.message||'Error desconocido'));
    }finally{
      button.disabled=false;
      button.textContent=$('#promotionId').value?'Actualizar promoción':'Guardar promoción';
    }
  };
}

async function loadContentPages(){const {data,error}=await db.from('content_pages').select('*').order('sort_order').order('created_at',{ascending:false});if(error)return toast('Error cargando páginas: '+error.message);contentPages=data||[];renderAdminPages()}
function renderAdminPages(){if(!$('#adminPageList'))return;$('#adminPageList').innerHTML=contentPages.map(p=>`<article class="adminRow"><div></div><div><b>${esc(p.title)}</b><small>/pagina/${esc(p.slug)} · ${p.published?'Publicada':'Borrador'}</small></div><a class="dark miniButton" target="_blank" href="/pagina/${esc(p.slug)}">Ver</a><button data-page-edit="${p.id}">Editar</button><button class="danger" data-page-delete="${p.id}">Eliminar</button></article>`).join('')||'<p>No hay páginas.</p>';$$('[data-page-edit]').forEach(b=>b.onclick=()=>editPage(b.dataset.pageEdit));$$('[data-page-delete]').forEach(b=>b.onclick=()=>deletePage(b.dataset.pageDelete))}
function resetPage(){$('#pageForm').reset();$('#pageId').value='';$('#pagePublished').checked=true;$('#pageSort').value=0}
function editPage(id){const p=contentPages.find(v=>v.id===id);if(!p)return;$('#pageId').value=p.id;$('#pageTitle').value=p.title;$('#pageSlug').value=p.slug;$('#pageSummary').value=p.summary||'';$('#pageHeroImage').value=p.hero_image||'';$('#pageContent').value=p.content;$('#pageButtonText').value=p.button_text||'';$('#pageButtonLink').value=p.button_link||'';$('#pageSort').value=p.sort_order||0;$('#pageShowMenu').checked=p.show_in_menu;$('#pagePublished').checked=p.published}
async function deletePage(id){if(!confirm('¿Eliminar página?'))return;const {error}=await db.from('content_pages').delete().eq('id',id);if(error)return toast(error.message);await loadContentPages()}
if($('#pageTitle'))if(document.querySelector('#pageTitle'))document.querySelector('#pageTitle').oninput=()=>{if(!$('#pageId').value)$('#pageSlug').value=slugify($('#pageTitle').value)};
if($('#pageForm'))if(document.querySelector('#pageForm'))document.querySelector('#pageForm').onsubmit=async e=>{e.preventDefault();const id=$('#pageId').value;const row={title:$('#pageTitle').value.trim(),slug:slugify($('#pageSlug').value),summary:$('#pageSummary').value.trim(),hero_image:$('#pageHeroImage').value.trim(),content:$('#pageContent').value.trim(),button_text:$('#pageButtonText').value.trim(),button_link:$('#pageButtonLink').value.trim(),sort_order:Number($('#pageSort').value||0),show_in_menu:$('#pageShowMenu').checked,published:$('#pagePublished').checked};const q=id?db.from('content_pages').update(row).eq('id',id):db.from('content_pages').insert(row);const {error}=await q;if(error)return toast(error.message);toast('Página guardada');resetPage();await loadContentPages()};
if($('#clearPage'))if(document.querySelector('#clearPage'))document.querySelector('#clearPage').onclick=resetPage;




init();

$$('[data-close="employeeLoginModal"]').forEach(b=>b.onclick=()=>$('#employeeLoginModal').classList.add('hidden'));
$$('[data-close="tableOrderModal"]').forEach(b=>b.onclick=()=>$('#tableOrderModal').classList.add('hidden'));


/* ===== SUBIDA DE IMÁGENES PARA PÁGINAS ===== */
(function initPageImageUploader(){
  const STORAGE_BUCKET = 'page-images';

  function getSupabaseClient(){
    return window.mordiscoSupabaseClient ||
      window.supabaseClient ||
      window.sb ||
      window.supabaseAdmin ||
      null;
  }

  function sanitizeFileName(name){
    return String(name || 'imagen')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9._-]+/g,'-')
      .replace(/-+/g,'-')
      .toLowerCase();
  }

  function setup(){
    const fileInput = document.querySelector('#pageImageFile');
    const selectBtn = document.querySelector('#pageImageSelectBtn');
    const uploadBtn = document.querySelector('#pageImageUploadBtn');
    const status = document.querySelector('#pageImageUploadStatus');
    const preview = document.querySelector('#pageImagePreview');
    const urlInput = document.querySelector('#pageImageUrl') ||
      document.querySelector('input[name="image_url"]');

    if(!fileInput || !selectBtn || !uploadBtn || !status || !urlInput) return;

    let selectedFile = null;

    selectBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      selectedFile = fileInput.files?.[0] || null;
      if(!selectedFile){
        uploadBtn.disabled = true;
        status.textContent = 'Ningún archivo seleccionado';
        preview.hidden = true;
        return;
      }

      const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
      if(!allowed.includes(selectedFile.type)){
        selectedFile = null;
        fileInput.value = '';
        uploadBtn.disabled = true;
        status.textContent = 'Formato no permitido. Usa JPG, PNG, WEBP o GIF.';
        preview.hidden = true;
        return;
      }

      if(selectedFile.size > 5 * 1024 * 1024){
        selectedFile = null;
        fileInput.value = '';
        uploadBtn.disabled = true;
        status.textContent = 'La imagen supera 5 MB.';
        preview.hidden = true;
        return;
      }

      uploadBtn.disabled = false;
      status.textContent = `${selectedFile.name} · ${(selectedFile.size/1024/1024).toFixed(2)} MB`;
      preview.src = URL.createObjectURL(selectedFile);
      preview.hidden = false;
    });

    uploadBtn.addEventListener('click', async () => {
      if(!selectedFile) return;

      const client = getSupabaseClient();
      if(!client){
        status.textContent = 'No se encontró la conexión con Supabase.';
        return;
      }

      uploadBtn.disabled = true;
      selectBtn.disabled = true;
      status.textContent = 'Subiendo imagen…';

      try{
        const ext = selectedFile.name.split('.').pop() || 'jpg';
        const base = sanitizeFileName(selectedFile.name.replace(/\.[^.]+$/,''));
        const path = `pages/${Date.now()}-${base}.${ext.toLowerCase()}`;

        const { error: uploadError } = await client.storage
          .from(STORAGE_BUCKET)
          .upload(path, selectedFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: selectedFile.type
          });

        if(uploadError) throw uploadError;

        const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        if(!data?.publicUrl) throw new Error('No se pudo obtener la URL pública.');

        urlInput.value = data.publicUrl;
        urlInput.dispatchEvent(new Event('input', { bubbles:true }));
        urlInput.dispatchEvent(new Event('change', { bubbles:true }));

        status.textContent = 'Imagen subida correctamente.';
        status.style.color = '#147a32';
      }catch(error){
        console.error('Error al subir imagen de página:', error);
        const msg = String(error?.message || 'Error desconocido');
        status.textContent = /bucket not found/i.test(msg)
          ? 'Falta crear el bucket page-images en Supabase Storage.'
          : `No se pudo subir: ${msg}`;
        status.style.color = '#a1261d';
      }finally{
        uploadBtn.disabled = false;
        selectBtn.disabled = false;
      }
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', setup, { once:true });
  }else{
    setup();
  }
})();


/* ===== HORARIOS DE ATENCIÓN ===== */
const WEEK_DAYS=[
  {day:1,label:'Lunes'},{day:2,label:'Martes'},{day:3,label:'Miércoles'},
  {day:4,label:'Jueves'},{day:5,label:'Viernes'},{day:6,label:'Sábado'},
  {day:0,label:'Domingo'}
];

async function loadBusinessHours(){
  const {data,error}=await db.from('business_hours').select('*').order('sort_order');
  if(error){
    console.warn('Horarios:',error.message);
    businessHours=[];
  }else{
    businessHours=data||[];
  }
  renderBusinessHours();
}

function renderBusinessHours(){
  const node=$('#businessHoursEditor');
  if(!node)return;
  node.innerHTML=WEEK_DAYS.map((item,index)=>{
    const row=businessHours.find(x=>Number(x.day_of_week)===item.day)||{
      day_of_week:item.day,closed:false,opens_at:'11:00',closes_at:'22:00'
    };
    return `<div class="businessHourRow" data-hour-day="${item.day}">
      <strong>${item.label}</strong>
      <label><input type="checkbox" class="hourClosed" ${row.closed?'checked':''}> Cerrado</label>
      <input type="time" class="hourOpen" value="${String(row.opens_at||'11:00').slice(0,5)}" ${row.closed?'disabled':''}>
      <span>—</span>
      <input type="time" class="hourClose" value="${String(row.closes_at||'22:00').slice(0,5)}" ${row.closed?'disabled':''}>
    </div>`;
  }).join('');

  $$('.hourClosed').forEach(input=>input.onchange=()=>{
    const row=input.closest('.businessHourRow');
    row.querySelector('.hourOpen').disabled=input.checked;
    row.querySelector('.hourClose').disabled=input.checked;
  });
}

function buildScheduleSummary(rows){
  const openRows=rows.filter(x=>!x.closed);
  if(!openRows.length)return 'Cerrado toda la semana';
  const grouped=[];
  for(const row of openRows){
    const label=WEEK_DAYS.find(x=>x.day===row.day_of_week)?.label||'Día';
    grouped.push(`${label}: ${String(row.opens_at).slice(0,5)}–${String(row.closes_at).slice(0,5)}`);
  }
  return grouped.join(' · ');
}

async function saveBusinessHours(){
  const rows=$$('[data-hour-day]').map((node,index)=>({
    day_of_week:Number(node.dataset.hourDay),
    closed:node.querySelector('.hourClosed').checked,
    opens_at:node.querySelector('.hourOpen').value||'11:00',
    closes_at:node.querySelector('.hourClose').value||'22:00',
    sort_order:index
  }));
  const {error}=await db.from('business_hours').upsert(rows,{onConflict:'day_of_week'});
  if(error)return toast('No se guardaron los horarios: '+error.message);
  businessHours=rows;
  const summary=buildScheduleSummary(rows);
  if($('#sSchedule'))$('#sSchedule').value=summary;
  const settingsRow={...settings,id:1,schedule:summary};
  const {error:settingsError}=await db.from('business_settings').upsert(settingsRow);
  if(settingsError)return toast('Horarios guardados, pero no se actualizó el resumen: '+settingsError.message);
  settings=settingsRow;
  applySettings();
  toast('Horarios de atención guardados');
}
$('#saveBusinessHours')?.addEventListener('click',saveBusinessHours);

/* ===== CUENTAS POR COBRAR Y PAGAR ===== */
async function loadFinanceAccounts(){
  const {data,error}=await db.from('finance_accounts').select('*').order('due_date',{ascending:true}).order('created_at',{ascending:false});
  if(error){
    console.warn('Cuentas:',error.message);
    financeAccounts=[];
    if($('#financeAccountsBody'))$('#financeAccountsBody').innerHTML='<tr><td colspan="9">Ejecuta el SQL 03 para activar cuentas por cobrar y pagar.</td></tr>';
    return;
  }
  financeAccounts=data||[];
  renderFinanceAccounts();
}

function accountStatusLabel(status){
  return ({pending:'Pendiente',partial:'Pago parcial',paid:'Pagada'})[status]||status;
}

function filteredFinanceAccounts(){
  const filter=$('#financeAccountFilter')?.value||'all';
  const today=isoToday();
  return financeAccounts.filter(x=>{
    if(filter==='all')return true;
    if(filter==='overdue')return x.status!=='paid'&&x.due_date<today;
    if(filter==='paid')return x.status==='paid';
    return x.kind===filter;
  });
}

function renderFinanceAccounts(){
  if(!$('#financeAccountsBody'))return;
  const pending=financeAccounts.filter(x=>x.status!=='paid');
  const receivable=pending.filter(x=>x.kind==='receivable').reduce((s,x)=>s+Math.max(0,Number(x.amount)-Number(x.paid_amount||0)),0);
  const payable=pending.filter(x=>x.kind==='payable').reduce((s,x)=>s+Math.max(0,Number(x.amount)-Number(x.paid_amount||0)),0);
  const overdue=pending.filter(x=>x.due_date<isoToday()).length;
  $('#accountsReceivableTotal').textContent=money(receivable);
  $('#accountsPayableTotal').textContent=money(payable);
  $('#accountsOverdueCount').textContent=overdue;

  const rows=filteredFinanceAccounts();
  $('#financeAccountsBody').innerHTML=rows.length?rows.map(x=>{
    const balance=Math.max(0,Number(x.amount)-Number(x.paid_amount||0));
    const overdue=x.status!=='paid'&&x.due_date<isoToday();
    const statusClass=x.status==='paid'?'accountPaid':overdue?'accountOverdue':'accountPending';
    return `<tr>
      <td class="${overdue?'accountOverdue':''}">${x.due_date}</td>
      <td>${x.kind==='receivable'?'Por cobrar':'Por pagar'}</td>
      <td>${esc(x.party_name)}</td>
      <td>${esc(x.description)}<small>${x.reference?` · ${esc(x.reference)}`:''}</small></td>
      <td>${money(x.amount)}</td>
      <td>${money(x.paid_amount||0)}</td>
      <td><b>${money(balance)}</b></td>
      <td class="${statusClass}">${overdue?'Vencida':accountStatusLabel(x.status)}</td>
      <td>
        <button data-account-edit="${x.id}">Editar</button>
        ${x.status!=='paid'?`<button class="primary" data-account-paid="${x.id}">Marcar pagada</button>`:''}
        <button class="danger" data-account-delete="${x.id}">Eliminar</button>
      </td>
    </tr>`;
  }).join(''):'<tr><td colspan="9">No hay cuentas registradas.</td></tr>';

  $$('[data-account-edit]').forEach(b=>b.onclick=()=>editFinanceAccount(b.dataset.accountEdit));
  $$('[data-account-paid]').forEach(b=>b.onclick=()=>markFinanceAccountPaid(b.dataset.accountPaid));
  $$('[data-account-delete]').forEach(b=>b.onclick=()=>deleteFinanceAccount(b.dataset.accountDelete));
}

function resetFinanceAccount(){
  $('#financeAccountForm')?.reset();
  if($('#financeAccountId'))$('#financeAccountId').value='';
  if($('#financeAccountDue'))$('#financeAccountDue').value=isoToday();
  if($('#financeAccountPaid'))$('#financeAccountPaid').value=0;
}

function editFinanceAccount(id){
  const x=financeAccounts.find(v=>String(v.id)===String(id));
  if(!x)return;
  $('#financeAccountId').value=x.id;
  $('#financeAccountKind').value=x.kind;
  $('#financeAccountParty').value=x.party_name;
  $('#financeAccountAmount').value=x.amount;
  $('#financeAccountDue').value=x.due_date;
  $('#financeAccountStatus').value=x.status;
  $('#financeAccountPaid').value=x.paid_amount||0;
  $('#financeAccountMethod').value=x.payment_method||'cash';
  $('#financeAccountReference').value=x.reference||'';
  $('#financeAccountDescription').value=x.description;
}

async function markFinanceAccountPaid(id){
  const x=financeAccounts.find(v=>String(v.id)===String(id));
  if(!x)return;
  const {error}=await db.from('finance_accounts').update({
    status:'paid',
    paid_amount:Number(x.amount),
    paid_at:new Date().toISOString()
  }).eq('id',id);
  if(error)return toast(error.message);
  toast('Cuenta marcada como pagada');
  await loadFinanceAccounts();
}

async function deleteFinanceAccount(id){
  if(!confirm('¿Eliminar esta cuenta?'))return;
  const {error}=await db.from('finance_accounts').delete().eq('id',id);
  if(error)return toast(error.message);
  await loadFinanceAccounts();
}

$('#financeAccountForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const id=$('#financeAccountId').value;
  const amount=Number($('#financeAccountAmount').value);
  let paid=Number($('#financeAccountPaid').value||0);
  let status=$('#financeAccountStatus').value;
  if(paid>=amount){paid=amount;status='paid'}
  else if(paid>0)status='partial';
  else if(status==='paid'){paid=amount}
  const row={
    kind:$('#financeAccountKind').value,
    party_name:$('#financeAccountParty').value.trim(),
    description:$('#financeAccountDescription').value.trim(),
    amount,
    due_date:$('#financeAccountDue').value,
    status,
    paid_amount:paid,
    payment_method:$('#financeAccountMethod').value,
    reference:$('#financeAccountReference').value.trim(),
    paid_at:status==='paid'?new Date().toISOString():null
  };
  const q=id?db.from('finance_accounts').update(row).eq('id',id):db.from('finance_accounts').insert(row);
  const {error}=await q;
  if(error)return toast(error.message);
  toast('Cuenta guardada');
  resetFinanceAccount();
  await loadFinanceAccounts();
});
$('#clearFinanceAccount')?.addEventListener('click',resetFinanceAccount);
$('#financeAccountFilter')?.addEventListener('change',renderFinanceAccounts);

/* Integrar las nuevas cargas con las pantallas existentes */
const _originalLoadFinance=loadFinance;
loadFinance=async function(){
  await Promise.all([_originalLoadFinance(),loadFinanceAccounts()]);
};
const _originalFillSettings=fillSettings;
fillSettings=function(){
  _originalFillSettings();
  loadBusinessHours();
};
resetFinanceAccount();


/* ===== EXTRAS Y EMPAQUES ===== */
async function loadExtraOptions(){
  const {data,error}=await db
    .from('extra_options')
    .select('*,categories(id,name)')
    .order('sort_order',{ascending:true})
    .order('name',{ascending:true});

  if(error){
    console.warn('Extras:',error.message);
    extraOptions=[];
    if($('#extraOptionsList')){
      $('#extraOptionsList').innerHTML='<div class="emptyState">Ejecuta el SQL 06 para activar extras y empaques.</div>';
    }
    return;
  }

  extraOptions=data||[];
  renderExtraOptions();
  fillExtraCategoryOptions();
}

function fillExtraCategoryOptions(){
  const select=$('#extraOptionCategory');
  if(!select)return;
  const current=select.value;
  select.innerHTML='<option value="">Todas las categorías</option>'+
    categories.filter(x=>x.active!==false).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
  if([...select.options].some(o=>o.value===current))select.value=current;
}

function extraTypeLabel(type){
  return type==='packaging'?'Empaque especial':'Extra de producto';
}

function renderExtraOptions(){
  const node=$('#extraOptionsList');
  if(!node)return;

  if(!extraOptions.length){
    node.innerHTML='<div class="emptyState">No hay extras ni empaques creados.</div>';
    return;
  }

  node.innerHTML=extraOptions.map(option=>`
    <article class="extraOptionCard">
      <div>
        <h4>${esc(option.name)}</h4>
        <small>${esc(option.description||'Sin descripción')}</small>
        <div class="extraOptionMeta">
          <span>${extraTypeLabel(option.option_type)}</span>
          <span>${money(option.price)}</span>
          <span>${option.categories?.name ? esc(option.categories.name) : 'Todas las categorías'}</span>
          <span>${option.active?'Disponible':'Oculto'}</span>
          ${option.featured?'<span>Destacado</span>':''}
        </div>
      </div>
      <div class="extraOptionActions">
        <button data-extra-edit="${option.id}">Editar</button>
        <button data-extra-toggle="${option.id}" class="${option.active?'warning':'primary'}">${option.active?'Ocultar':'Publicar'}</button>
        <button data-extra-delete="${option.id}" class="danger">Eliminar</button>
      </div>
    </article>
  `).join('');

  $$('[data-extra-edit]').forEach(btn=>btn.onclick=()=>editExtraOption(btn.dataset.extraEdit));
  $$('[data-extra-toggle]').forEach(btn=>btn.onclick=()=>toggleExtraOption(btn.dataset.extraToggle));
  $$('[data-extra-delete]').forEach(btn=>btn.onclick=()=>deleteExtraOption(btn.dataset.extraDelete));
}

function resetExtraOptionForm(){
  $('#extraOptionForm')?.reset();
  if($('#extraOptionId'))$('#extraOptionId').value='';
  if($('#extraOptionActive'))$('#extraOptionActive').checked=true;
  if($('#extraOptionOrder'))$('#extraOptionOrder').value=0;
}

function editExtraOption(id){
  const option=extraOptions.find(x=>String(x.id)===String(id));
  if(!option)return;

  $('#extraOptionId').value=option.id;
  $('#extraOptionName').value=option.name||'';
  $('#extraOptionType').value=option.option_type||'extra';
  $('#extraOptionPrice').value=option.price||0;
  $('#extraOptionCategory').value=option.category_id||'';
  $('#extraOptionDescription').value=option.description||'';
  $('#extraOptionOrder').value=option.sort_order||0;
  $('#extraOptionActive').checked=option.active!==false;
  $('#extraOptionFeatured').checked=!!option.featured;
}

async function toggleExtraOption(id){
  const option=extraOptions.find(x=>String(x.id)===String(id));
  if(!option)return;
  const {error}=await db.from('extra_options').update({active:!option.active}).eq('id',id);
  if(error)return toast(error.message);
  await loadExtraOptions();
}

async function deleteExtraOption(id){
  if(!confirm('¿Eliminar esta opción?'))return;
  const {error}=await db.from('extra_options').delete().eq('id',id);
  if(error)return toast(error.message);
  await loadExtraOptions();
}

$('#extraOptionForm')?.addEventListener('submit',async event=>{
  event.preventDefault();

  const id=$('#extraOptionId').value;
  const row={
    name:$('#extraOptionName').value.trim(),
    option_type:$('#extraOptionType').value,
    price:Number($('#extraOptionPrice').value||0),
    category_id:$('#extraOptionCategory').value||null,
    description:$('#extraOptionDescription').value.trim(),
    sort_order:Number($('#extraOptionOrder').value||0),
    active:$('#extraOptionActive').checked,
    featured:$('#extraOptionFeatured').checked
  };

  const query=id
    ? db.from('extra_options').update(row).eq('id',id)
    : db.from('extra_options').insert(row);

  const {error}=await query;
  if(error)return toast(error.message);

  toast('Opción guardada');
  resetExtraOptionForm();
  await loadExtraOptions();
});

$('#clearExtraOption')?.addEventListener('click',resetExtraOptionForm);

/* Cargar extras junto con el resto del administrador */
const _originalLoadCategoriesForExtras=loadCategories;
loadCategories=async function(){
  await _originalLoadCategoriesForExtras();
  fillExtraCategoryOptions();
};

document.addEventListener('DOMContentLoaded',loadExtraOptions);


/* ===== CAMBIO DE CONTRASEÑA DEL ADMINISTRADOR ===== */
document.querySelector('#changeAdminPasswordForm')?.addEventListener('submit',async event=>{
  event.preventDefault();

  const password=document.querySelector('#newAdminPassword').value;
  const confirm=document.querySelector('#confirmAdminPassword').value;
  const button=document.querySelector('#changeAdminPasswordButton');

  if(password.length<8)return toast('La contraseña debe tener al menos 8 caracteres');
  if(password!==confirm)return toast('Las contraseñas no coinciden');

  button.disabled=true;
  button.textContent='Guardando…';

  const {error}=await db.auth.updateUser({password});

  button.disabled=false;
  button.textContent='Cambiar mi contraseña';

  if(error)return toast(error.message||'No se pudo cambiar la contraseña');

  event.target.reset();
  toast('Contraseña actualizada correctamente');
});



/* ===== CONTROL ADMINISTRATIVO DE CAJA ===== */
async function loadCashRegisterState(){
  const {data,error}=await db.from('cash_register_state').select('*').eq('id',1).maybeSingle();
  if(error){
    console.warn('Estado de caja:',error);
    return;
  }
  cashRegisterState=data||{id:1,is_open:false};
  renderCashRegisterState();
}

function renderCashRegisterState(){
  const isOpen=!!cashRegisterState?.is_open;
  document.body.classList.toggle('cashRegisterClosed',!isOpen);

  const badge=$('#cashRegisterBadge');
  if(badge){
    badge.textContent=isOpen?'Caja abierta':'Caja cerrada';
    badge.className='cashRegisterBadge '+(isOpen?'open':'closed');
  }

  if($('#cashRegisterMessage')){
    $('#cashRegisterMessage').textContent=isOpen
      ? `Abierta${cashRegisterState.opened_at?' desde '+new Date(cashRegisterState.opened_at).toLocaleString('es-EC'):''}.`
      : `Cerrada${cashRegisterState.closed_at?' desde '+new Date(cashRegisterState.closed_at).toLocaleString('es-EC'):''}.`;
  }

  $('#openCashRegisterBtn')?.classList.toggle('hidden',isOpen);
  $('#closeCashRegisterBtn')?.classList.toggle('hidden',!isOpen);
  $('#cashRegisterClosedNotice')?.classList.toggle('hidden',isOpen||isAdminSession);

  const cashierBlocked=currentEmployee?.role==='cashier'&&!isOpen;
  ['#posCreateOrder','#posCharge','#sendPosOrder','#chargeOrderConfirm'].forEach(selector=>{
    const node=$(selector);
    if(node)node.disabled=cashierBlocked;
  });
}

async function setCashRegisterState(isOpen){
  if(!isAdminSession)return toast('Solo el administrador puede abrir o cerrar la caja');
  const {data:{user}}=await db.auth.getUser();
  const row={
    id:1,
    is_open:isOpen,
    opened_at:isOpen?new Date().toISOString():cashRegisterState?.opened_at,
    closed_at:!isOpen?new Date().toISOString():null,
    changed_by:user?.id||null,
    updated_at:new Date().toISOString()
  };
  const {error}=await db.from('cash_register_state').upsert(row);
  if(error)return toast(error.message);
  toast(isOpen?'Caja abierta correctamente':'Caja cerrada correctamente');
  await loadCashRegisterState();
}

$('#openCashRegisterBtn')?.addEventListener('click',()=>setCashRegisterState(true));
$('#closeCashRegisterBtn')?.addEventListener('click',()=>{
  if(confirm('¿Cerrar la caja? Los cajeros no podrán registrar ni cobrar ventas.'))setCashRegisterState(false);
});

/* Bloqueo adicional antes de acciones de cobro o venta */
document.addEventListener('click',event=>{
  if(currentEmployee?.role!=='cashier'||cashRegisterState?.is_open)return;
  const action=event.target.closest?.('#posCreateOrder,#posCharge,#sendPosOrder,#chargeOrderConfirm,.chargeOrderBtn');
  if(action){
    event.preventDefault();
    event.stopImmediatePropagation();
    toast('La caja está cerrada. Solicita al administrador que la abra.');
  }
},true);



/* ===== CORRECCIÓN DEFINITIVA: MODALES DE COBRO Y NUEVA VENTA ===== */
function mordiscoCloseOverlay(node){
  if(!node)return;
  node.classList.add('hidden');
  node.classList.remove('show','open','active');
  node.setAttribute('aria-hidden','true');
  node.style.removeProperty('display');
  document.body.classList.remove('modal-open','no-scroll');
  document.documentElement.classList.remove('modal-open','no-scroll');
}

function mordiscoClosePaymentModals(){
  [
    '#chargeModal',
    '#paymentModal',
    '#receiptModal',
    '#saleReceiptModal',
    '#posChargeModal',
    '#orderReceiptModal'
  ].forEach(selector=>mordiscoCloseOverlay($(selector)));

  $$('.modal,.overlay,.dialogBackdrop').forEach(node=>{
    const text=(node.textContent||'').toLowerCase();
    if(
      text.includes('cobro de venta')||
      text.includes('comprobante de venta')||
      text.includes('confirmar cobro')||
      text.includes('nueva venta')
    ){
      mordiscoCloseOverlay(node);
    }
  });
}

function mordiscoResetPosAfterSale(){
  try{
    if(Array.isArray(posCart))posCart.length=0;
  }catch{}
  try{
    if(typeof posCart!=='undefined')posCart=[];
  }catch{}
  try{
    if(typeof currentPosOrder!=='undefined')currentPosOrder=null;
  }catch{}
  try{
    if(typeof selectedOrderForCharge!=='undefined')selectedOrderForCharge=null;
  }catch{}

  [
    '#posCustomerName',
    '#posCustomerPhone',
    '#posNotes',
    '#posDiscountValue'
  ].forEach(selector=>{
    const input=$(selector);
    if(input)input.value='';
  });

  const discountType=$('#posDiscountType');
  if(discountType)discountType.value='none';

  if(typeof renderPosCart==='function'){
    try{renderPosCart()}catch(error){console.warn('Reinicio POS:',error)}
  }
  if(typeof renderPOS==='function'){
    try{renderPOS()}catch(error){console.warn('Reinicio POS:',error)}
  }

  mordiscoClosePaymentModals();
  setTimeout(()=>mordiscoClosePaymentModals(),60);
  setTimeout(()=>mordiscoClosePaymentModals(),250);
}

/* Cerrar con cualquier X dentro de un modal de cobro/comprobante */
document.addEventListener('click',event=>{
  const closeButton=event.target.closest?.(
    '[data-close-modal],.modalClose,.closeModal,.receiptClose,.dialogClose,button[aria-label="Cerrar"]'
  );

  if(closeButton){
    const modal=closeButton.closest('.modal,.overlay,.dialogBackdrop,[role="dialog"]');
    const text=(modal?.textContent||'').toLowerCase();
    if(
      text.includes('cobro de venta')||
      text.includes('comprobante de venta')||
      text.includes('confirmar cobro')||
      text.includes('nueva venta')
    ){
      event.preventDefault();
      event.stopImmediatePropagation();
      mordiscoCloseOverlay(modal);
    }
  }

  const newSaleButton=event.target.closest?.(
    '#newSaleBtn,#newOrderBtn,#receiptNewSale,.newSaleBtn,[data-action="new-sale"]'
  );

  if(newSaleButton){
    event.preventDefault();
    event.stopImmediatePropagation();
    mordiscoResetPosAfterSale();
    toast('Lista una nueva venta');
  }
},true);

/* Cerrar al pulsar el fondo oscuro */
document.addEventListener('click',event=>{
  const overlay=event.target;
  if(!overlay?.matches?.('.modal,.overlay,.dialogBackdrop'))return;
  const text=(overlay.textContent||'').toLowerCase();
  if(
    text.includes('cobro de venta')||
    text.includes('comprobante de venta')||
    text.includes('confirmar cobro')||
    text.includes('nueva venta')
  ){
    mordiscoCloseOverlay(overlay);
  }
});

/* Escape también cierra */
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')mordiscoClosePaymentModals();
});

/* Después de un cobro exitoso, garantizar que el modal de cobro se retire */
document.addEventListener('mordisco:sale-completed',()=>{
  mordiscoClosePaymentModals();
});


$('#posCustomer')?.addEventListener('change',syncSelectedPosCustomer);
$('#posCustomer')?.addEventListener('input',()=>{
  const exact=customers.some(customer=>
    String(customer.full_name||'').trim().toLowerCase()===
    String($('#posCustomer').value||'').trim().toLowerCase()
  );
  if(exact)syncSelectedPosCustomer();
});




/* ===== PERMISOS SOLO PARA NAVEGACIÓN LATERAL ===== */
function mordiscoEmployeeAllowedTabs(){
  let employee=currentEmployee||null;
  if(!employee){
    try{employee=JSON.parse(localStorage.getItem('mordisco_employee')||'null')}catch{}
  }
  if(!employee)return [];

  const defaults={
    cashier:['pos'],
    kitchen:['kitchen'],
    waiter:['comandas']
  };

  return Array.isArray(employee.permissions)&&employee.permissions.length
    ? [...new Set(employee.permissions)]
    : (defaults[employee.role]||[]);
}

document.addEventListener('click',event=>{
  if(!document.body.classList.contains('employeeMode'))return;

  // Solo bloquea enlaces/botones del menú lateral.
  const navButton=event.target.closest?.('.sidebar > [data-tab], .sidebar nav [data-tab]');
  if(!navButton)return;

  const allowed=mordiscoEmployeeAllowedTabs();
  if(!allowed.includes(navButton.dataset.tab)){
    event.preventDefault();
    event.stopImmediatePropagation();
    toast('No tienes permiso para abrir esta sección');
  }
},true);


/* BOTONES DE COCINA NO PARTICIPAN EN LA VALIDACIÓN DEL MENÚ */
document.addEventListener('click',event=>{
  const kitchenButton=event.target.closest?.('[data-kitchen-order]');
  if(!kitchenButton)return;
  event.stopPropagation();
},false);


/* ===== COCINA: ACTUALIZACIÓN AUTOMÁTICA, DETALLE Y SONIDO ===== */
function kitchenIsVisible(){
  const tab=$('#tab-kitchen');
  return !!tab&&!tab.classList.contains('hidden');
}

async function kitchenUnlockSound(showTest=true){
  try{
    if(!kitchenAudioContext){
      kitchenAudioContext=new (window.AudioContext||window.webkitAudioContext)();
    }
    if(kitchenAudioContext.state==='suspended'){
      await kitchenAudioContext.resume();
    }
    localStorage.setItem('mordisco_kitchen_sound','1');
    if($('#kitchenSound'))$('#kitchenSound').checked=true;
    if(showTest)kitchenPlaySound(true);
  }catch(error){
    console.warn('No se pudo activar sonido:',error);
    toast('El navegador bloqueó el sonido. Sube el volumen y toca Sonido otra vez.');
  }
}

function kitchenPlaySound(test=false){
  if(!test&&!$('#kitchenSound')?.checked)return;

  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!kitchenAudioContext)kitchenAudioContext=new AudioCtx();
    const ctx=kitchenAudioContext;

    if(ctx.state==='suspended')ctx.resume();

    const now=ctx.currentTime;
    const master=ctx.createGain();
    master.gain.setValueAtTime(0.95,now);
    master.connect(ctx.destination);

    const sequence=[
      [880,0.00,.28],
      [1175,0.32,.28],
      [1480,0.64,.34],
      [1175,1.05,.28],
      [1480,1.37,.40]
    ];

    sequence.forEach(([frequency,offset,duration])=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();

      osc.type='square';
      osc.frequency.setValueAtTime(frequency,now+offset);
      osc.connect(gain);
      gain.connect(master);

      gain.gain.setValueAtTime(0.0001,now+offset);
      gain.gain.exponentialRampToValueAtTime(0.72,now+offset+.025);
      gain.gain.setValueAtTime(0.72,now+offset+duration-.05);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+duration);

      osc.start(now+offset);
      osc.stop(now+offset+duration+.02);
    });

    if(navigator.vibrate&&!test){
      navigator.vibrate([300,120,300,120,500]);
    }
  }catch(error){
    console.warn('Error de sonido de Cocina:',error);
  }
}

async function loadKitchenOrdersReliable({notify=true}={}){
  const {data,error}=await db.rpc('kitchen_get_active_orders');

  if(error){
    console.warn('Lectura segura de Cocina:',error);
    // Mantener el método normal como respaldo.
    await loadOrders();
    return;
  }

  const active=Array.isArray(data)?data:[];
  const activeNumbers=new Set(active.map(order=>Number(order.order_number)));
  const previousPending=new Set(kitchenKnownPendingNumbers);

  // Conservar órdenes históricas/no activas ya cargadas y sustituir las activas.
  orders=[
    ...orders.filter(order=>!activeNumbers.has(Number(order.order_number))&&
      !['pending','confirmed','preparing','ready'].includes(order.status)),
    ...active
  ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

  const pendingNumbers=new Set(
    active
      .filter(order=>['pending','confirmed'].includes(order.status))
      .map(order=>Number(order.order_number))
  );

  const newNumbers=[...pendingNumbers].filter(number=>!previousPending.has(number));
  kitchenKnownPendingNumbers=pendingNumbers;

  renderKitchen();
  renderPosPendingOrders();

  if(notify&&newNumbers.length){
    kitchenPlaySound(false);
    toast(`Nuevo pedido #${newNumbers.sort((a,b)=>a-b).join(', #')}`);
  }
}

function startKitchenAutoRefresh(){
  clearInterval(kitchenPollHandle);

  // La primera carga establece la referencia sin sonar por pedidos antiguos.
  loadKitchenOrdersReliable({notify:false}).then(()=>{
    kitchenKnownPendingNumbers=new Set(
      orders
        .filter(order=>['pending','confirmed'].includes(order.status))
        .map(order=>Number(order.order_number))
    );
  });

  kitchenPollHandle=setInterval(()=>{
    if(document.visibilityState==='visible'&&(
      kitchenIsVisible()||
      currentEmployee?.role==='kitchen'||
      document.body.dataset.employeeRole==='kitchen'
    )){
      loadKitchenOrdersReliable({notify:true});
    }
  },2000);
}

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&(
      kitchenIsVisible()||
      currentEmployee?.role==='kitchen'||
      document.body.dataset.employeeRole==='kitchen'
    )){
    loadKitchenOrdersReliable({notify:true});
  }
});

window.addEventListener('focus',()=>{
  if(kitchenIsVisible())loadKitchenOrdersReliable({notify:true});
});

$('#kitchenSound')?.addEventListener('change',event=>{
  if(event.target.checked){
    kitchenUnlockSound(true);
  }else{
    localStorage.removeItem('mordisco_kitchen_sound');
  }
});

$('#kitchenSound')?.addEventListener('click',()=>{
  if($('#kitchenSound')?.checked)kitchenUnlockSound(false);
});

if($('#kitchenSound')){
  $('#kitchenSound').checked=localStorage.getItem('mordisco_kitchen_sound')==='1';
}

$('#refreshKitchen')?.addEventListener('click',()=>{
  loadKitchenOrdersReliable({notify:false});
});


/* ===== COMPROBANTE: CIERRE Y NUEVA VENTA DEFINITIVOS ===== */
function closeReceiptModal(){
  const modal=$('#receiptModal');
  if(!modal)return;
  modal.classList.add('hidden');
  modal.classList.remove('show','open','active');
  modal.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open','no-scroll');
  document.documentElement.classList.remove('modal-open','no-scroll');
}

function resetPosForNewSale(){
  try{posCart=[]}catch{}
  try{selectedOrderForCharge=null}catch{}
  try{lastReceiptOrder=null}catch{}

  const fields={
    '#posCustomer':'Consumidor final',
    '#posPhone':'',
    '#posNotes':'',
    '#posDiscountValue':'0'
  };

  Object.entries(fields).forEach(([selector,value])=>{
    const node=$(selector);
    if(node)node.value=value;
  });

  const discountType=$('#posDiscountType');
  if(discountType)discountType.value='none';

  const orderType=$('#posOrderType');
  if(orderType&&!orderType.value)orderType.value='local';

  closeReceiptModal();

  if(typeof renderPosCart==='function')renderPosCart();
  if(typeof renderPosPendingOrders==='function')renderPosPendingOrders();

  window.scrollTo({top:0,behavior:'smooth'});
}

$('#receiptCloseBtn')?.addEventListener('click',event=>{
  event.preventDefault();
  event.stopPropagation();
  closeReceiptModal();
});

$('#receiptNewSaleBtn')?.addEventListener('click',event=>{
  event.preventDefault();
  event.stopPropagation();
  resetPosForNewSale();
  toast('Caja lista para una nueva venta');
});

$('#receiptModal')?.addEventListener('click',event=>{
  if(event.target===$('#receiptModal'))closeReceiptModal();
});

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('#receiptModal')?.classList.contains('hidden')){
    closeReceiptModal();
  }
});

/* CIERRE INFERIOR DE LA VENTANA DE MESAS */
$('#closeTableOrderBottom')?.addEventListener('click',()=>{
  $('#tableOrderModal')?.classList.add('hidden');
});


/* REFRESCO DE RESPALDO PARA EL DISPOSITIVO DE COCINA */
let mordiscoKitchenBackupPoll=null;

function startKitchenBackupPoll(){
  clearInterval(mordiscoKitchenBackupPoll);

  mordiscoKitchenBackupPoll=setInterval(()=>{
    const employeeRole=currentEmployee?.role||document.body.dataset.employeeRole;
    if(employeeRole!=='kitchen')return;
    if(document.visibilityState!=='visible')return;

    if(typeof loadKitchenOrdersReliable==='function'){
      loadKitchenOrdersReliable({notify:true});
    }else if(typeof loadOrders==='function'){
      loadOrders();
    }
  },2000);
}

window.addEventListener('load',startKitchenBackupPoll);
window.addEventListener('pageshow',startKitchenBackupPoll);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){
    startKitchenBackupPoll();
    if(typeof loadKitchenOrdersReliable==='function'){
      loadKitchenOrdersReliable({notify:true});
    }
  }
});


/* ===== PRODUCCIÓN: RESPALDO DE ACTUALIZACIÓN DE COCINA ===== */
let mordiscoProductionKitchenTimer=null;

function startProductionKitchenTimer(){
  clearInterval(mordiscoProductionKitchenTimer);

  mordiscoProductionKitchenTimer=setInterval(()=>{
    const role=currentEmployee?.role||document.body.dataset.employeeRole;

    if(role!=='kitchen'||document.visibilityState!=='visible')return;

    if(typeof loadKitchenOrdersReliable==='function'){
      loadKitchenOrdersReliable({notify:true});
    }else if(typeof loadOrders==='function'){
      loadOrders();
    }
  },2000);
}

window.addEventListener('load',startProductionKitchenTimer);
window.addEventListener('pageshow',startProductionKitchenTimer);


/* ===== PRODUCCIÓN: CIERRE SEGURO DEL COMPROBANTE ===== */
function mordiscoProductionCloseReceipt(){
  const modal=$('#receiptModal');
  if(!modal)return;

  modal.classList.add('hidden');
  modal.classList.remove('show','open','active');
  modal.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open','no-scroll');
}

document.addEventListener('click',event=>{
  const modal=$('#receiptModal');
  if(!modal||modal.classList.contains('hidden'))return;

  const close=event.target.closest?.(
    '#receiptCloseBtn,#receiptNewSaleBtn,[data-close="receiptModal"],.receiptModal .close'
  );

  if(close){
    event.preventDefault();
    event.stopImmediatePropagation();
    mordiscoProductionCloseReceipt();

    if(
      close.id==='receiptNewSaleBtn'||
      String(close.textContent||'').toLowerCase().includes('nueva venta')
    ){
      try{posCart=[]}catch{}
      if(typeof renderPosCart==='function')renderPosCart();
    }
  }
},true);


/* ===== POS / CAJA: MODO DE VENTANA PROFESIONAL ===== */
function setPosFocusMode(enabled){
  document.body.classList.toggle('posFocusMode',Boolean(enabled));

  if(enabled){
    document.documentElement.classList.remove('posFocusModeRoot');
    requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));
  }else{
    document.documentElement.classList.remove('posFocusModeRoot');
  }
}

function openPosFocusMode(){
  setPosFocusMode(true);
}

function exitPosFocusMode(){
  setPosFocusMode(false);

  const dashboardButton=$('.sidebar [data-tab="dashboard"]');
  if(dashboardButton){
    dashboardButton.click();
  }
}

$('#exitPosFocusBtn')?.addEventListener('click',exitPosFocusMode);

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.body.classList.contains('posFocusMode')){
    const openModal=document.querySelector('.modal:not(.hidden)');
    if(!openModal)exitPosFocusMode();
  }
});


/* ===== POS / CAJA: COBRO RÁPIDO SIN DESPLAZAMIENTO ===== */
let quickPaymentMethod='cash';

function getCurrentPosTotal(){
  const text=$('#posHeaderTotal')?.textContent||$('#posTotal')?.textContent||'$0';
  return Number(String(text).replace(/[^\d,.-]/g,'').replace(',','.'))||0;
}

function formatQuickMoney(value){
  return money(Number(value||0));
}

function syncQuickCheckoutTotal(){
  const total=getCurrentPosTotal();
  if($('#quickCheckoutTotal'))$('#quickCheckoutTotal').textContent=formatQuickMoney(total);
  if($('#quickCheckoutAmount'))$('#quickCheckoutAmount').textContent=formatQuickMoney(total);
  updateQuickChange();
}

function updateQuickChange(){
  const total=getCurrentPosTotal();
  const received=Number($('#quickCashReceived')?.value||0);
  if($('#quickCashChange')){
    $('#quickCashChange').textContent=formatQuickMoney(Math.max(0,received-total));
  }
}

$('#posDetailsToggle')?.addEventListener('click',()=>{
  const box=$('#posOptionalDetails');
  if(!box)return;
  const collapsed=box.classList.toggle('collapsed');
  $('#posDetailsToggle').textContent=collapsed?'Datos del pedido ▾':'Datos del pedido ▴';
});

$('#openQuickCheckoutBtn')?.addEventListener('click',()=>{
  if(!posCart?.length)return toast('Selecciona productos para cobrar');
  syncQuickCheckoutTotal();
  $('#quickCheckoutModal')?.classList.remove('hidden');
  setTimeout(()=>$('#quickCashReceived')?.focus(),80);
});

$('#quickCheckoutClose')?.addEventListener('click',()=>{
  $('#quickCheckoutModal')?.classList.add('hidden');
});

$('#quickCheckoutModal')?.addEventListener('click',event=>{
  if(event.target===$('#quickCheckoutModal')){
    $('#quickCheckoutModal').classList.add('hidden');
  }
});

$$('[data-quick-discount]').forEach(button=>{
  button.onclick=()=>{
    $('#quickDiscountType').value='percent';
    $('#quickDiscountValue').value=button.dataset.quickDiscount;
    syncQuickCheckoutTotal();
  };
});

$$('[data-quick-payment]').forEach(button=>{
  button.onclick=()=>{
    quickPaymentMethod=button.dataset.quickPayment;
    $$('[data-quick-payment]').forEach(item=>item.classList.toggle('active',item===button));
    $('#quickCashFields')?.classList.toggle('hidden',quickPaymentMethod!=='cash');
  };
});

$('#quickCashReceived')?.addEventListener('input',updateQuickChange);
$('#quickDiscountType')?.addEventListener('change',syncQuickCheckoutTotal);
$('#quickDiscountValue')?.addEventListener('input',syncQuickCheckoutTotal);

$('#confirmQuickCheckoutBtn')?.addEventListener('click',async()=>{
  const discountType=$('#quickDiscountType')?.value||'none';
  const discountValue=Number($('#quickDiscountValue')?.value||0);

  const originalType=$('#posDiscountType');
  const originalValue=$('#posDiscountValue');
  const paymentMethod=$('#paymentMethod');
  const cashReceived=$('#cashReceived');

  if(originalType)originalType.value=discountType;
  if(originalValue)originalValue.value=discountValue;
  if(paymentMethod)paymentMethod.value=quickPaymentMethod;
  if(cashReceived)cashReceived.value=Number($('#quickCashReceived')?.value||0);

  const button=$('#confirmQuickCheckoutBtn');
  const previous=button.textContent;
  button.disabled=true;
  button.textContent='Procesando...';

  try{
    if(typeof confirmChargeOrder==='function'){
      await confirmChargeOrder();
    }else{
      $('#confirmChargeOrder')?.click();
    }
    $('#quickCheckoutModal')?.classList.add('hidden');
  }finally{
    button.disabled=false;
    button.textContent=previous;
  }
});

// Mantener el total rápido sincronizado con cambios en la orden.
const quickTotalObserver=new MutationObserver(syncQuickCheckoutTotal);
['#posHeaderTotal','#posTotal'].forEach(selector=>{
  const node=$(selector);
  if(node)quickTotalObserver.observe(node,{childList:true,subtree:true,characterData:true});
});
syncQuickCheckoutTotal();


/* ===== CLIENTES: PANTALLA PROFESIONAL SIN PANEL LATERAL ===== */
function setCustomersFocusMode(enabled){
  document.body.classList.toggle('customersFocusMode',Boolean(enabled));
  document.documentElement.classList.toggle('customersFocusModeRoot',Boolean(enabled));

  if(enabled){
    requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));
  }
}

function exitCustomersFocusMode(){
  setCustomersFocusMode(false);
  const dashboardButton=$('.sidebar [data-tab="dashboard"]');
  if(dashboardButton)dashboardButton.click();
}

$('#exitCustomersFocusBtn')?.addEventListener('click',exitCustomersFocusMode);

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.body.classList.contains('customersFocusMode')){
    const openModal=document.querySelector('.modal:not(.hidden)');
    if(!openModal)exitCustomersFocusMode();
  }
});


/* ============================================================
   MORDISCO OS V21 — NAVEGACIÓN Y ESPACIO DE TRABAJO ESTABLE
   ============================================================ */
function activateMordiscoV21(){
  const view=document.querySelector('#adminView');
  if(!view)return;
  view.classList.add('adminV21');

  const collapsed=localStorage.getItem('mordisco_sidebar_collapsed')==='1';
  document.body.classList.toggle('sidebarCollapsedV21',collapsed);
  updateSidebarToggleLabel();
}

function updateSidebarToggleLabel(){
  const button=document.querySelector('#toggleAdminSidebar');
  if(!button)return;
  const collapsed=document.body.classList.contains('sidebarCollapsedV21');
  button.textContent=collapsed?'☰':'←';
  button.title=collapsed?'Mostrar menú':'Ocultar menú';
  button.setAttribute('aria-label',button.title);
}

function toggleAdminSidebarV21(){
  const collapsed=document.body.classList.toggle('sidebarCollapsedV21');
  localStorage.setItem('mordisco_sidebar_collapsed',collapsed?'1':'0');
  updateSidebarToggleLabel();
}

function toggleModuleFocusV21(){
  const tab=document.querySelector('#adminView .tab:not(.hidden)');
  if(!tab)return;

  const enabled=document.body.classList.toggle('moduleFocusV21');
  document.body.dataset.focusTab=enabled?tab.id:'';

  const button=document.querySelector('#toggleModuleFocus');
  if(button)button.textContent=enabled?'Volver al panel':'Pantalla amplia';

  if(enabled)window.scrollTo({top:0,left:0,behavior:'auto'});
}

function leaveModuleFocusV21(){
  document.body.classList.remove('moduleFocusV21');
  document.body.dataset.focusTab='';
  const button=document.querySelector('#toggleModuleFocus');
  if(button)button.textContent='Pantalla amplia';
}

document.querySelector('#toggleAdminSidebar')?.addEventListener('click',toggleAdminSidebarV21);
document.querySelector('#toggleModuleFocus')?.addEventListener('click',toggleModuleFocusV21);

document.querySelectorAll('.sidebar [data-tab]').forEach(button=>{
  button.addEventListener('click',()=>{
    leaveModuleFocusV21();
    requestAnimationFrame(activateMordiscoV21);
  });
});

document.querySelector('#posDetailsToggle')?.addEventListener('click',()=>{
  const details=document.querySelector('#posOptionalDetails');
  const button=document.querySelector('#posDetailsToggle');
  if(!details||!button)return;
  const collapsed=details.classList.toggle('collapsed');
  button.textContent=collapsed?'Más datos ▾':'Más datos ▴';
});

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&document.body.classList.contains('moduleFocusV21')){
    const visibleModal=document.querySelector('.modal:not(.hidden)');
    if(!visibleModal)leaveModuleFocusV21();
  }
});

window.addEventListener('load',activateMordiscoV21);
window.addEventListener('pageshow',activateMordiscoV21);


/* ============================================================
   V21 — COBRO VISIBLE Y DATOS ESENCIALES DEL PEDIDO
   ============================================================ */
document.addEventListener('click',event=>{
  const payButton=event.target.closest?.('[data-pos-pay]');
  if(!payButton)return;

  event.preventDefault();
  event.stopPropagation();

  const orderId=payButton.dataset.posPay;
  if(typeof openChargeOrder==='function'){
    openChargeOrder(orderId);
    requestAnimationFrame(()=>{
      const modal=document.querySelector('#chargeOrderModal');
      if(modal){
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden','false');
      }
    });
  }
},true);

document.querySelectorAll('[data-close="chargeOrderModal"]').forEach(button=>{
  button.addEventListener('click',event=>{
    event.preventDefault();
    document.querySelector('#chargeOrderModal')?.classList.add('hidden');
  });
});

function ensureChargeModalVisibleV21(){
  const modal=document.querySelector('#chargeOrderModal');
  if(!modal||modal.classList.contains('hidden'))return;
  modal.style.zIndex='12050';
}

const chargeModalObserverV21=new MutationObserver(ensureChargeModalVisibleV21);
const chargeModalV21=document.querySelector('#chargeOrderModal');
if(chargeModalV21){
  chargeModalObserverV21.observe(chargeModalV21,{attributes:true,attributeFilter:['class']});
}
