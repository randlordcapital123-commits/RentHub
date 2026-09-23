/* RentHub public site script.
   Data lives in Store (see data.js): localStorage for records,
   IndexedDB for uploaded photos. Admin management happens in /admin. */
const data = Store.data;
const DEFAULT_IMG = Store.DEFAULT_IMG;
const $ = s => document.querySelector(s);
const money = Store.money, escapeHtml = Store.escapeHtml, uid = Store.uid, hydrateImages = Store.hydrateImages;
let state = { location: "", type: "", min: "", max: "", availability: "", facility: "", search: "" };

// Icons shown next to a property/unit's facilities and features.
const ICONS={
 parking:'<svg viewBox="0 0 24 24"><path d="M6 20V4h6.5a4.5 4.5 0 0 1 0 9H9v7M9 8h3.5a1.5 1.5 0 0 1 0 3H9"/></svg>',
 shower:'<svg viewBox="0 0 24 24"><path d="M5 12h14M7 12v3m10-3v3M8 7V5a4 4 0 0 1 8 0v2M10 18v2m4-2v2"/></svg>',
 bath:'<svg viewBox="0 0 24 24"><path d="M4 12h16M5 12v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4M7 12V7a2 2 0 0 1 4 0v1"/></svg>',
 wifi:'<svg viewBox="0 0 24 24"><path d="M3 9a16 16 0 0 1 18 0M6 13a11 11 0 0 1 12 0M9 17a6 6 0 0 1 6 0M12 21h.01"/></svg>',
 security:'<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-2.7 8-7 10-4.3-2-7-5.5-7-10V6l7-3z"/></svg>',
 water:'<svg viewBox="0 0 24 24"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>',
 feature:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>'
};
function iconFor(label){const x=String(label).toLowerCase();if(x.includes('park'))return ICONS.parking;if(x.includes('shower'))return ICONS.shower;if(x.includes('bath'))return ICONS.bath;if(x.includes('wifi')||x.includes('wi-fi')||x.includes('internet')||x.includes('fibre')||x.includes('fiber'))return ICONS.wifi;if(x.includes('security')||x.includes('cctv')||x.includes('guard')||x.includes('alarm'))return ICONS.security;if(x.includes('water'))return ICONS.water;return ICONS.feature}
function featureChips(list){return (list||[]).map(f=>`<span class="feature"><span class="feature-icon">${iconFor(f)}</span>${escapeHtml(f)}</span>`).join('')}
function roomListings(){
  return (Array.isArray(data.rooms)?data.rooms:[]).filter(r=>r&&r.id).map(r=>{
    const p=r.propertyId?data.properties.find(x=>x.id===r.propertyId):null;
    return {...r,price:Number(r.companyPrice??r.price??r.landlordPrice??0),images:Array.isArray(r.images)?r.images:[],features:Array.isArray(r.features)?r.features:[],facilities:Array.isArray(p?.facilities)?p.facilities:[],propertyName:r.propertyName||p?.name||'',rules:p?.rules||'',approved:r.approved!==false&&p?.approved!==false};
  });
}
function roomImages(r){return r.images.filter(x=>x&&x!=='default').slice(0,5)}
function relatedProperty(r){return r.propertyId?data.properties.find(p=>p.id===r.propertyId):null}

