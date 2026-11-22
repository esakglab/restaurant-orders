// Восстановление из backup.json в любой Supabase-проект (после schema.sql и migration_2.sql):
// SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node restore.js backup.json
const {createClient}=require('@supabase/supabase-js'),b=require(require('path').resolve(process.argv[2]||'backup.json'));
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);
(async()=>{for(const [t,strip] of [['users',1],['venues'],['staff'],['menu'],['orders'],['receipts'],['notifs'],['users']]){const rows=(b[t]||[]).map(r=>strip?{...r,venue_id:null}:r);
 if(rows.length){const {error}=await db.from(t).upsert(rows);console.log(t,error?error.message:'ok')}}})();
