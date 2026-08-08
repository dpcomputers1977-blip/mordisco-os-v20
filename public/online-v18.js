const SUPABASE_URL="https://nmmjthqflxwucpmmmrks.supabase.co";
const SUPABASE_KEY="sb_publishable_izCztp4wZ0MzKOHjT2KGYA_ot_3pgb0";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

let products=[],categories=[],cart=[],category="Todos",search="",extraOptions=[],selectedExtras=[];
let storeIsOpen=true;
let businessHours=[];

const PAYMENT_LABELS={
  cash:"Efectivo al recibir",
  deuna:"Deuna",
  ahorita:"Ahorita",
  transfer:"Transferencia bancaria",
  card:"Tarjeta en el local"
};

function ecuadorNowParts(){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"America/Guayaquil",
    weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false
  }).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return {
    day:dayMap[values.weekday],
    minutes:Number(values.hour)*60+Number(values.minute)
  };
}

function timeToMinutes(value){
  const [hours,minutes]=String(value||"00:00").slice(0,5).split(":").map(Number);
  return (hours||0)*60+(minutes||0);
}

function evaluateStoreOpen(rows){
  if(!Array.isArray(rows)||!rows.length){
    return {open:true,message:"Horario no configurado; pedidos habilitados."};
  }

  const now=ecuadorNowParts();
  const today=rows.find(row=>Number(row.day_of_week)===Number(now.day));
  if(!today||today.closed){
    const next=findNextOpening(rows,now.day);
    return {open:false,message:next?`Volvemos ${next}.`:"No hay horarios de atención configurados."};
  }

  const opens=timeToMinutes(today.opens_at);
  const closes=timeToMinutes(today.closes_at);
  const openNow=closes>opens
    ? now.minutes>=opens&&now.minutes<closes
    : now.minutes>=opens||now.minutes<closes;

  if(openNow){
    return {open:true,message:`Abierto hasta ${String(today.closes_at).slice(0,5)}.`};
  }

  if(now.minutes<opens){
    return {open:false,message:`Abrimos hoy a las ${String(today.opens_at).slice(0,5)}.`};
  }

  const next=findNextOpening(rows,now.day);
  return {open:false,message:next?`Volvemos ${next}.`:"Estamos fuera del horario de atención."};
}

function findNextOpening(rows,currentDay){
  const labels=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  for(let offset=1;offset<=7;offset++){
    const day=(currentDay+offset)%7;
    const row=rows.find(item=>Number(item.day_of_week)===day&&!item.closed);
    if(row)return `${labels[day]} a las ${String(row.opens_at).slice(0,5)}`;
  }
  return "";
}

function applyStoreStatus(result){
  storeIsOpen=Boolean(result.open);
  const status=document.querySelector("#onlineStoreStatus");
  const overlay=document.querySelector("#closedStoreOverlay");
  const message=result.message||"Consulta nuestro horario.";

  document.body.classList.toggle("storeClosed",!storeIsOpen);
  status?.classList.remove("checking","open","closed");
  status?.classList.add(storeIsOpen?"open":"closed");
  if(status){
    status.querySelector("b").textContent=storeIsOpen?"Estamos abiertos":"Restaurante cerrado";
    status.querySelector("small").textContent=message;
  }
  const closedMessage=document.querySelector("#closedStoreMessage");
  if(closedMessage)closedMessage.textContent=message;
  overlay?.classList.toggle("hidden",storeIsOpen);
  overlay?.setAttribute("aria-hidden",storeIsOpen?"true":"false");

  const submit=document.querySelector("#sendOnlineOrder");
  if(submit){
    submit.disabled=!storeIsOpen;
    submit.textContent=storeIsOpen
      ?"Confirmar pedido por WhatsApp"
      :"Pedidos cerrados por horario";
  }
}

async function loadBusinessHoursForOrdering(){
  try{
    const {data,error}=await db.from("business_hours").select("*").order("sort_order");
    if(error)throw error;
    businessHours=data||[];
    applyStoreStatus(evaluateStoreOpen(businessHours));
  }catch(error){
    console.warn("No se pudo comprobar el horario:",error);
    applyStoreStatus({open:true,message:"No se pudo comprobar el horario; pedidos habilitados."});
  }
}
const money=n=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(Number(n||0));
const esc=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

