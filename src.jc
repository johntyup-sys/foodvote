import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const CONFIG_KEY = 'foodvote_config';
const DEVICE_KEY = 'foodvote_device';
const root = document.querySelector('#app');
let supabase = null;
let currentPoll = null;
let chosen = null;

const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));

function config(){
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}');
  } catch {
    return {};
  }
}

function client(){
  const c=config();
  if(!c.url||!c.key) return null;
  return createClient(c.url,c.key);
}

function layout(content){
  root.innerHTML=`
    <main class="shell">
      <header class="top">
        <div class="brand">Food<span>Vote</span></div>
        <div class="tag">Workplace polls</div>
      </header>
      ${content}
    </main>`;
}

function msg(text,error=false){
  return `<div class="notice ${error?'error':''}">${esc(text)}</div>`;
}

function setupScreen(){
  layout(`
    <section class="card">
      <h1>Connect FoodVote</h1>
      <p>Enter your Supabase project details to connect voting across everyone's phones.</p>

      <label>Project URL</label>
      <input id="url" placeholder="https://your-project.supabase.co"
        value="${esc(config().url||'')}">

      <label>Publishable / anon key</label>
      <input id="key" placeholder="Supabase anon key"
        value="${esc(config().key||'')}">

      <div class="actions">
        <button class="primary" id="save">Save connection</button>
      </div>

      <p class="small">
        The public key is designed to be used in a browser.
        Never enter a service-role key here.
      </p>
    </section>

    <section class="card">
      <h2>First-time setup</h2>
      <p>
        Run the included supabase.sql in Supabase → SQL Editor.
        Then create your admin login in Authentication → Users.
      </p>
    </section>
  `);

  document.querySelector('#save').onclick=()=>{
    localStorage.setItem(CONFIG_KEY,JSON.stringify({
      url:document.querySelector('#url').value.trim(),
      key:document.querySelector('#key').value.trim()
    }));
    location.reload();
  };
}

function adminScreen(){
  layout(`
    <section class="card">
      <h1>Admin dashboard</h1>
      <p>Create a food poll, generate its QR code, and check the results.</p>
      <div id="authArea"></div>
    </section>
    <section id="adminArea"></section>
  `);

  supabase.auth.getSession().then(({data})=>{
    renderAdminAuth(data.session);
  });

  supabase.auth.onAuthStateChange((_e,session)=>{
    renderAdminAuth(session);
  });
}

async function renderAdminAuth(session){
  const area=document.querySelector('#authArea');
  if(!area)return;

  if(!session){
    area.innerHTML=`
      <label>Admin email</label>
      <input id="email" type="email" placeholder="you@work.com">

      <label>Password</label>
      <input id="password" type="password" placeholder="Admin password">

      <div class="actions">
        <button class="primary" id="login">Log in</button>
      </div>

      <p class="small">
        Admin accounts are created in your Supabase dashboard.
        Public sign-ups are not enabled here.
      </p>
    `;

    document.querySelector('#login').onclick=async()=>{
      const {error}=await supabase.auth.signInWithPassword({
        email:document.querySelector('#email').value,
        password:document.querySelector('#password').value
      });

      if(error)alert(error.message);
    };

    document.querySelector('#adminArea').innerHTML='';
    return;
  }

  area.innerHTML=`
    <div class="row">
      <span class="pill">Signed in: ${esc(session.user.email)}</span>
      <button class="secondary" id="logout">Log out</button>
    </div>
  `;

  document.querySelector('#logout').onclick=()=>{
    supabase.auth.signOut();
  };

  renderCreatePoll();
}

function renderCreatePoll(){
  const area=document.querySelector('#adminArea');

  area.innerHTML=`
    <section class="card">
      <h2>Create a poll</h2>

      <label>Question</label>
      <input id="question" value="Where should we eat?" maxlength="180">

      <label>Food choices</label>

      <div id="choices" class="stack">
        <div class="row">
          <input value="Pizza">
          <button class="danger remove">Remove</button>
        </div>

        <div class="row">
          <input value="Burgers">
          <button class="danger remove">Remove</button>
        </div>

        <div class="row">
          <input value="Tacos">
          <button class="danger remove">Remove</button>
        </div>
      </div>

      <div class="actions">
        <button class="secondary" id="add">+ Add choice</button>
        <button class="primary" id="create">Create poll & QR code</button>
      </div>

      <p class="small">
        Each poll gets its own QR code. Device-level repeat protection
        is a deterrent, not identity verification.
      </p>
    </section>

    <section id="created"></section>

    <section class="card">
      <h2>Previous polls</h2>
      <div id="polls">Loading…</div>
    </section>
  `;

  const choices=document.querySelector('#choices');

  function bindRemove(){
    choices.querySelectorAll('.remove').forEach(b=>{
      b.onclick=()=>{
        if(choices.children.length>2){
          b.parentElement.remove();
        } else {
          alert('A poll needs at least two choices.');
        }
      };
    });
  }

  bindRemove();

  document.querySelector('#add').onclick=()=>{
    const row=document.createElement('div');
    row.className='row';
    row.innerHTML=`
      <input placeholder="Another food option" maxlength="100">
      <button class="danger remove">Remove</button>
    `;
    choices.append(row);
    bindRemove();
  };

  document.querySelector('#create').onclick=createPoll;

  loadPolls();
}

