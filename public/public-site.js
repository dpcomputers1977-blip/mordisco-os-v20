document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  toggle?.addEventListener('click', () => nav?.classList.toggle('open'));
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

  const container = document.querySelector('#featured-products');
  if (!container) return;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const money = v => Number(v || 0).toLocaleString('es-EC',{style:'currency',currency:'USD'});

  const fallback = [
    {name:'Mordida Clásica',description:'Carne jugosa, queso, vegetales frescos y salsa especial.',price:3.5,image_url:'/media/hamburguesa.png'},
    {name:'Mordida Doble',description:'Doble carne, doble queso y todo el sabor de Mordisco.',price:6,image_url:'/media/hamburguesa.png'},
    {name:'Combo Mordisco',description:'Hamburguesa, papas y bebida para disfrutar completo.',price:7.5,image_url:'/media/hamburguesa.png'}
  ];

  let products = [];
  try {
    const cfg = window.MORDISCO_SUPABASE || window.SUPABASE_CONFIG || {};
    if (window.supabase && cfg.url && cfg.anonKey) {
      const client = window.supabase.createClient(cfg.url,cfg.anonKey);
      const {data,error} = await client.from('products').select('*').eq('active',true).limit(6);
      if (error) throw error;
      products = data || [];
    }
  } catch (e) {
    console.warn('Productos destacados:',e);
  }
  if (!products.length) products = fallback;

  container.innerHTML = products.slice(0,6).map(p => `
    <article class="product-card">
      <img src="${esc(p.image_url || '/media/hamburguesa.png')}" alt="${esc(p.name)}">
      <div class="content">
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.description || 'Preparado al momento con el sabor de Mordisco.')}</p>
        <div class="meta"><strong>${money(p.price)}</strong><a class="btn yellow" href="/pedir">Pedir</a></div>
      </div>
    </article>`).join('');

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
});
