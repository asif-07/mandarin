/* Temporary fixture integration test. Credentials are supplied in a mode-0600 JSON file,
   never printed. Seed/cleanup requires a trusted test operator, not a public endpoint. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = process.env.AMBRO_QA_BASE_URL || 'http://localhost:3010';
const credentialFile = process.env.AMBRO_QA_CREDENTIALS;
if (!credentialFile) throw new Error('Set AMBRO_QA_CREDENTIALS to a private temporary fixture JSON file.');
const fixture = JSON.parse(fs.readFileSync(credentialFile, 'utf8'));
const clients = new Map(fixture.map(user => [user.lane, { ...user, cookies: new Map() }]));
const passed = [];
const uploaded = [];
async function call(client, path, method = 'GET', body, status = 200) {
  const headers = { ...(client ? { Cookie: [...client.cookies].map(([k,v])=>`${k}=${v}`).join('; ') } : {}), ...(body && !(body instanceof FormData) ? {'Content-Type':'application/json'} : {}) };
  const res = await fetch(base + path, { method, headers, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined, redirect:'manual' });
  const setCookies = res.headers.getSetCookie();
  if(client) for(const cookie of setCookies) { const pair=cookie.split(';')[0];const at=pair.indexOf('=');client.cookies.set(pair.slice(0,at),pair.slice(at+1)); }
  const json = await res.json();
  assert.equal(res.status, status, `${method} ${path}: ${res.status}, ${json.error || 'unexpected status'}`);
  assert.match(res.headers.get('cache-control')||'',/no-store/);
  if(path==='/api/auth' && body?.action==='login') assert(setCookies.some(cookie=>/HttpOnly/i.test(cookie)), 'Auth cookies must be HttpOnly');
  return json;
}
function token(client) {
  const parts=[...client.cookies].filter(([key])=>key.includes('-auth-token')).sort(([a],[b])=>a.localeCompare(b));
  const value=decodeURIComponent(parts.map(([,value])=>value).join(''));
  return JSON.parse(Buffer.from(value.slice('base64-'.length),'base64url').toString()).access_token;
}
async function cleanMedia() {
  if(!uploaded.length)return;
  const env = fs.readFileSync('.env.local','utf8');
  const config=Object.fromEntries(env.split('\n').map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1).replace(/^['"]|['"]$/g,'')]}));
  for(const {client,path} of uploaded) {
    const res=await fetch(`${config.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/member-media`,{method:'DELETE',headers:{apikey:config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token(client)}`,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});
    assert(res.ok,'Fixture photo cleanup failed');
  }
}
(async()=>{
 const admin=clients.get('admin'), china=clients.get('china'), global=clients.get('global');
 try {
  assert.equal((await call(null,'/api/me')).user,null);
  await call(null,'/api/profile','PUT',{id:china.id,moderation_status:'approved'},401);
  for(const client of clients.values()) await call(client,'/api/auth','POST',{action:'login',email:client.email,password:client.password});
  assert.equal((await call(admin,'/api/me')).user.is_admin,true);
  assert.equal((await call(global,'/api/me')).user.is_admin,false);
  await call(global,'/api/admin','GET',undefined,403);
  passed.push('Real Auth login, HttpOnly session cookies, anonymous and non-admin boundaries');
  const profile={full_name:'QA China fixture',bio:'Temporary integration fixture, removed immediately after test.',city:'Guangzhou',company:'QA temporary company',specialties:['Sourcing'],languages:['English'],avatar_url:'',cover_url:'',achievements:[],portfolio:[]};
  await call(china,'/api/profile','PUT',profile);
  assert.equal((await call(china,'/api/profile')).profile.company,profile.company);
  const form=new FormData();form.set('kind','avatar');form.set('file',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lYQAAAAASUVORK5CYII=','base64')],'qa.png',{type:'image/png'}));
  const image=await call(global,'/api/upload','POST',form,201);uploaded.push({client:global,path:image.path});
  assert(image.url.includes(global.id));
  passed.push('Profile save/read and real owned photo upload');
  await call(global,'/api/connections','POST',{recipient_id:china.id,message:'Temporary QA introduction only',consent:true},400);
  const globalRequest=await call(global,'/api/membership','POST',{plan:'global_monthly',reference:'QA reference - not a payment'},201);
  const chinaRequest=await call(china,'/api/membership','POST',{plan:'china_yearly',reference:'QA reference - not a payment'},201);
  assert.equal((await call(global,'/api/me')).membership.active,false);
  await call(admin,'/api/admin','PATCH',{kind:'profile',id:china.id,decision:'approved'});
  for(const request of [globalRequest,chinaRequest])await call(admin,'/api/admin','PATCH',{kind:'membership',id:request.id,decision:'approved'});
  const globalMe=await call(global,'/api/me'), chinaMe=await call(china,'/api/me');
  assert(globalMe.membership.active && chinaMe.membership.active);
  assert.equal(globalMe.membership.current.amount_rmb,100);assert.equal(chinaMe.membership.current.amount_rmb,1000);
  assert.equal((await call(null,`/api/members/${china.id}`)).member.id,china.id);
  passed.push('Pending membership has no access; admin approval creates correct active plans and public listing');
  await call(global,'/api/connections','POST',{recipient_id:china.id,message:'Temporary QA introduction only',consent:false},400);
  const connection=await call(global,'/api/connections','POST',{recipient_id:china.id,message:'Temporary QA introduction only',consent:true},201);
  assert.equal((await call(china,'/api/me')).connections.find(c=>c.id===connection.id).contact_email,null);
  await call(china,'/api/connections','PATCH',{id:connection.id,status:'accepted',consent:false},400);
  await call(global,'/api/connections','PATCH',{id:connection.id,status:'accepted',consent:true},400);
  await call(china,'/api/connections','PATCH',{id:connection.id,status:'accepted',consent:true});
  assert.equal((await call(global,'/api/me')).connections.find(c=>c.id===connection.id).contact_email,china.email);
  assert.equal((await call(china,'/api/me')).connections.find(c=>c.id===connection.id).contact_email,global.email);
  await call(china,'/api/connections','PATCH',{id:connection.id,status:'completed'});
  passed.push('Recipient-only connection transitions and bilateral email consent');
  const review=await call(global,'/api/reviews','POST',{connection_id:connection.id,rating:5,body:'Temporary QA integration review; removed immediately.'},201);
  await call(global,'/api/reviews','POST',{connection_id:connection.id,rating:5,body:'Temporary duplicate review must be rejected.'},409);
  assert.equal((await call(null,`/api/members/${china.id}`)).member.review_count,0);
  const queues=await call(admin,'/api/admin');assert(queues.reviews.some(r=>r.id===review.id));
  await call(admin,'/api/admin','PATCH',{kind:'review',id:review.id,decision:'approved'});
  const reviewed=await call(null,`/api/members/${china.id}`);assert.equal(reviewed.member.rating,5);assert.equal(reviewed.member.review_count,1);
  passed.push('Unique completed review, moderation queue and approved public rating');
  console.log(JSON.stringify({passed,checks:'HTTP lifecycle passed; no email was sent'},null,2));
 } finally {
  await cleanMedia();
  for(const client of clients.values())if(client.cookies.size)await call(client,'/api/auth','POST',{action:'logout'});
  for(const client of clients.values())assert.equal((await call(client,'/api/me')).user,null);
  console.log('Fixture photos removed; all fixture sessions signed out. Database fixture deletion is still required by operator.');
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
