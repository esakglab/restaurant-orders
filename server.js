const express=require('express'),helmet=require('helmet'),rl=require('express-rate-limit'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),{createClient}=require('@supabase/supabase-js');
const {SUPABASE_URL,SUPABASE_SERVICE_KEY,JWT_SECRET}=process.env;
if(!SUPABASE_URL||!SUPABASE_SERVICE_KEY||!JWT_SECRET||JWT_SECRET.length<24)throw Error('Нужны SUPABASE_URL, SUPABASE_SERVICE_KEY и JWT_SECRET (от 24 символов)');
const db=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const app=express();app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{...helmet.contentSecurityPolicy.getDefaultDirectives(),'img-src':["'self'",'data:','https:'],'frame-src':['https://www.google.com','https://maps.google.com']}}}));
app.use(express.json({limit:'1mb'}));
app.use('/api/',rl({windowMs:60000,limit:200}));
const authRl=rl({windowMs:900000,limit:30});
const wrap=f=>(q,s)=>f(q,s).catch(e=>{console.error(e);s.status(500).json({error:'Ошибка сервера'})});
const str=(v,n=200)=>String(v??'').trim().slice(0,n),tel=v=>str(v,20).replace(/[^\d+]/g,''),num=v=>v===''||v==null||isNaN(+v)?null:+v,https=v=>/^https:\/\//.test(v||'')?str(v,500):null;
const tok=u=>jwt.sign({id:u.id,role:u.role,name:u.name,venue:u.venue_id||null},JWT_SECRET,{expiresIn:'12h'});
const auth=(...roles)=>(q,s,n)=>{try{const u=jwt.verify((q.headers.authorization||'').slice(7),JWT_SECRET);if(!roles.includes(u.role))return s.status(403).json({error:'Нет доступа'});q.user=u;n()}catch{s.status(401).json({error:'Войдите заново'})}};
// объект: у admin/terminal он в токене, у владельца — в заголовке X-Venue (и принадлежит ему)
const G=(q,s,n)=>{const u=q.user,v=u.role==='owner'?+q.headers['x-venue']:u.venue;if(!v)return s.status(400).json({error:'Выберите объект'});
 if(u.role!=='owner'){q.vid=v;return n()}
 db.from('venues').select('id').eq('id',v).eq('owner_id',u.id).maybeSingle().then(({data})=>{if(!data)return s.status(403).json({error:'Нет доступа'});q.vid=v;n()}).catch(()=>s.status(500).json({error:'Ошибка сервера'}))};
const adm=[auth('admin','owner'),G],stf=[auth('terminal','admin','owner','waiter'),G],own=auth('owner');

// --- вход ---
app.post('/api/register',authRl,wrap(async(q,s)=>{const b=q.body,name=str(b.name,60),phone=tel(b.phone),p=String(b.password||'');
 if(!name||phone.length<7||p.length<6)return s.status(400).json({error:'Проверьте имя, телефон и пароль (от 6 символов)'});
 const {data,error}=await db.from('users').insert({role:'customer',name,nick:str(b.nick,40)||name,phone,login:phone,pass_hash:await bcrypt.hash(p,10)}).select().single();
 if(error)return s.status(409).json({error:'Этот номер уже зарегистрирован'});s.json({token:tok(data),name:data.name,role:data.role})}));
app.post('/api/login',authRl,wrap(async(q,s)=>{const l=str(q.body.login,40).toLowerCase();const {data:r}=await db.from('users').select().in('login',[l,tel(l)]);
 const u=(r||[])[0];if(!u||!(await bcrypt.compare(String(q.body.password||''),u.pass_hash)))return s.status(401).json({error:'Неверный логин или пароль'});
 s.json({token:tok(u),name:u.name,role:u.role,venue:u.venue_id})}));

// --- публичное ---
app.get('/api/venues',wrap(async(q,s)=>{const {data}=await db.from('venues').select('id,name,logo,welcome').order('id');s.json(data||[])}));
app.get('/api/info',wrap(async(q,s)=>{const v=+q.query.v||0;const [a,b]=await Promise.all([db.from('venues').select('id,name,logo,welcome,points,address,lat,lng,qr').eq('id',v).maybeSingle(),db.from('menu').select().eq('venue_id',v).order('id')]);
 if(!a.data)return s.status(404).json({error:'Объект не найден'});s.json({venue:a.data,menu:b.data||[]})}));

