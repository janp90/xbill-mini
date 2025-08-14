const $ = (id) => document.getElementById(id);
const euro = n => new Intl.NumberFormat('de-DE',{style:'currency', currency:'EUR'}).format(n);

function toast(msg){ const el=$('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2000); }
function spin(on){ $('spinner').hidden = !on; }
function setDisabled(dis){ ['btnValidate','btnExport','btnEmail','addLine'].forEach(id=>{ const b=$(id); if(b) b.disabled=dis; }); }

function today() {
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function showFeedback(errors=[], warnings=[]){
  const fb = $('feedback'); const err=$('errors'); const warn=$('warnings');
  const ul = (list)=> list.length? `<ul>${list.map(e=>`<li>${escapeHtml(e)}`).join('')}</ul>` : '';
  if(errors.length){ err.style.display='block'; err.innerHTML = `<strong>Fehler</strong>${ul(errors)}`; } else { err.style.display='none'; err.innerHTML=''; }
  if(warnings.length){ warn.style.display='block'; warn.innerHTML = `<strong>Hinweise</strong>${ul(warnings)}`; } else { warn.style.display='none'; warn.innerHTML=''; }
  fb.style.display = (errors.length||warnings.length)? 'block':'none';
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

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

function getMode(){ return [...document.querySelectorAll('input[name=mode]')].find(r=>r.checked).value; }

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
      number: $('number').value || '2025-001',
      issue_date: $('issue_date').value || today(),
      currency: 'EUR'
    },
    seller: {
      name: $('seller_name').value || 'Studio Presche',
      vat_id: $('seller_vat').value || null,
      address: { city: $('seller_city').value||'Augsburg', postcode: $('seller_postcode').value||'86150', country_code: $('seller_country').value||'DE' },
      contact: { person: $('seller_person').value||'Jan Presche', phone: $('seller_phone').value||'+49 123', email: $('seller_email').value||'hi@example.com' }
    },
    buyer: {
      name: $('buyer_name').value || 'Muster GmbH',
      address: { city: $('buyer_city').value||'München', postcode: $('buyer_postcode').value||'80331', country_code: $('buyer_country').value||'DE' },
      reference: $('buyer_reference').value || null
    },
    payment: { means_code: '30', iban: $('iban').value||'DE89370400440532013000', remittance: $('remittance').value||'Re 2025-001' },
    lines
  };
}

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

async function postJSON(url, body){
  setDisabled(true); spin(true); showFeedback([],[]);
  try{
    const res = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    let data = null;
    try { data = await res.json(); } catch { data = {}; }
    return { ok: res.ok, status: res.status, data };
  } finally {
    setDisabled(false); spin(false);
  }
}

async function callValidate(){
  const payload = payloadFromForm();
  const {ok, data} = await postJSON('/validate', payload);
  if(ok){
    showFeedback([], data.warnings||[]);
    $('out').textContent = '✅ Valide.';
    toast('Valide ✔︎');
  } else {
    showFeedback(data.errors||[], data.warnings||[]);
    $('out').textContent = '❌ Fehler vorhanden.';
    toast('Fehler gefunden');
  }
}

async function callExport(){
  const payload = payloadFromForm();
  const res = await fetch('/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!res.ok){
    let d = {}; try{ d = await res.json(); }catch{}
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
}

async function callEmail(){
  const payload = payloadFromForm();
  const to = $('email_to').value || 'test@example.com';
  const from = $('email_from').value || 'me@example.com';
  const url = `/export_email?recipient=${encodeURIComponent(to)}&sender=${encodeURIComponent(from)}`;
  const {ok, data} = await postJSON(url, payload);
  if(ok){
    $('out').textContent = '📧 Mail verschickt (MailHog).';
    toast('Mail gesendet');
  } else {
    showFeedback([data.detail || `HTTP ${data.status||''}`], []);
    $('out').textContent = '❌ Mail-Fehler.';
    toast('Mail fehlgeschlagen');
  }
}

function init(){
  try { $('spinner').hidden = true; } catch {}
  $('issue_date').value = today();
  $('addLine').onclick = ()=>{ $('lines').appendChild(lineRow()); computeTotals(); };
  $('lines').appendChild(lineRow({name:'UX Workshop', qty:1, unit_code:'DAY', net_unit_price:1200, vat:{category:'S', rate:19}}));
  computeTotals();

  document.querySelectorAll('input[name=mode]').forEach(r=>{
    r.addEventListener('change', ()=>{
      const b2g = getMode()==='B2G';
      $('b2gHint').hidden = !b2g;
      $('lwLabel').hidden = !b2g;
    });
  });
  $('btnValidate').onclick = (e)=>{ e.preventDefault(); callValidate(); };
  $('btnExport').onclick = (e)=>{ e.preventDefault(); callExport(); };
  $('btnEmail').onclick  = (e)=>{ e.preventDefault(); callEmail(); };
}
init();