function toast(message){
  const node=document.querySelector("#onlineToast");
  node.textContent=message;
  node.classList.add("show");
  setTimeout(()=>node.classList.remove("show"),3500);
}


function getAvailableExtras(){
  const cartProductCategoryIds=new Set(
    cart.map(item=>{
      const product=products.find(p=>String(p.id)===String(item.id));
      return product?.category_id!=null?String(product.category_id):null;
    }).filter(Boolean)
  );

  return extraOptions.filter(option=>{
    if(option.active===false)return false;
    if(!option.category_id)return true;
    return cartProductCategoryIds.has(String(option.category_id));
  });
}

function normalizeSelectedExtras(){
  const availableIds=new Set(getAvailableExtras().map(option=>String(option.id)));
  selectedExtras=selectedExtras.filter(item=>
    availableIds.has(String(item.id)) && Number(item.qty)>0
  );
}

function extrasTotal(){
  normalizeSelectedExtras();
  return selectedExtras.reduce((sum,item)=>{
    const option=extraOptions.find(extra=>String(extra.id)===String(item.id));
    return sum+(option?Number(option.price||0)*Number(item.qty||0):0);
  },0);
}

function renderExtras(){
  const node=document.querySelector("#onlineExtrasList");
  if(!node)return;

  normalizeSelectedExtras();
  const available=getAvailableExtras();

  if(!cart.length){
    node.innerHTML='<p class="onlineExtrasEmpty">Agrega un producto para ver los extras disponibles.</p>';
    return;
  }

  if(!available.length){
    node.innerHTML='<p class="onlineExtrasEmpty">No hay extras disponibles para los productos seleccionados.</p>';
    return;
  }

  node.innerHTML=available.map(option=>{
    const selected=selectedExtras.find(item=>String(item.id)===String(option.id));
    const qty=Number(selected?.qty||0);
    const label=option.option_type==="packaging"?"Empaque":"Extra";

    return `<div class="onlineExtraRow">
      <div class="onlineExtraInfo">
        <b>${esc(option.name)}</b>
        <small>${label}${option.description?` · ${esc(option.description)}`:""}</small>
        <strong>+ ${money(option.price)}</strong>
      </div>
      <div class="onlineExtraQty">
        <button type="button" data-extra-minus="${option.id}" aria-label="Quitar ${esc(option.name)}">−</button>
        <b>${qty}</b>
        <button type="button" data-extra-plus="${option.id}" aria-label="Agregar ${esc(option.name)}">+</button>
      </div>
    </div>`;
  }).join("");

  node.querySelectorAll("[data-extra-plus]").forEach(button=>{
    button.onclick=()=>{
      const id=button.dataset.extraPlus;
      const row=selectedExtras.find(item=>String(item.id)===String(id));
      if(row)row.qty++;
      else selectedExtras.push({id,qty:1});
      renderExtras();
      renderCart();
    };
  });

  node.querySelectorAll("[data-extra-minus]").forEach(button=>{
    button.onclick=()=>{
      const id=button.dataset.extraMinus;
      const row=selectedExtras.find(item=>String(item.id)===String(id));
      if(!row)return;
      row.qty--;
      selectedExtras=selectedExtras.filter(item=>Number(item.qty)>0);
      renderExtras();
      renderCart();
    };
  });
}

