const $ = (id) => document.getElementById(id);
const euro = n => new Intl.NumberFormat('de-DE',{style:'currency', currency:'EUR'}).format(n);

// --- UI helpers ---
function toast(msg){ const el=$('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2000); }
function spin(on){ $('spinner').hidden = !on; }
function setDisabled(dis){ ['btnValidate','btnExport','btnEmail','addLine','modeB2B','modeB2G'].forEach(id=>{ const b=$(id); if(b) b.disabled=dis; }); }
function today(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function showFeedback(errors=[], warnings=[]){
  const fb = $('feedback'); const err=$('errors'); const warn=$('warnings');
  const ul = (list)=> list.length? `<ul>${list.map(e=>`<li>${escapeHtml(e)}`).join('')}</ul>` : '';
  if(errors.length){ err.style.display='block'; err.innerHTML = `<strong>Fehler</strong>${ul(errors)}`; } else { err.style.display='none'; err.innerHTML=''; }
  if(warnings.length){ warn.style.display='block'; warn.innerHTML = `<strong>Hinweise</strong>${ul(warnings)}`; } else { warn.style.display='none'; warn.innerHTML=''; }
  fb.style.display = (errors.length||warnings.length)? 'block':'none';
}

// --- Mode toggle state ---
let currentMode = 'B2B';
function setMode(mode){
  currentMode = mode;
  $('modeB2B').classList.toggle('active', mode==='B2B');
  $('modeB2G').classList.toggle('active', mode==='B2G');
  const b2g = mode==='B2G';
  $('b2gHint').hidden = !b2g;
  const lw = $('lwLabel'); if(lw) lw.hidden = !b2g;
}
function getMode(){ return currentMode; }

// --- Lines ---
function lineRow(data={}){
  const row=document.createElement('div');
  row.className='line';
  row.innerHTML = `
    <input placeholder="Bezeichnung" value="${data.name||''}" class="ln-name"/>
    <input type="number" step="0.01" placeholder="Menge" value="${data.qty||1}" class="ln-qty"/>
    <select class="ln-unit">
      <option value="DAY"${data.unit_code==='DAY'?' selected':''}>DAY</option>
      <option value="HUR"${data.unit_code==='HUR'?' selected':''}>HUR</option>
      <option value="C62"${data.unit_code==='C62'?' selected':''}>C62</option>
    </select>
    <input type="number" step="0.01" placeholder="Netto/Einheit" value="${data.net_unit_price||0}" class="ln-price"/>
    <select class="ln-vat">
      <option value="S-19"${data.vat?.rate===19?' selected':''}>19% (steuerpfl.)</option>
      <option value="S-7"${data.vat?.rate===7?' selected':''}>7% (steuerpfl.)</option>
      <option value="E-0"${data.vat?.category==='E'?' selected':''}>0% (steuerfrei)</option>
    </select>
    <button class="rm">–</button>
  `;
  row.querySelector('.rm').onclick = ()=>{ row.remove(); computeTotals(); };
  ['ln-qty','ln-price','ln-vat'].forEach(cls=>{
    row.querySelector(`.${cls}`).addEventListener('input', computeTotals);
    row.querySelector(`.${cls}`).addEventListener('change', computeTotals);
  });
  return row;
}

// --- Feld-Fehler utils ---
function clearFieldErrors(){
  document.querySelectorAll('.invalid').forEach(el=>el.classList.remove('invalid'));
  document.querySelectorAll('.field-msg, .field-warn').forEach(el=>el.remove());
}
function setFieldError(inputId, message, isWarning=false){
  const el = $(inputId);
  if(!el) return false;
  if(!isWarning) el.classList.add('invalid');
  const msg = document.createElement('div');
  msg.className = isWarning ? 'field-warn' : 'field-msg';
  msg.textContent = message;
  const parent = el.parentElement || el;
  parent.appendChild(msg);
  return true;
}
function scrollToFirstError(){
  const el = document.querySelector('.invalid');
  if(el) el.scrollIntoView({behavior:'smooth', block:'center'});
}

// --- Mapping Backend-Pfade -> Input-IDs ---
const FIELD_MAP = {
  'payment.iban': 'iban',
  'buyer.reference': 'buyer_reference',
  'seller.contact.email': 'seller_email',
  'seller.address.country_code': 'seller_country',
  'buyer.address.country_code': 'buyer_country',
  'seller.address.postcode': 'seller_postcode',
  'seller.address.city': 'seller_city',
  'buyer.address.postcode': 'buyer_postcode',
  'buyer.address.city': 'buyer_city',
  'header.issue_date': 'issue_date',
  'header.number': 'number',
  'seller.name': 'seller_name',
  'buyer.name': 'buyer_name'
};

// --- Build payload from form ---
function payloadFromForm(){
  const lines = [...document.querySelectorAll('.line')].map((row,i)=>{
    const [nameEl, qtyEl, unitEl, priceEl, vatEl] = [
      row.querySelector('.ln-name'), row.querySelector('.ln-qty'),
      row.querySelector('.ln-unit'), row.querySelector('.ln-price'),
      row.querySelector('.ln-vat'),
    ];
    const [cat, rate] = vatEl.value.split('-');
    return {
      id: String(i+1),
      name: nameEl.value || `Pos ${i+1}`,
      qty: parseFloat(qtyEl.value||0),
      unit_code: unitEl.value,
      net_unit_price: parseFloat(priceEl.value||0),
      vat: { category: cat, rate: parseFloat(rate) }
    };
  });

  return {
    mode: getMode(),
    header: {
      number: $('number').value || '',
      issue_date: $('issue_date').value || '',
      currency: 'EUR'
    },
    seller: {
      name: $('seller_name').value || '',
      vat_id: $('seller_vat').value || null,
      address: { city: $('seller_city').value||'', postcode: $('seller_postcode').value||'', country_code: $('seller_country').value||'' },
      contact: { person: $('seller_person').value||'', phone: $('seller_phone').value||'', email: $('seller_email').value||'' }
    },
    buyer: {
      name: $('buyer_name').value || '',
      address: { city: $('buyer_city').value||'', postcode: $('buyer_postcode').value||'', country_code: $('buyer_country').value||'' },
      reference: $('buyer_reference').value || null
    },
    payment: { means_code: '30', iban: $('iban').value||'', remittance: $('remittance').value||'' },
    lines
  };
}

// --- Totals ---
function computeTotals(){
  const p = payloadFromForm();
  let net=0, vat=0;
  p.lines.forEach(ln=>{
    const n = +(ln.qty*ln.net_unit_price).toFixed(2);
    net += n;
    const rate = ln.vat.category==='S' ? ln.vat.rate : 0;
    vat += +(n*rate/100).toFixed(2);
  });
  const gross = +(net+vat).toFixed(2);
  $('totals').textContent = `Netto ${euro(net)} • USt ${euro(vat)} • Brutto ${euro(gross)}`;
}

// --- API helper ---
async function postJSON(url, body){
  setDisabled(true); spin(true); showFeedback([],[]); clearFieldErrors();
  try{
    const res = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    let data = null;
    try { data = await res.json(); } catch { data = {}; }
    return { ok: res.ok, status: res.status, data };
  } finally {
    setDisabled(false); spin(false);
  }
}

// Fehler aus Backend auf Felder mappen
function applyErrorsToFields(status, data){
  let mapped = 0;

  if(status === 400 && Array.isArray(data.errors)){
    for(const e of data.errors){
      let path = null, msg = e;
      const idx = e.indexOf(':');
      if(idx > -1){ path = e.slice(0, idx).trim(); msg  = e.slice(idx+1).trim(); }
      if(path && FIELD_MAP[path]){
        if(setFieldError(FIELD_MAP[path], msg)) mapped++;
        continue;
      }
      // heuristics
      if(!path && /IBAN/i.test(e)) { if(setFieldError('iban', e)) mapped++; }
    }
    if(Array.isArray(data.warnings)){
      for(const w of data.warnings){
        let path = null, msg = w;
        const idx = w.indexOf(':'); if(idx > -1){ path = w.slice(0, idx).trim(); msg = w.slice(idx+1).trim(); }
        if(path && FIELD_MAP[path]) setFieldError(FIELD_MAP[path], msg, true);
      }
    }
  }

  if(status === 422 && Array.isArray(data.detail)){
    for(const d of data.detail){
      if(!Array.isArray(d.loc)) continue;
      const parts = d.loc.slice(1); // "body" weg
      const path = parts.join('.');
      if(FIELD_MAP[path]){ if(setFieldError(FIELD_MAP[path], d.msg)) mapped++; }
    }
  }
  return mapped;
}

// --- Actions ---
async function callValidate(){
  const payload = payloadFromForm();
  const {ok, status, data} = await postJSON('/validate', payload);

  if(ok){
    showFeedback([], data.warnings||[]);
    $('out').textContent = '✅ Valide.';
    toast('Valide ✔︎');
  } else {
    const mapped = applyErrorsToFields(status, data);
    if(status===400){
      showFeedback(data.errors||[], data.warnings||[]);
    } else if(status===422){
      const msgs = (data.detail||[]).map(d=>`${(d.loc||[]).join('.')}: ${d.msg}`);
      showFeedback(msgs, []);
    } else {
      showFeedback([data.detail || `HTTP ${status}`], []);
    }
    $('out').textContent = '❌ Fehler vorhanden.';
    toast(mapped ? 'Bitte markierte Felder prüfen' : 'Fehler gefunden');
    scrollToFirstError();
  }
}

async function callExport(){
  const payload = payloadFromForm();
  spin(true);
  try{
    const res = await fetch('/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!res.ok){
      let d = {}; try{ d = await res.json(); }catch{}
      applyErrorsToFields(res.status, d);
      showFeedback(d.detail||d.errors||['Unbekannter Fehler'], []);
      toast('Export fehlgeschlagen'); return;
    }
    const blob = await res.blob();
    const num = $('number').value || 'rechnung';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${num}.zip`;
    a.click();
    $('out').textContent = '📦 ZIP heruntergeladen.';
    toast('ZIP geladen');
  } finally {
    spin(false);
  }
}

async function callEmail(){
  const payload = payloadFromForm();
  const to = $('email_to').value || 'test@example.com';
  const from = $('email_from').value || 'me@example.com';
  const url = `/export_email?recipient=${encodeURIComponent(to)}&sender=${encodeURIComponent(from)}`;
  const {ok, status, data} = await postJSON(url, payload);
  if(ok){
    $('out').textContent = '📧 Mail verschickt (MailHog).';
    toast('Mail gesendet');
  } else {
    applyErrorsToFields(status, data);
    showFeedback([data.detail || `HTTP ${status}`], []);
    $('out').textContent = '❌ Mail-Fehler.';
    toast('Mail fehlgeschlagen');
    scrollToFirstError();
  }
}

// --- Init ---
function init(){
  try { $('spinner').hidden = true; } catch {}
  $('issue_date').value = today();
  setMode('B2B');
  $('modeB2B').addEventListener('click', ()=> setMode('B2B'));
  $('modeB2G').addEventListener('click', ()=> setMode('B2G'));

  $('addLine').onclick = ()=>{ $('lines').appendChild(lineRow()); computeTotals(); };
  $('lines').appendChild(lineRow({name:'UX Workshop', qty:1, unit_code:'DAY', net_unit_price:1200, vat:{category:'S', rate:19}}));
  computeTotals();

  $('btnValidate').onclick = (e)=>{ e.preventDefault(); callValidate(); };
  $('btnExport').onclick   = (e)=>{ e.preventDefault(); callExport(); };
  $('btnEmail').onclick    = (e)=>{ e.preventDefault(); callEmail(); };
}
init();
