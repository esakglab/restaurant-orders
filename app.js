const $=(s,r=document)=>r.querySelector(s),A=document.body.dataset.app,K='tk_'+A,VID=()=>localStorage['v_'+A]||'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const money=n=>Number(n).toLocaleString('ru-RU')+' сом',hm=d=>new Date(d).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
const TY={takeaway:'С собой',dinein:'В заведении',delivery:'Доставка'},ST={new:'Ожидает',accepted:'Готовится',ready:'Готов!'};
const ROLES={shop:['customer'],staff:['terminal','admin'],admin:['admin'],owner:['owner']};
let H={},T,IP=null;
const logout=()=>{localStorage.removeItem(K);location.reload()};
function toast(m){const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.append(e);setTimeout(()=>e.remove(),3500)}
function beep(){try{const c=new(window.AudioContext||webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.setValueAtTime(.2,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.7);o.start();o.stop(c.currentTime+.7)}catch{}}
async function api(p,m='GET',b){const r=await fetch('/api/'+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(localStorage[K]||''),'X-Venue':VID()},body:b?JSON.stringify(b):undefined});const d=await r.json().catch(()=>({}));
 if(r.status===401&&localStorage[K])logout();if(!r.ok)throw Error(d.error||'Ошибка');return d}
const head=(t,x='',logo)=>`<header><b>${logo?`<img class="logo" src="${esc(logo)}" alt="">`:'🍴 '}${esc(t)}</b><span>${IP?'<button class="ghost" id="inst">⬇ Установить</button>':''}${x}<button class="ghost" id="out">Выйти</button></span></header>`;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();IP=e});
['click','submit','input'].forEach(t=>$('#app').addEventListener(t,e=>{if(t==='click'&&e.target.id==='out')return logout();if(t==='click'&&e.target.id==='inst'){IP.prompt();IP=null;return}H[t]&&H[t](e)}));
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});

function authView(){let reg=0;const sh=A==='shop',draw=()=>{
 $('#app').innerHTML=`<form class="card login" id="lf"><h2>${reg?'Регистрация':'Вход'}</h2>${reg?'<input name="name" placeholder="Имя" required><input name="nick" placeholder="Ник"><input name="phone" placeholder="Телефон" required>':`<input name="login" placeholder="${sh?'Телефон':'Логин'}" required autocomplete="username">`}<input name="password" type="password" placeholder="Пароль" required minlength="6" autocomplete="current-password"><button class="btn">${reg?'Создать аккаунт':'Войти'}</button>${sh?`<a href="#" id="sw">${reg?'Уже есть аккаунт':'Регистрация'}</a>`:''}</form>`;
 if($('#sw'))$('#sw').onclick=e=>{e.preventDefault();reg=!reg;draw()};
 $('#lf').onsubmit=async e=>{e.preventDefault();try{const d=await api(reg?'register':'login','POST',Object.fromEntries(new FormData(e.target)));if(!ROLES[A].includes(d.role))throw Error('Нет доступа');localStorage[K]=d.token;localStorage.nm=d.name;if(A!=='owner')localStorage['v_'+A]=d.venue||'';boot()}catch(x){toast(x.message)}}};draw()}

