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

  const renderProducts = products => {
    const container = document.querySelector('#featured-products');
    if (!container) return;
    container.innerHTML = products.slice(0,6).map((product,index) => `
      <article class="product-card reveal visible" data-category="${safe((product.category || '').toLowerCase())}">
        <div class="product-image">
          <img src="${safe(product.image_url || '/media/hamburguesa.png')}" alt="${safe(product.name)}" loading="lazy">
          ${product.featured || index === 0 ? '<span class="product-tag">DESTACADO</span>' : ''}
        </div>
        <div class="product-body">
          <span class="product-category">${safe(product.category || 'Mordisco')}</span>
          <h3>${safe(product.name)}</h3>
          <p>${safe(product.description || 'Preparado al momento con todo el sabor de Mordisco.')}</p>
          <div class="product-footer">
            <strong>${money(product.price)}</strong>
            <a class="btn btn-primary" href="/pedir">Añadir</a>
          </div>
        </div>
      </article>
    `).join('');
  };

  const loadProducts = async () => {
    try {
      const cfg = window.MORDISCO_SUPABASE || window.SUPABASE_CONFIG || {};
      if (window.supabase && cfg.url && cfg.anonKey) {
        const client = window.supabase.createClient(cfg.url, cfg.anonKey);
        const { data, error } = await client
          .from('products')
          .select('*')
          .eq('active', true)
          .order('featured', { ascending:false })
          .limit(12);
        if (error) throw error;
        allProducts = (data || []).map(p => ({
          ...p,
          category: p.category_name || p.category || 'Hamburguesas'
        }));
      }
    } catch (error) {
      console.warn('No se pudieron cargar productos desde Supabase:', error);
    }
    if (!allProducts.length) allProducts = fallbackProducts;
    renderProducts(allProducts);
  };

  document.querySelectorAll('#category-filters button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#category-filters button').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      const category = button.dataset.category;
      if (category === 'all') return renderProducts(allProducts);
      renderProducts(allProducts.filter(p => String(p.category || '').toLowerCase().includes(category)));
    });
  });

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


/* ===== INSTALACIÓN DE LA APP MORDISCO ===== */
let mordiscoInstallPrompt=null;

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  mordiscoInstallPrompt=event;
  const button=document.querySelector('#installMordiscoApp');
  button?.classList.remove('hidden');
});

function mordiscoIsInstalled(){
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function showInstallInstructions(){
  const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid=/android/i.test(navigator.userAgent);

  const message=isIos
    ? 'Para instalar Mordisco en iPhone:\n\n1. Abre esta página en Safari.\n2. Pulsa Compartir.\n3. Selecciona “Agregar a pantalla de inicio”.'
    : isAndroid
      ? 'Chrome todavía no habilitó la ventana automática.\n\nPulsa el menú ⋮ de Chrome y selecciona “Instalar aplicación” o “Agregar a pantalla principal”.'
      : 'Abre el menú del navegador y selecciona “Instalar aplicación”.';

  alert(message);
}

async function installMordiscoApp(){
  if(mordiscoIsInstalled()){
    alert('Mordisco ya está instalado en este dispositivo.');
    document.querySelector('#installMordiscoApp')?.classList.add('hidden');
    return;
  }

  if(!mordiscoInstallPrompt){
    showInstallInstructions();
    return;
  }

  try{
    await mordiscoInstallPrompt.prompt();
    const choice=await mordiscoInstallPrompt.userChoice;

    if(choice.outcome==='accepted'){
      document.querySelector('#installMordiscoApp')?.classList.add('hidden');
    }
  }catch(error){
    console.error('No se pudo abrir el instalador:',error);
    showInstallInstructions();
  }finally{
    mordiscoInstallPrompt=null;
  }
}

function initializeMordiscoInstallButton(){
  const button=document.querySelector('#installMordiscoApp');
  if(!button)return;

  button.addEventListener('click',installMordiscoApp);

  if(mordiscoIsInstalled()){
    button.classList.add('hidden');
  }else{
    button.classList.remove('hidden');
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initializeMordiscoInstallButton,{once:true});
}else{
  initializeMordiscoInstallButton();
}

window.addEventListener('appinstalled',()=>{
  document.querySelector('#installMordiscoApp')?.classList.add('hidden');
  mordiscoInstallPrompt=null;
});


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