function matches(r){
  if(r.approved===false)return false; const q=state.search.toLowerCase(); const text=`${r.name} ${r.location||''} ${r.description||''} ${(r.features||[]).join(' ')} ${(r.facilities||[]).join(' ')} ${r.propertyName||''}`.toLowerCase();
  if(q&&!text.includes(q))return false; if(state.location&&r.location!==state.location)return false;if(state.type&&r.type!==state.type)return false;
  if(state.min&&r.price<Number(state.min))return false;if(state.max&&r.price>Number(state.max))return false;if(state.availability&&r.availability!==state.availability)return false;
  if(state.facility&&!(`${(r.features||[]).join(' ')} ${(r.facilities||[]).join(' ')}`.toLowerCase().includes(state.facility.toLowerCase())))return false;return true;
}
function initFilters(){const rs=roomListings();$('#locationFilter').innerHTML='<option value="">Any location</option>'+[...new Set(rs.map(r=>r.location).filter(Boolean))].map(x=>`<option>${escapeHtml(x)}</option>`).join('');$('#typeFilter').innerHTML='<option value="">Any type</option>'+[...new Set(rs.map(r=>r.type).filter(Boolean))].map(x=>`<option>${escapeHtml(x)}</option>`).join('')}
function render(){let list=roomListings().filter(matches);if($('#sortSelect').value==='priceAsc')list.sort((a,b)=>a.price-b.price);if($('#sortSelect').value==='priceDesc')list.sort((a,b)=>b.price-a.price);$('#resultCount').textContent=`${list.length} room${list.length===1?'':'s'} found`;$('#propertyGrid').innerHTML=list.map(r=>{const im=roomImages(r)[0]||'default';const src=im.startsWith('data:')?im:DEFAULT_IMG;return `<article class="property-card" onclick="openUnit('${r.id}')"><img class="property-img" src="${src}" data-local-img="${escapeHtml(im)}" alt="${escapeHtml(r.name)}" loading="lazy"><div class="property-body"><h3>${escapeHtml(r.name)}</h3><div class="location">${escapeHtml(r.location||'')}</div><div class="price">${money(r.price)} / month</div><div class="features">${featureChips([...(r.features||[]), ...(r.facilities||[])].filter((v,i,a)=>a.indexOf(v)===i).slice(0,4))}</div><button class="btn primary">View room</button></div></article>`}).join('');$('#emptyState').classList.toggle('hidden',list.length>0);renderChips();hydrateImages()}
function renderChips(){const vals=[['Location',state.location],['Type',state.type],['Min',state.min?money(state.min):''],['Max',state.max?money(state.max):''],['Availability',state.availability],['Facility',state.facility],['Search',state.search]];$('#activeChips').innerHTML=vals.filter(x=>x[1]).map(x=>`<span class="chip">${escapeHtml(x[0])}: ${escapeHtml(x[1])}</span>`).join('')}
function openUnit(id){
  const r=roomListings().find(x=>x.id===id);
  if(!r)return;
  let imgs=roomImages(r);
  let current=0;
  const p=relatedProperty(r);
  const allFeatures=[...(r.features||[]), ...(r.facilities||[])]
    .filter((v,i,a)=>v&&a.indexOf(v)===i);
  const draw=()=>{
    const mainRef=imgs[current]||'';
    const gallery=imgs.length ? `
      <div class="gallery">
        <img class="gallery-main" src="${mainRef.startsWith('data:')?mainRef:DEFAULT_IMG}" data-local-img="${escapeHtml(mainRef)}" alt="${escapeHtml(r.name)}">
        <div class="thumbs">
          ${imgs.map((im,i)=>`<img class="${i===current?'active':''}" src="${im.startsWith('data:')?im:DEFAULT_IMG}" data-local-img="${escapeHtml(im)}" onclick="window.__roomGallery(${i})" alt="Room photo ${i+1}">`).join('')}
        </div>
      </div>` : `
      <div class="gallery"><img class="gallery-main" src="${DEFAULT_IMG}" alt="No room photo available"></div>`;
    $('#unitContent').innerHTML=`
      ${gallery}
      <div class="unit-meta">
        <div>
          <div class="eyebrow">ROOM LISTING</div>
          <h2>${escapeHtml(r.name)}</h2>
          <div class="location">${escapeHtml(r.location||'')}${p?' · '+escapeHtml(p.name):''}</div>
        </div>
        <span class="status-pill">${escapeHtml((r.availability||'available').toUpperCase())}</span>
      </div>
      <div class="room-summary">
        <div><span class="detail-label">Monthly rent</span><strong>${money(r.price)} / month</strong></div>
        <div><span class="detail-label">Room type</span><strong>${escapeHtml(r.type||'Room')}</strong></div>
      </div>
      <section class="room-info">
        <h3>About this room</h3>
        <p>${escapeHtml(r.description||'No description has been provided for this room.')}</p>
      </section>
      ${allFeatures.length?`<section class="room-info"><h3>Facilities</h3><div class="features">${featureChips(allFeatures)}</div></section>`:''}
      ${p?.rules?`<section class="room-info"><h3>Property rules</h3><p>${escapeHtml(p.rules)}</p></section>`:''}
      ${r.availability==='available' && r.approved!==false ? `<button class="btn primary" style="width:100%;margin-top:10px" onclick="startApplicationStandalone('${r.id}')">Apply for this room</button>` : `<button class="btn ghost" style="width:100%;margin-top:10px" disabled>Room not available</button>`}`;
    hydrateImages($('#unitContent'));
  };
  window.__roomGallery=i=>{if(i>=0&&i<imgs.length){current=i;draw()}};
  draw();
  $('#unitModal').classList.add('open');
}