async function shop(){
 clearInterval(T);const vs=await api('venues');let vid=vs.length===1?vs[0].id:localStorage.sv;
 if(!vs.find(x=>x.id==vid)){$('#app').innerHTML=head('Выберите заведение')+`<div class="grid">${vs.map(v=>`<button class="card vcard" data-v="${v.id}">${v.logo?`<img class="logo big" src="${esc(v.logo)}" alt="">`:'<div class="ph">🍽️</div>'}<b>${esc(v.name)}</b><small>${esc(v.welcome||'')}</small></button>`).join('')||'<p>Заведений пока нет</p>'}</div>`;
  H.click=e=>{const b=e.target.closest('[data-v]');if(b){localStorage.sv=b.dataset.v;shop()}};return}
 const {venue:S,menu}=await api('info?v='+vid),pts=S.points||[];let me=await api('me'),cart={},bell=0,seen=me.notifs.filter(n=>!n.read).length,f={type:'takeaway',point:pts[0]||'',address:'',comment:''};
 const its=()=>Object.entries(cart).map(([id,qty])=>({id:+id,qty})),tot=()=>its().reduce((s,i)=>s+menu.find(m=>m.id===i.id).price*i.qty,0);
 const qty=id=>`<div class="qty"><button data-d="-1" data-id="${id}">−</button><b>${cart[id]}</b><button data-d="1" data-id="${id}">+</button></div>`;
 const map=S.lat!=null&&S.lng!=null?`<div class="card map"><b>📍 ${esc(S.address||'Как добраться')}</b><iframe loading="lazy" title="Карта" src="https://www.openstreetmap.org/export/embed.html?bbox=${S.lng-.006}%2C${S.lat-.004}%2C${S.lng+.006}%2C${S.lat+.004}&layer=mapnik&marker=${S.lat}%2C${S.lng}"></iframe><div class="seg"><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${S.lat},${S.lng}">Маршрут · Google</a><a class="btn" target="_blank" rel="noopener" href="https://yandex.ru/maps/?rtext=~${S.lat},${S.lng}&rtt=auto">Маршрут · Яндекс</a></div></div>`:'';
 function draw(){const a=document.activeElement.name,un=me.notifs.filter(n=>!n.read).length;
  $('#app').innerHTML=head(S.name,`${vs.length>1?'<button class="ghost" data-sw title="Другое заведение">⇄</button>':''}<button class="ghost" id="bl">🔔${un?`<i class="dot">${un}</i>`:''}</button>`,S.logo)+
  (bell?`<div class="card pop">${me.notifs.map(n=>`<p class="${n.read?'':'new'}">${esc(n.text)} <small>${hm(n.created_at)}</small></p>`).join('')||'Уведомлений пока нет'}</div>`:'')+
  `<section class="card hero"><h1>${esc(S.name)}</h1><p>${esc(S.welcome||'')}</p></section>`+
  [...new Set(menu.map(m=>m.category))].map(c=>`<h3>${esc(c)}</h3><div class="grid">${menu.filter(m=>m.category===c).map(m=>`<div class="card dish">${m.photo?`<img src="${esc(m.photo)}" alt="" loading="lazy">`:'<div class="ph">🍽️</div>'}<b>${esc(m.name)}</b><span>${money(m.price)}</span>${cart[m.id]?qty(m.id):`<button class="btn" data-d="1" data-id="${m.id}">В корзину</button>`}</div>`).join('')}</div>`).join('')+
  `<section class="card"><h3>Корзина</h3>${its().map(i=>`<div class="row"><span>${esc(menu.find(x=>x.id===i.id).name)}</span>${qty(i.id)}<button class="ghost" data-x="${i.id}" title="Убрать">✕</button></div>`).join('')||'<p>Добавьте блюда из меню</p>'}
  <div class="row"><b>Итого</b><b>${money(tot())}</b></div>
  <div class="seg">${Object.entries(TY).map(([k,v])=>`<label><input type="radio" name="type" value="${k}" ${f.type===k?'checked':''}>${v}</label>`).join('')}</div>
  ${f.type==='delivery'?`<input name="address" placeholder="Адрес доставки" value="${esc(f.address)}">`:`<select name="point">${pts.map(p=>`<option ${p===f.point?'selected':''}>${esc(p)}</option>`).join('')}</select>`}
  <textarea name="comment" placeholder="Комментарий к заказу">${esc(f.comment)}</textarea><button class="btn" id="go" ${its().length?'':'disabled'}>Заказать</button></section>${map}
  <h3>Мои заказы</h3>${me.orders.slice(0,5).map(o=>`<div class="card row"><span>№${o.id} · ${esc(o.venues?.name||'')} · ${money(o.total)}</span><span class="badge ${o.status}">${ST[o.status]}</span></div>`).join('')||'<p>Заказов пока нет</p>'}`;
  if(a){const e=$(`[name=${a}]`);e&&e.focus()}}
 H.click=async e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.d){cart[d.id]=(cart[d.id]||0)+ +d.d;if(cart[d.id]<1)delete cart[d.id];draw()}
  else if(d.x){delete cart[d.x];draw()}
  else if(b.hasAttribute('data-sw')){localStorage.sv='';shop()}
  else if(b.id==='bl'){bell=!bell;if(!bell){me.notifs.forEach(n=>n.read=true);seen=0;api('notifs/read','POST').catch(()=>{})}else window.Notification&&Notification.requestPermission();draw()}
  else if(b.id==='go'){try{await api('orders','POST',{items:its(),venue:vid,...f});cart={};f.comment='';me=await api('me');toast('Заказ отправлен ✅');draw()}catch(x){toast(x.message)}}};
 H.input=e=>{f[e.target.name]=e.target.value;if(e.target.name==='type')draw()};
 T=setInterval(async()=>{try{const n=await api('me'),u=n.notifs.filter(x=>!x.read);if(u.length>seen){beep();toast('🔔 '+u[0].text);if(window.Notification&&Notification.permission==='granted')new Notification(S.name,{body:u[0].text})}seen=u.length;
  if(JSON.stringify(n)!==JSON.stringify(me)){me=n;draw()}}catch{}},8000);
 draw()}

