const $=(s,r=document)=>r.querySelector(s),A=document.body.dataset.app,K='tk_'+A,VID=()=>localStorage['v_'+A]||'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const money=n=>Number(n).toLocaleString('ru-RU')+' сом',hm=d=>new Date(d).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
const TY={takeaway:'С собой',dinein:'В заведении',delivery:'Доставка'},ST={new:'Ожидает',accepted:'Готовится',ready:'Готов!',closed:'Завершён',rejected:'Отклонён'};
const ROLES={shop:['customer'],staff:['terminal','admin'],admin:['admin'],owner:['owner'],waiter:['waiter']};
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

function fm(title,fields,save){const el=document.createElement('div');el.className='modal';
 el.innerHTML=`<form class="card"><h3>${esc(title)}</h3>${fields.map(([n,ph,v])=>`<input name="${n}" placeholder="${esc(ph)}" value="${esc(v||'')}" autocomplete="off">`).join('')}<button class="btn">Сохранить</button><button type="button" class="ghost" data-c>Отмена</button></form>`;
 el.onclick=e=>{if(e.target===el||e.target.dataset.c!==undefined)el.remove()};
 el.onsubmit=async e=>{e.preventDefault();try{await save(Object.fromEntries(new FormData(e.target)));el.remove();toast('Сохранено ✅')}catch(x){toast(x.message)}};document.body.append(el)}
const shrink=file=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,1100/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.7))};i.onerror=no;i.src=r.result};r.onerror=no;r.readAsDataURL(file)});
const qrBox=(S,amt)=>`<div class="qrbox"><div class="qrimg"><img class="qr" src="${esc(S.qr)}" alt="QR"><span class="qrlogo">${S.logo?`<img src="${esc(S.logo)}" alt="">`:'🍔'}</span></div><div class="qrprice">${money(amt)}</div></div>`;
function authView(){let reg=0;const sh=A==='shop',draw=()=>{
 $('#app').innerHTML=`<form class="card login" id="lf"><h2>${reg?'Регистрация':'Вход'}</h2>${reg?'<input name="name" placeholder="Имя" required><input name="nick" placeholder="Ник"><input name="phone" placeholder="Телефон" required>':`<input name="login" placeholder="${sh?'Телефон':'Логин'}" required autocomplete="username">`}<input name="password" type="password" placeholder="Пароль" required minlength="6" autocomplete="current-password"><button class="btn">${reg?'Создать аккаунт':'Войти'}</button>${sh?`<a href="#" id="sw">${reg?'Уже есть аккаунт':'Регистрация'}</a>`:''}</form>`;
 if($('#sw'))$('#sw').onclick=e=>{e.preventDefault();reg=!reg;draw()};
 $('#lf').onsubmit=async e=>{e.preventDefault();try{const d=await api(reg?'register':'login','POST',Object.fromEntries(new FormData(e.target)));if(!ROLES[A].includes(d.role))throw Error('Нет доступа');localStorage[K]=d.token;localStorage.nm=d.name;if(A!=='owner')localStorage['v_'+A]=d.venue||'';boot()}catch(x){toast(x.message)}}};draw()}

