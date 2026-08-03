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