async function createPoll(){
  const question=document.querySelector('#question').value.trim();

  const options=[
    ...document.querySelectorAll('#choices input')
  ].map(x=>x.value.trim()).filter(Boolean);

  if(!question||options.length<2){
    alert('Add a question and at least two choices.');
    return;
  }

  const {data:poll,error}=await supabase
    .from('polls')
    .insert({question,status:'open'})
    .select()
    .single();

  if(error){
    alert(error.message);
    return;
  }

  const {error:optError}=await supabase
    .from('poll_options')
    .insert(options.map(label=>({
      poll_id:poll.id,
      label
    })));

  if(optError){
    alert(optError.message);
    return;
  }

  const link=`${location.origin}${location.pathname}?poll=${poll.id}`;

  const qr=await QRCode.toDataURL(link,{
    width:600,
    margin:2
  });

  document.querySelector('#created').innerHTML=`
    <section class="card">
      <h2>Your poll is live</h2>
      <p>Print or share this QR code. Anyone scanning it can vote.</p>

      <img class="qr" src="${qr}" alt="Poll QR code">

      <p class="small" style="text-align:center;word-break:break-all">
        ${esc(link)}
      </p>

      <div class="actions">
        <button class="primary" id="download">Download QR</button>
        <button class="secondary" id="copy">Copy voting link</button>
      </div>
    </section>
  `;

  document.querySelector('#download').onclick=()=>{
    const a=document.createElement('a');
    a.href=qr;
    a.download='foodvote-qr.png';
    a.click();
  };

  document.querySelector('#copy').onclick=()=>{
    navigator.clipboard.writeText(link);
  };

  loadPolls();
}

async function loadPolls(){
  const el=document.querySelector('#polls');
  if(!el)return;

  const {data,error}=await supabase
    .from('polls')
    .select('id,question,status,created_at')
    .order('created_at',{ascending:false})
    .limit(20);

  if(error){
    el.innerHTML=msg(error.message,true);
    return;
  }

  if(!data.length){
    el.innerHTML='<p class="muted">No polls yet.</p>';
    return;
  }

  el.innerHTML=data.map(p=>`
    <div class="row"
      style="justify-content:space-between;padding:12px 0;border-bottom:1px solid #edf0ec">

      <div>
        <b>${esc(p.question)}</b>
        <div class="small">${esc(p.status)}</div>
      </div>

      <button class="secondary" data-results="${p.id}">
        Results
      </button>
    </div>
  `).join('');

  el.querySelectorAll('[data-results]').forEach(b=>{
    b.onclick=()=>showResults(b.dataset.results);
  });
}

