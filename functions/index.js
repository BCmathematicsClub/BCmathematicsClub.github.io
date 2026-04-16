const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {google} = require('googleapis');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());

const PASSWORD_HASH = process.env.PWD_HASH; // bcrypt or simple sha256 for demo
const JWT_SECRET = process.env.JWT_SECRET;
const SERVICE_ACCOUNT_JSON = process.env.SA_JSON; // content of service account JSON
const CLUB_EMAIL = process.env.CLUB_EMAIL; // recipient for 2FA
const EMAIL_USER = process.env.EMAIL_USER; // SMTP user (gmail)
const EMAIL_PASS = process.env.EMAIL_PASS; // app password

// In-memory store (simple). For production use Secret Manager or DB.
const sessions = new Map();

function hash(s){ return crypto.createHash('sha256').update(s).digest('hex'); }

app.post('/authPassword', (req,res)=>{
  const { password } = req.body || {};
  if(!password){ return res.status(400).json({ error:'missing' }); }
  if (hash(password) !== PASSWORD_HASH) return res.status(401).json({ error:'invalid' });
  const sessionId = crypto.randomBytes(16).toString('hex');
  const code = ('000000' + Math.floor(Math.random()*1000000)).slice(-6);
  const expires = Date.now() + 5*60*1000;
  sessions.set(sessionId, { code, expires });
  // send email
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });
  transporter.sendMail({
    from: EMAIL_USER,
    to: CLUB_EMAIL,
    subject: 'Your club access code',
    text: `Your code: ${code}`
  }).catch(e=>console.error('mailerr',e));
  res.json({ sessionId });
});

app.post('/authVerify', (req,res)=>{
  const { sessionId, code } = req.body || {};
  const s = sessions.get(sessionId);
  if(!s || s.expires < Date.now() || s.code !== code) return res.status(401).json({ error:'invalid or expired' });
  sessions.delete(sessionId);
  const token = jwt.sign({ sub: 'club-user' }, JWT_SECRET, { expiresIn: '30m' });
  res.json({ token });
});

async function getAuthClient(){
  const sa = JSON.parse(SERVICE_ACCOUNT_JSON);
  const scopes = ['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/documents'];
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes
  });
  await auth.authorize();
  return auth;
}

function verifyJwt(req,res,next){
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer (.+)$/);
  if(!m) return res.status(401).json({ error:'no token' });
  try{
    jwt.verify(m[1], JWT_SECRET);
    next();
  }catch(e){ return res.status(401).json({ error:'invalid token' }); }
}

app.post('/driveCreateFolder', verifyJwt, async (req,res)=>{
  const { name } = req.body || {};
  if(!name) return res.status(400).json({ error:'missing name' });
  try{
    const auth = await getAuthClient();
    const drive = google.drive({ version:'v3', auth });
    const resp = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id'
    });
    res.json({ id: resp.data.id });
  }catch(e){ console.error(e); res.status(500).json({ error:'drive error' }); }
});

app.post('/driveCreateDoc', verifyJwt, async (req,res)=>{
  const { folderId, titleTemplate, date, phrase, contentTemplate } = req.body || {};
  if(!folderId || !titleTemplate) return res.status(400).json({ error:'missing fields' });
  try{
    const title = titleTemplate.replace('{{date}}', date||'').replace('{{phrase}}', phrase||'');
    const auth = await getAuthClient();
    const drive = google.drive({ version:'v3', auth });
    const docs = google.docs({ version:'v1', auth });

    // create blank doc via Drive
    const file = await drive.files.create({
      requestBody: { name: title, parents: [folderId], mimeType: 'application/vnd.google-apps.document' },
      fields: 'id'
    });
    const docId = file.data.id;

    const content = (contentTemplate||'').replace('{{date}}', date||'').replace('{{phrase}}', phrase||'');

    // Update doc body
    await docs.documents.batchUpdate({ documentId: docId, requestBody: {
      requests: [
        { insertText: { location: { index: 1 }, text: content } }
      ]
    }});
    res.json({ id: docId });
  }catch(e){ console.error(e); res.status(500).json({ error:'drive/docs error' }); }
});

module.exports = app;
