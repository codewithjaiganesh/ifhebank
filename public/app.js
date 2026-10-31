const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const TOKEN_KEY = 'branchflow_session';
const state = { token: localStorage.getItem(TOKEN_KEY), user: null, page: 'dashboard', cache: {}, dashboard: null };
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const RESOURCE_META = {
  banks: {
    title: 'Banks', singular: 'Bank', description: 'Manage the bank profile and institutional details.',
    columns: [['bank_id','ID'],['bank_name','Bank name'],['head_office','Head office'],['established_year','Established'],['contact_no','Contact'],['email','Email']],
    fields: [f('bank_name','Bank name','text',true),f('head_office','Head office','text',true),f('established_year','Established year','number'),f('contact_no','Contact number'),f('email','Email','email')]
  },
  branches: {
    title: 'Branches', singular: 'Branch', description: 'A connected view of every branch, location, and manager.',
    columns: [['branch_name','Branch'],['ifsc_code','IFSC code'],['bank_name','Bank'],['city','City'],['state','State'],['manager_name','Manager'],['phone_no','Phone']],
    fields: [f('bank_id','Bank','select',true,'banks'),f('branch_name','Branch name','text',true),f('ifsc_code','IFSC code','text',true),f('address_line1','Address','text',true),f('city','City','text',true),f('state','State','text',true),f('pin_code','PIN code','text',true),f('phone_no','Phone number'),f('email','Email','email'),f('manager_name','Branch manager')]
  },
  employees: {
    title: 'Employees', singular: 'Employee', description: 'Keep employee assignments and branch contacts up to date.',
    columns: [['name','Employee'],['designation','Designation'],['branch_name','Branch'],['phone_no','Phone'],['email','Email'],['join_date','Joined']],
    fields: [f('branch_id','Branch','select',true,'branches'),f('name','Full name','text',true),f('designation','Designation','text',true),f('phone_no','Phone number'),f('email','Email','email'),f('join_date','Join date','date',true)]
  },
  accounts: {
    title: 'Accounts', singular: 'Account', description: 'Manage customer accounts and monitor balances by branch.',
    columns: [['account_no','Account number'],['customer_id','Customer ID'],['account_type','Account type'],['branch_name','Branch'],['balance','Available balance'],['open_date','Open date'],['status','Status']],
    fields: [f('account_no','Account number','text',true),f('branch_id','Branch','select',true,'branches'),f('customer_id','Customer ID','number',true),f('account_type','Account type','select',true,['Savings','Current','Premium','Salary','Fixed Deposit']),f('balance','Opening balance (₹)','number'),f('open_date','Open date','date',true),f('status','Account status','select',true,['Active','Inactive','Frozen','Closed'])]
  },
  loans: {
    title: 'Loans', singular: 'Loan', description: 'Track loan applications, sanctioned amounts, and status.',
    columns: [['loan_id','Loan ID'],['customer_id','Customer ID'],['loan_type','Loan type'],['branch_name','Branch'],['amount','Loan amount'],['interest_rate','Rate'],['start_date','Start date'],['status','Status']],
    fields: [f('branch_id','Branch','select',true,'branches'),f('customer_id','Customer ID','number',true),f('loan_type','Loan type','select',true,['Home loan','Vehicle loan','Personal loan','Education loan','Business loan']),f('amount','Principal amount (₹)','number',true),f('interest_rate','Interest rate (%)','number',true),f('start_date','Start date','date',true),f('status','Loan status','select',true,['Pending','Active','Closed','Rejected'])]
  }
};
function f(name,label,type='text',required=false,options=null){return {name,label,type,required,options};}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtMoney(value){return INR.format(Number(value || 0));}
function fmtDate(value){if(!value)return '—'; const d = new Date(String(value).slice(0,10)+'T00:00:00'); return Number.isNaN(d.getTime()) ? escapeHTML(value) : d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}
function initials(name='VA'){return name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();}
function toast(message,type='success'){const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;$('#toast-region').appendChild(el);setTimeout(()=>el.remove(),3600);}
async function api(url, options={}){
  const headers={...(options.headers||{})};
  if(options.body && !(options.body instanceof FormData)) headers['Content-Type']='application/json';
  if(state.token) headers.Authorization=`Bearer ${state.token}`;
  const response=await fetch(url,{...options,headers});
  const data=await response.json().catch(()=>({}));
  if(response.status===401 && url!=='/api/auth/login'){logout(false);throw new Error('Your session expired. Please sign in again.');}
  if(!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
function showLogin(){ $('#login-screen').classList.remove('hidden'); $('#app-shell').classList.add('hidden'); }
function showApp(){ $('#login-screen').classList.add('hidden'); $('#app-shell').classList.remove('hidden'); }
function logout(showMessage=true){state.token=null;state.user=null;localStorage.removeItem(TOKEN_KEY);showLogin();if(showMessage)toast('You have signed out.','success');}
async function boot(){
  $('#today-date').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).toUpperCase();
  if(!state.token){showLogin();return;}
  try{const r=await api('/api/auth/me');state.user=r.user;startWorkspace();}catch{logout(false);}
}
function startWorkspace(){
  showApp(); const name=state.user?.name||'Administrator';
  $('#user-name').textContent=name;$('#user-role').textContent=(state.user?.role||'admin')==='admin'?'Workspace administrator':'Branch employee';
  $('#user-avatar').textContent=initials(name);$('#top-avatar').textContent=initials(name);
  navigate('dashboard');
}
$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();$('#login-error').textContent='';
  const button=e.submitter;button.disabled=true;button.querySelector('span').textContent='Signing in…';
  try{const result=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:$('#login-email').value,password:$('#login-password').value})});state.token=result.token;state.user=result.user;localStorage.setItem(TOKEN_KEY,state.token);$('#login-password').value='';startWorkspace();toast(`Welcome back, ${result.user.name.split(' ')[0]}.`);}
  catch(err){$('#login-error').textContent=err.message;}
  finally{button.disabled=false;button.querySelector('span').textContent='Sign in to workspace';}
});
$('#toggle-password').addEventListener('click',()=>{const input=$('#login-password');input.type=input.type==='password'?'text':'password';$('#toggle-password').textContent=input.type==='password'?'Show':'Hide';});
$('#logout-button').addEventListener('click',()=>logout());
$('#menu-toggle').addEventListener('click',()=>$('#sidebar').classList.add('open'));
$('#sidebar-close').addEventListener('click',()=>$('#sidebar').classList.remove('open'));
$('#refresh-button').addEventListener('click',()=>navigate(state.page,true));
$('#main-nav').addEventListener('click',e=>{const button=e.target.closest('[data-page]');if(button)navigate(button.dataset.page);});
$('#profile-button').addEventListener('click',()=>openPasswordModal());

