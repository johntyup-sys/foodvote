
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const CONFIG_KEY = 'foodvote_config';
const DEVICE_KEY = 'foodvote_device';

const root = document.querySelector('#app');
let supabase = null;

const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

function config() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  } catch {
    return {};
  }
}


function client() {
  return createClient(
    'https://rrvhklpqvwcakfnsqzfw.supabase.co',
    'sb_publishable_9ONRGH7p8QmZg6RYhk3EfA_8p_A5FXF'
  );
}


function layout(content) {
  root.innerHTML = `
    <main class="shell">
      <header class="top">
        <div class="brand">Food<span>Vote</span></div>
        <div class="tag">Workplace polls</div>
      </header>
      ${content}
    </main>`;
}

function msg(text, error = false) {
  return `<div class="notice ${error ? 'error' : ''}">${esc(text)}</div>`;
}

// CONNECTION SETUP

function setupScreen() {
  layout(`
    <section class="card">
      <h1>Connect FoodVote</h1>
      <p>Enter your Supabase project details.</p>

      <label>Project URL</label>
      <input id="url" placeholder="https://your-project.supabase.co"
        value="${esc(config().url || '')}">

      <label>Publishable / anon key</label>
      <input id="key" placeholder="Supabase anon key"
        value="${esc(config().key || '')}">

      <div class="actions">
        <button class="primary" id="save">Save connection</button>
      </div>

      <p class="small">
        Never enter a service-role or secret key here.
      </p>
    </section>
  `);

  document.querySelector('#save').onclick = () => {
    const url = document.querySelector('#url').value.trim();
    const key = document.querySelector('#key').value.trim();

    if (!url || !key) {
      alert('Enter both your Project URL and public key.');
      return;
    }

    localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key }));
    location.reload();
  };
}

// ADMIN DASHBOARD

function adminScreen() {
  layout(`
    <section class="card">
      <h1>Admin dashboard</h1>
      <p>Create food polls, download QR codes, and check results.</p>
      <div id="authArea"></div>
    </section>
    <section id="adminArea"></section>
  `);

  supabase.auth.getSession().then(({ data }) => {
    renderAdminAuth(data.session);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    renderAdminAuth(session);
  });
}

async function renderAdminAuth(session) {
  const area = document.querySelector('#authArea');
  if (!area) return;

  if (!session) {
    area.innerHTML = `
      <label>Admin email</label>
      <input id="email" type="email" placeholder="Admin email">

      <label>Password</label>
      <input id="password" type="password" placeholder="Password">

      <div class="actions">
        <button class="primary" id="login">Log in</button>
      </div>
    `;

    document.querySelector('#login').onclick = async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: document.querySelector('#email').value,
        password: document.querySelector('#password').value
      });

      if (error) alert(error.message);
    };

    document.querySelector('#adminArea').innerHTML = '';
    return;
  }

  area.innerHTML = `
    <div class="row">
      <span class="pill">Signed in: ${esc(session.user.email)}</span>
      <button class="secondary" id="logout">Log out</button>
    </div>
  `;

  document.querySelector('#logout').onclick = () => {
    supabase.auth.signOut();
  };

  renderCreatePoll();
}

// CREATE POLL

function renderCreatePoll() {
  const area = document.querySelector('#adminArea');

  area.innerHTML = `
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
        <button class="primary" id="create">Create poll & QR codes</button>
      </div>

      <p class="small">
        Each food choice gets its own QR code.
        Scanning it automatically submits that choice.
      </p>
    </section>

    <section id="created"></section>

    <section class="card">
      <h2>Previous polls</h2>
      <div id="polls">Loading…</div>
    </section>
  `;

  const choices = document.querySelector('#choices');

  function bindRemove() {
    choices.querySelectorAll('.remove').forEach(button => {
      button.onclick = () => {
        if (choices.children.length > 2) {
          button.parentElement.remove();
        } else {
          alert('A poll needs at least two choices.');
        }
      };
    });
  }

  bindRemove();

  document.querySelector('#add').onclick = () => {
    const row = document.createElement('div');
    row.className = 'row';

    row.innerHTML = `
      <input placeholder="Another food option" maxlength="100">
      <button class="danger remove">Remove</button>
    `;

    choices.append(row);
    bindRemove();
  };

  document.querySelector('#create').onclick = createPoll;

  loadPolls();
}

