const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_BEFORE_PRODUCTION';
const db = new Database(path.join(__dirname, 'soul.db'));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

db.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'BUYER',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  location TEXT DEFAULT 'Dar es Salaam',
  verified INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  total INTEGER NOT NULL,
  delivery_address TEXT NOT NULL,
  payment_status TEXT DEFAULT 'PENDING',
  delivery_status TEXT DEFAULT 'PENDING',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(buyer_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(id),
  FOREIGN KEY(seller_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(buyer_id) REFERENCES users(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  buyer_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(buyer_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS verification_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  business_name TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(seller_id) REFERENCES users(id)
);
`);

const adminEmail = process.env.ADMIN_EMAIL || 'admin@soul.tz';
const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const existingAdmin = db.prepare('SELECT id FROM users WHERE email=?').get(adminEmail);
if (!existingAdmin) {
  const hash = bcrypt.hashSync(adminPassword, 12);
  db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)')
    .run('SOUL Admin', adminEmail, hash, 'ADMIN');
}

function tokenFor(user) {
  return jwt.sign({id:user.id, role:user.role, email:user.email}, JWT_SECRET, {expiresIn:'7d'});
}
function auth(req,res,next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({error:'Ingia kwanza'});
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch { return res.status(401).json({error:'Session imekwisha, ingia tena'}); }
}
function role(...roles) {
  return (req,res,next) => roles.includes(req.user.role) ? next() : res.status(403).json({error:'Huna ruhusa'});
}

app.get('/api/health', (req,res)=>res.json({ok:true, service:'SOUL API'}));

app.post('/api/auth/register', (req,res)=>{
  const {name,email,phone,password,role='BUYER',storeName} = req.body;
  if (!name || !email || !password) return res.status(400).json({error:'Jaza jina, barua pepe na password'});
  const safeRole = role === 'SELLER' ? 'SELLER' : 'BUYER';
  try {
    const hash = bcrypt.hashSync(password, 12);
    const info = db.prepare('INSERT INTO users(name,email,phone,password_hash,role) VALUES (?,?,?,?,?)')
      .run(name,email.toLowerCase(),phone||'',hash,safeRole);
    if (safeRole === 'SELLER') {
      db.prepare('INSERT INTO stores(seller_id,name) VALUES (?,?)').run(info.lastInsertRowid, storeName || `${name} Store`);
    }
    const user = db.prepare('SELECT id,name,email,phone,role FROM users WHERE id=?').get(info.lastInsertRowid);
    res.json({user,token:tokenFor(user)});
  } catch(e) { res.status(400).json({error:'Barua pepe tayari inatumika'}); }
});

app.post('/api/auth/login', (req,res)=>{
  const {email,password} = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email=?').get((email||'').toLowerCase());
  if (!user || !bcrypt.compareSync(password||'', user.password_hash)) return res.status(401).json({error:'Email au password si sahihi'});
  const safe = {id:user.id,name:user.name,email:user.email,phone:user.phone,role:user.role};
  res.json({user:safe,token:tokenFor(safe)});
});

app.get('/api/me', auth, (req,res)=>{
  const user = db.prepare('SELECT id,name,email,phone,role,created_at FROM users WHERE id=?').get(req.user.id);
  res.json({user});
});

app.get('/api/products', (req,res)=>{
  const {q,category,seller_id} = req.query;
  let sql = `SELECT p.*, u.name seller_name, s.name store_name, s.verified
             FROM products p JOIN users u ON u.id=p.seller_id
             LEFT JOIN stores s ON s.seller_id=p.seller_id WHERE p.active=1`;
  const args=[];
  if(q){ sql += ` AND (p.name LIKE ? OR p.description LIKE ?)`; args.push(`%${q}%`,`%${q}%`); }
  if(category){ sql += ` AND p.category=?`; args.push(category); }
  if(seller_id){ sql += ` AND p.seller_id=?`; args.push(Number(seller_id)); }
  sql += ' ORDER BY p.id DESC';
  res.json({products:db.prepare(sql).all(...args)});
});

app.get('/api/products/:id',(req,res)=>{
  const p=db.prepare(`SELECT p.*,u.name seller_name,s.name store_name,s.verified,s.rating,s.sales_count
                      FROM products p JOIN users u ON u.id=p.seller_id
                      LEFT JOIN stores s ON s.seller_id=p.seller_id WHERE p.id=?`).get(req.params.id);
  if(!p) return res.status(404).json({error:'Bidhaa haipo'});
  res.json({product:p,reviews:db.prepare(`SELECT r.*,u.name buyer_name FROM reviews r JOIN users u ON u.id=r.buyer_id WHERE product_id=? ORDER BY r.id DESC`).all(req.params.id)});
});

app.post('/api/products', auth, role('SELLER','ADMIN'), (req,res)=>{
  const sellerId=req.user.role==='ADMIN' ? req.body.seller_id : req.user.id;
  const {name,category,description,price,stock,image_url=''}=req.body;
  if(!sellerId || !name || !category || Number(price)<0) return res.status(400).json({error:'Taarifa za bidhaa hazijakamilika'});
  const info=db.prepare(`INSERT INTO products(seller_id,name,category,description,price,stock,image_url) VALUES (?,?,?,?,?,?,?)`)
    .run(sellerId,name,category,description||'',Number(price),Number(stock)||0,image_url);
  res.json({product:db.prepare('SELECT * FROM products WHERE id=?').get(info.lastInsertRowid)});
});

app.put('/api/products/:id', auth, role('SELLER','ADMIN'), (req,res)=>{
  const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if(!p) return res.status(404).json({error:'Bidhaa haipo'});
  if(req.user.role==='SELLER' && p.seller_id!==req.user.id) return res.status(403).json({error:'Hii si bidhaa yako'});
  const {name,category,description,price,stock,image_url,active=1}=req.body;
  db.prepare(`UPDATE products SET name=?,category=?,description=?,price=?,stock=?,image_url=?,active=? WHERE id=?`)
    .run(name,category,description||'',Number(price),Number(stock),image_url||'',active?1:0,p.id);
  res.json({product:db.prepare('SELECT * FROM products WHERE id=?').get(p.id)});
});

app.get('/api/stores/:sellerId',(req,res)=>{
  const store=db.prepare(`SELECT s.*,u.name seller_name,u.email FROM stores s JOIN users u ON u.id=s.seller_id WHERE s.seller_id=?`).get(req.params.sellerId);
  if(!store) return res.status(404).json({error:'Duka halipo'});
  res.json({store});
});

app.get('/api/seller/products', auth, role('SELLER'), (req,res)=>{
  res.json({products:db.prepare('SELECT * FROM products WHERE seller_id=? ORDER BY id DESC').all(req.user.id)});
});

app.get('/api/orders', auth, (req,res)=>{
  if(req.user.role==='ADMIN') {
    return res.json({orders:db.prepare(`SELECT o.*,u.name buyer_name,u.email FROM orders o JOIN users u ON u.id=o.buyer_id ORDER BY o.id DESC`).all()});
  }
  if(req.user.role==='SELLER') {
    return res.json({orders:db.prepare(`SELECT DISTINCT o.*,u.name buyer_name FROM orders o JOIN users u ON u.id=o.buyer_id JOIN order_items oi ON oi.order_id=o.id WHERE oi.seller_id=? ORDER BY o.id DESC`).all(req.user.id)});
  }
  res.json({orders:db.prepare('SELECT * FROM orders WHERE buyer_id=? ORDER BY id DESC').all(req.user.id)});
});

app.get('/api/orders/:id', auth, (req,res)=>{
  const o=db.prepare(`SELECT o.*,u.name buyer_name FROM orders o JOIN users u ON u.id=o.buyer_id WHERE o.id=?`).get(req.params.id);
  if(!o) return res.status(404).json({error:'Oda haipo'});
  if(req.user.role==='BUYER' && o.buyer_id!==req.user.id) return res.status(403).json({error:'Huna ruhusa'});
  const items=db.prepare(`SELECT oi.*,p.name product_name FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?`).all(o.id);
  res.json({order:o,items});
});

app.post('/api/orders', auth, role('BUYER'), (req,res)=>{
  const {items,delivery_address}=req.body;
  if(!Array.isArray(items)||!items.length||!delivery_address) return res.status(400).json({error:'Oda haijakamilika'});
  const getP=db.prepare('SELECT * FROM products WHERE id=? AND active=1');
  let total=0, rows=[];
  for(const item of items){
    const p=getP.get(item.product_id);
    const q=Number(item.quantity)||0;
    if(!p || q<1 || p.stock<q) return res.status(400).json({error:`Stock haitoshi kwa ${p?.name||'bidhaa'}`});
    total += p.price*q;
    rows.push({p,q});
  }
  const create=db.transaction(()=>{
    const o=db.prepare('INSERT INTO orders(buyer_id,total,delivery_address) VALUES (?,?,?)').run(req.user.id,total,delivery_address);
    for(const r of rows){
      db.prepare('INSERT INTO order_items(order_id,product_id,seller_id,quantity,unit_price) VALUES (?,?,?,?,?)')
        .run(o.lastInsertRowid,r.p.id,r.p.seller_id,r.q,r.p.price);
      db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(r.q,r.p.id);
    }
    return o.lastInsertRowid;
  });
  const id=create();
  res.json({order:db.prepare('SELECT * FROM orders WHERE id=?').get(id)});
});

app.post('/api/orders/:id/status', auth, role('SELLER','ADMIN'), (req,res)=>{
  const {status}=req.body;
  const allowed=['SELLER_ACCEPTED','PREPARING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','COMPLETED','DISPUTED','REFUNDED'];
  if(!allowed.includes(status)) return res.status(400).json({error:'Status si sahihi'});
  const o=db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if(!o) return res.status(404).json({error:'Oda haipo'});
  if(req.user.role==='SELLER'){
    const owns=db.prepare('SELECT 1 FROM order_items WHERE order_id=? AND seller_id=?').get(o.id,req.user.id);
    if(!owns) return res.status(403).json({error:'Hii si oda yako'});
  }
  db.prepare('UPDATE orders SET status=?, delivery_status=? WHERE id=?').run(status,status,o.id);
  res.json({order:db.prepare('SELECT * FROM orders WHERE id=?').get(o.id)});
});

app.post('/api/reviews', auth, role('BUYER'), (req,res)=>{
  const {product_id,rating,comment}=req.body;
  const own=db.prepare(`SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.buyer_id=? AND oi.product_id=? AND o.status='COMPLETED'`).get(req.user.id,product_id);
  if(!own) return res.status(400).json({error:'Ukadiriaji unaruhusiwa baada ya oda kukamilika'});
  db.prepare('INSERT INTO reviews(buyer_id,product_id,rating,comment) VALUES (?,?,?,?)').run(req.user.id,product_id,Number(rating),comment||'');
  res.json({ok:true});
});

app.post('/api/disputes', auth, role('BUYER'), (req,res)=>{
  const {order_id,reason}=req.body;
  const own=db.prepare('SELECT 1 FROM orders WHERE id=? AND buyer_id=?').get(order_id,req.user.id);
  if(!own) return res.status(403).json({error:'Oda si yako'});
  const info=db.prepare('INSERT INTO disputes(order_id,buyer_id,reason) VALUES (?,?,?)').run(order_id,req.user.id,reason);
  db.prepare(`UPDATE orders SET status='DISPUTED' WHERE id=?`).run(order_id);
  res.json({dispute:db.prepare('SELECT * FROM disputes WHERE id=?').get(info.lastInsertRowid)});
});

app.post('/api/seller/verify', auth, role('SELLER'), (req,res)=>{
  const {business_name}=req.body;
  if(!business_name) return res.status(400).json({error:'Weka jina la biashara'});
  const info=db.prepare('INSERT INTO verification_requests(seller_id,business_name) VALUES (?,?)').run(req.user.id,business_name);
  res.json({request:db.prepare('SELECT * FROM verification_requests WHERE id=?').get(info.lastInsertRowid)});
});

app.get('/api/admin/stats', auth, role('ADMIN'), (req,res)=>{
  const stats={
    users:db.prepare('SELECT COUNT(*) c FROM users').get().c,
    buyers:db.prepare(`SELECT COUNT(*) c FROM users WHERE role='BUYER'`).get().c,
    sellers:db.prepare(`SELECT COUNT(*) c FROM users WHERE role='SELLER'`).get().c,
    products:db.prepare('SELECT COUNT(*) c FROM products').get().c,
    orders:db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    gmv:db.prepare('SELECT COALESCE(SUM(total),0) s FROM orders WHERE status NOT IN ("REFUNDED")').get().s,
    disputes:db.prepare(`SELECT COUNT(*) c FROM disputes WHERE status='OPEN'`).get().c,
    verifications:db.prepare(`SELECT COUNT(*) c FROM verification_requests WHERE status='PENDING'`).get().c
  };
  res.json({stats});
});

app.get('/api/admin/sellers', auth, role('ADMIN'), (req,res)=>{
  res.json({sellers:db.prepare(`SELECT u.id,u.name,u.email,u.created_at,s.name store_name,s.verified,s.rating,s.sales_count
    FROM users u LEFT JOIN stores s ON s.seller_id=u.id WHERE u.role='SELLER' ORDER BY u.id DESC`).all()});
});

app.post('/api/admin/sellers/:id/verify', auth, role('ADMIN'), (req,res)=>{
  db.prepare('UPDATE stores SET verified=1 WHERE seller_id=?').run(req.params.id);
  db.prepare(`UPDATE verification_requests SET status='APPROVED' WHERE seller_id=? AND status='PENDING'`).run(req.params.id);
  res.json({ok:true});
});

app.get('/api/admin/disputes', auth, role('ADMIN'), (req,res)=>{
  res.json({disputes:db.prepare(`SELECT d.*,u.name buyer_name FROM disputes d JOIN users u ON u.id=d.buyer_id ORDER BY d.id DESC`).all()});
});

app.use((req,res,next)=>{
  if(req.path.startsWith('/api/')) return res.status(404).json({error:'API haipo'});
  res.sendFile(path.join(__dirname,'..','frontend','index.html'));
});

 app.listen(PORT, '0.0.0.0', ()=>console.log(`SOUL API running at http://localhost:${PORT}`));