function startApplicationStandalone(id){
  const r=roomListings().find(x=>x.id===id);
  if(!r||r.availability!=='available'||r.approved===false){alert('This room is no longer available.');return}
  const wrap=document.createElement('div'); wrap.className='modal open'; wrap.id='applicationModal';
  wrap.innerHTML=`<div class="modal-card"><button class="icon-btn close" id="closeApplication" aria-label="Close">×</button><div class="eyebrow">TENANT APPLICATION</div><h2>Apply for ${escapeHtml(r.name)}</h2><p>${escapeHtml(r.location||'')} · ${money(r.price)} / month</p><form id="applicationForm"><div class="form-grid"><label>First name<input required name="first"></label><label>Surname<input required name="surname"></label><label>Phone<input required name="phone" inputmode="tel"></label><label>Email<input required type="email" name="email"></label><label>ID / tenant number<input required name="tenantNumber"></label></div><label>Message<textarea name="message" placeholder="Tell us anything relevant to your application"></textarea><button class="btn primary" style="width:100%">Submit application</button></form><div id="applicationResult"></div></div>`; document.body.appendChild(wrap);
  const close=()=>wrap.remove(); $('#closeApplication').onclick=close; wrap.onclick=e=>{if(e.target===wrap)close()};
  $('#applicationForm').onsubmit=e=>{e.preventDefault(); const f=new FormData(e.target); const phone=String(f.get('phone')).trim(); const tenantNo=String(f.get('tenantNumber')).trim(); if(!/^\+?[0-9 ()-]{7,20}$/.test(phone)){alert('Enter a valid phone number.');return} if(data.applications.some(a=>a.roomId===r.id&&a.tenantNumber===tenantNo&&['RECEIVED','APPROVED'].includes(a.status))){alert('An active application already exists for this tenant and room.');return} const a={id:uid('APP'),roomId:r.id,propertyId:r.propertyId||null,tenantNumber:tenantNo,tenant:{first:String(f.get('first')).trim(),surname:String(f.get('surname')).trim(),phone,email:String(f.get('email')).trim()},message:String(f.get('message')).trim(),status:'RECEIVED',createdAt:new Date().toISOString()}; data.applications.unshift(a); Store.save(); Store.log('New tenant application',`${a.tenant.first} ${a.tenant.surname} — ${r.name}`); $('#applicationResult').innerHTML=`<div class="chip" style="margin-top:12px">Application submitted. Reference: <b>${escapeHtml(a.id)}</b>. Save this reference to check your status.</div>`; e.target.reset(); };
}
window.startApplicationStandalone=startApplicationStandalone;

