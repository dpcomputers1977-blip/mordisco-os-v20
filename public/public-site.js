document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.main-nav');
  const toggle = document.querySelector('.menu-toggle');

  toggle?.addEventListener('click', () => {
    const open = nav?.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(Boolean(open)));
  });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[char]);
  const money = value => Number(value || 0).toLocaleString('es-EC', { style:'currency', currency:'USD' });

  const fallbackProducts = [
    {name:'Mordida Clásica',description:'Carne jugosa, queso, vegetales frescos y salsa especial.',price:3.5,image_url:'/media/hamburguesa.png',category:'Hamburguesas',featured:true},
    {name:'Mordida Doble',description:'Doble carne, doble queso y todo el sabor de Mordisco.',price:6,image_url:'/media/hamburguesa.png',category:'Hamburguesas',featured:true},
    {name:'Combo Mordisco',description:'Hamburguesa, papas y bebida para disfrutar completo.',price:7.5,image_url:'/media/hamburguesa.png',category:'Combos',featured:true}
  ];

  let allProducts = [];
  let allCategories = [];
  let activeCategory = 'all';

  const slugCategory = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .trim();

  const renderCategoryFilters = () => {
    const container = document.querySelector('#category-filters');
    if (!container) return;

    const categoriesWithProducts = allCategories.filter(category =>
      allProducts.some(product => String(product.category_id || '') === String(category.id))
    );

    container.innerHTML = [
      '<button class="active" data-category="all">Todos</button>',
      ...categoriesWithProducts.map(category =>
        `<button data-category="${safe(String(category.id))}">${safe(category.name)}</button>`
      )
    ].join('');

    container.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        container.querySelectorAll('button').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        activeCategory = button.dataset.category || 'all';
        renderProducts();
      });
    });
  };

  const filteredProducts = () => {
    if (activeCategory === 'all') return allProducts;
    return allProducts.filter(product =>
      String(product.category_id || '') === String(activeCategory)
    );
  };

  const renderProducts = () => {
    const container = document.querySelector('#featured-products');
    const summary = document.querySelector('#menuCatalogSummary');
    if (!container) return;

    const products = filteredProducts();
    const activeName = activeCategory === 'all'
      ? 'todas las categorías'
      : allCategories.find(category => String(category.id) === String(activeCategory))?.name || 'esta categoría';

    if (summary) {
      summary.textContent = activeCategory === 'all'
        ? `${allProducts.length} productos disponibles en ${allCategories.filter(c => allProducts.some(p => String(p.category_id) === String(c.id))).length} categorías`
        : `${products.length} productos en ${activeName}`;
    }

    if (!products.length) {
      container.innerHTML = `
        <div class="menu-empty-state">
          <strong>No hay productos visibles en ${safe(activeName)}.</strong>
          <span>Selecciona “Todos” para ver el menú completo.</span>
        </div>`;
      return;
    }

    container.innerHTML = products.map((product,index) => `
      <article class="product-card reveal visible" data-category="${safe(slugCategory(product.category))}">
        <div class="product-image">
          <img src="${safe(product.image_url || '/media/hamburguesa.png')}" alt="${safe(product.name)}" loading="lazy">
          ${product.featured ? '<span class="product-tag">DESTACADO</span>' : ''}
        </div>
        <div class="product-body">
          <span class="product-category">${safe(product.category || 'Mordisco')}</span>
          <h3>${safe(product.name)}</h3>
          <p>${safe(product.description || 'Preparado al momento con todo el sabor de Mordisco.')}</p>
          <div class="product-footer">
            <strong>${money(product.price)}</strong>
            <a class="btn btn-primary" href="/pedir">Pedir</a>
          </div>
        </div>
      </article>
    `).join('');
  };

  const loadProducts = async () => {
    try {
      const client = window.mordiscoSupabaseClient;
      if (!client) throw new Error('No se encontró la conexión con Supabase.');

      const [
        { data: categoryData, error: categoryError },
        { data: productData, error: productError }
      ] = await Promise.all([
        client
          .from('categories')
          .select('id,name,sort_order,active')
          .eq('active', true)
          .order('sort_order', { ascending:true })
          .order('name', { ascending:true }),
        client
          .from('products')
          .select('*,categories(id,name)')
          .eq('active', true)
          .order('featured', { ascending:false })
          .order('sort_order', { ascending:true })
          .order('name', { ascending:true })
      ]);

      if (categoryError) throw categoryError;
      if (productError) throw productError;

      allCategories = categoryData || [];
      allProducts = (productData || []).map(product => ({
        ...product,
        category: product.categories?.name || 'Sin categoría'
      }));
    } catch (error) {
      console.warn('No se pudo cargar el menú completo desde Supabase:', error);
      allCategories = [
        {id:'fallback-hamburguesas',name:'Hamburguesas',active:true,sort_order:0},
        {id:'fallback-combos',name:'Combos',active:true,sort_order:1}
      ];
      allProducts = fallbackProducts.map((product,index) => ({
        ...product,
        category_id:index < 2 ? 'fallback-hamburguesas' : 'fallback-combos'
      }));
    }

    renderCategoryFilters();
    renderProducts();
  };

  loadProducts();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});