async function staff(){
 clearInterval(T);const [{venue:S},names]=await Promise.all([api('info?v='+VID()),api('staff/names')]);let os=[],last=-1;
 const rc=o=>`${S.name}\nЧЕК №${o.id}\n${new Date(o.created_at).toLocaleDateString('ru-RU')} ${hm(o.created_at)}\nПринял: ${o.staff_name} (${hm(o.accepted_at)})\nКлиент: ${o.users.nick}, тел. ${o.users.phone}\n${TY[o.type]}: ${o.address||o.point||''}\n----------\n${o.items.map(i=>`${i.name} ×${i.qty} = ${money(i.price*i.qty)}`).join('\n')}\n----------\nИТОГО: ${money(o.total)}${o.comment?'\nКомментарий: '+o.comment:''}`;
 const modal=h=>{const m=document.createElement('div');m.className='modal';m.innerHTML=`<div class="card">${h}</div>`;document.body.append(m);return m};
 const show=o=>{const m=modal('<pre></pre><button class="btn" data-p>Печать</button><button class="ghost" data-c>Закрыть</button>');$('pre',m).textContent=rc(o);m.onclick=e=>{if(e.target.dataset.p!==undefined)print();if(e.target.dataset.c!==undefined||e.target===m)m.remove()}};
 const pick=cb=>{const m=modal(`<h3>Кто принимает заказ?</h3><div class="names">${names.map(n=>`<button class="btn" data-n="${n.id}">${esc(n.name)}<small>${esc(n.position||'')}</small></button>`).join('')}</div><button class="ghost" data-c>Отмена</button>`);
  m.onclick=e=>{const b=e.target.closest('button'),d=b?b.dataset:{};if(d.n){m.remove();cb(d.n)}else if(d.c!==undefined||e.target===m)m.remove()}};
 const draw=async()=>{try{os=await api('staff/orders')}catch{return}const mx=Math.max(0,...os.map(o=>o.id));if(last>=0&&mx>last){beep();toast('🔔 Новый заказ!')}last=Math.max(last,mx);
  $('#app').innerHTML=head('Приём заказов · '+S.name,'',S.logo)+`<div class="grid">${os.map(o=>`<div class="card"><b>№${o.id}</b> <span class="badge ${o.status}">${ST[o.status]}</span><p>${o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join('<br>')}</p><p>${TY[o.type]}: ${esc(o.address||o.point||'')}<br>${esc(o.users.nick)}, ${esc(o.users.phone)}${o.comment?`<br>${esc(o.comment)}`:''}</p><b>${money(o.total)}</b> <small>${hm(o.created_at)}</small>${o.status==='new'?`<button class="btn" data-a="accept" data-id="${o.id}">Принят</button>`:`<button class="btn" data-a="ready" data-id="${o.id}">Заказ готов</button><button class="ghost" data-a="chek" data-id="${o.id}">Показать чек</button>`}</div>`).join('')||'<p>Новых заказов нет</p>'}</div>`};
 H.click=e=>{const d=e.target.dataset;if(!d.a)return;if(d.a==='chek')return show(os.find(o=>o.id==d.id));
  const act=async x=>{try{const o=await api(`staff/orders/${d.id}/${d.a}`,'POST',x);if(d.a==='accept')show(o);toast(d.a==='accept'?'Принят, клиент уведомлён':'Клиент уведомлён: заказ готов');await draw()}catch(er){toast(er.message)}};
  if(d.a==='accept'){if(!names.length)return toast('Сначала добавьте сотрудников в админке');pick(n=>act({staff:n}))}else act({})};
 await draw();T=setInterval(draw,6000)}