// --- клиент ---
app.post('/api/orders',auth('customer'),wrap(async(q,s)=>{const b=q.body,vid=+b.venue,ids=(Array.isArray(b.items)?b.items:[]).slice(0,50);
 const {data:v}=await db.from('venues').select('points,qr').eq('id',vid).maybeSingle();if(!v)return s.status(400).json({error:'Выберите заведение'});
 const {data:menu}=await db.from('menu').select().eq('venue_id',vid).in('id',ids.map(i=>+i.id||0));let total=0;const items=[];
 for(const i of ids){const m=(menu||[]).find(x=>x.id==i.id),n=Math.min(parseInt(i.qty)||0,50);if(m&&n>0){items.push({id:m.id,name:m.name,price:m.price,qty:n});total+=m.price*n}}
 const type=['takeaway','dinein','delivery'].includes(b.type)?b.type:null;
 if(!items.length||!type)return s.status(400).json({error:'Корзина пуста'});
 if(b.pay==='online'&&(!v.qr||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(b.receipt||'')||b.receipt.length>900000))return s.status(400).json({error:'Для онлайн-оплаты оплатите по QR и загрузите чек (скриншот)'});
 if(type==='delivery'&&!str(b.address))return s.status(400).json({error:'Укажите адрес доставки'});
 const pts=v.points||[],point=pts.includes(b.point)?b.point:pts[0]||null;
 let tbl=null;if(type==='dinein'){const ts=await TS(vid);if(ts.length){tbl=ts.find(t=>t.id==b.table);if(!tbl)return s.status(400).json({error:'Выберите стол'});if(tbl.busy)return s.status(409).json({error:'Этот стол занят. Если это ваш заказ — напишите в чате или позовите официанта'})}}
 const {data,error}=await db.from('orders').insert({user_id:q.user.id,venue_id:vid,items,total,type,pay_method:b.pay==='online'?'online':'cash',cash_given:b.pay==='online'?null:(g=>g!=null&&g>=total?g:null)(num(b.given)),table_id:tbl?tbl.id:null,point:type==='delivery'?null:tbl?`Стол №${tbl.num}`:point,address:type==='delivery'?str(b.address,200):null,comment:str(b.comment,300)}).select().single();
 if(error)throw error;if(b.pay==='online')await db.from('receipts').insert({order_id:data.id,data:b.receipt});s.json(data)}));
app.get('/api/me',auth('customer'),wrap(async(q,s)=>{const [o,n,u]=await Promise.all([db.from('orders').select('*,venues(name)').eq('user_id',q.user.id).eq('hide_client',false).order('id',{ascending:false}).limit(20),db.from('notifs').select().eq('user_id',q.user.id).order('id',{ascending:false}).limit(50),db.from('users').select('name,nick,phone').eq('id',q.user.id).maybeSingle()]);s.json({orders:o.data||[],notifs:n.data||[],u:u.data||{}})}));
app.post('/api/notifs/read',auth('customer'),wrap(async(q,s)=>{await db.from('notifs').update({read:true}).eq('user_id',q.user.id);s.json({ok:1})}));

// --- приём заказов (терминал) ---
app.get('/api/staff/names',stf,wrap(async(q,s)=>{const {data}=await db.from('staff').select('id,name,position').eq('venue_id',q.vid).order('name');s.json(data||[])}));
app.get('/api/staff/orders',stf,wrap(async(q,s)=>{const {data}=await db.from('orders').select('*,users(nick,phone)').eq('venue_id',q.vid).in('status',['new','accepted','ready','sent']).order('id');const ids=(data||[]).map(x=>x.id),{data:rc}=ids.length?await db.from('receipts').select('order_id').in('order_id',ids):{data:[]},{data:ms}=ids.length?await db.from('messages').select('order_id').eq('from_client',true).eq('read',false).in('order_id',ids):{data:[]};s.json((data||[]).map(x=>({...x,has_receipt:(rc||[]).some(r=>r.order_id===x.id),chat_new:(ms||[]).filter(m=>m.order_id===x.id).length})))}));
app.get('/api/staff/orders/:id/receipt',stf,wrap(async(q,s)=>{if(q.user.role==='waiter')return s.status(403).json({error:'Нет доступа'});const id=+q.params.id;
 const {data:o}=await db.from('orders').select('id').eq('id',id).eq('venue_id',q.vid).maybeSingle();if(!o)return s.status(404).json({error:'Не найдено'});
 const {data}=await db.from('receipts').select('data').eq('order_id',id).maybeSingle();s.json({data:data?.data||null})}));