const EM={Бургеры:'🍔',Шаурма:'🌯',Кесадилья:'🫓',Пицца:'🍕',Пинца:'🍕',Роллы:'🍣','Запеченные роллы':'🍣','Горячие роллы':'🍤','Мини роллы':'🍙',Сеты:'🍱',Комбо:'🎁',Рамен:'🍜',Супы:'🍲',Салаты:'🥗',Закуски:'🍗',Добавки:'➕',Десерты:'🍰',Чай:'🍵',Кофе:'☕',Лимонады:'🍹',Напитки:'🥤'},emo=c=>EM[c]||'🍽️';
async function shop(){
 clearInterval(T);const vs=await api('venues');let vid=vs.length===1?vs[0].id:localStorage.sv;
 if(!vs.find(x=>x.id==vid)){$('#app').innerHTML=head('Выберите заведение')+`<div class="grid">${vs.map(v=>`<button class="card vcard" data-v="${v.id}">${v.logo?`<img class="logo big" src="${esc(v.logo)}" alt="">`:'<div class="ph">🍔</div>'}<b>${esc(v.name)}</b><small>${esc(v.welcome||'')}</small></button>`).join('')||'<p>Заведений пока нет</p>'}</div>`;
  H.click=e=>{const b=e.target.closest('[data-v]');if(b){localStorage.sv=b.dataset.v;shop()}};return}
 const {venue:S,menu}=await api('info?v='+vid),pts=S.points||[],cats=[...new Set(menu.map(m=>m.category))];
 let tbs=await api('tables?v='+vid),me=await api('me'),cart={},bell=0,pg='menu',cat=cats[0]||'',q='',seen=me.notifs.filter(n=>!n.read).length,f={type:'takeaway',point:pts[0]||'',address:'',comment:'',table:'',pay:'cash',given:'',receipt:''};
 const its=()=>Object.entries(cart).map(([id,qty])=>({id:+id,qty})),tot=()=>its().reduce((s,i)=>s+menu.find(m=>m.id===i.id).price*i.qty,0),cnt=()=>Object.values(cart).reduce((a,b)=>a+b,0);
 const qty=id=>`<div class="qty"><button data-d="-1" data-id="${id}">−</button><b>${cart[id]}</b><button data-d="1" data-id="${id}">+</button></div>`;
 const card=m=>`<div class="card dish"><div class="pic">${m.photo?`<img src="${esc(m.photo)}" alt="" loading="lazy">`:`<span>${emo(m.category)}</span>`}<em class="tag">${money(m.price)}</em></div><b>${esc(m.name)}</b>${m.description?`<small class="ds">${esc(m.description)}</small>`:''}<div class="act">${m.description?`<button class="ghost more" data-i="${m.id}">Подробнее</button>`:'<i></i>'}${cart[m.id]?qty(m.id):`<button class="btn sm" data-d="1" data-id="${m.id}">+ В корзину</button>`}</div></div>`;
 const items=()=>{const k=q.trim().toLowerCase();return menu.filter(m=>k?(m.name+' '+m.category+' '+(m.description||'')).toLowerCase().includes(k):m.category===cat)};
 const list=()=>{const a=items();return a.length?`<div class="grid">${a.map(card).join('')}</div>`:'<p class="muted">Ничего не найдено</p>'};
 const chips=()=>cats.map(c=>`<button class="chip ${c===cat&&!q?'on':''}" data-cat="${esc(c)}">${emo(c)} ${esc(c)}</button>`).join('');
 const chg=()=>{const t=tot(),g=+f.given||0;return g>=t&&t?`Сдача: <b>${money(g-t)}</b>`:g&&t?'Сумма меньше заказа':''};
 const map=S.lat!=null&&S.lng!=null?`<div class="card map"><b>📍 ${esc(S.address||'Как добраться')}</b><iframe loading="lazy" title="Карта" src="https://www.openstreetmap.org/export/embed.html?bbox=${S.lng-.006}%2C${S.lat-.004}%2C${S.lng+.006}%2C${S.lat+.004}&layer=mapnik&marker=${S.lat}%2C${S.lng}"></iframe><div class="seg"><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${S.lat},${S.lng}">Маршрут · Google</a><a class="btn alt" target="_blank" rel="noopener" href="https://yandex.ru/maps/?rtext=~${S.lat},${S.lng}&rtt=auto">Маршрут · Яндекс</a></div></div>`:'';
 const pages={
  menu:()=>`<div class="search"><input name="q" type="search" placeholder="🔍 Найти: бургер, ролл, пицца…" value="${esc(q)}" autocomplete="off"></div><div class="chips" id="chips">${chips()}</div><div id="items">${list()}</div>`,
  cart:()=>`<section class="card"><h3>Корзина</h3>${its().map(i=>`<div class="row"><span>${esc(menu.find(x=>x.id===i.id).name)}</span>${qty(i.id)}<button class="ghost" data-x="${i.id}" title="Убрать">✕</button></div>`).join('')||'<p class="muted">Пусто — выберите блюда в меню</p>'}<div class="row"><b>Итого</b><b class="big">${money(tot())}</b></div></section>
  <section class="card"><h3>Получение</h3><div class="seg">${Object.entries(TY).map(([k,v])=>`<label><input type="radio" name="type" value="${k}" ${f.type===k?'checked':''}>${v}</label>`).join('')}</div>
  ${f.type==='delivery'?`<input name="address" placeholder="Адрес доставки" value="${esc(f.address)}">`:f.type==='dinein'&&tbs.length?`<p><b>Выберите свободный стол</b></p><div class="tables">${tbs.map(t=>`<button class="tbl ${t.busy?'busy':f.table==t.id?'sel':'free'}" data-tb="${t.id}" ${t.busy?'disabled':''}><b>№${t.num}</b><small>${t.busy?'Занят':f.table==t.id?'Ваш стол':'Свободен'}</small></button>`).join('')}</div>`:`<select name="point">${pts.map(p=>`<option ${p===f.point?'selected':''}>${esc(p)}</option>`).join('')}</select>`}</section>
  <section class="card"><h3>Оплата</h3><div class="seg">${[['cash','💵 Наличными'],...(S.qr?[['online','📱 Онлайн (QR)']]:[])].map(([k,v])=>`<label><input type="radio" name="pay" value="${k}" ${f.pay===k?'checked':''}>${v}</label>`).join('')}</div>${f.pay==='cash'?`<input name="given" type="number" min="0" placeholder="С какой суммы приготовить сдачу? (необязательно)" value="${esc(f.given)}"><p class="chg" id="chg">${chg()}</p>`:`${qrBox(S,tot())}<p class="muted">Отсканируйте QR в банковском приложении, введите сумму ${money(tot())} и оплатите. Затем загрузите скриншот чека.</p><label class="file">🧾 ${f.receipt?'Чек загружен ✅ — заменить':'Загрузить чек'}<input name="rf" type="file" accept="image/*" hidden></label>${f.receipt?`<img class="rprev" src="${f.receipt}" alt="Чек">`:''}`}</section>
  <section class="card"><textarea name="comment" placeholder="Комментарий к заказу">${esc(f.comment)}</textarea><button class="btn" id="go" ${its().length?'':'disabled'}>Заказать · ${money(tot())}</button></section>`,
  orders:()=>`<h3>Мои заказы</h3>${me.orders.map(o=>`<div class="card"><div class="row"><b>№${o.id} · ${money(o.total)}</b><span class="badge ${o.status}">${ST[o.status]}</span></div><small class="muted">${o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join(', ')}</small><div class="muted">${hm(o.created_at)} · ${TY[o.type]}${o.point?' · '+esc(o.point):''} · ${o.paid?'✅ оплачено':o.pay_method==='online'?'📱 онлайн':'💵 наличными'}</div></div>`).join('')||'<p class="muted">Заказов пока нет</p>'}`,
  about:()=>`<section class="card hero">${S.logo?`<img class="logo big" src="${esc(S.logo)}" alt="">`:'<div class="bun">🍔</div>'}<h1>${esc(S.name)}</h1><p>${esc(S.welcome||'')}</p></section>${map}${vs.length>1?'<button class="btn alt" data-sw>⇄ Другое заведение</button>':''}`};
 const NAV=[['menu','🍔','Меню'],['cart','🛒','Корзина'],['orders','🧾','Заказы'],['about','📍','О нас']];
 function draw(){const a=document.activeElement.name,un=me.notifs.filter(n=>!n.read).length;
  $('#app').innerHTML=head(S.name,`<button class="ghost ${un?'shake':''}" id="bl">🔔${un?`<i class="dot">${un}</i>`:''}</button>`,S.logo)+
  (bell?`<div class="card pop">${me.notifs.map(n=>`<p class="${n.read?'':'new'}">${esc(n.text)} <small>${hm(n.created_at)}</small></p>`).join('')||'Уведомлений пока нет'}</div>`:'')+`<div class="pg">${pages[pg]()}</div>`+
  (pg==='menu'&&cnt()?`<button class="cartbar" data-p="cart"><span>🛒 ${cnt()} · ${money(tot())}</span><b>Оформить →</b></button>`:'')+
  `<nav class="bnav">${NAV.map(([k,i,t])=>`<button class="${pg===k?'on':''}" data-p="${k}"><span>${i}</span>${t}${k==='cart'&&cnt()?`<i class="dot">${cnt()}</i>`:''}</button>`).join('')}</nav>`;
  if(a){const e=$(`[name=${a}]`);if(e){e.focus();try{e.setSelectionRange(e.value.length,e.value.length)}catch{}}}}
 H.click=async e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.p){pg=d.p;bell=0;draw();scrollTo(0,0)}
  else if(d.cat!==undefined){cat=d.cat;q='';draw()}
  else if(d.d){cart[d.id]=(cart[d.id]||0)+ +d.d;if(cart[d.id]<1)delete cart[d.id];draw()}
  else if(d.i){const m=menu.find(x=>x.id==d.i),el=document.createElement('div');el.className='modal';el.innerHTML=`<div class="card">${m.photo?`<img class="dimg" src="${esc(m.photo)}" alt="">`:`<div class="ph">${emo(m.category)}</div>`}<h3>${esc(m.name)}</h3><p><b>${money(m.price)}</b></p><p>${esc(m.description||'')}</p><button class="btn" data-add="${m.id}">В корзину</button><button class="ghost" data-c>Закрыть</button></div>`;
   el.onclick=ev=>{const x=ev.target.closest('button'),y=x?x.dataset:{};if(y.add){cart[y.add]=(cart[y.add]||0)+1;draw()}if(y.add||y.c!==undefined||ev.target===el)el.remove()};document.body.append(el)}
  else if(d.tb){f.table=d.tb;draw()}
  else if(d.x){delete cart[d.x];draw()}
  else if(b.hasAttribute('data-sw')){localStorage.sv='';shop()}
  else if(b.id==='bl'){bell=!bell;if(!bell){me.notifs.forEach(n=>n.read=true);seen=0;api('notifs/read','POST').catch(()=>{})}else window.Notification&&Notification.requestPermission();draw()}
  else if(b.id==='go'){if(f.pay==='online'&&!f.receipt)return toast('Сначала оплатите по QR и загрузите чек');try{await api('orders','POST',{items:its(),venue:vid,...f});cart={};f.comment='';f.given='';f.receipt='';me=await api('me');tbs=await api('tables?v='+vid);f.table='';pg='orders';toast('Заказ отправлен ✅');draw();scrollTo(0,0)}catch(x){toast(x.message)}}};
 H.input=e=>{const n=e.target.name,v=e.target.value;if(n==='rf'){const fl=e.target.files[0];if(fl)shrink(fl).then(r=>{f.receipt=r;draw()}).catch(()=>toast('Не удалось прочитать файл'));return}if(n==='q'){q=v;$('#items').innerHTML=list();$('#chips').innerHTML=chips();return}f[n]=v;if(n==='given'){$('#chg').innerHTML=chg();return}if(n==='type'||n==='pay')draw()};
 T=setInterval(async()=>{try{const n=await api('me'),u=n.notifs.filter(x=>!x.read);if(u.length>seen){beep();toast('🔔 '+u[0].text);if(window.Notification&&Notification.permission==='granted')new Notification(S.name,{body:u[0].text})}seen=u.length;
  const nt=await api('tables?v='+vid);if(JSON.stringify(n)!==JSON.stringify(me)||JSON.stringify(nt)!==JSON.stringify(tbs)){me=n;tbs=nt;draw()}}catch{}},8000);
 draw()}