async function load(){
  const [productsResult,categoriesResult,extrasResult]=await Promise.all([
    db.from("products").select("*,categories(name)").eq("active",true).order("sort_order"),
    db.from("categories").select("*").eq("active",true).order("sort_order"),
    db.from("extra_options").select("*").eq("active",true).order("sort_order").order("name"),
    loadBusinessHoursForOrdering()
  ]);
  if(productsResult.error)return toast(productsResult.error.message);
  products=productsResult.data||[];
  categories=categoriesResult.data||[];
  extraOptions=extrasResult?.error?[]:(extrasResult?.data||[]);
  if(extrasResult?.error)console.warn("Extras web:",extrasResult.error.message);
  renderCategories();
  renderProducts();
  renderExtras();
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
    if(!storeIsOpen)return toast("El restaurante está cerrado en este momento");
    const id=button.dataset.add;
    const row=cart.find(item=>String(item.id)===String(id));
    if(row)row.qty++;else cart.push({id,qty:1});
    renderExtras();
    renderCart();
    toast("Producto agregado");
  });
}

function renderCart(){
  const node=document.querySelector("#onlineCartItems");
  if(!storeIsOpen){
    toast("El restaurante está cerrado en este momento");
    applyStoreStatus(evaluateStoreOpen(businessHours));
    return;
  }

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
    renderExtras();
    renderCart();
  });
  document.querySelectorAll("[data-plus]").forEach(button=>button.onclick=()=>{
    cart.find(item=>String(item.id)===String(button.dataset.plus)).qty++;
    renderCart();
  });

  const productsTotal=cart.reduce((sum,item)=>{
    const p=products.find(product=>String(product.id)===String(item.id));
    return sum+(p?Number(p.price)*item.qty:0);
  },0);
  const total=productsTotal+extrasTotal();
  document.querySelector("#onlineTotal").textContent=money(total);
  const itemCount=cart.reduce((sum,item)=>sum+Number(item.qty||0),0);
  const floatingSummary=document.querySelector("#floatingCartSummary");
  if(floatingSummary)floatingSummary.textContent=`${itemCount} ${itemCount===1?"producto":"productos"} · ${money(total)}`;
  const floatingButton=document.querySelector("#floatingCartButton");
  if(floatingButton){
    floatingButton.classList.toggle("hasItems",itemCount>0);
    setTimeout(()=>floatingButton.classList.remove("hasItems"),380);
  }
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
  const paymentMethod=document.querySelector("#onlinePaymentMethod").value||"cash";
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

  normalizeSelectedExtras();
  const selectedExtraRows=selectedExtras.map(item=>{
    const option=extraOptions.find(extra=>String(extra.id)===String(item.id));
    return {
      id:item.id,
      extra_id:item.id,
      option_id:item.id,
      quantity:Number(item.qty||1),
      qty:Number(item.qty||1),
      name:option?.name||"Extra",
      price:Number(option?.price||0),
      subtotal:Number(option?.price||0)*Number(item.qty||1),
      option_type:option?.option_type||"extra"
    };
  });

  const productsTotal=selectedItems.reduce((sum,item)=>sum+item.subtotal,0);
  const selectedExtrasTotal=selectedExtraRows.reduce((sum,item)=>sum+item.subtotal,0);
  const total=productsTotal+selectedExtrasTotal;

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
      })),
      p_payment_method:paymentMethod,
      p_extras:selectedExtraRows
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

    const extraLines=selectedExtraRows
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
      extraLines?"":"",
      extraLines?"*Extras y empaques:*":"",
      extraLines||"",
      "",
      `*Total: ${money(total)}*`,
      `Método de pago: ${PAYMENT_LABELS[paymentMethod]||paymentMethod}`,
      notes?`Notas: ${notes}`:"",
      "",
      "Confirmo que deseo realizar este pedido.",
      "Por favor, respóndanme por este WhatsApp para coordinarlo."
    ].filter(Boolean).join("\n");

    const whatsappUrl=
      `https://wa.me/593959005534?text=${encodeURIComponent(whatsappMessage)}`;

    // Solo vaciar el carrito después de que Supabase confirmó el pedido.
    cart=[];
    selectedExtras=[];
    renderExtras();
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

document.querySelector("#floatingCartButton")?.addEventListener("click",()=>{
  document.querySelector(".onlineCart")?.scrollIntoView({behavior:"smooth",block:"start"});
});

setInterval(()=>{
  if(businessHours.length)applyStoreStatus(evaluateStoreOpen(businessHours));
},60000);

load();