app.post('/api/staff/orders/:id/:act',stf,wrap(async(q,s)=>{const id=+q.params.id,a=q.params.act;if(q.user.role==='waiter'&&a!=='pay')return s.status(403).json({error:'Нет доступа'});const {data:o}=await db.from('orders').select().eq('id',id).eq('venue_id',q.vid).maybeSingle();
 if(!o)return s.status(404).json({error:'Заказ не найден'});let patch,msg;
 if(a==='accept'&&o.status==='new'){const {data:st}=await db.from('staff').select('name').eq('id',+q.body.staff||0).eq('venue_id',q.vid).maybeSingle();
  if(!st)return s.status(400).json({error:'Выберите своё имя'});patch={status:'accepted',staff_name:st.name,accepted_at:new Date(),...(o.pay_method==='online'?{paid:true,paid_at:new Date()}:{})};msg=`Ваш заказ №${id} принят, начинаем готовить!`}
 else if(a==='ready'&&o.status==='accepted'){patch={status:'ready',ready_at:new Date()};msg=`Ваш заказ №${id} готов! ${o.type==='delivery'?'Скоро доставим.':'Можно забирать.'}`}
 else if(a==='send'&&o.status==='ready'){patch={status:'sent'};msg=o.type==='delivery'?`Заказ №${id} передан курьеру и уже в пути!`:`Заказ №${id} отправлен.`}
 else if(a==='reject'&&['new','accepted'].includes(o.status)){patch={status:'rejected'};const why=str(q.body.reason,200);msg=`Заказ №${id} отклонён.${why?' Причина: '+why.replace(/[.!?\s]+$/,'')+'.':''} Если вы уже оплатили — свяжитесь с заведением.`}
 else if(a==='pay'&&!o.paid&&o.status!=='closed'){const m=q.body.method==='online'?'online':'cash',g=num(q.body.given);if(m==='cash'&&(g==null||g<o.total))return s.status(400).json({error:'Получено меньше суммы заказа'});patch={paid:true,paid_at:new Date(),pay_method:m,cash_given:m==='cash'?g:null}}
 else if(a==='close'&&!o.paid)return s.status(400).json({error:'Сначала примите оплату'});
 else if(a==='close'&&['accepted','ready','sent'].includes(o.status)){patch={status:'closed'}}
 else return s.status(400).json({error:'Действие недоступно'});
 const {data}=await db.from('orders').update(patch).eq('id',id).select('*,users(nick,phone)').single();
 if(msg&&o.user_id)await db.from('notifs').insert({user_id:o.user_id,text:msg});s.json(data)}));

// --- администратор объекта ---
app.post('/api/admin/venue',adm,wrap(async(q,s)=>{const b=q.body;if(!str(b.name))return s.status(400).json({error:'Укажите название'});
 await db.from('venues').update({name:str(b.name,80),logo:https(b.logo),welcome:str(b.welcome,500),address:str(b.address,200),qr:/^(https:\/\/|\/qr\.png$)/.test(b.qr||'')?str(b.qr,500):null,lat:num(b.lat),lng:num(b.lng),points:(Array.isArray(b.points)?b.points:[]).map(p=>str(p,100)).filter(Boolean).slice(0,20)}).eq('id',q.vid);s.json({ok:1})}));
app.post('/api/admin/menu',adm,wrap(async(q,s)=>{const b=q.body,price=Number(b.price);if(!str(b.name)||!(price>=0))return s.status(400).json({error:'Укажите название и цену'});
 const row={name:str(b.name,80),category:str(b.category,40)||'Основное',price,photo:https(b.photo),description:str(b.description,600)||null};
 const {data,error}=b.id?await db.from('menu').update(row).eq('id',+b.id).eq('venue_id',q.vid).select().single():await db.from('menu').insert({...row,venue_id:q.vid}).select().single();if(error)throw error;s.json(data)}));