const NAMEOF=o=>o.users?.nick||'Гость',PAY={cash:'Наличные',online:'Онлайн'},payInfo=o=>(o.paid?'✅ Оплачено · ':'⏳ Не оплачено · ')+(PAY[o.pay_method]||'Наличные')+(o.cash_given&&!o.paid?` · сдача с ${money(o.cash_given)} → ${money(o.cash_given-o.total)}`:'');
function bellKit(){const k={ev:[],un:0,seen:{},ini:0,open:0,
 feed(os){os.forEach(o=>{const p=k.seen[o.id],w=o.point||TY[o.type];if(k.ini&&p===undefined&&o.status==='new')k.add(`Новый заказ №${o.id} · ${w}`);if(k.ini&&p&&p!==o.status&&o.status==='ready')k.add(`Заказ №${o.id} (${w}) готов`);k.seen[o.id]=o.status});k.ini=1},
 add(t){k.ev.unshift({t,at:new Date()});k.un++;beep();toast('🔔 '+t)},
 btn(){return `<button class="ghost" id="bl">🔔${k.un?`<i class="dot">${k.un}</i>`:''}</button>`},
 pop(){return k.open?`<div class="card pop">${k.ev.map(e=>`<p>${esc(e.t)} <small>${hm(e.at)}</small></p>`).join('')||'Пока пусто'}</div>`:''}};return k}