/* ===== HORARIOS PÚBLICOS ===== */
const PUBLIC_WEEK_DAYS=[
  {day:1,label:'Lunes'},{day:2,label:'Martes'},{day:3,label:'Miércoles'},
  {day:4,label:'Jueves'},{day:5,label:'Viernes'},{day:6,label:'Sábado'},
  {day:0,label:'Domingo'}
];

function minutesFromTime(value){
  const [hour,minute]=String(value||'00:00').slice(0,5).split(':').map(Number);
  return hour*60+minute;
}

function getBusinessStatus(rows,date=new Date()){
  const day=date.getDay();
  const current=date.getHours()*60+date.getMinutes();
  const today=rows.find(x=>Number(x.day_of_week)===day);
  if(!today || today.closed)return {open:false,today,nextText:'Hoy estamos cerrados'};

  const opens=minutesFromTime(today.opens_at);
  const closes=minutesFromTime(today.closes_at);
  const open=current>=opens && current<closes;
  return {
    open,
    today,
    nextText:open
      ? `Abierto ahora · cerramos a las ${String(today.closes_at).slice(0,5)}`
      : current<opens
        ? `Abrimos hoy a las ${String(today.opens_at).slice(0,5)}`
        : `Ya cerramos por hoy`
  };
}

function findNextOpening(rows,date=new Date()){
  for(let offset=0;offset<8;offset++){
    const candidate=new Date(date);
    candidate.setDate(date.getDate()+offset);
    const row=rows.find(x=>Number(x.day_of_week)===candidate.getDay());
    if(!row || row.closed)continue;
    const nowMinutes=date.getHours()*60+date.getMinutes();
    if(offset===0 && nowMinutes>=minutesFromTime(row.opens_at))continue;
    const label=offset===0?'hoy':offset===1?'mañana':PUBLIC_WEEK_DAYS.find(x=>x.day===candidate.getDay())?.label.toLowerCase();
    return `Volvemos a abrir ${label} a las ${String(row.opens_at).slice(0,5)}`;
  }
  return 'Consulta nuevamente más tarde';
}

async function loadPublicBusinessHours(){
  const list=document.querySelector('#publicBusinessHours');
  const statusNode=document.querySelector('#publicBusinessStatus');
  if(!list || !statusNode)return;

  try{
    const cfg=window.MORDISCO_SUPABASE || window.SUPABASE_CONFIG || {};
    const client=window.mordiscoSupabaseClient ||
      (window.supabase && cfg.url && cfg.anonKey
        ? window.supabase.createClient(cfg.url,cfg.anonKey)
        : null);

    if(!client)throw new Error('No se encontró la conexión');

    const {data,error}=await client.from('business_hours').select('*').order('sort_order');
    if(error)throw error;
    const rows=data||[];

    const currentDay=new Date().getDay();
    list.innerHTML=PUBLIC_WEEK_DAYS.map(item=>{
      const row=rows.find(x=>Number(x.day_of_week)===item.day);
      const text=!row || row.closed
        ? 'Cerrado'
        : `${String(row.opens_at).slice(0,5)} – ${String(row.closes_at).slice(0,5)}`;
      return `<div class="public-hour-row ${item.day===currentDay?'today':''}">
        <strong>${item.label}</strong>
        <span>${text}</span>
        <b>${item.day===currentDay?'Hoy':''}</b>
      </div>`;
    }).join('');

    const state=getBusinessStatus(rows);
    statusNode.classList.remove('loading');
    statusNode.classList.add(state.open?'open':'closed');
    statusNode.textContent=state.open
      ? `● ${state.nextText}`
      : `● ${state.nextText}. ${findNextOpening(rows)}`;
  }catch(error){
    console.warn('No se pudieron cargar horarios públicos:',error);
    list.innerHTML='<div class="hours-loading">Horario no disponible temporalmente.</div>';
    statusNode.className='business-status closed';
    statusNode.textContent='Consulta el horario por WhatsApp';
  }
}

document.addEventListener('DOMContentLoaded',loadPublicBusinessHours);


/* ===== INSTALACIÓN PREMIUM DE LA APP MORDISCO ===== */
let mordiscoInstallPrompt=null;