app.delete('/api/admin/menu/:id',adm,wrap(async(q,s)=>{await db.from('menu').delete().eq('id',+q.params.id).eq('venue_id',q.vid);s.json({ok:1})}));
app.get('/api/admin/staff',adm,wrap(async(q,s)=>{const {data}=await db.from('staff').select().eq('venue_id',q.vid).order('name');s.json(data||[])}));
app.post('/api/admin/staff',adm,wrap(async(q,s)=>{if(!str(q.body.name))return s.status(400).json({error:'Укажите имя'});await db.from('staff').insert({venue_id:q.vid,name:str(q.body.name,60),position:str(q.body.position,40)});s.json({ok:1})}));
app.delete('/api/admin/staff/:id',adm,wrap(async(q,s)=>{await db.from('staff').delete().eq('id',+q.params.id).eq('venue_id',q.vid);s.json({ok:1})}));

// --- владелец: объекты и доступы ---
app.get('/api/owner/venues',own,wrap(async(q,s)=>{const {data:v}=await db.from('venues').select('id,name,logo').eq('owner_id',q.user.id).order('id');const ids=(v||[]).map(x=>x.id);
 const {data:u}=ids.length?await db.from('users').select('id,role,name,login,venue_id').in('role',['admin','terminal']).in('venue_id',ids):{data:[]};
 s.json((v||[]).map(x=>({...x,accounts:(u||[]).filter(a=>a.venue_id===x.id)})))}));
app.post('/api/owner/venues',own,wrap(async(q,s)=>{if(!str(q.body.name))return s.status(400).json({error:'Укажите название'});
 const {data}=await db.from('venues').insert({owner_id:q.user.id,name:str(q.body.name,80)}).select().single();s.json(data)}));
app.post('/api/owner/accounts',own,G,wrap(async(q,s)=>{const b=q.body,login=str(b.login,40).toLowerCase(),p=String(b.password||'');
 if(!['admin','terminal'].includes(b.role)||!/^[a-z0-9_.-]{3,40}$/.test(login)||p.length<8)return s.status(400).json({error:'Логин: 3–40 латинских букв/цифр. Пароль: от 8 символов'});
 const {error}=await db.from('users').insert({role:b.role,name:b.role==='admin'?'Администратор':'Терминал',login,venue_id:q.vid,pass_hash:await bcrypt.hash(p,10)});
 if(error)return s.status(409).json({error:'Такой логин уже занят'});s.json({ok:1})}));
app.delete('/api/owner/accounts/:id',own,G,wrap(async(q,s)=>{await db.from('users').delete().eq('id',str(q.params.id,60)).eq('venue_id',q.vid).in('role',['admin','terminal']);s.json({ok:1})}));
app.get('/api/owner/stats',own,G,wrap(async(q,s)=>{const {data:o}=await db.from('orders').select('id,total,items,status,created_at,accepted_at,ready_at,paid,pay_method,users(nick)').neq('status','rejected').eq('venue_id',q.vid).order('id',{ascending:false});
 const off=+process.env.TZ_OFFSET||6,L=d=>new Date(+new Date(d)+off*36e5),hours=Array(24).fill(0),wd=Array(7).fill(0),days={},dish={},ta=[],tr=[];let sum=0;const pay={cash:0,online:0};
 for(const r of o||[]){sum+=r.total;if(r.paid)pay[r.pay_method||'cash']+=r.total;const l=L(r.created_at);hours[l.getUTCHours()]++;wd[l.getUTCDay()]++;const k=l.toISOString().slice(0,10);days[k]=(days[k]||0)+r.total;
  r.items.forEach(i=>dish[i.name]=(dish[i.name]||0)+i.qty);if(r.accepted_at)ta.push((new Date(r.accepted_at)-new Date(r.created_at))/6e4);if(r.ready_at)tr.push((new Date(r.ready_at)-new Date(r.accepted_at))/6e4)}
 const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:0,n=(o||[]).length;
 s.json({count:n,sum,pay,avg:n?Math.round(sum/n):0,accept:avg(ta),cook:avg(tr),hours,wd,days:Object.keys(days).sort().slice(-14).map(k=>[k.slice(5),days[k]]),top:Object.entries(dish).sort((a,b)=>b[1]-a[1]).slice(0,6),recent:(o||[]).slice(0,15)})}));