async function navigate(page,force=false){
  state.page=page;$('#sidebar').classList.remove('open');
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('#crumb-current').textContent=page.replace(/-/g,' ').toUpperCase();
  $('#page-content').innerHTML='<div class="loading-state"><div class="loader"></div><span>Loading workspace…</span></div>';
  try{
    if(page==='dashboard') await renderDashboard();
    else if(RESOURCE_META[page]) await renderResourcePage(page,force);
    else if(page==='transactions') await renderTransactions();
    else if(page==='reports') await renderReports();
    else $('#page-content').innerHTML='<div class="empty-state"><div class="empty-icon">◈</div><strong>Coming soon</strong><p>This workspace section is not available yet.</p></div>';
  }catch(err){$('#page-content').innerHTML=`<div class="panel"><div class="empty-state"><div class="empty-icon">!</div><strong>We couldn't load this view</strong><p>${escapeHTML(err.message)}</p><button class="btn btn-secondary btn-sm" id="retry-page">Try again</button></div></div>`;$('#retry-page')?.addEventListener('click',()=>navigate(page,true));}
}

async function renderDashboard(){
  const data=await api('/api/dashboard');state.dashboard=data;const m=data.metrics;
  const maxVol=Math.max(1,...data.activity.map(x=>Number(x.volume)));
  const chart=data.activity.length?data.activity.map((x,i)=>`<div class="chart-column"><div class="chart-bars"><div class="chart-bar ${i%2?'alt':''}" style="height:${Math.max(7,Number(x.volume)/maxVol*100)}%" title="${fmtMoney(x.volume)}"></div></div><small>${escapeHTML(x.month_label)}</small></div>`).join(''):'<div class="table-empty">No transaction activity recorded yet.</div>';
  const branchRows=data.branchStats.map((b,i)=>`<div class="branch-row"><div class="branch-avatar">${escapeHTML(initials(b.branch_name))}</div><div class="branch-row-main"><b>${escapeHTML(b.branch_name)}</b><small>${Number(b.account_count)} accounts · ${Number(b.employee_count)} employees</small></div><div class="branch-row-value">${fmtMoney(b.balance_total)}<small>account balance</small></div></div>`).join('')||'<div class="table-empty">No branches added yet.</div>';
  const recent=data.recent.map(t=>`<tr><td><strong>${escapeHTML(t.reference)}</strong></td><td>${escapeHTML(t.transaction_type.replace('_',' '))}</td><td>${escapeHTML(t.account_no)}</td><td>${fmtMoney(t.amount)}</td><td>${fmtDate(t.created_at)}</td></tr>`).join('');
  $('#page-content').innerHTML=`
    <div class="page-heading"><div><p class="eyebrow">FRIDAY, FOCUS ON WHAT MATTERS</p><h1>Good to see you, ${escapeHTML((state.user?.name||'there').split(' ')[0])}<span class="accent-dot">.</span></h1><p>Your banking network, all in one considered view.</p></div><div class="heading-actions"><span class="badge success">● &nbsp; All systems operational</span></div></div>
    <div class="metric-grid">
      ${metric('Total deposits',fmtMoney(m.totalBalance),'Across all customer accounts','↗','pink')}
      ${metric('Active accounts',m.activeAccounts.toLocaleString('en-IN'),`${m.accounts} accounts recorded`,'▣')}
      ${metric('Branch network',m.branches.toLocaleString('en-IN'),`${m.employees} employees assigned`,'⌖')}
      ${metric('Loan portfolio',fmtMoney(m.loanAmount),`${m.pendingLoans} applications pending`,'◈')}
    </div>
    <div class="dashboard-top">
      <section class="hero-balance"><div class="hero-bank"><div><span class="hero-label">VELORA BANK · NETWORK POSITION</span><div style="margin-top:8px"><strong>BranchFlow</strong></div></div><div class="hero-chip"></div></div><div class="hero-amount">${fmtMoney(m.totalBalance)}</div><div class="hero-caption">Combined demo account balances · illustrative only</div><div class="hero-bottom"><span>•••• &nbsp; •••• &nbsp; •••• &nbsp; 2048</span><b>V</b></div></section>
      <section class="quick-panel"><div class="section-title"><h3>Quick actions</h3><span>GET THINGS DONE</span></div><div class="quick-actions"><button class="quick-action" data-quick="branches"><span>⌖</span><b>Add a branch ↗</b></button><button class="quick-action" data-quick="accounts"><span>▣</span><b>Open an account ↗</b></button><button class="quick-action" data-quick="employees"><span>♙</span><b>Add employee ↗</b></button><button class="quick-action" data-quick="transactions"><span>↗</span><b>New transaction ↗</b></button></div></section>
    </div>
    <div class="dashboard-lower"><section class="panel"><div class="section-title"><h3>Transaction activity</h3><span>LAST 6 MONTHS</span></div><div class="chart-area">${chart}</div><p class="modal-hint" style="margin:12px 0 0">Activity is based on the simulated account ledger, not a live banking network.</p></section>
      <section class="panel"><div class="section-title"><h3>Top branches</h3><span>BY ACCOUNT BALANCE</span></div><div class="branch-list">${branchRows}</div></section></div>
    <section class="table-panel" style="margin-top:15px"><div class="table-toolbar"><div><h3>Latest account activity</h3><p>Recent entries from your internal demo ledger.</p></div><button class="btn btn-ghost btn-sm" data-quick="transactions">View all activity ↗</button></div><div class="table-wrap"><table><thead><tr><th>Reference</th><th>Activity</th><th>Account</th><th>Amount</th><th>Date</th></tr></thead><tbody>${recent||'<tr><td class="table-empty" colspan="5">No transactions yet. Add a demo deposit or transfer to see activity.</td></tr>'}</tbody></table></div></section>
    <p class="modal-hint" style="margin:13px 2px 0">Demo environment: balances and transaction actions are stored in your MySQL database for learning and presentation. No money is moved through real banking rails.</p>`;
  $$('[data-quick]').forEach(btn=>btn.addEventListener('click',()=>btn.dataset.quick==='transactions'?openTransactionModal():navigate(btn.dataset.quick)));
}
function metric(label,value,note,icon,extra=''){return `<div class="metric-card ${extra}"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></div>`;}

