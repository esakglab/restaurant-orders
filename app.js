const $=(s,r=document)=>r.querySelector(s),A=document.body.dataset.app,K='tk_'+A;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const money=n=>Number(n).toLocaleString('ru-RU')+' сом',hm=d=>new Date(d).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
const TY={takeaway:'С собой',dinein:'В заведении',delivery:'Доставка'},ST={new:'Ожидает',accepted:'Готовится',ready:'Готов!'};
const ROLES={shop:['customer'],staff:['staff'],admin:['admin','owner'],owner:['owner']};
const logout=()=>{localStorage.removeItem(K);location.reload()};
function toast(m){const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.append(e);setTimeout(()=>e.remove(),3500)}
async function api(p,m='GET',b){const r=await fetch('/api/'+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(localStorage[K]||'')},body:b?JSON.stringify(b):undefined});const d=await r.json().catch(()=>({}));
 if(r.status===401&&localStorage[K])logout();if(!r.ok)throw Error(d.error||'Ошибка');return d}
const head=(t,x='')=>`<header><b>🍴 ${esc(t)}</b><span>${x}<button class="ghost" id="out">Выйти</button></span></header>`;
$('#app').addEventListener('click',e=>{if(e.target.id==='out')logout()});

function authView(){let reg=0;const st=A==='staff',draw=()=>{
 $('#app').innerHTML=`<form class="card login" id="lf"><h2>${reg?'Регистрация':'Вход'}</h2>${st?'<select name="id"></select>':(reg?'<input name="name" placeholder="Имя" required><input name="nick" placeholder="Ник">':'')+'<input name="phone" placeholder="Телефон" required>'}<input name="password" type="password" placeholder="Пароль (от 6 символов)" required minlength="6"><button class="btn">${reg?'Создать аккаунт':'Войти'}</button>${A==='shop'?`<a href="#" id="sw">${reg?'Уже есть аккаунт':'Регистрация'}</a>`:''}</form>`;
 if(st)api('staff-list').then(l=>$('#lf select').innerHTML=l.map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join(''));
 if($('#sw'))$('#sw').onclick=e=>{e.preventDefault();reg=!reg;draw()};
 $('#lf').onsubmit=async e=>{e.preventDefault();try{const d=await api(reg?'register':'login','POST',Object.fromEntries(new FormData(e.target)));if(!ROLES[A].includes(d.role))throw Error('Нет доступа');localStorage[K]=d.token;localStorage.nm=d.name;boot()}catch(x){toast(x.message)}}};draw()}

async function shop(){
 const {settings:S,menu}=await api('info');let me=await api('me'),cart={},bell=0,seen=me.notifs.filter(n=>!n.read).length,f={type:'takeaway',point:S.points[0]||'',address:'',comment:''};
 const its=()=>Object.entries(cart).map(([id,qty])=>({id:+id,qty})),tot=()=>its().reduce((s,i)=>s+menu.find(m=>m.id===i.id).price*i.qty,0);
 const qty=id=>`<div class="qty"><button data-d="-1" data-id="${id}">−</button><b>${cart[id]}</b><button data-d="1" data-id="${id}">+</button></div>`;
 function draw(){const a=document.activeElement.name,un=me.notifs.filter(n=>!n.read).length;
  $('#app').innerHTML=head(S.name,`<button class="ghost" id="bl">🔔${un?`<i class="dot">${un}</i>`:''}</button>`)+
  (bell?`<div class="card pop">${me.notifs.map(n=>`<p class="${n.read?'':'new'}">${esc(n.text)} <small>${hm(n.created_at)}</small></p>`).join('')||'Уведомлений пока нет'}</div>`:'')+
  `<section class="card hero"><h1>${esc(S.name)}</h1><p>${esc(S.welcome)}</p></section>`+
  [...new Set(menu.map(m=>m.category))].map(c=>`<h3>${esc(c)}</h3><div class="grid">${menu.filter(m=>m.category===c).map(m=>`<div class="card dish">${m.photo?`<img src="${esc(m.photo)}" alt="" loading="lazy">`:'<div class="ph">🍽️</div>'}<b>${esc(m.name)}</b><span>${money(m.price)}</span>${cart[m.id]?qty(m.id):`<button class="btn" data-d="1" data-id="${m.id}">В корзину</button>`}</div>`).join('')}</div>`).join('')+
  `<section class="card"><h3>Корзина</h3>${its().map(i=>`<div class="row"><span>${esc(menu.find(x=>x.id===i.id).name)}</span>${qty(i.id)}<button class="ghost" data-x="${i.id}" title="Убрать">✕</button></div>`).join('')||'<p>Добавьте блюда из меню</p>'}
  <div class="row"><b>Итого</b><b>${money(tot())}</b></div>
  <div class="seg">${Object.entries(TY).map(([k,v])=>`<label><input type="radio" name="type" value="${k}" ${f.type===k?'checked':''}>${v}</label>`).join('')}</div>
  ${f.type==='delivery'?`<input name="address" placeholder="Адрес доставки" value="${esc(f.address)}">`:`<select name="point">${S.points.map(p=>`<option ${p===f.point?'selected':''}>${esc(p)}</option>`).join('')}</select>`}
  <textarea name="comment" placeholder="Комментарий к заказу">${esc(f.comment)}</textarea><button class="btn" id="go" ${its().length?'':'disabled'}>Заказать</button></section>
  <h3>Мои заказы</h3>${me.orders.slice(0,5).map(o=>`<div class="card row"><span>№${o.id} · ${money(o.total)}</span><span class="badge ${o.status}">${ST[o.status]}</span></div>`).join('')||'<p>Заказов пока нет</p>'}`;
  if(a){const e=$(`[name=${a}]`);e&&e.focus()}}
 $('#app').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.d){cart[d.id]=(cart[d.id]||0)+ +d.d;if(cart[d.id]<1)delete cart[d.id];draw()}
  else if(d.x){delete cart[d.x];draw()}
  else if(b.id==='bl'){bell=!bell;if(!bell){me.notifs.forEach(n=>n.read=true);seen=0;api('notifs/read','POST').catch(()=>{})}else window.Notification&&Notification.requestPermission();draw()}
  else if(b.id==='go'){try{await api('orders','POST',{items:its(),...f});cart={};f.comment='';me=await api('me');toast('Заказ отправлен ✅');draw()}catch(x){toast(x.message)}}});
 $('#app').addEventListener('input',e=>{f[e.target.name]=e.target.value;if(e.target.name==='type')draw()});
 setInterval(async()=>{try{const n=await api('me'),u=n.notifs.filter(x=>!x.read);if(u.length>seen){toast('🔔 '+u[0].text);if(window.Notification&&Notification.permission==='granted')new Notification(S.name,{body:u[0].text})}seen=u.length;
  if(JSON.stringify(n)!==JSON.stringify(me)){me=n;draw()}}catch{}},8000);
 draw()}

