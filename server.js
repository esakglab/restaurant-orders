const express=require('express'),helmet=require('helmet'),rl=require('express-rate-limit'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),{createClient}=require('@supabase/supabase-js');
const {SUPABASE_URL,SUPABASE_SERVICE_KEY,JWT_SECRET}=process.env;
if(!SUPABASE_URL||!SUPABASE_SERVICE_KEY||!JWT_SECRET||JWT_SECRET.length<24)throw Error('Нужны SUPABASE_URL, SUPABASE_SERVICE_KEY и JWT_SECRET (от 24 символов)');
const db=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const app=express();app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{...helmet.contentSecurityPolicy.getDefaultDirectives(),'img-src':["'self'",'data:','https:']}}}));
app.use(express.json({limit:'50kb'}));
app.use('/api/',rl({windowMs:60000,limit:150}));
const authRl=rl({windowMs:900000,limit:25});
const wrap=f=>(q,s)=>f(q,s).catch(e=>{console.error(e);s.status(500).json({error:'Ошибка сервера'})});
const str=(v,n=200)=>String(v??'').trim().slice(0,n),tel=v=>str(v,20).replace(/[^\d+]/g,'');
const tok=u=>jwt.sign({id:u.id,role:u.role,name:u.name},JWT_SECRET,{expiresIn:'12h'});
const auth=(...roles)=>(q,s,n)=>{try{const u=jwt.verify((q.headers.authorization||'').slice(7),JWT_SECRET);if(!roles.includes(u.role))return s.status(403).json({error:'Нет доступа'});q.user=u;n()}catch{s.status(401).json({error:'Войдите заново'})}};
const adm=auth('admin','owner'),stf=auth('staff','admin'),own=auth('owner');

// --- вход ---
app.post('/api/register',authRl,wrap(async(q,s)=>{const b=q.body,name=str(b.name,60),phone=tel(b.phone),p=String(b.password||'');
 if(!name||phone.length<7||p.length<6)return s.status(400).json({error:'Проверьте имя, телефон и пароль (от 6 символов)'});
 const {data,error}=await db.from('users').insert({role:'customer',name,nick:str(b.nick,40)||name,phone,pass_hash:await bcrypt.hash(p,10)}).select().single();
 if(error)return s.status(409).json({error:'Этот номер уже зарегистрирован'});s.json({token:tok(data),name:data.name,role:data.role})}));
app.post('/api/login',authRl,wrap(async(q,s)=>{const {id,phone,password}=q.body;let r=db.from('users').select();r=id?r.eq('id',str(id,60)):r.eq('phone',tel(phone));
 const {data:u}=await r.maybeSingle();if(!u||!(await bcrypt.compare(String(password||''),u.pass_hash)))return s.status(401).json({error:'Неверный телефон или пароль'});
 s.json({token:tok(u),name:u.name,role:u.role})}));
app.get('/api/staff-list',wrap(async(q,s)=>{const {data}=await db.from('users').select('id,name').eq('role','staff');s.json(data||[])}));
app.get('/api/info',wrap(async(q,s)=>{const [a,b]=await Promise.all([db.from('settings').select().single(),db.from('menu').select().order('category').order('id')]);s.json({settings:a.data,menu:b.data})}));

// --- клиент ---
app.post('/api/orders',auth('customer'),wrap(async(q,s)=>{const b=q.body,ids=(Array.isArray(b.items)?b.items:[]).slice(0,50);
 const {data:menu}=await db.from('menu').select().in('id',ids.map(i=>+i.id||0));let total=0;const items=[];
 for(const i of ids){const m=(menu||[]).find(x=>x.id==i.id),n=Math.min(parseInt(i.qty)||0,50);if(m&&n>0){items.push({id:m.id,name:m.name,price:m.price,qty:n});total+=m.price*n}}
 const type=['takeaway','dinein','delivery'].includes(b.type)?b.type:null;
 if(!items.length||!type)return s.status(400).json({error:'Корзина пуста'});
 if(type==='delivery'&&!str(b.address))return s.status(400).json({error:'Укажите адрес доставки'});
 const {data,error}=await db.from('orders').insert({user_id:q.user.id,items,total,type,point:type==='delivery'?null:str(b.point,100),address:type==='delivery'?str(b.address,200):null,comment:str(b.comment,300)}).select().single();
 if(error)throw error;s.json(data)}));
app.get('/api/me',auth('customer'),wrap(async(q,s)=>{const [o,n]=await Promise.all([db.from('orders').select().eq('user_id',q.user.id).order('id',{ascending:false}).limit(20),db.from('notifs').select().eq('user_id',q.user.id).order('id',{ascending:false}).limit(30)]);s.json({orders:o.data||[],notifs:n.data||[]})}));
app.post('/api/notifs/read',auth('customer'),wrap(async(q,s)=>{await db.from('notifs').update({read:true}).eq('user_id',q.user.id);s.json({ok:1})}));

