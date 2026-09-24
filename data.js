/* RentHub data layer.
 * This build uses ONE canonical room collection (data.rooms). Properties are
 * metadata containers and keep roomIds for compatibility. The local mode is
 * deliberately defensive, but a real multi-device deployment still needs a
 * server/backend (see BACKEND-SETUP.md).
 */
const Store = (() => {
  const CFG = window.RENTHUB_SUPABASE || {};
  const SUPA_URL = CFG.url || '';
  // Use the modern publishable browser key first; retain anonKey only for legacy compatibility.
  const SUPA_KEY = CFG.publishableKey || CFG.anonKey || '';
  const HEADERS = {apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`};
  const TABLE = 'rent_hub_state', ID = 'main';
  const DEFAULT_IMG = /\/(admin|landlord|agent)\//.test(location.pathname) ? '../assets/default-property.svg' : 'assets/default-property.svg';
  let data = seed();
  let remoteReady = false;
  let writeChain = Promise.resolve();
  let session = null;
  let sessionToken = new URLSearchParams(location.search).get('session') || '';
  const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money = n => `R${Number(n||0).toLocaleString('en-ZA')}`;
  function seed(){return {brandName:'RentHub',contact:'',properties:[],rooms:[],applications:[],landlords:[],agents:[],rentals:[],payments:[],commissions:[],payouts:[],documents:[],notifications:[],auditLogs:[],settings:{username:'',password:''}}}
  function normalize(raw){
    const d=raw&&typeof raw==='object'?raw:seed();
    ['properties','rooms','applications','landlords','agents','rentals','payments','commissions','payouts','documents','notifications','auditLogs'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});
    if(!d.settings||typeof d.settings!=='object')d.settings={username:'',password:''};
    if(!d.brandName)d.brandName='RentHub'; if(d.contact==null)d.contact='';
    const map=new Map(d.rooms.map(r=>[r.id,r]));
    d.properties.forEach(p=>{
      if(!Array.isArray(p.roomIds))p.roomIds=[]; if(!Array.isArray(p.images))p.images=[]; if(!Array.isArray(p.facilities))p.facilities=[];
      if(p.approved==null)p.approved=true; if(p.landlordId==null)p.landlordId=null;
      (Array.isArray(p.units)?p.units:[]).forEach(u=>{if(!u||!u.id)return;let r=map.get(u.id);if(!r){r={...u};map.set(u.id,r);d.rooms.push(r)}
        Object.assign(r,{name:r.name||u.name||'Room',price:Number(r.price??u.companyPrice??u.landlordPrice??0),landlordPrice:Number(r.landlordPrice??u.companyPrice??u.price??0),companyPrice:Number(r.companyPrice??u.price??u.landlordPrice??0),availability:r.availability||u.availability||'available',description:r.description??u.description??'',features:Array.isArray(r.features)?r.features:(Array.isArray(u.features)?u.features:[]),images:Array.isArray(r.images)?r.images:(Array.isArray(u.images)?u.images:[]),propertyId:r.propertyId||p.id,propertyName:r.propertyName||p.name||'',location:r.location||p.location||'',type:r.type||p.type||'Room',landlordId:r.landlordId??p.landlordId??null,approved:r.approved!==false&&p.approved!==false});
        if(!p.roomIds.includes(r.id))p.roomIds.push(r.id);
      });
    });
    d.rooms.forEach(r=>{if(!Array.isArray(r.images))r.images=[];if(!Array.isArray(r.features))r.features=[];if(r.price==null)r.price=Number(r.companyPrice||r.landlordPrice||0);if(r.availability!=='occupied')r.availability='available';if(r.approved==null)r.approved=true;if(!r.propertyId){const p=d.properties.find(p=>(p.roomIds||[]).includes(r.id));if(p){r.propertyId=p.id;r.propertyName=p.name;r.location=r.location||p.location;r.type=r.type||p.type;r.landlordId=r.landlordId??p.landlordId??null}}});
    d.commissions.forEach(x=>{if(!x.agentId&&x.agent){const a=d.agents.find(v=>String(v.name||'').trim().toLowerCase()===String(x.agent).trim().toLowerCase());if(a)x.agentId=a.id}});
    d.payouts.forEach(x=>{if(!x.landlordId&&x.landlord){const l=d.landlords.find(v=>String(v.name||'').trim().toLowerCase()===String(x.landlord).trim().toLowerCase());if(l)x.landlordId=l.id}});
    syncPropertyCompatibility(d); return d;
  }
  function syncPropertyCompatibility(d){d.properties.forEach(p=>{p.roomIds=d.rooms.filter(r=>r.propertyId===p.id).map(r=>r.id);p.units=p.roomIds.map(id=>d.rooms.find(r=>r.id===id)).filter(Boolean)})}
  async function req(path,options={}){if(!SUPA_URL||!SUPA_KEY)throw new Error('Supabase is not configured. Check supabase-config.js.');const controller=new AbortController();const t=setTimeout(()=>controller.abort(),8000);try{const res=await fetch(`${SUPA_URL}${path}`,{...options,signal:controller.signal,headers:{...HEADERS,...(options.headers||{})}});const txt=await res.text();let body=null;try{body=txt?JSON.parse(txt):null}catch{body=txt}if(!res.ok)throw new Error(body?.message||body?.hint||body?.error||`Supabase HTTP ${res.status}`);return body}finally{clearTimeout(t)}}
  function replaceData(next){const normalized=normalize(next);Object.keys(data).forEach(k=>{if(!(k in normalized))delete data[k]});Object.assign(data,normalized);syncPropertyCompatibility(data);return data}
  async function loadRemote(){const rows=await req(`/rest/v1/${TABLE}?id=eq.${encodeURIComponent(ID)}&select=data,updated_at`);if(!rows.length){replaceData(seed());remoteReady=true;await saveRemote();}else replaceData(rows[0].data);remoteReady=true;window.dispatchEvent(new Event('rentHubDataChanged'));return data}
  function saveRemote(){syncPropertyCompatibility(data);const payload={id:ID,data:JSON.parse(JSON.stringify(data)),updated_at:new Date().toISOString()};writeChain=writeChain.then(()=>req(`/rest/v1/${TABLE}?on_conflict=id`,{method:'POST',headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)}));return writeChain}
  function save(){if(!remoteReady)throw new Error('Supabase is not connected. Changes were not saved.');return saveRemote()}
  function refresh(){return loadRemote()}
  function log(action,detail){const now=new Date().toISOString();data.auditLogs.unshift({id:uid('LOG'),action,detail:detail||'',date:now});data.notifications.unshift({id:uid('NOTE'),message:detail||action,date:now,read:false});data.auditLogs=data.auditLogs.slice(0,500);data.notifications=data.notifications.slice(0,500);saveRemote()}
  function getRoom(id){return data.rooms.find(r=>r.id===id)||null} function getProperty(id){return data.properties.find(p=>p.id===id)||null}

  function makePreview(blob){return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onerror=()=>reject(rd.error);rd.onload=()=>{const img=new Image();img.onload=()=>{const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>b?resolve(b):reject(new Error('Image compression failed')),'image/jpeg',.78)};img.onerror=()=>reject(new Error('Invalid image'));img.src=rd.result};rd.readAsDataURL(blob)})}
  async function putImage(blob){const b=await makePreview(blob);const path=`rooms/${Date.now()}_${Math.random().toString(36).slice(2,10)}.jpg`;await req(`/storage/v1/object/renthub-images/${path}`,{method:'POST',headers:{'Content-Type':'image/jpeg','x-upsert':'false','Cache-Control':'public,max-age=31536000,immutable'},body:b});return `${SUPA_URL}/storage/v1/object/public/renthub-images/${path}`}
  async function deleteImage(ref){if(!ref||!ref.includes('/storage/v1/object/public/renthub-images/'))return;const marker='/storage/v1/object/public/renthub-images/';const i=ref.indexOf(marker);const path=decodeURIComponent(ref.slice(i+marker.length));try{await req(`/storage/v1/object/renthub-images/${path}`,{method:'DELETE'})}catch(e){console.warn(e)}}
  async function hydrateImages(root=document){root.querySelectorAll('img[data-local-img]').forEach(el=>{const ref=el.dataset.localImg;if(/^https?:\/\//i.test(ref))el.src=ref})}
  function releaseObjectUrls(){}

  async function createSession(role,identifier,password){const body={role,identifier:String(identifier||'').trim(),password:String(password||'')};const r=await req('/rest/v1/rpc/renthub_login',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({p_role:body.role,p_identifier:body.identifier,p_password:body.password})});const s=Array.isArray(r)?r[0]:r;if(!s?.token)throw new Error('Invalid login');sessionToken=s.token;session={role,userId:s.user_id};return true}
  async function validateSession(){if(!sessionToken)return false;try{const r=await req('/rest/v1/rpc/renthub_validate_session',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({token:sessionToken})});const s=Array.isArray(r)?r[0]:r;if(!s?.valid){session=null;return false}session={role:s.role,userId:s.user_id};return true}catch{session=null;return false}}
  async function logout(){if(sessionToken){try{await req('/rest/v1/rpc/renthub_logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:sessionToken})})}catch{}}session=null;sessionToken='';location.href=location.pathname.split('/').slice(0,-1).join('/')+'/login.html'}
  function decorateLinks(){if(!sessionToken)return;document.querySelectorAll('a[href]').forEach(a=>{const href=a.getAttribute('href');if(!href||href.startsWith('#')||href.startsWith('http')||href.startsWith('mailto:')||href.includes('session='))return;if(/\.html/.test(href))a.setAttribute('href',href+(href.includes('?')?'&':'?')+'session='+encodeURIComponent(sessionToken))})}
  function isLoggedIn(){return session?.role==='admin'} function login(u,p){return createSession('admin',u,p)} function isLandlordLoggedIn(){return session?.role==='landlord'} function currentLandlord(){return session?.role==='landlord'?data.landlords.find(x=>x.id===session.userId)||null:null} function loginLandlord(u,p){return createSession('landlord',u,p)} function logoutLandlord(){return logout()} function isAgentLoggedIn(){return session?.role==='agent'} function currentAgent(){return session?.role==='agent'?data.agents.find(x=>x.id===session.userId)||null:null} function loginAgent(u,p){return createSession('agent',u,p)} function logoutAgent(){return logout()}

  const ready=(async()=>{await loadRemote();await validateSession();decorateLinks();return true})().catch(e=>{remoteReady=false;console.error('RentHub requires Supabase:',e);const existing=document.getElementById('supabaseConnectionError');if(!existing){const box=document.createElement('div');box.id='supabaseConnectionError';box.setAttribute('role','alert');box.innerHTML=`<strong>Supabase connection required</strong><span>${esc(e.message)}</span><small>No browser storage is being used. Check the Supabase URL, key, RLS policies and SQL setup.</small>`;document.body.appendChild(box)}throw e});
  return {get data(){return data},save,log,uid,escapeHtml:esc,money,refresh,getRoom,getProperty,sync:()=>syncPropertyCompatibility(data),putImage,getImage:async()=>null,deleteImage,hydrateImages,releaseObjectUrls,initRemote:loadRemote,ready,remoteEnabled:()=>Boolean(SUPA_URL&&SUPA_KEY),remoteStatus:()=>({configured:Boolean(SUPA_URL&&SUPA_KEY),connected:remoteReady}),DEFAULT_IMG,isLoggedIn,login,logout,isLandlordLoggedIn,currentLandlord,loginLandlord,logoutLandlord,isAgentLoggedIn,currentAgent,loginAgent,logoutAgent,sessionToken:()=>sessionToken,decorateLinks};
})();