async function renderResourcePage(resource,force=false){
  const meta=RESOURCE_META[resource];
  const result=await api(`/api/resources/${resource}`);const rows=result.data||[];state.cache[resource]=rows;
  const filteredRows=rows;
  const tableRows=filteredRows.map(row=>resourceRow(resource,row)).join('');
  $('#page-content').innerHTML=`<div class="page-heading"><div><p class="eyebrow">OPERATIONS / ${meta.title.toUpperCase()}</p><h1>${meta.title}<span class="accent-dot">.</span></h1><p>${meta.description}</p></div><div class="heading-actions"><button class="btn btn-ghost btn-sm" id="export-csv">↓ Export CSV</button><button class="btn btn-primary btn-sm" id="add-record">＋ Add ${meta.singular}</button></div></div>
    <section class="table-panel"><div class="table-toolbar"><div><h3>${meta.title} directory</h3><p>${rows.length} record${rows.length===1?'':'s'} currently stored in MySQL</p></div><div class="table-actions"><input class="search-input" id="table-search" placeholder="Search ${meta.title.toLowerCase()}…"/><span class="badge">${rows.length} TOTAL</span></div></div><div class="table-wrap"><table><thead><tr>${meta.columns.map(([,label])=>`<th>${label}</th>`).join('')}<th>Actions</th></tr></thead><tbody id="resource-tbody">${tableRows||`<tr><td colspan="${meta.columns.length+1}"><div class="empty-state"><div class="empty-icon">＋</div><strong>No ${meta.title.toLowerCase()} yet</strong><p>Add your first record to populate this section.</p></div></td></tr>`}</tbody></table></div><div class="table-foot"><span>Live database records · ${meta.title}</span><span>BranchFlow secure workspace</span></div></section>`;
  $('#add-record').addEventListener('click',()=>openResourceModal(resource));
  $('#table-search').addEventListener('input',e=>{
    const q=e.target.value.toLowerCase();
    const filtered=rows.filter(row=>Object.values(row).some(v=>String(v??'').toLowerCase().includes(q)));
    $('#resource-tbody').innerHTML=filtered.map(row=>resourceRow(resource,row)).join('')||`<tr><td colspan="${meta.columns.length+1}" class="table-empty">No matching records.</td></tr>`;
    bindRowActions(resource);
  });
  $('#export-csv').addEventListener('click',()=>exportCSV(resource,rows));
  bindRowActions(resource);
}
function statusBadge(value){const v=String(value||'').toLowerCase();const cls=['active','confirmed','successful'].includes(v)?'success':['pending','inactive','frozen'].includes(v)?'warning':['rejected','closed','cancelled'].includes(v)?'danger':'';return `<span class="badge ${cls}">${escapeHTML(value||'—')}</span>`;}
function cellValue(resource,row,key){const value=row[key];if(key==='balance'||key==='amount')return fmtMoney(value);if(key==='interest_rate')return `${Number(value).toFixed(2)}%`;if(key==='status'||key==='booking_status')return statusBadge(value);if(key.endsWith('_date')||key==='join_date'||key==='open_date'||key==='start_date')return fmtDate(value);return escapeHTML(value ?? '—');}
function resourceRow(resource,row){const meta=RESOURCE_META[resource];const idKey={banks:'bank_id',branches:'branch_id',employees:'emp_id',accounts:'account_no',loans:'loan_id'}[resource];const id=row[idKey];return `<tr>${meta.columns.map(([key])=>`<td>${key==='bank_name'&&resource==='banks'?`<strong>${escapeHTML(row[key])}</strong>`:key==='branch_name'&&resource==='branches'?`<strong>${escapeHTML(row[key])}</strong>`:cellValue(resource,row,key)}</td>`).join('')}<td><div class="row-actions"><button class="mini-btn" data-action="edit" data-id="${escapeHTML(id)}">Edit</button><button class="mini-btn delete" data-action="delete" data-id="${escapeHTML(id)}">Delete</button></div></td></tr>`;}
function bindRowActions(resource){$$('[data-action="edit"]').forEach(btn=>btn.addEventListener('click',()=>{const rows=state.cache[resource]||[];const meta=RESOURCE_META[resource];const key=meta.id||({banks:'bank_id',branches:'branch_id',employees:'emp_id',accounts:'account_no',loans:'loan_id'}[resource]);const row=rows.find(r=>String(r[key])===String(btn.dataset.id));if(row)openResourceModal(resource,row);}));$$('[data-action="delete"]').forEach(btn=>btn.addEventListener('click',()=>deleteRecord(resource,btn.dataset.id)));}

