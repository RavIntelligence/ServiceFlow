
const $ = id => document.getElementById(id);
const state = {
  jobs: JSON.parse(localStorage.getItem('sf_jobs') || '[]'),
  settings: JSON.parse(localStorage.getItem('sf_settings') || 'null') || {
    companyName:'Your Company', techName:'Josh',
    onWayTemplate:"Hi {first_name}, this is {tech} with {company}. I'm on my way now and should arrive in about {eta}. See you soon!",
    arrivalTemplate:"Hi {first_name}, I've arrived and will be right with you.",
    reviewTemplate:"Hi {first_name}, thanks for choosing {company}! If you were happy with your service today, we'd really appreciate a review: {review_link}",
    reviewLink:'', reviewDelay:'120'
  }
};

function save(){ localStorage.setItem('sf_jobs', JSON.stringify(state.jobs)); }
function saveSettings(){ localStorage.setItem('sf_settings', JSON.stringify(state.settings)); }
function firstName(name){ return (name || '').trim().split(/\s+/)[0] || 'there'; }
function fillTemplate(t,j,extra={}){
  return t
   .replaceAll('{first_name}', firstName(j.customerName))
   .replaceAll('{tech}', state.settings.techName)
   .replaceAll('{company}', state.settings.companyName)
   .replaceAll('{review_link}', state.settings.reviewLink || '[review link]')
   .replaceAll('{eta}', extra.eta || 'about 20 minutes')
   .replaceAll('{delay}', extra.delay || '30 minutes');
}
function smsLink(phone,msg){ return `sms:${phone}?&body=${encodeURIComponent(msg)}`; }

function showScreen(which){
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.bottomnav button').forEach(x=>x.classList.remove('active'));
  $(which+'Screen').classList.add('active');
  document.querySelector(`.bottomnav button[data-screen="${which}"]`)?.classList.add('active');
  $('screenTitle').textContent = which==='today'?'Today':which==='add'?'Add Job':'Settings';
  $('addJobBtn').style.visibility = which==='today'?'visible':'hidden';
  if(which==='settings') loadSettingsForm();
  if(which==='today') renderJobs();
}

document.querySelectorAll('.bottomnav button').forEach(b=>b.onclick=()=>showScreen(b.dataset.screen));
$('addJobBtn').onclick=()=>showScreen('add');

$('jobForm').addEventListener('submit',e=>{
  e.preventDefault();
  const job = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    customerName:$('customerName').value.trim(),
    phone:$('phone').value.trim(),
    address:$('address').value.trim(),
    description:$('description').value.trim(),
    date:$('date').value, time:$('time').value,
    duration:Number($('duration').value)||60,
    completeBy:$('completeBy').value,
    notes:$('notes').value.trim(),
    status:'scheduled', reviewQueued:false, createdAt:new Date().toISOString()
  };
  state.jobs.push(job); save(); e.target.reset(); $('duration').value=60; seedDate();
  showScreen('today');
});

function fmtTime(t){
  if(!t) return '';
  const [h,m]=t.split(':').map(Number);
  const d=new Date(); d.setHours(h,m,0,0);
  return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
}
function renderJobs(){
  const list=$('jobsList'), empty=$('emptyState'); list.innerHTML='';
  const jobs=[...state.jobs].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  $('jobCount').textContent=jobs.length;
  $('doneCount').textContent=jobs.filter(j=>j.status==='complete').length;
  $('onTimeCount').textContent=jobs.filter(j=>j.status!=='complete').length;
  empty.style.display=jobs.length?'none':'block';
  jobs.forEach(j=>{
    const el=document.createElement('div'); el.className='job-card';
    const badge = j.status==='complete'?'Completed':j.status==='arrived'?'Arrived':j.status==='onway'?'On My Way':'Scheduled';
    const badgeClass=j.status==='complete'?'done':j.status==='arrived'?'arrived':'';
    el.innerHTML=`
      <div class="row"><div class="job-time">${fmtTime(j.time)} · ${j.date}</div><div class="eta">${j.duration} min job</div></div>
      <span class="badge ${badgeClass}">${badge}</span>
      <h3>${escapeHtml(j.customerName)}</h3>
      <p>${escapeHtml(j.address)}</p>
      <p>${escapeHtml(j.description)}</p>
      <div class="actions">
        <button class="primary-mini" onclick="notifyOnWay('${j.id}')">On My Way</button>
        <button onclick="openJob('${j.id}')">Open</button>
        <button onclick="openDirections('${j.id}')">Directions</button>
      </div>`;
    list.appendChild(el);
  });
}
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function getJob(id){ return state.jobs.find(j=>j.id===id); }