let AM=[],AV={};
async function adminHTML(){const [i,st]=await Promise.all([api('info?v='+VID()),api('admin/staff')]),v=AV=i.venue;AM=i.menu;
 return `<form class="card" data-f="vf"><h3>Заведение</h3><input name="name" value="${esc(v.name)}" placeholder="Название" required><input name="logo" value="${esc(v.logo||'')}" placeholder="Логотип: ссылка https://…"><textarea name="welcome" placeholder="Приветствие">${esc(v.welcome||'')}</textarea><textarea name="points" placeholder="Точки выдачи — по одной в строке">${esc((v.points||[]).join('\n'))}</textarea><input name="address" value="${esc(v.address||'')}" placeholder="Адрес"><div class="seg"><input name="lat" value="${v.lat??''}" placeholder="Широта"><input name="lng" value="${v.lng??''}" placeholder="Долгота"></div><button type="button" class="ghost" data-geo>📍 Определить по моему положению</button><button class="btn">Сохранить</button></form>
 <form class="card" data-f="mf"><h3>Блюдо</h3><input type="hidden" name="id"><input name="name" placeholder="Название" required><input name="category" placeholder="Раздел (Горячее, Напитки…)"><input name="price" type="number" min="0" step="0.01" placeholder="Цена" required><input name="photo" placeholder="Фото: ссылка https://…"><button class="btn">Сохранить блюдо</button></form>
 <div class="grid">${AM.map(m=>`<div class="card row"><span>${esc(m.name)}<br><small>${money(m.price)}</small></span><span><button class="ghost" data-e="${m.id}" title="Изменить">✎</button><button class="ghost" data-m="${m.id}" title="Удалить">🗑</button></span></div>`).join('')}</div>
 <form class="card" data-f="tf"><h3>Сотрудники (выбирают своё имя при приёме заказа)</h3><input name="name" placeholder="Имя" required><input name="position" placeholder="Должность (официант, повар…)"><button class="btn">Добавить</button>${st.map(u=>`<div class="row"><span>${esc(u.name)} <small>${esc(u.position||'')}</small></span><button type="button" class="ghost" data-s="${u.id}" title="Удалить">🗑</button></div>`).join('')}</form>`}
const adminH=R=>({
 async submit(e){e.preventDefault();const t=e.target.dataset.f,f=Object.fromEntries(new FormData(e.target));
  try{await api(t==='vf'?'admin/venue':t==='mf'?'admin/menu':'admin/staff','POST',t==='vf'?{...f,points:f.points.split('\n')}:f);toast('Сохранено ✅');await R()}catch(x){toast(x.message)}},
 async click(e){const d=e.target.dataset;try{
  if(d.e){const m=AM.find(x=>x.id==d.e);for(const k of['id','name','category','price','photo'])$(`[data-f=mf] [name=${k}]`).value=m[k]??'';$('[data-f=mf]').scrollIntoView({behavior:'smooth'})}
  if(d.geo!==undefined)navigator.geolocation.getCurrentPosition(p=>{$('[name=lat]').value=p.coords.latitude.toFixed(6);$('[name=lng]').value=p.coords.longitude.toFixed(6)},()=>toast('Нет доступа к геолокации'));
  if(d.m&&confirm('Удалить блюдо?')){await api('admin/menu/'+d.m,'DELETE');await R()}
  if(d.s&&confirm('Удалить сотрудника?')){await api('admin/staff/'+d.s,'DELETE');await R()}}catch(x){toast(x.message)}}});
async function admin(){clearInterval(T);const R=async()=>{const h=await adminHTML();$('#app').innerHTML=head('Админ · '+AV.name,'',AV.logo)+h},hh=adminH(R);H.click=hh.click;H.submit=hh.submit;await R()}