const staff=()=>desk('staff'),waiter=()=>desk('waiter');
async function desk(kind){
 clearInterval(T);const W=kind==='waiter',[{venue:S,menu},names]=await Promise.all([api('info?v='+VID()),W?[]:api('staff/names')]);let os=[],tb=[],tab=W?'tables':'orders';const bk=bellKit();
 const rc=o=>`${S.name}\nЧЕК №${o.id}\n${new Date(o.created_at).toLocaleDateString('ru-RU')} ${hm(o.created_at)}\nПринял: ${o.staff_name} (${hm(o.accepted_at)})\nКлиент: ${NAMEOF(o)}, тел. ${o.users?.phone||'—'}\n${TY[o.type]}: ${o.address||o.point||''}\n----------\n${o.items.map(i=>`${i.name} ×${i.qty} = ${money(i.price*i.qty)}`).join('\n')}\n----------\nИТОГО: ${money(o.total)}\nОплата: ${PAY[o.pay_method]||'—'}${o.paid?' (оплачено)':''}${o.paid&&o.cash_given?`\nПолучено: ${money(o.cash_given)}, сдача: ${money(o.cash_given-o.total)}`:''}${o.comment?'\nКомментарий: '+o.comment:''}`;
 const modal=h=>{const m=document.createElement('div');m.className='modal';m.innerHTML=`<div class="card">${h}</div>`;document.body.append(m);return m};
 const show=o=>{const m=modal('<pre></pre><button class="btn" data-p>Печать</button><button class="ghost" data-c>Закрыть</button>');$('pre',m).textContent=rc(o);m.onclick=e=>{if(e.target.dataset.p!==undefined)print();if(e.target.dataset.c!==undefined||e.target===m)m.remove()}};
 const pick=cb=>{if(!names.length)return toast('Сначала добавьте сотрудников в админке');const m=modal(`<h3>Кто принимает заказ?</h3><div class="names">${names.map(n=>`<button class="btn" data-n="${n.id}">${esc(n.name)}<small>${esc(n.position||'')}</small></button>`).join('')}</div><button class="ghost" data-c>Отмена</button>`);
  m.onclick=e=>{const b=e.target.closest('button'),d=b?b.dataset:{};if(d.n){m.remove();cb(d.n)}else if(d.c!==undefined||e.target===m)m.remove()}};
 const qrModal=amt=>{if(!S.qr)return toast('QR оплаты не настроен');const m=modal(qrBox(S,amt)+'<button class="ghost" data-c>Закрыть</button>');m.onclick=e=>{if(e.target===m||e.target.dataset.c!==undefined)m.remove()}};
 const confirmReject=(o,done)=>{const m=modal(`<h3>Отклонить заказ №${o.id}?</h3><p>Клиент получит уведомление об отказе. Вы уверены?</p><input name="why" placeholder="Причина (необязательно): чек не подходит, нет блюда…"><button class="btn danger" data-y>Да, отклонить</button><button class="ghost" data-c>Нет, вернуться</button>`);
  m.onclick=async e=>{const d=e.target.dataset;if(d.y!==undefined){try{await api(`staff/orders/${o.id}/reject`,'POST',{reason:$('[name=why]',m).value});m.remove();toast('Заказ отклонён');done()}catch(x){toast(x.message)}}else if(d.c!==undefined||e.target===m)m.remove()}};
 const review=(o,accept)=>{const m=modal(`<h3>Чек · заказ №${o.id}</h3><p>Сумма заказа: <b>${money(o.total)}</b>. Сверьте сумму, дату и получателя.</p><div id="rcv" class="muted">Загрузка…</div><button class="btn" data-ok>Чек настоящий — принять</button><button class="btn danger" data-no>Отказать</button><button class="ghost" data-c>Закрыть</button>`);
  api(`staff/orders/${o.id}/receipt`).then(r=>{$('#rcv',m).innerHTML=r.data?`<img class="rbig" src="${r.data}" alt="Чек">`:'Чек не найден'}).catch(x=>toast(x.message));
  m.onclick=e=>{const d=e.target.dataset;if(d.ok!==undefined){m.remove();accept()}else if(d.no!==undefined){m.remove();confirmReject(o,draw)}else if(d.c!==undefined||e.target===m)m.remove()}};
 const payModal=(o,done)=>{const m=modal(''),st={mt:o.pay_method||'cash',g:o.cash_given||''};
  const chg=()=>{const g=+st.g||0;return g>=o.total?`Сдача: <b>${money(g-o.total)}</b>`:g?`Не хватает: ${money(o.total-g)}`:''};
  const paint=()=>{m.firstChild.innerHTML=`<h3>Оплата · №${o.id}</h3><p class="big">К оплате: <b>${money(o.total)}</b></p><div class="seg">${[['cash','💵 Наличные'],['online','📱 Онлайн']].map(([k,v])=>`<button class="btn ${st.mt===k?'':'alt'}" data-mt="${k}">${v}</button>`).join('')}</div>${st.mt==='cash'?`<input name="g" type="number" placeholder="Получено от клиента" value="${st.g}"><p class="chg" id="ch">${chg()}</p>`:'<p class="muted">Подтвердите, что перевод или оплата картой получены.</p>'}<button class="btn" data-ok>Оплата получена</button><button class="ghost" data-c>Отмена</button>`};
  paint();m.oninput=e=>{st.g=e.target.value;$('#ch').innerHTML=chg()};
  m.onclick=async e=>{const b=e.target.closest('button'),d=b?b.dataset:{};if(d.mt){st.mt=d.mt;paint()}else if(d.ok!==undefined){try{await api(`staff/orders/${o.id}/pay`,'POST',{method:st.mt,given:st.g});m.remove();toast('Оплата принята ✅');done&&done()}catch(x){toast(x.message)}}else if(d.c!==undefined||e.target===m)m.remove()}};
 const sheet=t=>{const cart={},o=t.order,m=modal(''),cs=[...new Set(menu.map(x=>x.category))];let sq='',sc='';
  const lst=()=>{const k=sq.trim().toLowerCase(),a=menu.filter(x=>(!sc||x.category===sc)&&(!k||x.name.toLowerCase().includes(k)));return a.map(x=>`<div class="row"><span>${esc(x.name)}<br><small>${money(x.price)}</small></span><div class="qty"><button data-d="-1" data-id="${x.id}">−</button><b>${cart[x.id]||0}</b><button data-d="1" data-id="${x.id}">+</button></div></div>`).join('')||'<p class="muted">Ничего не найдено</p>'};
  const paint=()=>{const sum=Object.entries(cart).reduce((a,[id,q])=>a+menu.find(x=>x.id==id).price*q,0);
   m.firstChild.innerHTML=`<h3>Стол №${t.num}${o?` · заказ №${o.id}`:''}</h3>${o?`<p>${ST[o.status]} · ${money(o.total)}<br>${payInfo(o)}</p><button class="btn alt" data-qr>📱 QR для оплаты · ${money(o.total)}</button>`:''}${!W&&o?`<div class="seg">${o.status==='accepted'?'<button class="btn" data-rdy>Заказ готов</button>':''}${o.paid?'<button class="btn alt" data-cl>Закрыть стол</button>':'<button class="btn alt" data-pay>💳 Принять оплату</button>'}</div>`:''}<input name="sq" type="search" placeholder="🔍 Поиск блюда" value="${esc(sq)}"><select name="sc"><option value="">Все разделы</option>${cs.map(c=>`<option ${c===sc?'selected':''}>${esc(c)}</option>`).join('')}</select><div class="sheet" id="sl">${lst()}</div><button class="btn" data-ok ${sum?'':'disabled'}>${o?'Добавить к заказу':'Отправить в работу'} · ${money(sum)}</button><button class="ghost" data-c>Закрыть</button>`};
  paint();
  m.oninput=e=>{if(e.target.name==='sq')sq=e.target.value;else if(e.target.name==='sc')sc=e.target.value;else return;$('#sl',m).innerHTML=lst()};
  m.onclick=async e=>{const b=e.target.closest('button');if(!b){if(e.target===m)m.remove();return}const d=b.dataset;
   if(d.d){cart[d.id]=Math.max(0,(cart[d.id]||0)+ +d.d);paint()}
   else if(d.c!==undefined)m.remove();
   else if(d.qr!==undefined)qrModal(o.total);
   else if(d.pay!==undefined)payModal(o,()=>{m.remove();draw()});
   else if(d.ok!==undefined){const go=async who=>{try{await api('staff/new-order','POST',{table:t.id,staff:who,items:Object.entries(cart).filter(([,q])=>q).map(([id,q])=>({id:+id,qty:q}))});m.remove();toast('Заказ отправлен ✅');draw()}catch(x){toast(x.message)}};W?go():pick(go)}
   else if(d.rdy!==undefined||d.cl!==undefined){try{await api(`staff/orders/${o.id}/${d.rdy!==undefined?'ready':'close'}`,'POST',{});m.remove();draw()}catch(x){toast(x.message)}}}};
  const ordHTML=()=>`<div class="grid">${os.filter(o=>o.status!=='ready').map(o=>`<div class="card"><b>№${o.id}</b> <span class="badge ${o.status}">${ST[o.status]}</span><p>${o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join('<br>')}</p><p>${TY[o.type]}: ${esc(o.address||o.point||'')}<br>${esc(NAMEOF(o))}, ${esc(o.users?.phone||'')}${o.comment?`<br>${esc(o.comment)}`:''}</p><b>${money(o.total)}</b> <small>${hm(o.created_at)}</small><p>${payInfo(o)}</p>${o.status==='new'?`${o.pay_method==='online'?`<button class="btn" data-a="review" data-id="${o.id}">🧾 Проверить чек${o.has_receipt?'':' (нет!)'}</button>`:`<button class="btn" data-a="accept" data-id="${o.id}">Принят</button>`}<button class="btn danger" data-a="reject" data-id="${o.id}">Отказ</button>`:`<button class="btn" data-a="ready" data-id="${o.id}">Заказ готов</button>${o.paid?'':`<button class="btn alt" data-a="pay" data-id="${o.id}">💳 Принять оплату</button>`}<button class="ghost" data-a="chek" data-id="${o.id}">Показать чек</button>`}</div>`).join('')||'<p>Новых заказов нет</p>'}</div>`;
 const tblHTML=()=>`<div class="tables">${tb.map(t=>`<button class="tbl ${t.busy?'busy':'free'}" data-t="${t.id}"><b>Стол №${t.num}</b><small>${t.busy?`${esc(t.order.waiter||'Гость')} · ${money(t.order.total)}`:'Свободен'}</small></button>`).join('')||'<p>Столы не добавлены (админка → Столы)</p>'}</div>`;
 const render=()=>{$('#app').innerHTML=head((W?'Официант · ':'Приём · ')+S.name,bk.btn(),S.logo)+bk.pop()+(W?'':`<nav class="tabs">${[['orders','Заказы'],['tables','Столы / новый заказ']].map(([k,t])=>`<button class="${tab===k?'on':''}" data-tab="${k}">${t}</button>`).join('')}</nav>`)+(tab==='orders'?ordHTML():tblHTML())};
 const draw=async()=>{try{[os,tb]=await Promise.all([api('staff/orders'),api('staff/tables')])}catch{return}bk.feed(os);render()};
 H.click=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(b.id==='bl'){bk.open=!bk.open;if(!bk.open)bk.un=0;return render()}
  if(d.tab){tab=d.tab;return render()}
  if(d.t)return sheet(tb.find(x=>x.id==d.t));
  if(!d.a)return;if(d.a==='chek')return show(os.find(o=>o.id==d.id));if(d.a==='pay')return payModal(os.find(o=>o.id==d.id),draw);
  const act=async(x,A=d.a)=>{try{const o=await api(`staff/orders/${d.id}/${A}`,'POST',x);if(A==='accept')show(o);toast(A==='accept'?'Принят, клиент уведомлён':'Клиент уведомлён: заказ готов');await draw()}catch(er){toast(er.message)}};
  if(d.a==='reject')confirmReject(os.find(o=>o.id==d.id),draw);else if(d.a==='review')review(os.find(o=>o.id==d.id),()=>pick(n=>act({staff:n},'accept')));else if(d.a==='accept')pick(n=>act({staff:n}));else act({})};
 await draw();T=setInterval(draw,6000)}