async function createPoll() {
  const question = document.querySelector('#question').value.trim();

  const options = [
    ...document.querySelectorAll('#choices input')
  ].map(input => input.value.trim()).filter(Boolean);

  if (!question || options.length < 2) {
    alert('Add a question and at least two choices.');
    return;
  }

  const createButton = document.querySelector('#create');
  createButton.disabled = true;
  createButton.textContent = 'Creating…';

  const { data: poll, error } = await supabase
    .from('polls')
    .insert({ question, status: 'open' })
    .select()
    .single();

  if (error) {
    alert(error.message);
    createButton.disabled = false;
    createButton.textContent = 'Create poll & QR codes';
    return;
  }

  const { data: createdOptions, error: optError } = await supabase
    .from('poll_options')
    .insert(options.map(label => ({
      poll_id: poll.id,
      label
    })))
    .select('id,label');

  if (optError) {
    alert(optError.message);
    createButton.disabled = false;
    createButton.textContent = 'Create poll & QR codes';
    return;
  }

  const cards = await Promise.all(createdOptions.map(async option => {
    const link = `${location.origin}${location.pathname}?poll=${poll.id}&option=${option.id}`;

    const qr = await QRCode.toDataURL(link, {
      width: 600,
      margin: 2
    });

    return `
      <section class="card">
        <h2>${esc(option.label)}</h2>

        <img class="qr" src="${qr}" alt="QR code for ${esc(option.label)}">

        <p class="small" style="text-align:center;word-break:break-all">
          ${esc(link)}
        </p>

        <div class="actions">
          <button class="primary download-option"
            data-qr="${qr}"
            data-name="${esc(option.label)}">
            Download ${esc(option.label)} QR
          </button>
        </div>
      </section>
    `;
  }));

  document.querySelector('#created').innerHTML = `
    <section class="card">
      <h2>Your poll is live!</h2>
      <p>${esc(question)}</p>
      <p>Each QR code votes directly for its food choice.</p>
      <p class="small">Print and display the individual QR codes for employees.</p>
    </section>

    ${cards.join('')}
  `;

  document.querySelectorAll('.download-option').forEach(button => {
    button.onclick = () => {
      const a = document.createElement('a');
      a.href = button.dataset.qr;
      a.download = 'foodvote-' +
        button.dataset.name.replace(/[^a-z0-9]/gi, '-') + '.png';
      a.click();
    };
  });

  createButton.disabled = false;
  createButton.textContent = 'Create poll & QR codes';

  loadPolls();
}

// PREVIOUS POLLS

async function loadPolls() {
  const el = document.querySelector('#polls');
  if (!el) return;

  const { data, error } = await supabase
    .from('polls')
    .select('id,question,status,created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    el.innerHTML = msg(error.message, true);
    return;
  }

  if (!data.length) {
    el.innerHTML = '<p class="muted">No polls yet.</p>';
    return;
  }

  el.innerHTML = data.map(poll => `
    <div class="row"
      style="justify-content:space-between;padding:12px 0;border-bottom:1px solid #edf0ec">

      <div>
        <b>${esc(poll.question)}</b>
        <div class="small">${esc(poll.status)}</div>
      </div>

      <button class="secondary" data-results="${poll.id}">
        Results
      </button>
    </div>
  `).join('');

  el.querySelectorAll('[data-results]').forEach(button => {
    button.onclick = () => showResults(button.dataset.results);
  });
}

// RESULTS AND POLL CONTROLS

