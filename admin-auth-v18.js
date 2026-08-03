<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#11100e">
  <title>Promociones | Mordisco Fast Food</title>
  <link rel="stylesheet" href="/public-site.css?v=19.1.0">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
<header class="siteHeader">
  <a class="siteBrand" href="/"><img src="/mordisco-logo.png" alt="Mordisco"><span>MORDISCO <small>FAST FOOD</small></span></a>
  <nav><a href="/">Inicio</a><a href="/#menu">Menú</a><a href="/promociones">Promociones</a><a href="/#contacto">Contacto</a></nav>
  <a class="orderHeader" href="/pedir.html">Pedir ahora</a>
</header>

<main>
  <section class="publicSection promoSection publicPromotionsPage">
    <div class="sectionTitle">
      <div><span>PROMOCIONES</span><h1>Ofertas que merecen un Mordisco</h1></div>
      <a href="/pedir.html">Hacer pedido →</a>
    </div>
    <div id="publicPromotions" class="promoGrid"><p class="loading">Cargando promociones…</p></div>
  </section>
</main>

<footer class="siteFooter">
  <div><img src="/mordisco-logo.png"><span>© 2026 Mordisco Fast Food</span></div>
</footer>

<script>
const db=supabase.createClient(
  "https://nmmjthqflxwucpmmmrks.supabase.co",
  "sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0"
);
const money=n=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(Number(n||0));
const esc=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

async function loadPromotions(){
  const now=new Date().toISOString().slice(0,10);
  const {data,error}=await db.from("promotions").select("*").order("sort_order");

  const node=document.querySelector("#publicPromotions");
  if(error){
    node.innerHTML=`<p class="catalogStatus">No se pudieron cargar las promociones: ${esc(error.message)}</p>`;
    return;
  }

  const current=(data||[]).filter(p=>p.active&&(!p.starts_on||p.starts_on<=now)&&(!p.ends_on||p.ends_on>=now));
  const active=(data||[]).filter(p=>p.active);
  const list=current.length?current:active;
  node.innerHTML=list.map(p=>`<article class="promoCard">
    ${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.title)}">`:""}
    <div class="promoCardBody">
      ${p.badge?`<span>${esc(p.badge)}</span>`:""}
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.description)}</p>
      ${p.promo_price!=null?`<b>${money(p.promo_price)}</b>`:""}
      <a class="yellowButton" href="${esc(p.link_url||'/pedir')}">Pedir promoción</a>
    </div>
  </article>`).join("")||'<div class="catalogStatus"><h3>No hay promociones publicadas todavía</h3><p>Créala desde Administración → Promociones y marca la opción Activa.</p><a class="yellowButton" href="/pedir.html">Ver menú y pedir</a></div>';
}
loadPromotions();
</script>
</body>
</html>