async function staff(){
 const {settings:S}=await api('info');let os=[];
 const rc=o=>`${S.name}\nЧЕК №${o.id}\n${new Date(o.created_at).toLocaleDateString('ru-RU')} ${hm(o.created_at)}\nПринял: ${o.staff_name} (${hm(o.accepted_at)})\nКлиент: ${o.users.nick}, тел. ${o.users.phone}\n${TY[o.type]}: ${o.address||o.point||''}\n----------\n${o.items.map(i=>`${i.name} ×${i.qty} = ${money(i.price*i.qty)}`).join('\n')}\n----------\nИТОГО: ${money(o.total)}${o.comment?'\nКомментарий: '+o.comment:''}`;
 const show=o=>{const m=document.createElement('div');m.className='modal';m.innerHTML='<div class="card"><pre></pre><button class="btn" data-p>Печать</button><button class="ghost" data-c>Закрыть</button></div>';$('pre',m).textContent=rc(o);
  m.onclick=e=>{if(e.target.dataset.p!==undefined)print();if(e.target.dataset.c!==undefined)m.remove()};document.body.append(m)};
 const draw=async()=>{try{os=await api('staff/orders')}catch{return}
  $('#app').innerHTML=head('Приём заказов · '+localStorage.nm)+`<div class="grid">${os.map(o=>`<div class="card"><b>№${o.id}</b> <span class="badge ${o.status}">${ST[o.status]}</span><p>${o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join('<br>')}</p><p>${TY[o.type]}: ${esc(o.address||o.point||'')}<br>${esc(o.users.nick)}, ${esc(o.users.phone)}${o.comment?`<br>${esc(o.comment)}`:''}</p><b>${money(o.total)}</b> <small>${hm(o.created_at)}</small>${o.status==='new'?`<button class="btn" data-a="accept" data-id="${o.id}">Принят</button>`:`<button class="btn" data-a="ready" data-id="${o.id}">Заказ готов</button><button class="ghost" data-a="chek" data-id="${o.id}">Показать чек</button>`}</div>`).join('')||'<p>Новых заказов нет</p>'}</div>`};
 $('#app').addEventListener('click',async e=>{const d=e.target.dataset;if(!d.a)return;if(d.a==='chek')return show(os.find(o=>o.id==d.id));
  try{const o=await api(`staff/orders/${d.id}/${d.a}`,'POST');if(d.a==='accept')show(o);toast(d.a==='accept'?'Принят, клиент уведомлён':'Клиент уведомлён: заказ готов');await draw()}catch(x){toast(x.message)}});
 await draw();setInterval(draw,10000)}