async function showResults(id) {
  const { data: poll, error } = await supabase
    .from('polls')
    .select('id,question,status')
    .eq('id', id)
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  const [{ data: options, error: optionError },
         { data: votes, error: voteError }] = await Promise.all([
    supabase.from('poll_options')
      .select('id,label')
      .eq('poll_id', id),

    supabase.from('votes')
      .select('option_id')
      .eq('poll_id', id)
  ]);

  if (optionError || voteError) {
    alert(optionError?.message || voteError?.message);
    return;
  }

  const total = votes.length;

  const lines = options.map(option => {
    const count = votes.filter(vote =>
      vote.option_id === option.id
    ).length;

    const pct = total ? Math.round(count / total * 100) : 0;

    return `
      <div class="result">
        <b>${esc(option.label)}</b>
        <span>${count} (${pct}%)</span>
        <div class="track">
          <div class="fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  const target = document.querySelector('#created');

  target.innerHTML = `
    <section class="card">
      <div class="row" style="justify-content:space-between">
        <h2>Poll results</h2>
        <span class="pill">${total} votes</span>
      </div>

      <p>${esc(poll.question)}</p>

      ${lines}

      <div class="actions">
        <button class="secondary" id="toggle">
          ${poll.status === 'open' ? 'Close poll' : 'Reopen poll'}
        </button>
      </div>
    </section>
  `;

  document.querySelector('#toggle').onclick = async () => {
    const newStatus = poll.status === 'open' ? 'closed' : 'open';

    const { error } = await supabase
      .from('polls')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      alert(error.message);
    } else {
      alert('Poll status updated.');
      renderCreatePoll();
    }
  };
}

// DEVICE PROTECTION

async function hashToken(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function deviceToken(pollId) {
  const key = DEVICE_KEY + '_' + pollId;
  let token = localStorage.getItem(key);

  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }

  return token;
}

// AUTOMATIC VOTING

async function voteScreen(pollId, optionId) {
  layout(`
    <section class="card" id="voteCard">
      <div class="pill">FoodVote • Anonymous poll</div>
      <h1 style="margin-top:18px">Loading your vote…</h1>
      <p>Please wait.</p>
    </section>
  `);

  const card = document.querySelector('#voteCard');

  const { data: poll, error } = await supabase
    .from('polls')
    .select('id,question,status')
    .eq('id', pollId)
    .single();

  if (error || !poll) {
    card.innerHTML = msg(
      'This poll could not be found.',
      true
    );
    return;
  }

  if (poll.status !== 'open') {
    card.innerHTML = `
      <h1>Voting is closed</h1>
      <p>This poll is no longer accepting votes.</p>
    `;
    return;
  }

  const { data: options, error: optionError } = await supabase
    .from('poll_options')
    .select('id,label')
    .eq('poll_id', pollId)
    .order('created_at');

  if (optionError) {
    card.innerHTML = msg(optionError.message, true);
    return;
  }

  // If an old poll QR has no option in its link,
  // show the choices and allow manual voting.

  if (!optionId) {
    card.innerHTML = `
      <div class="pill">Anonymous workplace vote</div>
      <h1 style="margin-top:18px">${esc(poll.question)}</h1>
      <p>This QR code does not specify a food choice.
      Select one below.</p>
      <div id="voteOptions" class="stack"></div>
      <div class="actions">
        <button class="primary full" id="submit" disabled>
          Submit vote
        </button>
      </div>
    `;

    const list = document.querySelector('#voteOptions');
    let selected = null;

    list.innerHTML = options.map(option => `
      <button class="option" data-id="${option.id}">
        <span>${esc(option.label)}</span>
        <span>○</span>
      </button>
    `).join('');

    list.querySelectorAll('button').forEach(button => {
      button.onclick = () => {
        selected = button.dataset.id;

        list.querySelectorAll('button').forEach(item => {
          item.classList.toggle('selected', item === button);
          item.lastElementChild.textContent =
            item === button ? '●' : '○';
        });

        document.querySelector('#submit').disabled = false;
      };
    });

    document.querySelector('#submit').onclick = () =>
      submitVote(poll, selected, card);

    return;
  }

  // Verify that the QR code belongs to this poll.

  const selectedOption = options.find(option =>
    option.id === optionId
  );

  if (!selectedOption) {
    card.innerHTML = msg(
      'This QR code does not match a valid food choice.',
      true
    );
    return;
  }

  card.innerHTML = `
    <div class="pill">Anonymous workplace vote</div>
    <h1 style="margin-top:18px">${esc(poll.question)}</h1>
    <p>You are voting for:</p>
    <h2>${esc(selectedOption.label)}</h2>
    <p>Please wait while your vote is submitted automatically.</p>
  `;

  await submitVote(poll, selectedOption.id, card);
}

async function submitVote(poll, optionId, card) {
  if (!optionId) return;

  const already = localStorage.getItem(
    'foodvote_voted_' + poll.id
  );

  if (already) {
    card.innerHTML = `
      <div class="pill">Already voted</div>
      <h1 style="margin-top:18px">Thank you!</h1>
      <p>A vote has already been submitted from this browser for this poll.</p>
    `;
    return;
  }

  card.innerHTML = `
    <div class="pill">Submitting vote</div>
    <h1 style="margin-top:18px">Please wait…</h1>
    <p>Your anonymous vote is being recorded.</p>
  `;

  try {
    const token = await hashToken(deviceToken(poll.id));

    const { error } = await supabase.rpc('cast_foodvote', {
      p_poll_id: poll.id,
      p_option_id: optionId,
      p_voter_hash: token
    });

    if (error) {
      const duplicate = /duplicate|already|unique/i.test(error.message);

      card.innerHTML = `
        <div class="pill">${duplicate ? 'Already voted' : 'Vote not submitted'}</div>
        <h1 style="margin-top:18px">${duplicate ? 'Thank you!' : 'Something went wrong'}</h1>
        <p>${duplicate
          ? 'A vote has already been recorded for this poll.'
          : esc(error.message)}</p>
      `;

      return;
    }

    localStorage.setItem(
      'foodvote_voted_' + poll.id,
      '1'
    );

    card.innerHTML = `
      <div class="pill">Vote recorded</div>
      <h1 style="margin-top:18px">Thanks for voting!</h1>
      <p>Your vote for <b>${esc(
        document.querySelector('#voteCard h2')?.textContent || 'your choice'
      )}</b> has been submitted anonymously.</p>
      ${msg('You’re all set. You can close this page.')}
    `;

  } catch (error) {
    card.innerHTML = msg(
      'Something went wrong. Please try scanning again. ' + error.message,
      true
    );
  }
}

// PAGE ROUTING

function route() {
  supabase = client();

  if (!supabase) {
    setupScreen();
    return;
  }

  const params = new URLSearchParams(location.search);
  const poll = params.get('poll');
  const option = params.get('option');

  if (poll) {
    voteScreen(poll, option);
    return;
  }

  if (location.hash === '#admin') {
    adminScreen();
    return;
  }

  layout(`
    <section class="card">
      <h1>FoodVote</h1>
      <p>Scan a food choice QR code to vote.</p>
      <button class="primary" id="admin">
        Open admin dashboard
      </button>
    </section>
  `);

  document.querySelector('#admin').onclick = () => {
    location.hash = 'admin';
    adminScreen();
  };
}

route();
