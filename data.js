/* RentHub data layer.
 * This build uses ONE canonical room collection (data.rooms). Properties are
 * metadata containers and keep roomIds for compatibility. The local mode is
 * deliberately defensive, but a real multi-device deployment still needs a
 * server/backend (see BACKEND-SETUP.md).
 */
const Store = (() => {
  // Supabase multi-device backend. Falls back to local mode if the SDK/config/table is unavailable.
  const SUPA_CFG = window.RENTHUB_SUPABASE || {};
  const SUPA_URL = SUPA_CFG.url || '';
  const SUPA_KEY = SUPA_CFG.publishableKey || SUPA_CFG.anonKey || '';
  const SUPA_ENABLED = !!(SUPA_URL && SUPA_KEY);
  // Prefer the official SDK when it has loaded, but keep a REST fallback so the
  // application does not become dependent on a third-party CDN.
  const supabaseClient = (window.supabase && SUPA_ENABLED) ? window.supabase.createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  const REST_HEADERS = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };
  const REMOTE_TIMEOUT = 7000;
  async function withTimeout(promise, ms=REMOTE_TIMEOUT){
    let timer;
    try {
      return await Promise.race([promise, new Promise((_, reject)=>{timer=setTimeout(()=>reject(new Error('Supabase request timed out')),ms)})]);
    } finally { clearTimeout(timer); }
  }
  async function restRequest(path, options={}){
    const headers = {...REST_HEADERS, ...(options.headers||{})};
    const res = await withTimeout(fetch(`${SUPA_URL}${path}`, {...options, headers}));
    const text = await res.text();
    let body=null; try { body=text?JSON.parse(text):null } catch(_) { body=text; }
    if(!res.ok) throw new Error(body?.message || body?.error_description || body?.hint || body?.error || `Supabase HTTP ${res.status}`);
    return body;
  }
  const REMOTE_TABLE = 'rent_hub_state';
  const REMOTE_ID = 'main';
  let remoteReady = false;
  let remoteWriteTimer = null;
  let remoteWriteBusy = false;
  let remoteWriteQueued = false;

  const DATA_KEY = "rentHubLocalData";
  const SESSION_KEY = "rentHubAdminSession";
  const LANDLORD_SESSION_KEY = "rentHubLandlordSession";
  const AGENT_SESSION_KEY = "rentHubAgentSession";
  const IMAGE_DB = "rentHubLocalImages";
  const IMAGE_STORE = "images";
  const IN_SUBFOLDER = /\/(admin|landlord|agent)\//.test(location.pathname);
  const DEFAULT_IMG = IN_SUBFOLDER ? "../assets/default-property.svg" : "assets/default-property.svg";

  const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const money = n => `R${Number(n || 0).toLocaleString("en-ZA")}`;

  function seed() {
    return {brandName:"RentHub",contact:"",properties:[],rooms:[],applications:[],landlords:[],agents:[],rentals:[],payments:[],commissions:[],payouts:[],documents:[],notifications:[],auditLogs:[],settings:{username:"",password:""}};
  }

  function normalize(raw) {
    const d = raw && typeof raw === "object" ? raw : seed();
    const arrays = ["properties","rooms","applications","landlords","agents","rentals","payments","commissions","payouts","documents","notifications","auditLogs"];
    arrays.forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
    if (!d.settings || typeof d.settings !== "object") d.settings = {username:"",password:""};
    if (!d.brandName) d.brandName = "RentHub";
    if (d.contact == null) d.contact = "";

    // One-time migration from the old properties[].units model.
    const roomMap = new Map(d.rooms.map(r => [r.id,r]));
    d.properties.forEach(p => {
      if (!Array.isArray(p.roomIds)) p.roomIds = [];
      if (!Array.isArray(p.images)) p.images = [];
      if (!Array.isArray(p.facilities)) p.facilities = [];
      if (p.approved == null) p.approved = true;
      if (p.landlordId == null) p.landlordId = null;
      (Array.isArray(p.units) ? p.units : []).forEach(u => {
        if (!u || !u.id) return;
        let r = roomMap.get(u.id);
        if (!r) {
          r = {...u};
          roomMap.set(u.id,r);
          d.rooms.push(r);
        }
        Object.assign(r, {
          name:r.name || u.name || "Room",
          price:Number(r.price ?? u.companyPrice ?? u.landlordPrice ?? 0),
          landlordPrice:Number(r.landlordPrice ?? u.companyPrice ?? u.price ?? 0),
          companyPrice:Number(r.companyPrice ?? u.price ?? u.landlordPrice ?? 0),
          availability:r.availability || u.availability || "available",
          description:r.description ?? u.description ?? "",
          features:Array.isArray(r.features)?r.features:(Array.isArray(u.features)?u.features:[]),
          images:Array.isArray(r.images)?r.images:(Array.isArray(u.images)?u.images:[]),
          propertyId:r.propertyId || p.id,
          propertyName:r.propertyName || p.name || "",
          location:r.location || p.location || "",
          type:r.type || p.type || "Room",
          landlordId:r.landlordId ?? p.landlordId ?? null,
          approved:r.approved !== false && p.approved !== false
        });
        if (!p.roomIds.includes(r.id)) p.roomIds.push(r.id);
      });
    });
    d.rooms.forEach(r => {
      if (!Array.isArray(r.images)) r.images=[];
      if (!Array.isArray(r.features)) r.features=[];
      if (r.price == null) r.price=Number(r.companyPrice||r.landlordPrice||0);
      if (r.availability !== "occupied") r.availability="available";
      if (r.approved == null) r.approved=true;
      if (!r.propertyId) {
        const p=d.properties.find(p => p.roomIds.includes(r.id));
        if (p) { r.propertyId=p.id; r.propertyName=p.name; r.location=r.location||p.location; r.type=r.type||p.type; r.landlordId=r.landlordId??p.landlordId??null; }
      }
    });
    d.commissions.forEach(x=>{if(!x.agentId&&x.agent){const a=d.agents.find(v=>String(v.name||'').trim().toLowerCase()===String(x.agent).trim().toLowerCase());if(a)x.agentId=a.id}});
    d.payouts.forEach(x=>{if(!x.landlordId&&x.landlord){const l=d.landlords.find(v=>String(v.name||'').trim().toLowerCase()===String(x.landlord).trim().toLowerCase());if(l)x.landlordId=l.id}});
    syncPropertyCompatibility(d);
    return d;
  }

  function syncPropertyCompatibility(d) {
    d.properties.forEach(p => {
      p.roomIds = d.rooms.filter(r => r.propertyId === p.id).map(r => r.id);
      p.units = p.roomIds.map(id => d.rooms.find(r => r.id === id)).filter(Boolean);
    });
  }

  let data;
  try { data = normalize(JSON.parse(localStorage.getItem(DATA_KEY) || "null")); }
  catch(e) { data = normalize(seed()); }

  function save() {
    try {
      syncPropertyCompatibility(data);
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
      scheduleRemoteSave();
      return true;
    } catch(e) {
      console.error("RentHub storage error", e);
      alert("RentHub could not save this change. Browser storage may be full. Remove large photos or export/reset local data.");
      return false;
    }
  }

  async function remoteLoad() {
    if (!SUPA_ENABLED) { remoteReady = true; return false; }
    try {
      let rows;
      if (supabaseClient) {
        const result = await withTimeout(supabaseClient.from(REMOTE_TABLE).select('data,updated_at').eq('id', REMOTE_ID).maybeSingle());
        if (result.error) throw result.error;
        rows = result.data ? [result.data] : [];
      } else {
        rows = await restRequest(`/rest/v1/${REMOTE_TABLE}?id=eq.${encodeURIComponent(REMOTE_ID)}&select=data,updated_at`);
      }
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (row && row.data) {
        const fresh = normalize(row.data);
        Object.keys(data).forEach(k => delete data[k]);
        Object.assign(data, fresh);
        try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch (_) {}
      } else {
        // First run: create the remote record from the current local seed/cache.
        // Never do this until the read has completed successfully.
        remoteReady = true;
        await remoteSaveNow();
        return true;
      }
      remoteReady = true;
      window.dispatchEvent(new Event('rentHubDataChanged'));
      return true;
    } catch (e) {
      // Do not hold the entire admin/portal UI hostage to a failed network call.
      remoteReady = false;
      console.warn('RentHub Supabase load failed; continuing with local cache.', e);
      return false;
    }
  }

  async function remoteSaveNow() {
    if (!SUPA_ENABLED || !remoteReady) return false;
    if (remoteWriteBusy) { remoteWriteQueued = true; return false; }
    remoteWriteBusy = true;
    try {
      syncPropertyCompatibility(data);
      const payload = { id: REMOTE_ID, data: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() };
      if (supabaseClient) {
        const { error } = await withTimeout(supabaseClient.from(REMOTE_TABLE).upsert(payload, { onConflict: 'id' }));
        if (error) throw error;
      } else {
        await restRequest(`/rest/v1/${REMOTE_TABLE}?on_conflict=id`, {
          method:'POST',
          headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify(payload)
        });
      }
      return true;
    } catch (e) {
      console.warn('RentHub Supabase save failed; local cache is still available.', e);
      return false;
    } finally {
      remoteWriteBusy = false;
      if (remoteWriteQueued) { remoteWriteQueued = false; scheduleRemoteSave(50); }
    }
  }

  function scheduleRemoteSave(delay=250) {
    if (!SUPA_ENABLED || !remoteReady) return;
    clearTimeout(remoteWriteTimer);
    remoteWriteTimer = setTimeout(remoteSaveNow, delay);
  }

  async function initRemote() {
    if (!SUPA_ENABLED) { remoteReady = true; return false; }
    // The UI must never wait forever for Supabase.
    try {
      await Promise.race([
        remoteLoad(),
        new Promise(resolve => setTimeout(resolve, REMOTE_TIMEOUT + 500))
      ]);
    } catch (_) {}
    return true;
  }
  // Store.ready always resolves. A failed/slow Supabase request must not leave
  // every admin, landlord, agent or public page stuck on "Loading…".
  const ready = initRemote().catch(e => { console.warn('RentHub remote init error',e); remoteReady=false; return false; });

  function log(action,detail) {
    const now = new Date().toISOString();
    data.auditLogs.unshift({id:uid("LOG"),action,detail:detail||"",date:now});
    data.notifications.unshift({id:uid("NOTE"),message:detail||action,date:now,read:false});
    data.auditLogs=data.auditLogs.slice(0,500); data.notifications=data.notifications.slice(0,500);
    save();
  }

  function getRoom(id){return data.rooms.find(r=>r.id===id)||null;}
  function getProperty(id){return data.properties.find(p=>p.id===id)||null;}
  function refresh(){ try { const fresh=normalize(JSON.parse(localStorage.getItem(DATA_KEY)||"null")); Object.keys(data).forEach(k=>delete data[k]); Object.assign(data,fresh); } catch(e) {} return data; }

  // Image storage uses Supabase Storage when configured, with IndexedDB fallback for offline/local mode.
  function openImageDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(IMAGE_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(IMAGE_STORE))r.result.createObjectStore(IMAGE_STORE);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  const PREVIEW_KEY="rentHubImagePreviews";
  function readPreviews(){try{return JSON.parse(localStorage.getItem(PREVIEW_KEY)||"{}")}catch(e){return {}}}
  function writePreview(ref,url){try{const p=readPreviews();p[ref]=url;localStorage.setItem(PREVIEW_KEY,JSON.stringify(p))}catch(e){}}
  function previewFor(ref){return readPreviews()[ref]||null}
  function makePreview(blob){return new Promise((resolve,reject)=>{const rd=new FileReader();rd.onerror=()=>reject(rd.error);rd.onload=()=>{const img=new Image();img.onload=()=>{const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78))};img.onerror=()=>reject(new Error("Invalid image"));img.src=rd.result};rd.readAsDataURL(blob)})}
  function isRemoteImage(ref){return /^https?:\/\//i.test(String(ref||'')) && String(ref).includes('supabase');}
  async function putImage(blob){
    if(SUPA_ENABLED){
      try {
        const ext=(blob.name||'image.jpg').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
        const path=`rooms/${Date.now()}_${Math.random().toString(36).slice(2,10)}.${ext}`;
        if (supabaseClient) {
          const {error}=await withTimeout(supabaseClient.storage.from('renthub-images').upload(path,blob,{cacheControl:'31536000',upsert:false,contentType:blob.type||'image/jpeg'}));
          if(!error){const {data:pub}=supabaseClient.storage.from('renthub-images').getPublicUrl(path);if(pub?.publicUrl)return pub.publicUrl;}
          throw error || new Error('Could not create public image URL');
        }
        await restRequest(`/storage/v1/object/renthub-images/${path}`, {method:'POST',headers:{'Content-Type':blob.type||'image/jpeg','x-upsert':'false'},body:blob});
        return `${SUPA_URL}/storage/v1/object/public/renthub-images/${path}`;
      } catch(e){console.warn('Supabase image upload failed; using local fallback.',e)}
    }
    const key=uid("IMG"),ref="local:"+key;try{const db=await openImageDB();await new Promise((res,rej)=>{const tx=db.transaction(IMAGE_STORE,"readwrite");tx.objectStore(IMAGE_STORE).put(blob,key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});try{writePreview(ref,await makePreview(blob))}catch(e){}return ref}catch(e){return await makePreview(blob)}}
  async function getImage(ref){if(!ref||!ref.startsWith("local:"))return null;try{const db=await openImageDB();return await new Promise((res,rej)=>{const r=db.transaction(IMAGE_STORE).objectStore(IMAGE_STORE).get(ref.slice(6));r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}catch(e){return null}}
  async function deleteImage(ref){
    if(!ref)return;
    if(isRemoteImage(ref)&&supabaseClient){
      try { const marker='/storage/v1/object/public/renthub-images/'; const i=ref.indexOf(marker); if(i>=0){const path=decodeURIComponent(ref.slice(i+marker.length)); if(supabaseClient){await withTimeout(supabaseClient.storage.from('renthub-images').remove([path]));} else {await restRequest(`/storage/v1/object/renthub-images/${path}`,{method:'DELETE'});} } } catch(e){console.warn('Remote image delete failed',e)}
      return;
    }
    if(!ref.startsWith("local:"))return;try{const db=await openImageDB();await new Promise((res,rej)=>{const tx=db.transaction(IMAGE_STORE,"readwrite");tx.objectStore(IMAGE_STORE).delete(ref.slice(6));tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});const p=readPreviews();delete p[ref];try{localStorage.setItem(PREVIEW_KEY,JSON.stringify(p))}catch(e){}}catch(e){}}
  async function hydrateImages(root=document){for(const el of [...root.querySelectorAll("img[data-local-img]")]){const ref=el.dataset.localImg;if(!ref||ref==="default")continue;if(ref.startsWith("data:")||/^https?:\/\//i.test(ref)){el.src=ref;continue}if(ref.startsWith("local:")){const b=await getImage(ref);if(b){const u=URL.createObjectURL(b);el.src=u;el.dataset.objectUrl=u;continue}const f=previewFor(ref);if(f)el.src=f}}}
  function releaseObjectUrls(root=document){root.querySelectorAll("img[data-object-url]").forEach(el=>{try{URL.revokeObjectURL(el.dataset.objectUrl)}catch(e){}})}

  function adminSession(){return localStorage.getItem(SESSION_KEY)}
  function isLoggedIn(){return !!adminSession()}
  function login(u,p){if(data.settings.username&&data.settings.password&&String(u).trim()===String(data.settings.username).trim()&&String(p)===String(data.settings.password)){localStorage.setItem(SESSION_KEY,uid("ADMSESS"));return true}return false}
  function logout(){localStorage.removeItem(SESSION_KEY)}
  function isLandlordLoggedIn(){return !!localStorage.getItem(LANDLORD_SESSION_KEY)}
  function currentLandlord(){const id=localStorage.getItem(LANDLORD_SESSION_KEY);return data.landlords.find(l=>l.id===id)||null}
  function loginLandlord(phone,pass){const p=String(phone||"").trim();const x=data.landlords.find(l=>l.status==="APPROVED"&&String(l.phone||"").trim()===p&&String(l.password||"")===String(pass||""));if(x){localStorage.setItem(LANDLORD_SESSION_KEY,x.id);return true}return false}
  function logoutLandlord(){localStorage.removeItem(LANDLORD_SESSION_KEY)}
  function isAgentLoggedIn(){return !!localStorage.getItem(AGENT_SESSION_KEY)}
  function currentAgent(){const id=localStorage.getItem(AGENT_SESSION_KEY);return data.agents.find(a=>a.id===id)||null}
  function loginAgent(phone,pass){const p=String(phone||"").trim();const x=data.agents.find(a=>a.status==="APPROVED"&&String(a.phone||"").trim()===p&&String(a.password||"")===String(pass||""));if(x){localStorage.setItem(AGENT_SESSION_KEY,x.id);return true}return false}
  function logoutAgent(){localStorage.removeItem(AGENT_SESSION_KEY)}

  window.addEventListener("storage",e=>{if(e.key===DATA_KEY){refresh();window.dispatchEvent(new Event("rentHubDataChanged"))}});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){refresh(); if(supabaseClient) remoteLoad(); window.dispatchEvent(new Event("rentHubDataChanged"))}});
  window.addEventListener('online',()=>{if(supabaseClient){remoteLoad();scheduleRemoteSave(100)}});

  return {get data(){return data},save,log,uid,escapeHtml:esc,money,refresh,getRoom,getProperty,sync:()=>syncPropertyCompatibility(data),putImage,getImage,deleteImage,hydrateImages,releaseObjectUrls,initRemote,ready,remoteEnabled:()=>SUPA_ENABLED,remoteStatus:()=>({configured:SUPA_ENABLED,connected:remoteReady}),DEFAULT_IMG,isLoggedIn,login,logout,isLandlordLoggedIn,currentLandlord,loginLandlord,logoutLandlord,isAgentLoggedIn,currentAgent,loginAgent,logoutAgent};
})();
