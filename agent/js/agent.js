Store.ready.then(() => {
  const data=Store.data,page=document.body.dataset.page,c=document.getElementById('content'),esc=Store.escapeHtml,money=Store.money,me=Store.currentAgent();
  if(!Store.isAgentLoggedIn()||!me||me.status!=='APPROVED'){Store.logoutAgent();location.href='login.html';return}
  document.getElementById('menuBtn')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.toggle('open'));
  document.getElementById('logoutBtn')?.addEventListener('click',()=>{Store.logoutAgent();location.href='../index.html'});
  function rows(){return data.commissions.filter(r=>r.agentId===me.id)}
  function dashboard(){const rs=rows(),total=rs.reduce((s,r)=>s+Number(r.amount||0),0);c.innerHTML=`<p class="muted">Welcome back, ${esc(me.name)}.</p><div class="cards"><div class="card">Commission entries<strong>${rs.length}</strong></div><div class="card">Total earned<strong>${money(total)}</strong></div><div class="card">Account status<strong>${esc(me.status)}</strong></div></div>`}
  function commissions(){const rs=rows(),total=rs.reduce((s,r)=>s+Number(r.amount||0),0);c.innerHTML=`<div class="cards"><div class="card">Total earned<strong>${money(total)}</strong></div></div><div class="section-gap">${rs.length?rs.map(r=>`<div class="admin-item"><b>${money(r.amount)}</b>${r.note?' · '+esc(r.note):''}<br><small>${new Date(r.date).toLocaleString()}</small></div>`).join(''):'<div class="empty">No commissions logged yet.</div>'}</div>`}
  ({dashboard,commissions}[page]||dashboard)();
  window.addEventListener('rentHubDataChanged',()=>({dashboard,commissions}[page]||dashboard)());
});