async function showResults(id){
  const {data:p,error}=await supabase
    .from('polls')
    .select('id,question,status')
    .eq('id',id)
    .single();

  if(error){
    alert(error.message);
    return;
  }

  const [{data:opts},{data:votes}] = await Promise.all([
    supabase.from('poll_options')
      .select('id,label')
      .eq('poll_id',id),

    supabase.from('votes')
      .select('option_id')
      .eq('poll_id',id)
  ]);

  const total=votes.length;

  const lines=opts.map(o=>{
    const n=votes.filter(v=>v.option_id===o.id).length;
    const pct=total?Math.round(n/total*100):0;

    return `
      <div class="result">
        <b>${esc(o.label)}</b>
        <span>${n} (${pct}%)</span>
        <div class="track">
          <div class="fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  const target=document.querySelector('#created');

  target.innerHTML=`
    <section class="card">
      <div class="row" style="justify-content:space-between">
        <h2>Poll results</h2>
        <span class="pill">${total} votes</span>
      </div>

      <p>${esc(p.question)}</p>

      ${lines}

      <div class="actions">
        <button class="secondary" id="toggle">
          ${p.status==='open'?'Close poll':'Reopen poll'}
        </button>
      </div>
    </section>
  `;

  document.querySelector('#toggle').onclick=async()=>{
    const {error}=await supabase
      .from('polls')
      .update({
        status:p.status==='open'?'closed':'open'
      })
      .eq('id',id);

    if(error){
      alert(error.message);
    } else {
      alert('Poll status updated.');
      renderCreatePoll();
    }
  };
}

async function hashToken(token){
  const bytes=new TextEncoder().encode(token);
  const digest=await crypto.subtle.digest('SHA-256',bytes);

  return [...new Uint8Array(digest)]
    .map(b=>b.toString(16).padStart(2,'0'))
    .join('');
}

function deviceToken(pollId){
  const k=DEVICE_KEY+'_'+pollId;
  let t=localStorage.getItem(k);

  if(!t){
    t=crypto.randomUUID();
    localStorage.setItem(k,t);
  }

  return t;
}

async function voteScreen(pollId){
  layout(`
    <section class="card" id="voteCard">
      <div class="pill">FoodVote • Anonymous poll</div>
      <h1 style="margin-top:18px">Loading poll…</h1>
    </section>
  `);

  const {data:poll,error}=await supabase
    .from('polls')
    .select('id,question,status')
    .eq('id',pollId)
    .single();

  const card=document.querySelector('#voteCard');

  if(error||!poll){
    card.innerHTML=msg(
      'This poll could not be found. It may have been removed.',
      true
    );
    return;
  }

  if(poll.status!=='open'){
    card.innerHTML=`
      <h1>Voting is closed</h1>
      <p>This poll is no longer accepting votes.</p>
    `;
    return;
  }

  const {data:opts,error:optErr}=await supabase
    .from('poll_options')
    .select('id,label')
    .eq('poll_id',pollId)
    .order('created_at');

  if(optErr){
    card.innerHTML=msg(optErr.message,true);
    return;
  }

  card.innerHTML=`
    <div class="pill">Anonymous workplace vote</div>

    <h1 style="margin-top:18px">${esc(poll.question)}</h1>

    <p>Choose one option. You can only submit once from this browser profile.</p>

    <div id="voteOptions" class="stack"></div>

    <div class="actions">
      <button class="primary full" id="submit" disabled>
        Submit vote
      </button>
    </div>

    <p class="small">
      Your choice is recorded without your name.
      A private browser token helps prevent repeat votes on this device.
    </p>
  `;

  const already=localStorage.getItem('foodvote_voted_'+pollId);
  const list=document.querySelector('#voteOptions');

  if(already){
    list.innerHTML=msg(
      'A vote has already been submitted from this browser. Thank you!'
    );
    document.querySelector('#submit').remove();
    return;
  }

  list.innerHTML=opts.map(o=>`
    <button class="option" data-id="${o.id}">
      <span>${esc(o.label)}</span>
      <span>○</span>
    </button>
  `).join('');

  list.querySelectorAll('button').forEach(b=>{
    b.onclick=()=>{
      chosen=b.dataset.id;

      list.querySelectorAll('button').forEach(x=>{
        x.classList.toggle('selected',x===b);
        x.lastElementChild.textContent=x===b?'●':'○';
      });

      document.querySelector('#submit').disabled=false;
    };
  });

  document.querySelector('#submit').onclick=async()=>{
    if(!chosen)return;

    const button=document.querySelector('#submit');
    button.disabled=true;
    button.textContent='Submitting…';

    const token=await hashToken(deviceToken(pollId));

    const {error}=await supabase.rpc('cast_foodvote',{
      p_poll_id:pollId,
      p_option_id:chosen,
      p_voter_hash:token
    });

    if(error){
      button.disabled=false;
      button.textContent='Submit vote';
      alert(error.message);
      return;
    }

    localStorage.setItem('foodvote_voted_'+pollId,'1');

    card.innerHTML=`
      <div class="pill">Vote recorded</div>
      <h1 style="margin-top:18px">Thanks for voting!</h1>
      <p>Your anonymous vote has been submitted.</p>
      ${msg('You’re all set. You can close this page.')}
    `;
  };
}

function route(){
  const c=config();
  supabase=client();

  if(!supabase){
    setupScreen();
    return;
  }

  const params=new URLSearchParams(location.search);
  const poll=params.get('poll');

  if(poll){
    voteScreen(poll);
  } else if(location.hash==='#admin'){
    adminScreen();
  } else {
    layout(`
      <section class="card">
        <h1>FoodVote</h1>
        <p>Use your poll's QR code to vote, or open the admin dashboard to create a poll.</p>
        <button class="primary" id="admin">Open admin dashboard</button>
      </section>
    `);

    document.querySelector('#admin').onclick=()=>{
      location.hash='admin';
      adminScreen();
    };
  }
}

route();
