// Minimal auth flow frontend
const API_BASE = 'https://REGION-PROJECT.cloudfunctions.net'; // replace with your functions base

document.getElementById('sendCode').addEventListener('click', async () => {
  const pwd = document.getElementById('pwd').value;
  const r = await fetch(API_BASE + '/authPassword', {
    method: 'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ password: pwd })
  });
  const j = await r.json();
  if (r.ok) {
    window.sessionId = j.sessionId;
    document.getElementById('step-password').style.display='none';
    document.getElementById('step-2fa').style.display='';
  } else {
    document.getElementById('pwdMsg').textContent = j.error || 'Error';
  }
});

document.getElementById('verify').addEventListener('click', async () => {
  const code = document.getElementById('code').value;
  const r = await fetch(API_BASE + '/authVerify', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ sessionId: window.sessionId, code })
  });
  const j = await r.json();
  if (r.ok && j.token) {
    localStorage.setItem('clubToken', j.token);
    window.location.href = '/protected.html';
  } else {
    document.getElementById('codeMsg').textContent = j.error || 'Invalid code';
  }
});
