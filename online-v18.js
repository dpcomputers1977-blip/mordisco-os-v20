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

document.querySelector("#onlinePhone").addEventListener("input",event=>{
  event.target.value=event.target.value.replace(/[^0-9+()\-\s]/g,"").slice(0,16);
});

document.querySelector("#onlineType").onchange=event=>{
  document.querySelector("#onlineAddressWrap").classList.toggle("hidden",event.target.value!=="delivery");
};

document.querySelector("#onlineOrderForm").onsubmit=async event=>{
  event.preventDefault();

  if(!cart.length){
    toast("Agrega productos al pedido");
    document.querySelector("#onlineProducts")?.scrollIntoView({behavior:"smooth"});
    return;
  }

  const form=event.currentTarget;
  const name=document.querySelector("#onlineName").value.trim();
  const rawPhone=document.querySelector("#onlinePhone").value.trim();
  const phone=rawPhone.replace(/\D/g,"");
  const type=document.querySelector("#onlineType").value;
  const address=document.querySelector("#onlineAddress").value.trim();
  const notes=document.querySelector("#onlineNotes").value.trim();
  const button=document.querySelector("#sendOnlineOrder");

  if(name.length<2){
    toast("Escribe tu nombre");
    document.querySelector("#onlineName").focus();
    return;
  }

  if(phone.length<9||phone.length>15){
    toast("Escribe un número de WhatsApp válido");
    document.querySelector("#onlinePhone").focus();
    return;
  }

  if(type==="delivery"&&!address){
    toast("Escribe la dirección de entrega");
    document.querySelector("#onlineAddress").focus();
    return;
  }

  const selectedItems=cart.map(item=>{
    const product=products.find(p=>String(p.id)===String(item.id));
    return {
      product_id:item.id,
      quantity:Number(item.qty||1),
      name:product?.name||"Producto",
      price:Number(product?.price||0),
      subtotal:Number(product?.price||0)*Number(item.qty||1)
    };
  });

  const total=selectedItems.reduce((sum,item)=>sum+item.subtotal,0);

  // Abrir una pestaña desde el mismo toque para evitar el bloqueo de WhatsApp
  // en Chrome, Android y navegadores integrados.
  let whatsappWindow=null;
  try{
    whatsappWindow=window.open("about:blank","_blank");
    if(whatsappWindow){
      whatsappWindow.document.write(
        "<title>Confirmando pedido...</title>"+
        "<body style='font-family:Arial;padding:30px;text-align:center'>"+
        "<h2>Registrando tu pedido...</h2>"+
        "<p>En unos segundos abriremos WhatsApp.</p></body>"
      );
    }
  }catch(error){
    whatsappWindow=null;
  }

  button.disabled=true;
  button.textContent="Registrando pedido...";

  try{
    const {data,error}=await db.rpc("create_web_order",{
      p_customer_name:name,
      p_customer_phone:rawPhone,
      p_customer_address:address,
      p_order_type:type,
      p_notes:notes,
      p_items:selectedItems.map(item=>({
        product_id:item.product_id,
        quantity:item.quantity
      }))
    });

    if(error)throw error;

    const result=Array.isArray(data)?data[0]:data;
    const orderNumber=
      result?.order_number ??
      result?.number ??
      (typeof data==="number"||typeof data==="string"?data:null);
    const orderLabel=orderNumber||"pendiente";
    const typeLabel=type==="delivery"?"Delivery":"Retiro en el local";

    const itemLines=selectedItems
      .map(item=>`${item.quantity} x ${item.name} - ${money(item.subtotal)}`)
      .join("\n");

    const whatsappMessage=[
      "🍔 *CONFIRMACIÓN DE PEDIDO - MORDISCO*",
      "",
      `Pedido: #${orderLabel}`,
      `Cliente: ${name}`,
      `Teléfono registrado: ${rawPhone}`,
      `Tipo: ${typeLabel}`,
      address?`Dirección: ${address}`:"",
      "",
      "*Productos:*",
      itemLines,
      "",
      `*Total: ${money(total)}*`,
      notes?`Notas: ${notes}`:"",
      "",
      "Confirmo que deseo realizar este pedido.",
      "Por favor, respóndanme por este WhatsApp para coordinarlo."
    ].filter(Boolean).join("\n");

    const whatsappUrl=
      `https://wa.me/593959005534?text=${encodeURIComponent(whatsappMessage)}`;

    // Solo vaciar el carrito después de que Supabase confirmó el pedido.
    cart=[];
    renderCart();
    form.reset();
    document.querySelector("#onlineAddressWrap").classList.add("hidden");

    toast(`Pedido #${orderLabel} registrado. Abriendo WhatsApp...`);

    if(whatsappWindow&&!whatsappWindow.closed){
      whatsappWindow.location.replace(whatsappUrl);
    }else{
      window.location.href=whatsappUrl;
    }
  }catch(error){
    console.error("Error confirmando pedido:",error);

    if(whatsappWindow&&!whatsappWindow.closed){
      whatsappWindow.close();
    }

    toast("No se pudo registrar el pedido: "+(error?.message||"Error desconocido"));
  }finally{
    button.disabled=false;
    button.textContent="Confirmar pedido por WhatsApp";
  }
};

load();