$("#filterBtn").onclick = () => { $("#filterDrawer").classList.add("open"); $("#drawerBackdrop").classList.add("open"); };
$("#closeDrawer").onclick = $("#drawerBackdrop").onclick = () => { $("#filterDrawer").classList.remove("open"); $("#drawerBackdrop").classList.remove("open"); };
$("#applyFilters").onclick = () => { state = { ...state, location: $("#locationFilter").value, type: $("#typeFilter").value, min: $("#minPrice").value, max: $("#maxPrice").value, availability: $("#availabilityFilter").value, facility: $("#facilityFilter").value }; $("#filterDrawer").classList.remove("open"); $("#drawerBackdrop").classList.remove("open"); render(); };
$("#drawerClear").onclick = $("#clearBtn").onclick = () => { state = { location: "", type: "", min: "", max: "", availability: "", facility: "", search: "" }; $("#searchInput").value = ""; ["locationFilter", "typeFilter", "minPrice", "maxPrice", "availabilityFilter", "facilityFilter"].forEach(id => $("#" + id).value = ""); render(); };
$("#searchInput").oninput = e => { state.search = e.target.value; render(); };
$("#sortSelect").onchange = render;
$("#closeModal").onclick = () => $("#unitModal").classList.remove("open");
$("#unitModal").onclick = e => { if (e.target.id === "unitModal") $("#unitModal").classList.remove("open"); }; document.addEventListener("keydown",e=>{if(e.key==="Escape"){document.querySelectorAll(".modal.open").forEach(m=>m.classList.remove("open"));}});
$("#menuBtn").onclick = () => $("#mobileNav").classList.toggle("open");
document.querySelectorAll(".mobile-nav a").forEach(a => a.onclick = () => $("#mobileNav").classList.remove("open"));
$("#statusForm").onsubmit = e => {
  e.preventDefault();
  const a = data.applications.find(x => x.id === $("#statusToken").value.trim());
  $("#statusResult").innerHTML = a ? `<div class="chip" style="margin-top:10px">Status: ${escapeHtml(a.status)} · ${escapeHtml(a.tenantNumber)}</div>` : `<div class="chip" style="margin-top:10px">Application not found.</div>`;
};
$("#landlordForm").onsubmit = e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const phone=String(f.get('phone')||'').trim(); if(!/^\+?[0-9 ()-]{7,20}$/.test(phone)){alert('Enter a valid phone number.');return} if(data.landlords.some(x=>String(x.phone||'').replace(/\D/g,'')===phone.replace(/\D/g,''))){alert('A landlord application already exists for this phone number.');return} const rec={ id: uid('L'), name:String(f.get('name')).trim(), company:String(f.get('company')).trim(), phone, whatsapp:String(f.get('whatsapp')).trim(), email:String(f.get('email')).trim(), address:String(f.get('address')).trim(), property:String(f.get('property')).trim(), ownership:String(f.get('ownership')).trim(), status:'PENDING' }; data.landlords.push(rec); Store.save(); Store.log('New landlord application',rec.name); alert('Your landlord application has been submitted. Reference: '+rec.id); e.target.reset();
};
$("#agentForm").onsubmit = e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const phone=String(f.get('phone')||'').trim(); if(!/^\+?[0-9 ()-]{7,20}$/.test(phone)){alert('Enter a valid phone number.');return} if(data.agents.some(x=>String(x.phone||'').replace(/\D/g,'')===phone.replace(/\D/g,''))){alert('An agent application already exists for this phone number.');return} const rec={ id: uid('A'), name:String(f.get('name')).trim(), business:String(f.get('business')).trim(), phone, whatsapp:String(f.get('whatsapp')).trim(), email:String(f.get('email')).trim(), address:String(f.get('address')).trim(), type:String(f.get('type')), reason:String(f.get('reason')).trim(), status:'PENDING' }; data.agents.push(rec); Store.save(); Store.log('New agent application',rec.name); alert('Your Agent application has been submitted. Reference: '+rec.id); e.target.reset();
};
$("#contactBtn").onclick = () => alert(data.contact);
$("#brandName").textContent = data.brandName;
$("#year").textContent = new Date().getFullYear();
document.title = data.brandName;
initFilters(); render();

window.addEventListener('storage', e => { if(e.key === 'rentHubLocalData'){ try { const fresh=JSON.parse(e.newValue||'null'); if(fresh){ Object.keys(data).forEach(k=>delete data[k]); Object.assign(data,fresh); initFilters(); render(); } } catch(_){} } });
window.addEventListener('rentHubDataChanged', ()=>{ initFilters(); render(); });
