// Восстановление из backup.json в ЛЮБОЙ Supabase-проект (после выполнения schema.sql):
// SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node restore.js backup.json
const {createClient}=require('@supabase/supabase-js'),b=require(require('path').resolve(process.argv[2]||'backup.json'));
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);
(async()=>{for(const t of ['users','settings','menu','orders','notifs'])if(b[t]?.length){const {error}=await db.from(t).upsert(b[t]);console.log(t,error?error.message:'ok')}})();