function mordiscoIsInstalled(){
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function showInstallHelp(){
  document.querySelector('#installHelpModal')?.classList.remove('hidden');
}

function hideInstallHelp(){
  document.querySelector('#installHelpModal')?.classList.add('hidden');
}

async function triggerMordiscoInstall(){
  if(mordiscoIsInstalled()){
    document.querySelector('#installMordiscoApp')?.classList.add('hidden');
    hideInstallHelp();
    return;
  }

  if(!mordiscoInstallPrompt){
    showInstallHelp();
    return;
  }

  try{
    await mordiscoInstallPrompt.prompt();
    const result=await mordiscoInstallPrompt.userChoice;

    if(result.outcome==='accepted'){
      document.querySelector('#installMordiscoApp')?.classList.add('hidden');
      hideInstallHelp();
    }else{
      showInstallHelp();
    }
  }catch(error){
    console.error('Instalación:',error);
    showInstallHelp();
  }finally{
    mordiscoInstallPrompt=null;
  }
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  mordiscoInstallPrompt=event;
  document.querySelector('#installMordiscoApp')?.classList.remove('hidden');
});

window.addEventListener('appinstalled',()=>{
  document.querySelector('#installMordiscoApp')?.classList.add('hidden');
  hideInstallHelp();
  mordiscoInstallPrompt=null;
});

function initializePremiumInstall(){
  const installButton=document.querySelector('#installMordiscoApp');
  const retryButton=document.querySelector('#retryInstallButton');
  const closeButton=document.querySelector('#closeInstallHelp');
  const dismissButton=document.querySelector('#dismissInstallHelp');

  installButton?.addEventListener('click',triggerMordiscoInstall);
  retryButton?.addEventListener('click',triggerMordiscoInstall);
  closeButton?.addEventListener('click',hideInstallHelp);
  dismissButton?.addEventListener('click',hideInstallHelp);

  if(mordiscoIsInstalled()){
    installButton?.classList.add('hidden');
  }else{
    installButton?.classList.remove('hidden');
  }

  const splash=document.querySelector('#mordiscoSplash');
  const alreadyShown=sessionStorage.getItem('mordiscoSplashShown');

  if(splash && !alreadyShown){
    splash.classList.add('show');
    sessionStorage.setItem('mordiscoSplashShown','1');
    setTimeout(()=>splash.classList.remove('show'),1800);
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initializePremiumInstall,{once:true});
}else{
  initializePremiumInstall();
}


/* Resaltar navegación móvil según sección */
const mobileNavLinks=[...document.querySelectorAll('.mobile-bottom-nav a')];
const mobileSections=['inicio','menu','horarios'];

const mobileSectionObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    mobileNavLinks.forEach(link=>link.classList.remove('active'));
    const link=document.querySelector(`.mobile-bottom-nav a[href="#${entry.target.id}"]`);
    link?.classList.add('active');
  });
},{threshold:.35});

mobileSections.forEach(id=>{
  const node=document.getElementById(id);
  if(node)mobileSectionObserver.observe(node);
});


/* ===== WHATSAPP DINÁMICO DESDE CONFIGURACIÓN DEL NEGOCIO ===== */
function normalizeWhatsappNumber(value){
  return String(value || '').replace(/\D/g,'');
}

function buildWhatsappUrl(number,message=''){
  const phone=normalizeWhatsappNumber(number);
  const text=encodeURIComponent(message || 'Hola Mordisco Fast Food, deseo realizar un pedido.');
  return phone ? `https://wa.me/${phone}?text=${text}` : '#';
}

async function loadDynamicWhatsapp(){
  try{
    const client=window.mordiscoSupabaseClient ||
      (window.supabase && window.MORDISCO_SUPABASE
        ? window.supabase.createClient(
            window.MORDISCO_SUPABASE.url,
            window.MORDISCO_SUPABASE.anonKey
          )
        : null);

    if(!client) throw new Error('No se encontró la conexión con Supabase.');

    const {data,error}=await client
      .from('business_settings')
      .select('whatsapp,business_name')
      .limit(1)
      .maybeSingle();

    if(error) throw error;

    const phone=normalizeWhatsappNumber(data?.whatsapp);
    if(!phone) throw new Error('No hay número de WhatsApp configurado.');

    const message=`Hola ${data?.business_name || 'Mordisco Fast Food'}, deseo realizar un pedido.`;
    const url=buildWhatsappUrl(phone,message);

    document.querySelectorAll(
      'a[href*="wa.me"], .whatsapp-button, [data-whatsapp-link], #whatsappButton'
    ).forEach(link=>{
      link.href=url;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.dataset.dynamicWhatsapp='1';
    });

    window.MORDISCO_WHATSAPP=phone;
  }catch(error){
    console.warn('WhatsApp dinámico:',error);
    document.querySelectorAll(
      'a[href*="wa.me"], .whatsapp-button, [data-whatsapp-link], #whatsappButton'
    ).forEach(link=>{
      link.addEventListener('click',event=>{
        event.preventDefault();
        alert('El número de WhatsApp no está disponible temporalmente.');
      },{once:true});
    });
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',loadDynamicWhatsapp,{once:true});
}else{
  loadDynamicWhatsapp();
}