app.get('/api/owner/backup',own,wrap(async(q,s)=>{const out={at:new Date()};for(const t of ['users','venues','staff','menu','orders','receipts','messages','notifs'])out[t]=(await db.from(t).select()).data;
 s.setHeader('Content-Disposition','attachment; filename=backup.json');s.json(out)}));

// первый запуск: создаём владельца из переменных окружения (админов и терминалы владелец создаёт сам)
(async()=>{const {OWNER_PHONE:ph,OWNER_PASSWORD:pw}=process.env;if(!ph||!pw)return;const {data}=await db.from('users').select('id').eq('role','owner').limit(1);
 if(!data?.length)await db.from('users').insert({role:'owner',name:'Владелец',phone:tel(ph),login:tel(ph),pass_hash:await bcrypt.hash(pw,10)})})().catch(console.error);

// --- столы, официанты ---
const TS=async vid=>{const [t,o]=await Promise.all([db.from('tables').select().eq('venue_id',vid).order('num'),db.from('orders').select('id,table_id,status,total,staff_name,paid,pay_method,cash_given').eq('venue_id',vid).not('table_id','is',null).in('status',['new','accepted','ready'])]);
 return (t.data||[]).map(x=>{const r=(o.data||[]).find(y=>y.table_id===x.id);return {id:x.id,num:x.num,busy:!!r,order:r?{id:r.id,status:r.status,total:r.total,waiter:r.staff_name,paid:r.paid,pay_method:r.pay_method,cash_given:r.cash_given}:null}})};
app.get('/api/tables',wrap(async(q,s)=>s.json((await TS(+q.query.v||0)).map(t=>({id:t.id,num:t.num,busy:t.busy})))));
app.get('/api/staff/tables',stf,wrap(async(q,s)=>s.json(await TS(q.vid))));
app.post('/api/staff/new-order',stf,wrap(async(q,s)=>{const b=q.body,ids=(Array.isArray(b.items)?b.items:[]).slice(0,60);
 const {data:t}=await db.from('tables').select().eq('id',+b.table||0).eq('venue_id',q.vid).maybeSingle();if(!t)return s.status(400).json({error:'Выберите стол'});
 const {data:menu}=await db.from('menu').select().eq('venue_id',q.vid).in('id',ids.map(i=>+i.id||0));const items=[];
 for(const i of ids){const m=(menu||[]).find(x=>x.id==i.id),n=Math.min(parseInt(i.qty)||0,50);if(m&&n>0)items.push({id:m.id,name:m.name,price:m.price,qty:n})}
 if(!items.length)return s.status(400).json({error:'Выберите блюда'});
 let who=q.user.role==='waiter'?q.user.name:null;if(!who){const {data:st}=await db.from('staff').select('name').eq('id',+b.staff||0).eq('venue_id',q.vid).maybeSingle();who=st?.name}
 if(!who)return s.status(400).json({error:'Выберите своё имя'});
 const {data:open}=await db.from('orders').select().eq('venue_id',q.vid).eq('table_id',t.id).in('status',['new','accepted','ready']).maybeSingle();
 let all=items;if(open){all=[...open.items];for(const i of items){const x=all.find(y=>y.id===i.id);x?x.qty+=i.qty:all.push(i)}}
 const row={items:all,total:all.reduce((a,i)=>a+i.price*i.qty,0),status:'accepted',staff_name:open?.staff_name||who,accepted_at:open?.accepted_at||new Date()};
 const {data,error}=open?await db.from('orders').update(row).eq('id',open.id).select().single():await db.from('orders').insert({...row,venue_id:q.vid,type:'dinein',table_id:t.id,point:`Стол №${t.num}`}).select().single();
 if(error)throw error;if(open?.user_id&&open.status==='new')await db.from('notifs').insert({user_id:open.user_id,text:`Ваш заказ №${open.id} принят, начинаем готовить!`});s.json(data)}));
