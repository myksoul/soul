 const API_BASE_URL = 'https://soul-backend.onrender.com';
const API = `${API_BASE_URL.replace(/\/$/, '')}/api`;

let token = localStorage.getItem('soul_token') || '';
let me = JSON.parse(localStorage.getItem('soul_user')) || 'null';
let cart = JSON.parse(localStorage.getItem('soul_cart')) || '[]';

const money = n => 'TSh ' + Number(n || 0).toLocaleString('en-TZ');
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);

async function api(path, opts = {}) {
    opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const r = await fetch(API + path, opts);
    const d = await r.json();
    if (!r.ok) throw Error(d.error || d.message || 'Hitilafu imetokea');
    return d;
}

function toast(s) {
    // Toast implementation
}