// --- приём заказов ---
app.get('/api/staff/orders',stf,wrap(async(q,s)=>{const {data}=await db.from('orders').select('*,users(nick,phone)').in('status',['new','accepted']).order('id');s.json(data||[])}));
app.post('/api/staff/orders/:id/:act',stf,wrap(async(q,s)=>{const id=+q.params.id,a=q.params.act;const {data:o}=await db.from('orders').select().eq('id',id).maybeSingle();
 if(!o)return s.status(404).json({error:'Заказ не найден'});let patch,msg;
 if(a==='accept'&&o.status==='new'){patch={status:'accepted',staff_name:q.user.name,accepted_at:new Date()};msg=`Ваш заказ №${id} принят, начинаем готовить!`}
 else if(a==='ready'&&o.status==='accepted'){patch={status:'ready',ready_at:new Date()};msg=`Ваш заказ №${id} готов! ${o.type==='delivery'?'Скоро доставим.':'Можно забирать.'}`}
 else return s.status(400).json({error:'Действие недоступно'});
 const {data}=await db.from('orders').update(patch).eq('id',id).select('*,users(nick,phone)').single();
 await db.from('notifs').insert({user_id:o.user_id,text:msg});s.json(data)}));

// --- администратор ---
app.post('/api/admin/menu',adm,wrap(async(q,s)=>{const b=q.body,price=Number(b.price);if(!str(b.name)||!(price>=0))return s.status(400).json({error:'Укажите название и цену'});
 const row={name:str(b.name,80),category:str(b.category,40)||'Основное',price,photo:/^https:\/\//.test(b.photo||'')?str(b.photo,500):null};
 const {data,error}=b.id?await db.from('menu').update(row).eq('id',+b.id).select().single():await db.from('menu').insert(row).select().single();if(error)throw error;s.json(data)}));
app.delete('/api/admin/menu/:id',adm,wrap(async(q,s)=>{await db.from('menu').delete().eq('id',+q.params.id);s.json({ok:1})}));
app.post('/api/admin/settings',adm,wrap(async(q,s)=>{const b=q.body;await db.from('settings').update({name:str(b.name,80),welcome:str(b.welcome,500),points:(Array.isArray(b.points)?b.points:[]).map(p=>str(p,100)).filter(Boolean).slice(0,20)}).eq('id',1);s.json({ok:1})}));
app.get('/api/admin/staff',adm,wrap(async(q,s)=>{const {data}=await db.from('users').select('id,name,phone').eq('role','staff');s.json(data||[])}));
app.post('/api/admin/staff',adm,wrap(async(q,s)=>{const b=q.body,phone=tel(b.phone),p=String(b.password||'');if(!str(b.name)||phone.length<7||p.length<6)return s.status(400).json({error:'Проверьте имя, телефон и пароль (от 6 символов)'});
 const {error}=await db.from('users').insert({role:'staff',name:str(b.name,60),phone,pass_hash:await bcrypt.hash(p,10)});if(error)return s.status(409).json({error:'Номер уже занят'});s.json({ok:1})}));
app.delete('/api/admin/staff/:id',adm,wrap(async(q,s)=>{await db.from('users').delete().eq('id',str(q.params.id,60)).eq('role','staff');s.json({ok:1})}));

// --- владелец ---
app.get('/api/owner/stats',own,wrap(async(q,s)=>{const {data:o}=await db.from('orders').select('id,total,items,status,created_at,accepted_at,ready_at,users(nick)').order('id',{ascending:false});
 const off=+process.env.TZ_OFFSET||6,L=d=>new Date(+new Date(d)+off*36e5),hours=Array(24).fill(0),wd=Array(7).fill(0),days={},dish={},ta=[],tr=[];let sum=0;
 for(const r of o||[]){sum+=r.total;const l=L(r.created_at);hours[l.getUTCHours()]++;wd[l.getUTCDay()]++;const k=l.toISOString().slice(0,10);days[k]=(days[k]||0)+r.total;
  r.items.forEach(i=>dish[i.name]=(dish[i.name]||0)+i.qty);if(r.accepted_at)ta.push((new Date(r.accepted_at)-new Date(r.created_at))/6e4);if(r.ready_at)tr.push((new Date(r.ready_at)-new Date(r.accepted_at))/6e4)}
 const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:0,n=(o||[]).length;
 s.json({count:n,sum,avg:n?Math.round(sum/n):0,accept:avg(ta),cook:avg(tr),hours,wd,days:Object.keys(days).sort().slice(-14).map(k=>[k.slice(5),days[k]]),top:Object.entries(dish).sort((a,b)=>b[1]-a[1]).slice(0,6),recent:(o||[]).slice(0,15)})}));
app.get('/api/owner/backup',own,wrap(async(q,s)=>{const out={at:new Date()};for(const t of ['users','settings','menu','orders','notifs'])out[t]=(await db.from(t).select()).data;
 s.setHeader('Content-Disposition','attachment; filename=backup.json');s.json(out)}));

// первый запуск: создаём владельца и админа из переменных окружения
(async()=>{for(const [role,name,ph,pw] of [['owner','Владелец',process.env.OWNER_PHONE,process.env.OWNER_PASSWORD],['admin','Администратор',process.env.ADMIN_PHONE,process.env.ADMIN_PASSWORD]]){
 if(!ph||!pw)continue;const {data}=await db.from('users').select('id').eq('role',role).limit(1);if(!data?.length)await db.from('users').insert({role,name,phone:tel(ph),pass_hash:await bcrypt.hash(pw,10)})}})().catch(console.error);

const pages={'/':'index.html','/staff':'staff.html','/admin':'admin.html','/owner':'owner.html','/app.js':'app.js','/style.css':'style.css'};
for(const [u,f] of Object.entries(pages))app.get(u,(q,s)=>s.sendFile(f,{root:__dirname}));
app.listen(process.env.PORT||3000,()=>console.log('OK'));