async function openResourceModal(resource,row=null){
  const meta=RESOURCE_META[resource];const fields=meta.fields;const isEdit=!!row;
  let related={};
  for(const field of fields){if(typeof field.options==='string'){const res=await api(`/api/resources/${field.options}`);related[field.name]=res.data||[];}}
  const body=fields.map(field=>{
    if(isEdit && resource==='accounts' && field.name==='account_no')return '';
    if(isEdit && resource==='accounts' && field.name==='balance')return '';
    const value=row?row[field.name]:(field.name==='status'?(resource==='loans'?'Pending':'Active'):field.name==='open_date'||field.name==='join_date'||field.name==='start_date'?new Date().toISOString().slice(0,10):field.name==='balance'?'0':'');
    let input='';
    if(field.type==='select'){
      const opts=Array.isArray(field.options)?field.options.map(x=>[x,x]):(related[field.name]||[]).map(x=>[x.bank_id||x.branch_id,x.bank_name||x.branch_name]);
      input=`<select name="${field.name}" ${field.required?'required':''}><option value="">Choose ${field.label.toLowerCase()}</option>${opts.map(([v,label])=>`<option value="${escapeHTML(v)}" ${String(value??'')===String(v)?'selected':''}>${escapeHTML(label)}</option>`).join('')}</select>`;
    }else input=`<input name="${field.name}" type="${field.type}" value="${escapeHTML(value??'')}" ${field.required?'required':''} ${field.type==='number'?'step="0.01" min="0"':''} placeholder="${escapeHTML(field.label)}"/>`;
    return `<div class="field"><label>${field.label}${field.required?' *':''}</label>${input}</div>`;
  }).join('');
  openModal(`${isEdit?'Edit':'Add'} ${meta.singular}`,meta.description,`<form id="resource-form"><div class="form-grid">${body}</div><div class="modal-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>Cancel</button><button type="submit" class="btn btn-primary btn-sm">${isEdit?'Save changes':'Create record'}</button></div></form>`);
  $('#resource-form').addEventListener('submit',async e=>{
    e.preventDefault();const form=new FormData(e.currentTarget);const payload={};for(const [k,v] of form.entries())payload[k]=v;
    const idKey={banks:'bank_id',branches:'branch_id',employees:'emp_id',accounts:'account_no',loans:'loan_id'}[resource];
    const id=row?.[idKey];const submit=e.submitter;submit.disabled=true;submit.textContent='Saving…';
    try{await api(`/api/resources/${resource}${isEdit?`/${encodeURIComponent(id)}`:''}`,{method:isEdit?'PUT':'POST',body:JSON.stringify(payload)});closeModal();toast(`${meta.singular} ${isEdit?'updated':'created'} successfully.`);await renderResourcePage(resource,true);}
    catch(err){toast(err.message,'error');submit.disabled=false;submit.textContent=isEdit?'Save changes':'Create record';}
  });
}
async function deleteRecord(resource,id){const meta=RESOURCE_META[resource];if(!confirm(`Delete this ${meta.singular.toLowerCase()} record? This cannot be undone.`))return;try{await api(`/api/resources/${resource}/${encodeURIComponent(id)}`,{method:'DELETE'});toast(`${meta.singular} deleted.`);await renderResourcePage(resource,true);}catch(err){toast(err.message,'error');}}
function exportCSV(resource,rows){const meta=RESOURCE_META[resource];if(!rows.length){toast('There are no rows to export.','error');return;}const cols=meta.columns.map(([k])=>k);const csv=[cols.join(','),...rows.map(r=>cols.map(k=>`"${String(r[k]??'').replace(/"/g,'""')}"`).join(','))].join('\r\n');downloadFile(`${resource}-branchflow.csv`,csv,'text/csv');}
function downloadFile(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}

