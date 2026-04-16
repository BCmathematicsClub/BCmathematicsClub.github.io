// Drive operations
const API_BASE = 'https://REGION-PROJECT.cloudfunctions.net'; // replace

function authHeaders(){ return { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('clubToken')||'') }; }

document.getElementById('createFolder').addEventListener('click', async () => {
  const name = document.getElementById('folderName').value;
  const r = await fetch(API_BASE + '/driveCreateFolder', {
    method:'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name })
  });
  const j = await r.json();
  document.getElementById('folderResult').textContent = r.ok ? ('Folder ID: '+j.id) : ('Error: '+(j.error||r.status));
});

document.getElementById('createDoc').addEventListener('click', async () => {
  const payload = {
    folderId: document.getElementById('docFolderId').value,
    titleTemplate: document.getElementById('titleTemplate').value,
    date: document.getElementById('date').value,
    phrase: document.getElementById('phrase').value,
    contentTemplate: document.getElementById('content').value
  };
  const r = await fetch(API_BASE + '/driveCreateDoc', {
    method:'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const j = await r.json();
  document.getElementById('docResult').textContent = r.ok ? ('Doc ID: '+j.id) : ('Error: '+(j.error||r.status));
});