app.post('/api/admin/tables',adm,wrap(async(q,s)=>{const n=Math.min(Math.max(parseInt(q.body.count)||0,0),100);const {data:t}=await db.from('tables').select('num').eq('venue_id',q.vid);const have=new Set((t||[]).map(x=>x.num)),add=[];
 for(let i=1;i<=n;i++)if(!have.has(i))add.push({venue_id:q.vid,num:i});if(add.length)await db.from('tables').insert(add);await db.from('tables').delete().eq('venue_id',q.vid).gt('num',n);s.json({ok:1})}));
app.get('/api/admin/waiters',adm,wrap(async(q,s)=>{const {data}=await db.from('users').select('id,name,login').eq('role','waiter').eq('venue_id',q.vid);s.json(data||[])}));
app.post('/api/admin/waiters',adm,wrap(async(q,s)=>{const b=q.body,login=str(b.login,40).toLowerCase(),p=String(b.password||'');
 if(!str(b.name)||!/^[a-z0-9_.-]{3,40}$/.test(login)||p.length<8)return s.status(400).json({error:'Имя, логин (латиницей) и пароль от 8 символов'});
 const {error}=await db.from('users').insert({role:'waiter',name:str(b.name,60),login,venue_id:q.vid,pass_hash:await bcrypt.hash(p,10)});if(error)return s.status(409).json({error:'Такой логин уже занят'});s.json({ok:1})}));
app.delete('/api/admin/waiters/:id',adm,wrap(async(q,s)=>{await db.from('users').delete().eq('id',str(q.params.id,60)).eq('venue_id',q.vid).eq('role','waiter');s.json({ok:1})}));

// --- изменить имя / логин / пароль ---
const upd=async(q,s,roles)=>{const b=q.body,patch={};if(str(b.name))patch.name=str(b.name,60);
 if(str(b.login)){const l=str(b.login,40).toLowerCase();if(!/^[a-z0-9_.-]{3,40}$/.test(l))return s.status(400).json({error:'Логин: 3–40 латинских букв или цифр'});patch.login=l}
 if(b.password){if(String(b.password).length<8)return s.status(400).json({error:'Пароль: от 8 символов'});patch.pass_hash=await bcrypt.hash(String(b.password),10)}
 if(!Object.keys(patch).length)return s.status(400).json({error:'Нечего менять'});
 const {error}=await db.from('users').update(patch).eq('id',str(q.params.id,60)).eq('venue_id',q.vid).in('role',roles);if(error)return s.status(409).json({error:'Такой логин уже занят'});s.json({ok:1})};
app.patch('/api/owner/accounts/:id',own,G,wrap((q,s)=>upd(q,s,['admin','terminal'])));
app.patch('/api/admin/waiters/:id',adm,wrap((q,s)=>upd(q,s,['waiter'])));
app.patch('/api/admin/staff/:id',adm,wrap(async(q,s)=>{if(!str(q.body.name))return s.status(400).json({error:'Укажите имя'});await db.from('staff').update({name:str(q.body.name,60),position:str(q.body.position,40)}).eq('id',+q.params.id).eq('venue_id',q.vid);s.json({ok:1})}));

// --- профиль и настройки ---
app.post('/api/account/password',authRl,auth('owner','admin','terminal','waiter','customer'),wrap(async(q,s)=>{const {data:u}=await db.from('users').select().eq('id',q.user.id).maybeSingle(),min=u&&u.role==='customer'?6:8;
 if(!u||!(await bcrypt.compare(String(q.body.old||''),u.pass_hash)))return s.status(403).json({error:'Текущий пароль неверный'});
 const n=String(q.body.new||'');if(n.length<min)return s.status(400).json({error:`Новый пароль: от ${min} символов`});
 await db.from('users').update({pass_hash:await bcrypt.hash(n,10)}).eq('id',u.id);s.json({ok:1})}));
app.post('/api/account/profile',auth('customer'),wrap(async(q,s)=>{const b=q.body,name=str(b.name,60),phone=tel(b.phone);if(!name||phone.length<7)return s.status(400).json({error:'Проверьте имя и телефон'});
 const {error}=await db.from('users').update({name,nick:str(b.nick,40)||name,phone,login:phone}).eq('id',q.user.id);if(error)return s.status(409).json({error:'Этот номер уже используется'});s.json({ok:1})}));