async function renderTransactions(){const result=await api('/api/transactions');const rows=result.data||[];state.cache.transactions=rows;const body=rows.map(t=>`<tr><td><strong>${escapeHTML(t.reference)}</strong></td><td>${statusBadge(t.transaction_type.replace('_',' '))}</td><td>${escapeHTML(t.account_no)}</td><td>${escapeHTML(t.related_account||'—')}</td><td>${fmtMoney(t.amount)}</td><td>${escapeHTML(t.branch_name)}</td><td>${fmtDate(t.created_at)}</td></tr>`).join('');
  $('#page-content').innerHTML=`<div class="page-heading"><div><p class="eyebrow">OPERATIONS / ACCOUNT ACTIVITY</p><h1>Transactions<span class="accent-dot">.</span></h1><p>Run and review simulated deposits, withdrawals, and internal transfers.</p></div><div class="heading-actions"><button class="btn btn-primary btn-sm" id="new-transaction">＋ New transaction</button></div></div><div class="panel" style="margin-bottom:15px;background:linear-gradient(115deg,#fff4f7,#fff)"><b style="font:700 11px var(--display);color:#b34270">Demo ledger notice</b><p class="modal-hint" style="margin:6px 0 0">These operations update balances in your BranchFlow database only. They do not connect to UPI, cards, payment networks, or real bank accounts.</p></div><section class="table-panel"><div class="table-toolbar"><div><h3>Account ledger</h3><p>${rows.length} entries recorded</p></div><input class="search-input" id="transaction-search" placeholder="Search ledger…"/></div><div class="table-wrap"><table><thead><tr><th>Reference</th><th>Type</th><th>Account</th><th>Related account</th><th>Amount</th><th>Branch</th><th>Date</th></tr></thead><tbody id="transaction-body">${body||'<tr><td colspan="7" class="table-empty">No activity yet. Add a demo transaction to begin.</td></tr>'}</tbody></table></div></section>`;
  $('#new-transaction').addEventListener('click',openTransactionModal);
  $('#transaction-search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();const filtered=rows.filter(r=>Object.values(r).some(v=>String(v??'').toLowerCase().includes(q)));$('#transaction-body').innerHTML=filtered.map(t=>`<tr><td><strong>${escapeHTML(t.reference)}</strong></td><td>${statusBadge(t.transaction_type.replace('_',' '))}</td><td>${escapeHTML(t.account_no)}</td><td>${escapeHTML(t.related_account||'—')}</td><td>${fmtMoney(t.amount)}</td><td>${escapeHTML(t.branch_name)}</td><td>${fmtDate(t.created_at)}</td></tr>`).join('')||'<tr><td colspan="7" class="table-empty">No matching activity.</td></tr>';});
}
async function openTransactionModal(){const res=await api('/api/resources/accounts');const accounts=(res.data||[]).filter(a=>a.status==='Active');const options=accounts.map(a=>`<option value="${escapeHTML(a.account_no)}">${escapeHTML(a.account_no)} · ${escapeHTML(a.branch_name)} · ${fmtMoney(a.balance)}</option>`).join('');
  openModal('New account transaction','A simulated operation within the BranchFlow demo ledger.',`<form id="transaction-form"><p class="modal-hint">This changes demo account balances in MySQL only. It is not a real bank transfer.</p><div class="form-grid"><div class="field"><label>Transaction type *</label><select name="type" id="transaction-type"><option value="DEPOSIT">Deposit</option><option value="WITHDRAWAL">Withdrawal</option><option value="TRANSFER">Internal transfer</option></select></div><div class="field"><label>Amount (₹) *</label><input name="amount" type="number" min="0.01" step="0.01" required placeholder="e.g. 2500"/></div><div class="field full"><label>Account *</label><select name="accountNo" required><option value="">Choose account</option>${options}</select></div><div class="field full" id="destination-field" style="display:none"><label>Destination account *</label><select name="toAccount"><option value="">Choose destination account</option>${options}</select></div><div class="field full"><label>Description</label><input name="description" maxlength="180" placeholder="Optional note for the ledger"/></div></div><div class="modal-actions"><button class="btn btn-ghost btn-sm" type="button" data-close>Cancel</button><button class="btn btn-primary btn-sm" type="submit">Confirm demo transaction</button></div></form>`);
  $('#transaction-type').addEventListener('change',e=>$('#destination-field').style.display=e.target.value==='TRANSFER'?'block':'none');
  $('#transaction-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const payload=Object.fromEntries(fd.entries());const submit=e.submitter;submit.disabled=true;submit.textContent='Processing…';try{const result=await api('/api/transactions',{method:'POST',body:JSON.stringify(payload)});closeModal();toast(`Demo transaction saved · ${result.reference}`);await renderTransactions();}catch(err){toast(err.message,'error');submit.disabled=false;submit.textContent='Confirm demo transaction';}});
}

async function renderReports(){const data=await api('/api/reports/summary');const max=Math.max(1,...data.branchBalances.map(b=>Number(b.total_balance)));const bars=data.branchBalances.map(b=>`<div class="report-bar-row"><span>${escapeHTML(b.branch_name)}</span><div class="progress-track"><div class="progress-fill" style="width:${Math.max(1,Number(b.total_balance)/max*100)}%"></div></div><b>${fmtMoney(b.total_balance)}</b></div>`).join('')||'<div class="table-empty">No branch data.</div>';const loanRows=data.loanStatus.map(r=>`<tr><td>${statusBadge(r.status)}</td><td>${Number(r.total)}</td><td>${fmtMoney(r.amount)}</td></tr>`).join('');const typeRows=data.byType.map(r=>`<tr><td><strong>${escapeHTML(r.account_type)}</strong></td><td>${Number(r.accounts)}</td><td>${fmtMoney(r.balance)}</td></tr>`).join('');
  $('#page-content').innerHTML=`<div class="page-heading"><div><p class="eyebrow">INSIGHTS / REPORTING</p><h1>Reports & insights<span class="accent-dot">.</span></h1><p>Useful summaries calculated directly from your MySQL records.</p></div><div class="heading-actions"><button class="btn btn-ghost btn-sm" id="report-refresh">↻ Refresh</button></div></div><div class="split-panels"><section class="panel"><div class="section-title"><h3>Account balance by branch</h3><span>INR · DEMO DATA</span></div><div class="report-bars">${bars}</div></section><section class="table-panel"><div class="table-toolbar"><div><h3>Accounts by type</h3><p>Count and combined balance</p></div></div><div class="table-wrap"><table><thead><tr><th>Account type</th><th>Accounts</th><th>Balance</th></tr></thead><tbody>${typeRows||'<tr><td colspan="3" class="table-empty">No accounts.</td></tr>'}</tbody></table></div></section></div><section class="table-panel" style="margin-top:15px"><div class="table-toolbar"><div><h3>Loan portfolio</h3><p>Loan records grouped by status</p></div></div><div class="table-wrap"><table><thead><tr><th>Status</th><th>Loans</th><th>Principal value</th></tr></thead><tbody>${loanRows||'<tr><td colspan="3" class="table-empty">No loan records.</td></tr>'}</tbody></table></div></section><p class="modal-hint" style="margin:13px 2px">Reports summarize demo records saved in the BranchFlow database. They are not audited financial statements.</p>`;
  $('#report-refresh').addEventListener('click',()=>renderReports());
}

function openModal(title,description,content){$('#modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><header class="modal-header"><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description||'')}</p></div><button class="modal-close" type="button" data-close aria-label="Close">×</button></header><div class="modal-form">${content}</div></section></div>`;$('#modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeModal();});$$('[data-close]').forEach(b=>b.addEventListener('click',closeModal));}
function closeModal(){$('#modal-root').innerHTML='';}
function openPasswordModal(){openModal('Change your password','Use a unique password with at least 12 characters.',`<form id="password-form"><div class="form-grid"><div class="field full"><label>Current password</label><input name="currentPassword" type="password" required autocomplete="current-password"/></div><div class="field full"><label>New password</label><input name="newPassword" type="password" minlength="12" required autocomplete="new-password"/></div></div><div class="modal-actions"><button type="button" class="btn btn-ghost btn-sm" data-close>Cancel</button><button class="btn btn-primary btn-sm" type="submit">Update password</button></div></form>`);$('#password-form').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget).entries());try{const result=await api('/api/auth/change-password',{method:'PATCH',body:JSON.stringify(data)});closeModal();toast(result.message);logout(false);}catch(err){toast(err.message,'error');}});}

boot();