async function admin(){let menu=[];
 const draw=async()=>{const [i,st]=await Promise.all([api('info'),api('admin/staff')]),S=i.settings;menu=i.menu;
 $('#app').innerHTML=head('Администратор')+`
 <form class="card" id="sf"><h3>Заведение</h3><input name="name" value="${esc(S.name)}" placeholder="Название"><textarea name="welcome" placeholder="Приветствие">${esc(S.welcome)}</textarea><textarea name="points" placeholder="Точки выдачи — по одной в строке">${esc(S.points.join('\n'))}</textarea><button class="btn">Сохранить</button></form>
 <form class="card" id="mf"><h3>Блюдо</h3><input type="hidden" name="id"><input name="name" placeholder="Название" required><input name="category" placeholder="Раздел (Горячее, Напитки…)"><input name="price" type="number" min="0" step="0.01" placeholder="Цена" required><input name="photo" placeholder="Фото: ссылка https://…"><button class="btn">Сохранить блюдо</button></form>
 <div class="grid">${menu.map(m=>`<div class="card row"><span>${esc(m.name)}<br><small>${money(m.price)}</small></span><span><button class="ghost" data-e="${m.id}" title="Изменить">✎</button><button class="ghost" data-m="${m.id}" title="Удалить">🗑</button></span></div>`).join('')}</div>
 <form class="card" id="tf"><h3>Сотрудники</h3><input name="name" placeholder="Имя" required><input name="phone" placeholder="Телефон" required><input name="password" placeholder="Пароль (от 6 символов)" minlength="6" required><button class="btn">Добавить сотрудника</button>${st.map(u=>`<div class="row"><span>${esc(u.name)} · ${esc(u.phone)}</span><button type="button" class="ghost" data-s="${u.id}" title="Удалить">🗑</button></div>`).join('')}</form>`};
 $('#app').addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),id=e.target.id;
  try{await api(id==='sf'?'admin/settings':id==='mf'?'admin/menu':'admin/staff','POST',id==='sf'?{...f,points:f.points.split('\n')}:f);toast('Сохранено ✅');await draw()}catch(x){toast(x.message)}});
 $('#app').addEventListener('click',async e=>{const d=e.target.dataset;try{
  if(d.e){const m=menu.find(x=>x.id==d.e);for(const k of['id','name','category','price','photo'])$(`#mf [name=${k}]`).value=m[k]??'';$('#mf').scrollIntoView()}
  if(d.m&&confirm('Удалить блюдо?')){await api('admin/menu/'+d.m,'DELETE');await draw()}
  if(d.s&&confirm('Удалить сотрудника?')){await api('admin/staff/'+d.s,'DELETE');await draw()}}catch(x){toast(x.message)}});
 await draw()}

async function owner(){
 const bars=(a,l,u='')=>{const m=Math.max(...a,1);return`<div class="bars">${a.map((v,i)=>`<div title="${l[i]}: ${v}${u}"><i style="height:${v/m*100}%"></i><small>${l[i]}</small></div>`).join('')}</div>`};
 const d=await api('owner/stats'),ph=d.hours.indexOf(Math.max(...d.hours)),W=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],pd=d.wd.indexOf(Math.max(...d.wd)),kpi=(t,v)=>`<div class="card kpi"><small>${t}</small><b>${v}</b></div>`;
 $('#app').innerHTML=head('Владелец')+`<div class="grid">${kpi('Выручка',money(d.sum))+kpi('Заказов',d.count)+kpi('Средний чек',money(d.avg))+kpi('Ожидание принятия',d.accept+' мин')+kpi('Время готовки',d.cook+' мин')}</div>
 <div class="card"><h3>Когда больше заказов</h3><p>${d.count?`Пик: <b>${ph}:00–${ph+1}:00</b>. Самый загруженный день: <b>${W[pd]}</b>.`:'Данных пока нет'}</p>${bars(d.hours,[...Array(24).keys()])}${bars(d.wd,W)}</div>
 <div class="card"><h3>Выручка по дням</h3>${bars(d.days.map(x=>x[1]),d.days.map(x=>x[0]),' сом')}</div>
 <div class="card"><h3>Топ блюд</h3>${d.top.map(([n,c])=>`<div class="hb"><span>${esc(n)}</span><i style="width:${c/d.top[0][1]*100}%"></i><b>${c}</b></div>`).join('')||'Данных пока нет'}</div>
 <div class="card"><h3>Последние заказы</h3>${d.recent.map(o=>`<div class="row"><span>№${o.id} · ${esc(o.users?.nick)} · ${hm(o.created_at)}</span><span>${money(o.total)} <span class="badge ${o.status}">${ST[o.status]}</span></span></div>`).join('')}</div>
 <button class="btn" id="bk">Скачать резервную копию (JSON)</button>`;
 $('#bk').onclick=async()=>{const r=await fetch('/api/owner/backup',{headers:{Authorization:'Bearer '+localStorage[K]}}),a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download='backup-'+new Date().toISOString().slice(0,10)+'.json';a.click()}}

const boot=()=>localStorage[K]?({shop,staff,admin,owner})[A]().catch(x=>toast(x.message)):authView();boot();