app.post('/api/me/clear',auth('customer'),wrap(async(q,s)=>{if(q.body.what==='orders')await db.from('orders').update({hide_client:true}).eq('user_id',q.user.id).in('status',['ready','closed','rejected']);else await db.from('notifs').delete().eq('user_id',q.user.id);s.json({ok:1})}));

// --- чат, отчёт Excel, QR столов ---
const ExcelJS=require('exceljs'),QR=require('qrcode');
const chatOrder=async(q,id)=>{const {data:o}=await db.from('orders').select('id,user_id,venue_id').eq('id',id).maybeSingle();if(!o)return null;const u=q.user;
 if(u.role==='customer')return o.user_id===u.id?o:null;
 if(u.role==='owner'){const {data:v}=await db.from('venues').select('id').eq('id',o.venue_id).eq('owner_id',u.id).maybeSingle();return v?o:null}
 return u.venue===o.venue_id?o:null};
const ALL=['customer','terminal','admin','owner','waiter'];
app.get('/api/chat/:id',auth(...ALL),wrap(async(q,s)=>{const o=await chatOrder(q,+q.params.id);if(!o)return s.status(404).json({error:'Не найдено'});const cl=q.user.role==='customer';
 const {data}=await db.from('messages').select().eq('order_id',o.id).order('id');await db.from('messages').update({read:true}).eq('order_id',o.id).eq('from_client',!cl);s.json(data||[])}));
app.post('/api/chat/:id',auth(...ALL),wrap(async(q,s)=>{const o=await chatOrder(q,+q.params.id),t=str(q.body.text,500);if(!o||!t)return s.status(400).json({error:'Пустое сообщение'});const cl=q.user.role==='customer';
 await db.from('messages').insert({order_id:o.id,from_client:cl,text:t});if(!cl&&o.user_id)await db.from('notifs').insert({user_id:o.user_id,text:`💬 Сообщение по заказу №${o.id}: ${t.slice(0,80)}`});s.json({ok:1})}));