function previewMessage(job,msg){
  $('messagePreview').textContent=msg;
  $('openSmsLink').href=smsLink(job.phone,msg);
  $('messageDialog').showModal();
}
function notifyOnWay(id){
  const j=getJob(id); if(!j) return;
  j.status='onway'; j.onWayAt=new Date().toISOString(); save(); renderJobs();
  previewMessage(j, fillTemplate(state.settings.onWayTemplate,j,{eta:'about 20 minutes'}));
}
function arrive(id){
  const j=getJob(id); if(!j) return;
  j.status='arrived'; j.arrivedAt=new Date().toISOString(); save(); renderJobs(); openJob(id);
  previewMessage(j, fillTemplate(state.settings.arrivalTemplate,j));
}
function complete(id){
  const j=getJob(id); if(!j) return;
  j.status='complete'; j.completedAt=new Date().toISOString(); j.reviewQueued=true; save(); renderJobs(); openJob(id);
  const delay=Number(state.settings.reviewDelay||0);
  const msg=fillTemplate(state.settings.reviewTemplate,j);
  if(delay===0) previewMessage(j,msg);
  else alert(`Review request queued for ${delay===1440?'the next day':delay+' minutes'} after completion.\n\nDemo note: automatic background sending will be connected in the production backend.`);
}
function openJob(id){
  const j=getJob(id); if(!j) return;
  $('jobDialogBody').innerHTML=`
    <h2>${escapeHtml(j.customerName)}</h2>
    <div class="detail-line"><b>${fmtTime(j.time)} · ${j.date}</b></div>
    <div class="detail-line">${escapeHtml(j.phone)}</div>
    <div class="detail-line">${escapeHtml(j.address)}</div>
    <div class="detail-line">${escapeHtml(j.description)}</div>
    ${j.notes?`<div class="detail-line">${escapeHtml(j.notes)}</div>`:''}
    <div class="status-flow">
      <button class="${j.status==='onway'?'active':''}" onclick="notifyOnWay('${j.id}')">On My Way</button>
      <button class="${j.status==='arrived'?'active':''}" onclick="arrive('${j.id}')">Arrived</button>
      <button class="${j.status==='complete'?'active':''}" onclick="complete('${j.id}')">Complete</button>
    </div>
    <button class="smallbtn" onclick="runningLate('${j.id}',30)">Running 30m Late</button>
  `;
  $('jobDialog').showModal();
}
function runningLate(id,mins){
  const j=getJob(id); if(!j) return;
  const msg=`Hi ${firstName(j.customerName)}, I'm running about ${mins} minutes behind schedule. I apologize and will be there as soon as possible.`;
  previewMessage(j,msg);
}
function openDirections(id){
  const j=getJob(id); if(!j) return;
  window.open(`https://maps.apple.com/?q=${encodeURIComponent(j.address)}`,'_blank');
}

function loadSettingsForm(){
  $('companyName').value=state.settings.companyName;
  $('techName').value=state.settings.techName;
  $('onWayTemplate').value=state.settings.onWayTemplate;
  $('arrivalTemplate').value=state.settings.arrivalTemplate;
  $('reviewTemplate').value=state.settings.reviewTemplate;
  $('reviewLink').value=state.settings.reviewLink;
  $('reviewDelay').value=state.settings.reviewDelay;
}
$('saveSettingsBtn').onclick=()=>{
  state.settings={
    companyName:$('companyName').value.trim()||'Your Company',
    techName:$('techName').value.trim()||'Technician',
    onWayTemplate:$('onWayTemplate').value,
    arrivalTemplate:$('arrivalTemplate').value,
    reviewTemplate:$('reviewTemplate').value,
    reviewLink:$('reviewLink').value.trim(),
    reviewDelay:$('reviewDelay').value
  };
  saveSettings(); alert('Settings saved.');
};

function seedDate(){
  const d=new Date();
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  $('date').value=local;
}
seedDate(); loadSettingsForm(); renderJobs();
window.showScreen=showScreen; window.notifyOnWay=notifyOnWay; window.openJob=openJob; window.openDirections=openDirections; window.arrive=arrive; window.complete=complete; window.runningLate=runningLate;