async function owner(){
 clearInterval(T);let vs=[],tab='stats';const cur=()=>vs.find(v=>v.id==VID());
 const bars=(a,l,u='')=>{const m=Math.max(...a,1);return`<div class="bars">${a.map((v,i)=>`<div title="${l[i]}: ${v}${u}"><i style="height:${v/m*100}%"></i><small>${l[i]}</small></div>`).join('')}</div>`};
 const statsHTML=async()=>{const d=await api('owner/stats'),ph=d.hours.indexOf(Math.max(...d.hours)),W=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],pd=d.wd.indexOf(Math.max(...d.wd)),kpi=(t,v)=>`<div class="card kpi"><small>${t}</small><b>${v}</b></div>`;
  return `<div class="grid">${kpi('Выручка',money(d.sum))+kpi('Заказов',d.count)+kpi('Средний чек',money(d.avg))+kpi('Ожидание принятия',d.accept+' мин')+kpi('Время готовки',d.cook+' мин')}</div>
 <div class="card"><h3>Когда больше заказов</h3><p>${d.count?`Пик: <b>${ph}:00–${ph+1}:00</b>. Самый загруженный день: <b>${W[pd]}</b>.`:'Данных пока нет'}</p>${bars(d.hours,[...Array(24).keys()])}${bars(d.wd,W)}</div>
 <div class="card"><h3>Выручка по дням</h3>${bars(d.days.map(x=>x[1]),d.days.map(x=>x[0]),' сом')}</div>
 <div class="card"><h3>Топ блюд</h3>${d.top.map(([n,c])=>`<div class="hb"><span>${esc(n)}</span><i style="width:${c/d.top[0][1]*100}%"></i><b>${c}</b></div>`).join('')||'Данных пока нет'}</div>
 <div class="card"><h3>Последние заказы</h3>${d.recent.map(o=>`<div class="row"><span>№${o.id} · ${esc(o.users?.nick)} · ${hm(o.created_at)}</span><span>${money(o.total)} <span class="badge ${o.status}">${ST[o.status]}</span></span></div>`).join('')}</div>
 <button class="btn" id="bk">Скачать резервную копию (все объекты, JSON)</button>`};
 const accHTML=v=>`<div class="card"><h3>Доступы объекта</h3><p><small>«Терминал» входит в программу приёма заказов (/staff), «Администратор» управляет меню и сотрудниками (/admin).</small></p>${v.accounts.map(a=>`<div class="row"><span>${a.role==='admin'?'Админ':'Терминал'}: <b>${esc(a.login)}</b></span><button class="ghost" data-ad="${a.id}" title="Удалить">🗑</button></div>`).join('')||'<p>Пока нет</p>'}</div>
 <form class="card" data-f="ac"><h3>Новый доступ</h3><select name="role"><option value="terminal">Терминал (приём заказов)</option><option value="admin">Администратор</option></select><input name="login" placeholder="Логин (латиницей/цифры)" required><input name="password" placeholder="Пароль (от 8 символов)" minlength="8" required><button class="btn">Создать</button></form>`;
 const R=async()=>{vs=await api('owner/venues');const v=cur();
  if(!v){$('#app').innerHTML=head('Владелец')+`<h3>Ваши объекты</h3><div class="grid">${vs.map(x=>`<button class="card vcard" data-vs="${x.id}">${x.logo?`<img class="logo big" src="${esc(x.logo)}" alt="">`:'<div class="ph">🍽️</div>'}<b>${esc(x.name)}</b></button>`).join('')}</div><form class="card" data-f="nv"><h3>＋ Новый объект</h3><input name="name" placeholder="Название заведения" required><button class="btn">Создать</button></form>`;return}
  const body=tab==='stats'?await statsHTML():tab==='manage'?await adminHTML():accHTML(v);
  $('#app').innerHTML=head(v.name,'<button class="ghost" data-back>⇄ Объекты</button>',v.logo)+`<nav class="tabs">${[['stats','Статистика'],['manage','Управление'],['acc','Доступы']].map(([k,t])=>`<button class="${tab===k?'on':''}" data-tab="${k}">${t}</button>`).join('')}</nav>`+body;
  if(tab==='stats')$('#bk').onclick=async()=>{const r=await fetch('/api/owner/backup',{headers:{Authorization:'Bearer '+localStorage[K]}}),a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download='backup-'+new Date().toISOString().slice(0,10)+'.json';a.click()}};
 const hh=adminH(R);
 H.click=async e=>{const d=e.target.closest('[data-vs],[data-back],[data-tab],[data-ad]')?.dataset||{};
  if(d.vs){localStorage.v_owner=d.vs;tab='stats';return R()}
  if(d.back!==undefined){localStorage.v_owner='';return R()}
  if(d.tab){tab=d.tab;return R()}
  if(d.ad){if(confirm('Удалить доступ?'))try{await api('owner/accounts/'+d.ad,'DELETE');R()}catch(x){toast(x.message)}return}
  hh.click(e)};
 H.submit=async e=>{const t=e.target.dataset.f;if(t!=='nv'&&t!=='ac')return hh.submit(e);e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
  try{if(t==='nv'){const v=await api('owner/venues','POST',f);localStorage.v_owner=v.id;tab='manage'}else{await api('owner/accounts','POST',f);toast('Доступ создан ✅')}R()}catch(x){toast(x.message)}};
 await R()}

const boot=()=>localStorage[K]?({shop,staff,admin,owner})[A]().catch(x=>toast(x.message)):authView();boot();
