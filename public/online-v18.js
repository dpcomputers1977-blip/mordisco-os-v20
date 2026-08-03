const SUPABASE_URL="https://nmmjthqflxwucpmmmrks.supabase.co";
const SUPABASE_KEY="sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

let products=[],categories=[],cart=[],category="Todos",search="";
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

  const total=cart.reduce((sum,item)=>{
    const p=products.find(product=>String(product.id)===String(item.id));
    return sum+Number(p.price)*item.qty;
  },0);
  document.querySelector("#onlineTotal").textContent=money(total);
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
    p_payment_method:document.querySelector("#onlinePaymentMethod").value
  });

  button.disabled=false;
  button.textContent="Enviar pedido";

  if(error)return toast("No se pudo enviar: "+error.message);

  const orderNumber=Array.isArray(data)?data[0]?.order_number:data?.order_number;
  cart=[];
  renderCart();
  event.target.reset();
  document.querySelector("#onlineAddressWrap").classList.add("hidden");
  toast(`Pedido #${orderNumber||""} enviado correctamente`);
};

load();