const TYL={takeaway:'С собой',dinein:'В заведении',delivery:'Доставка'},STL={new:'Новый',accepted:'Готовится',ready:'Готов',sent:'Отправлен',closed:'Закрыт',rejected:'Отклонён'},PYL={cash:'Наличные',online:'Онлайн'};
app.get('/api/report.xlsx',adm,wrap(async(q,s)=>{const off=+process.env.TZ_OFFSET||6,ok=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||''),f=ok(q.query.from)?q.query.from:new Date().toISOString().slice(0,10),t=ok(q.query.to)?q.query.to:f;
 const a=new Date(Date.parse(f+'T00:00:00Z')-off*36e5),b=new Date(Date.parse(t+'T00:00:00Z')+864e5-off*36e5);
 const {data:o}=await db.from('orders').select('id,created_at,type,point,address,total,paid,pay_method,status,staff_name,items,users(nick)').eq('venue_id',q.vid).gte('created_at',a.toISOString()).lt('created_at',b.toISOString()).order('id');
 const good=(o||[]).filter(x=>x.status!=='rejected'),sum=f=>good.filter(f).reduce((n,x)=>n+x.total,0),wb=new ExcelJS.Workbook(),w1=wb.addWorksheet('Итоги'),w2=wb.addWorksheet('По блюдам'),w3=wb.addWorksheet('По сотрудникам'),w4=wb.addWorksheet('Заказы');
 w1.columns=[{header:'Показатель',width:34},{header:'Значение',width:22}];
 [['Период',f===t?f:`${f} — ${t}`],['Заказов (без отказов)',good.length],['Отклонено',(o||[]).length-good.length],['Выручка, сом',sum(()=>1)],['Оплачено наличными, сом',sum(x=>x.paid&&x.pay_method!=='online')],['Оплачено онлайн, сом',sum(x=>x.paid&&x.pay_method==='online')],['Не оплачено, сом',sum(x=>!x.paid)],['Средний чек, сом',good.length?Math.round(sum(()=>1)/good.length):0]].forEach(r=>w1.addRow(r));
 const dm={};good.forEach(x=>x.items.forEach(i=>{const k=i.name+'|'+i.price;(dm[k]=dm[k]||{n:i.name,p:i.price,q:0}).q+=i.qty}));
 w2.columns=[{header:'Блюдо',width:38},{header:'Кол-во',width:10},{header:'Цена',width:12},{header:'Сумма',width:14}];
 const dl=Object.values(dm).sort((x,y)=>y.q-x.q);dl.forEach(d=>w2.addRow([d.n,d.q,d.p,d.q*d.p]));w2.addRow(['ИТОГО',dl.reduce((n,d)=>n+d.q,0),'',dl.reduce((n,d)=>n+d.q*d.p,0)]).font={bold:true};
 const wm={};good.forEach(x=>{const k=x.staff_name||'— без сотрудника',w=wm[k]=wm[k]||{o:0,t:0,c:0,n:0};w.o++;w.t+=x.total;if(x.paid)x.pay_method==='online'?w.n+=x.total:w.c+=x.total});
 w3.columns=[{header:'Сотрудник',width:30},{header:'Заказов',width:10},{header:'Сумма',width:14},{header:'Наличные',width:14},{header:'Онлайн',width:14}];Object.entries(wm).forEach(([k,w])=>w3.addRow([k,w.o,w.t,w.c,w.n]));
 w4.columns=[{header:'№',width:7},{header:'Дата и время',width:18},{header:'Тип',width:14},{header:'Стол / адрес',width:30},{header:'Клиент',width:16},{header:'Сумма',width:12},{header:'Оплата',width:12},{header:'Оплачен',width:10},{header:'Статус',width:12},{header:'Принял',width:18}];
 (o||[]).forEach(x=>w4.addRow([x.id,new Date(+new Date(x.created_at)+off*36e5).toISOString().replace('T',' ').slice(0,16),TYL[x.type],x.address||x.point||'',x.users?.nick||'Гость',x.total,PYL[x.pay_method]||'Наличные',x.paid?'да':'нет',STL[x.status]||x.status,x.staff_name||'']));
 [w1,w2,w3,w4].forEach(w=>w.getRow(1).font={bold:true});
 const buf=await wb.xlsx.writeBuffer();s.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');s.setHeader('Content-Disposition',`attachment; filename=report-${f}_${t}.xlsx`);s.send(Buffer.from(buf))}));
app.get('/api/admin/tables-qr',adm,wrap(async(q,s)=>{const base=`${q.protocol}://${q.get('host')}`,{data:t}=await db.from('tables').select('num').eq('venue_id',q.vid).order('num');
 s.json(await Promise.all((t||[]).map(async x=>({num:x.num,svg:await QR.toString(`${base}/?v=${q.vid}&t=${x.num}`,{type:'svg',margin:1})}))))}));

// --- загрузка фото блюд ---
app.post('/api/admin/upload',adm,wrap(async(q,s)=>{const m=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+\/=]+)$/.exec(q.body.data||'');if(!m)return s.status(400).json({error:'Загрузите картинку JPG, PNG или WebP'});
 const buf=Buffer.from(m[2],'base64');if(buf.length>1.5e6)return s.status(400).json({error:'Файл слишком большой (до 1,5 МБ)'});
 const path=`${q.vid}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${m[1]==='jpeg'?'jpg':m[1]}`;
 const {error}=await db.storage.from('menu').upload(path,buf,{contentType:'image/'+m[1],cacheControl:'31536000'});if(error)throw error;
 s.json({url:db.storage.from('menu').getPublicUrl(path).data.publicUrl})}));

app.get(/^\/(app\.js|style\.css|qr\.png|plan\.jpg|sw\.js|manifest-[a-z]+\.json|icon-[a-z]+-\d+\.png)$/,(q,s)=>s.sendFile(q.params[0],{root:__dirname}));
const pages={'/':'index.html','/staff':'staff.html','/admin':'admin.html','/owner':'owner.html','/waiter':'waiter.html'};
for(const [u,f] of Object.entries(pages))app.get(u,(q,s)=>s.sendFile(f,{root:__dirname}));
app.listen(process.env.PORT||3000,()=>console.log('OK'));