const geo=()=>navigator.geolocation.getCurrentPosition(p=>{$('[name=lat]').value=p.coords.latitude.toFixed(6);$('[name=lng]').value=p.coords.longitude.toFixed(6)},()=>toast('Нет доступа к геолокации'));
const formSubmit=R=>async e=>{e.preventDefault();const t=e.target.dataset.f,f=Object.fromEntries(new FormData(e.target));
 try{await api(({vf:'admin/venue',bf:'admin/tables',tf:'admin/staff',wf:'admin/waiters'})[t],'POST',t==='vf'?{...f,points:f.points.split('\n')}:f);toast('Сохранено ✅');await R()}catch(x){toast(x.message)}};
const venueForm=v=>`<form class="card" data-f="vf"><h3>Заведение</h3><input name="name" value="${esc(v.name)}" placeholder="Название" required><input name="logo" value="${esc(v.logo||'')}" placeholder="Логотип: ссылка https://…"><input name="qr" value="${esc(v.qr||'')}" placeholder="QR оплаты: ссылка на картинку https://… или /qr.png"><textarea name="welcome" placeholder="Приветствие">${esc(v.welcome||'')}</textarea><textarea name="points" placeholder="Точки выдачи — по одной в строке">${esc((v.points||[]).join('\n'))}</textarea><input name="address" value="${esc(v.address||'')}" placeholder="Адрес"><div class="seg"><input name="lat" value="${v.lat??''}" placeholder="Широта"><input name="lng" value="${v.lng??''}" placeholder="Долгота"></div><button type="button" class="ghost" data-geo>📍 Определить по моему положению</button><button class="btn">Сохранить</button></form>`;
async function admin(){
 clearInterval(T);let tab='menu',cf='',q='',M=[],V={},st=[],wt=[],tb=[];
 const load=async()=>{[{venue:V,menu:M},st,tb,wt]=await Promise.all([api('info?v='+VID()),api('admin/staff'),api('tables?v='+VID()),api('admin/waiters')])};
 const cats=()=>[...new Set(M.map(m=>m.category))];
 const mlist=()=>{const k=q.trim().toLowerCase();return M.filter(m=>(!cf||m.category===cf)&&(!k||m.name.toLowerCase().includes(k))).map(m=>`<div class="card row"><span>${esc(m.name)}<br><small>${esc(m.category)} · ${money(m.price)}</small></span><span><button class="ghost" data-e="${m.id}" title="Изменить">✎</button><button class="ghost" data-m="${m.id}" title="Удалить">🗑</button></span></div>`).join('')||'<p class="muted">Ничего не найдено</p>'};
 const chips=()=>['',...cats()].map(c=>`<button class="chip ${c===cf?'on':''}" data-cf="${esc(c)}">${c?esc(c):'Все'}</button>`).join('');
 const body=()=>tab==='menu'?`<div class="row"><input name="q" type="search" placeholder="🔍 Поиск блюда" value="${esc(q)}"><button class="btn sm" data-new>＋ Блюдо</button></div><div class="chips" id="chips">${chips()}</div><div id="ml">${mlist()}</div>`
  :tab==='venue'?venueForm(V)
  :tab==='tables'?`<form class="card" data-f="bf"><h3>Столы</h3><input name="count" type="number" min="0" max="100" value="${tb.length}" placeholder="Сколько столов"><button class="btn">Сохранить</button></form>`
  :`<form class="card" data-f="tf"><h3>Сотрудники (выбирают имя при приёме заказа)</h3><input name="name" placeholder="Имя" required><input name="position" placeholder="Должность"><button class="btn">Добавить</button>${st.map(u=>`<div class="row"><span>${esc(u.name)} <small>${esc(u.position||'')}</small></span><span><button type="button" class="ghost" data-es="${u.id}">✎</button><button type="button" class="ghost" data-s="${u.id}">🗑</button></span></div>`).join('')}</form>
  <form class="card" data-f="wf"><h3>Официанты (вход в /waiter)</h3><input name="name" placeholder="Имя официанта" required><input name="login" placeholder="Логин (латиницей)" required><input name="password" placeholder="Пароль (от 8 символов)" minlength="8" required><button class="btn">Добавить официанта</button>${wt.map(u=>`<div class="row"><span>${esc(u.name)} · ${esc(u.login)}</span><span><button type="button" class="ghost" data-ew="${u.id}">✎</button><button type="button" class="ghost" data-w="${u.id}">🗑</button></span></div>`).join('')}</form>`;
 const render=()=>{$('#app').innerHTML=head('Админ · '+V.name,'',V.logo)+`<nav class="tabs">${[['menu','🍔 Меню'],['tables','🪑 Столы'],['team','👥 Команда']].map(([k,t])=>`<button class="${tab===k?'on':''}" data-tab="${k}">${t}</button>`).join('')}</nav><div class="pg">${body()}</div>`};
 const R=async()=>{await load();render()};
 const dish=(m={})=>{const el=document.createElement('div');el.className='modal';
  el.innerHTML=`<form class="card"><h3>${m.id?'Изменить блюдо':'Новое блюдо'}</h3><input type="hidden" name="id" value="${m.id||''}"><input name="name" placeholder="Название" required value="${esc(m.name||'')}"><input name="category" list="cl" placeholder="Раздел" value="${esc(m.category||cf)}"><datalist id="cl">${cats().map(c=>`<option value="${esc(c)}">`).join('')}</datalist><input name="price" type="number" min="0" step="0.01" placeholder="Цена" required value="${m.price??''}"><input name="photo" placeholder="Фото: ссылка https://…" value="${esc(m.photo||'')}"><textarea name="description" placeholder="Описание, состав">${esc(m.description||'')}</textarea><button class="btn">Сохранить</button><button type="button" class="ghost" data-c>Отмена</button></form>`;
  el.onclick=e=>{if(e.target===el||e.target.dataset.c!==undefined)el.remove()};
  el.onsubmit=async e=>{e.preventDefault();try{await api('admin/menu','POST',Object.fromEntries(new FormData(e.target)));el.remove();toast('Сохранено ✅');await R()}catch(x){toast(x.message)}};document.body.append(el)};
 H.click=async e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;try{
  if(d.tab){tab=d.tab;return render()}
  if(d.cf!==undefined){cf=d.cf;q='';return render()}
  if(d.new!==undefined)return dish();
  if(d.e)return dish(M.find(x=>x.id==d.e));
  if(d.geo!==undefined)return geo();
  if(d.es){const u=st.find(x=>x.id==d.es);return fm('Сотрудник',[['name','Имя',u.name],['position','Должность',u.position]],async f=>{await api('admin/staff/'+u.id,'PATCH',f);await R()})}
  if(d.ew){const u=wt.find(x=>x.id==d.ew);return fm('Официант',[['name','Имя',u.name],['login','Логин',u.login],['password','Новый пароль (пусто — не менять)','']],async f=>{await api('admin/waiters/'+u.id,'PATCH',f);await R()})}
  if(d.m&&confirm('Удалить блюдо?')){await api('admin/menu/'+d.m,'DELETE');await R()}
  if(d.s&&confirm('Удалить сотрудника?')){await api('admin/staff/'+d.s,'DELETE');await R()}
  if(d.w&&confirm('Удалить официанта?')){await api('admin/waiters/'+d.w,'DELETE');await R()}}catch(x){toast(x.message)}};
 H.input=e=>{if(e.target.name==='q'){q=e.target.value;$('#ml').innerHTML=mlist()}};
 H.submit=formSubmit(R);await R()}

