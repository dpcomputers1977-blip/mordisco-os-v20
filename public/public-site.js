document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');

  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => nav.classList.remove('open'));
  });

  const container = document.querySelector('#featured-products');
  if (!container) return;

  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[c]);

  const money = value => {
    const n = Number(value || 0);
    return n.toLocaleString('es-EC', { style:'currency', currency:'USD' });
  };

  try {
    const cfg = window.MORDISCO_SUPABASE || window.SUPABASE_CONFIG || {};
    let products = [];

    if (window.supabase && cfg.url && cfg.anonKey) {
      const client = window.supabase.createClient(cfg.url, cfg.anonKey);
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('active', true)
        .order('featured', { ascending:false })
        .limit(6);
      if (error) throw error;
      products = data || [];
    }

    if (!products.length) {
      container.innerHTML = `
        <article class="menu-card">
          <img src="/hamburguesa.png" alt="Hamburguesa Mordisco">
          <div class="card-content">
            <h3>Mordida Clásica</h3>
            <p>Carne jugosa, queso, vegetales frescos y salsa especial.</p>
            <div class="card-meta"><strong>$3,50</strong><a class="btn btn-primary" href="/pedir">Pedir</a></div>
          </div>
        </article>
        <article class="menu-card">
          <img src="/hamburguesa.png" alt="Hamburguesa doble">
          <div class="card-content">
            <h3>Mordida Doble</h3>
            <p>Doble carne, doble queso y todo el sabor de Mordisco.</p>
            <div class="card-meta"><strong>$6,00</strong><a class="btn btn-primary" href="/pedir">Pedir</a></div>
          </div>
        </article>
        <article class="menu-card">
          <img src="/sandwich.png" alt="Sándwich Mordisco">
          <div class="card-content">
            <h3>Especial Mordisco</h3>
            <p>Una combinación intensa preparada al momento.</p>
            <div class="card-meta"><strong>Desde $4,00</strong><a class="btn btn-primary" href="/pedir">Pedir</a></div>
          </div>
        </article>`;
      return;
    }

    container.innerHTML = products.slice(0,6).map(p => `
      <article class="menu-card">
        <img src="${safe(p.image_url || '/hamburguesa.png')}" alt="${safe(p.name)}">
        <div class="card-content">
          <h3>${safe(p.name)}</h3>
          <p>${safe(p.description || 'Preparado al momento con el sabor de Mordisco.')}</p>
          <div class="card-meta">
            <strong>${money(p.price)}</strong>
            <a class="btn btn-primary" href="/pedir">Pedir</a>
          </div>
        </div>
      </article>
    `).join('');
  } catch (error) {
    console.warn('No se pudieron cargar productos destacados:', error);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});