async function owner(){
 clearInterval(T);let vs=[],tab='stats';const cur=()=>vs.find(v=>v.id==VID());
 const bars=(a,l,u='')=>{const m=Math.max(...a,1);return`<div class="bars">${a.map((v,i)=>`<div title="${l[i]}: ${v}${u}"><i style="height:${v/m*100}%"></i><small>${l[i]}</small></div>`).join('')}</div>`};
 const statsHTML=async()=>{const d=await api('owner/stats'),ph=d.hours.indexOf(Math.max(...d.hours)),W=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],pd=d.wd.indexOf(Math.max(...d.wd)),kpi=(t,v)=>`<div class="card kpi"><small>${t}</small><b>${v}</b></div>`;
  return `<div class="grid">${kpi('Выручка',money(d.sum))+kpi('Заказов',d.count)+kpi('Средний чек',money(d.avg))+kpi('Ожидание принятия',d.accept+' мин')+kpi('Время готовки',d.cook+' мин')+kpi('Оплачено наличными',money(d.pay.cash))+kpi('Оплачено онлайн',money(d.pay.online))}</div>
 <div class="card"><h3>Когда больше заказов</h3><p>${d.count?`Пик: <b>${ph}:00–${ph+1}:00</b>. Самый загруженный день: <b>${W[pd]}</b>.`:'Данных пока нет'}</p>${bars(d.hours,[...Array(24).keys()])}${bars(d.wd,W)}</div>
 <div class="card"><h3>Выручка по дням</h3>${bars(d.days.map(x=>x[1]),d.days.map(x=>x[0]),' сом')}</div>
 <div class="card"><h3>Топ блюд</h3>${d.top.map(([n,c])=>`<div class="hb"><span>${esc(n)}</span><i style="width:${c/d.top[0][1]*100}%"></i><b>${c}</b></div>`).join('')||'Данных пока нет'}</div>
 <div class="card"><h3>Последние заказы</h3>${d.recent.map(o=>`<div class="row"><span>№${o.id} · ${esc(o.users?.nick)} · ${hm(o.created_at)}</span><span>${money(o.total)} <span class="badge ${o.status}">${ST[o.status]}</span></span></div>`).join('')}</div>
 <button class="btn" id="bk">Скачать резервную копию (все объекты, JSON)</button>`};
 const accHTML=v=>`<div class="card"><h3>Доступы объекта</h3><p><small>«Терминал» входит в программу приёма заказов (/staff), «Администратор» управляет меню и сотрудниками (/admin).</small></p>${v.accounts.map(a=>`<div class="row"><span>${a.role==='admin'?'Админ':'Терминал'}: <b>${esc(a.login)}</b></span><span><button class="ghost" data-ea="${a.id}" title="Изменить">✎</button><button class="ghost" data-ad="${a.id}" title="Удалить">🗑</button></span></div>`).join('')||'<p>Пока нет</p>'}</div>
 <form class="card" data-f="ac"><h3>Новый доступ</h3><select name="role"><option value="terminal">Терминал (приём заказов)</option><option value="admin">Администратор</option></select><input name="login" placeholder="Логин (латиницей/цифры)" required><input name="password" placeholder="Пароль (от 8 символов)" minlength="8" required><button class="btn">Создать</button></form>`;
 const R=async()=>{vs=await api('owner/venues');const v=cur();
  if(!v){$('#app').innerHTML=head('Владелец')+`<h3>Ваши объекты</h3><div class="grid">${vs.map(x=>`<button class="card vcard" data-vs="${x.id}">${x.logo?`<img class="logo big" src="${esc(x.logo)}" alt="">`:'<div class="ph">🍽️</div>'}<b>${esc(x.name)}</b></button>`).join('')}</div><form class="card" data-f="nv"><h3>＋ Новый объект</h3><input name="name" placeholder="Название заведения" required><button class="btn">Создать</button></form>`;return}
  const body=tab==='stats'?await statsHTML():tab==='manage'?venueForm((await api('info?v='+VID())).venue):accHTML(v);
  $('#app').innerHTML=head(v.name,'<button class="ghost" data-back>⇄ Объекты</button>',v.logo)+`<nav class="tabs">${[['stats','Статистика'],['manage','Заведение'],['acc','Доступы']].map(([k,t])=>`<button class="${tab===k?'on':''}" data-tab="${k}">${t}</button>`).join('')}</nav>`+body;
  if(tab==='stats')$('#bk').onclick=async()=>{const r=await fetch('/api/owner/backup',{headers:{Authorization:'Bearer '+localStorage[K]}}),a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download='backup-'+new Date().toISOString().slice(0,10)+'.json';a.click()}};
  H.click=async e=>{const d=e.target.closest('[data-vs],[data-back],[data-tab],[data-ad],[data-ea]')?.dataset||{};
  if(d.vs){localStorage.v_owner=d.vs;tab='stats';return R()}
  if(d.back!==undefined){localStorage.v_owner='';return R()}
  if(d.tab){tab=d.tab;return R()}
  if(d.ea){const a=cur().accounts.find(x=>x.id==d.ea);return fm(a.role==='admin'?'Администратор':'Терминал',[['name','Имя',a.name],['login','Логин',a.login],['password','Новый пароль (пусто — не менять)','']],async f=>{await api('owner/accounts/'+a.id,'PATCH',f);await R()})}
  if(d.ad){if(confirm('Удалить доступ?'))try{await api('owner/accounts/'+d.ad,'DELETE');R()}catch(x){toast(x.message)}return}
  if(e.target.dataset.geo!==undefined)geo()};
 H.submit=async e=>{const t=e.target.dataset.f;if(t!=='nv'&&t!=='ac')return formSubmit(R)(e);e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
  try{if(t==='nv'){const v=await api('owner/venues','POST',f);localStorage.v_owner=v.id;tab='manage'}else{await api('owner/accounts','POST',f);toast('Доступ создан ✅')}R()}catch(x){toast(x.message)}};
 await R()}

const boot=()=>localStorage[K]?({shop,staff,waiter,admin,owner})[A]().catch(x=>toast(x.message)):authView();boot();
