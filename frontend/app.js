 /* =========================================================
   MEGAMART — app.js
   Mfumo mdogo wa SPA (single page app) unaotumia:
   show(view), searchProducts() — kama zilivyoitwa kwenye HTML
   ========================================================= */

/* ---------- 1. DATA YA BIDHAA (mfano) ---------- */
const PRODUCTS = [
  { id: 1, name: "Simu ya Smartphone",        price: 450000,  category: "electronics", emoji: "📱" },
  { id: 2, name: "Kompyuta Ndogo (Laptop)",   price: 1200000, category: "electronics", emoji: "💻" },
  { id: 3, name: "Kaptura za Kiume",          price: 25000,   category: "fashion",     emoji: "👕" },
  { id: 4, name: "Gauni la Kike",             price: 40000,   category: "fashion",     emoji: "👗" },
  { id: 5, name: "Sofa Seti",                 price: 850000,  category: "home",        emoji: "🛋️" },
  { id: 6, name: "Chungu za Kupikia",         price: 35000,   category: "home",        emoji: "🍳" },
  { id: 7, name: "Mpira wa Miguu",            price: 30000,   category: "sports",      emoji: "⚽" },
  { id: 8, name: "Raketi ya Tenisi",          price: 60000,   category: "sports",      emoji: "🎾" },
];

const CATEGORY_LABELS = {
  electronics: "Simu & Electronics",
  fashion: "Fashion",
  home: "Nyumbani",
  sports: "Michezo",
};

/* ---------- 2. HALI (STATE) ---------- */
let cart = loadJSON("megamart_cart", []);
let currentUser = loadJSON("megamart_user", null);
let homeHTML = null;      // HTML asili ya sehemu ya "home", itahifadhiwa mara moja
let nextProductId = PRODUCTS.length + 1;

const appEl = document.getElementById("app");
const cartCountEl = document.getElementById("cartCount");
const searchInput = document.getElementById("search");

/* ---------- 3. HELPERS ---------- */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveCart() {
  localStorage.setItem("megamart_cart", JSON.stringify(cart));
  updateCartCount();
}

function formatPrice(n) {
  return "Tsh " + Number(n).toLocaleString("en-US");
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function updateCartCount() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  if (cartCountEl) cartCountEl.textContent = totalItems;
}

/* ---------- 4. STYLE ZA ZIADA (zinazoendana na CSS ya ukurasa) ---------- */
function injectExtraStyles() {
  if (document.getElementById("megamart-extra-styles")) return;
  const style = document.createElement("style");
  style.id = "megamart-extra-styles";
  style.textContent = `
    .view-header{max-width:1150px;margin:0 auto;padding:30px 18px 0;}
    .view-header h2{font-size:1.7rem;margin-bottom:6px;}
    .view-header p{color:var(--muted);}
    .filter-row{display:flex;flex-wrap:wrap;gap:8px;max-width:1150px;margin:18px auto 0;padding:0 18px;}
    .filter-chip{border:1px solid var(--border);background:white;padding:8px 14px;border-radius:20px;font-weight:700;font-size:.85rem;}
    .filter-chip.active{background:var(--green);color:white;border-color:var(--green);}
    .product-grid{max-width:1150px;margin:24px auto;padding:0 18px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
    .product-card{background:white;border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px;}
    .product-emoji{font-size:2.4rem;text-align:center;}
    .product-name{font-weight:700;min-height:44px;}
    .product-price{color:var(--green-dark);font-weight:800;}
    .add-btn{margin-top:auto;border:0;background:var(--dark);color:white;padding:10px;border-radius:8px;font-weight:700;}
    .add-btn:hover{background:var(--green-dark);}
    .empty-msg{text-align:center;color:var(--muted);padding:40px 18px;}
    .form-wrap{max-width:480px;margin:30px auto;padding:26px;background:white;border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);}
    .form-wrap h2{margin-bottom:18px;}
    .form-group{margin-bottom:14px;}
    .form-group label{display:block;font-weight:700;margin-bottom:6px;font-size:.9rem;}
    .form-group input,.form-group select{width:100%;padding:11px;border:1px solid var(--border);border-radius:8px;outline:none;}
    .form-group input:focus,.form-group select:focus{border-color:var(--green);}
    .submit-btn{width:100%;border:0;background:var(--green);color:white;padding:13px;border-radius:9px;font-weight:800;margin-top:6px;}
    .submit-btn:hover{background:var(--green-dark);}
    .switch-link{text-align:center;margin-top:14px;font-size:.88rem;color:var(--muted);}
    .switch-link a{color:var(--green-dark);font-weight:700;cursor:pointer;text-decoration:underline;}
    .cart-list{max-width:800px;margin:24px auto;padding:0 18px;display:flex;flex-direction:column;gap:12px;}
    .cart-item{background:white;border:1px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow);}
    .cart-item .emoji{font-size:1.8rem;}
    .cart-item .info{flex:1;}
    .cart-item .qty-controls{display:flex;align-items:center;gap:8px;}
    .qty-controls button{border:1px solid var(--border);background:white;width:28px;height:28px;border-radius:6px;font-weight:800;}
    .remove-btn{border:0;background:transparent;color:#dc2626;font-weight:700;}
    .cart-summary{max-width:800px;margin:0 auto 40px;padding:20px 18px;display:flex;justify-content:space-between;align-items:center;}
    .cart-summary .total{font-size:1.3rem;font-weight:800;}
    .checkout-btn{border:0;background:var(--dark);color:white;padding:13px 24px;border-radius:9px;font-weight:800;}
    .checkout-btn:hover{background:var(--green-dark);}
    @media (max-width:900px){.product-grid{grid-template-columns:repeat(2,1fr);}}
    @media (max-width:560px){.product-grid{grid-template-columns:1fr;}}
  `;
  document.head.appendChild(style);
}

/* ---------- 5. ROUTER: show(view) ---------- */
function show(view, opts = {}) {
  // Hifadhi HTML asili ya "home" mara ya kwanza tu, kabla haijabadilishwa
  if (homeHTML === null) homeHTML = appEl.innerHTML;

  injectExtraStyles();

  switch (view) {
    case "home":
      appEl.innerHTML = homeHTML;
      break;
    case "shop":
      renderShop(opts.query || "", opts.category || "all");
      break;
    case "seller":
      renderSeller();
      break;
    case "login":
      renderLogin(opts.mode || "login");
      break;
    case "cart":
      renderCart();
      break;
    default:
      appEl.innerHTML = homeHTML;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- 6. UKURASA: DUKA (SHOP) ---------- */
function renderShop(query = "", category = "all") {
  const q = query.trim().toLowerCase();

  const filtered = PRODUCTS.filter((p) => {
    const matchesQuery = !q || p.name.toLowerCase().includes(q);
    const matchesCategory = category === "all" || p.category === category;
    return matchesQuery && matchesCategory;
  });

  const chips = ["all", ...Object.keys(CATEGORY_LABELS)]
    .map((cat) => {
      const label = cat === "all" ? "Zote" : CATEGORY_LABELS[cat];
      const active = cat === category ? "active" : "";
      return `<button class="filter-chip ${active}" data-cat="${cat}">${label}</button>`;
    })
    .join("");

  const cards = filtered.length
    ? filtered
        .map(
          (p) => `
        <div class="product-card">
          <div class="product-emoji">${p.emoji}</div>
          <div class="product-name">${escapeHTML(p.name)}</div>
          <div class="product-price">${formatPrice(p.price)}</div>
          <button class="add-btn" data-id="${p.id}">+ Ongeza Kikapuni</button>
        </div>`
        )
        .join("")
    : `<div class="empty-msg">Hakuna bidhaa zinazolingana na utafutaji wako.</div>`;

  appEl.innerHTML = `
    <div class="view-header">
      <h2>🛍️ Duka</h2>
      <p>${filtered.length} bidhaa zimepatikana</p>
    </div>
    <div class="filter-row">${chips}</div>
    <div class="product-grid">${cards}</div>
  `;

  // Vitufe vya kuchuja kwa kundi
  appEl.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderShop(searchInput ? searchInput.value : "", btn.dataset.cat);
    });
  });

  // Vitufe vya kuongeza kikapuni
  appEl.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(Number(btn.dataset.id)));
  });
}

function searchProducts() {
  const q = searchInput ? searchInput.value : "";
  show("shop", { query: q, category: "all" });
}

/* ---------- 7. KIKAPU (CART) ---------- */
function addToCart(productId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return;

  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, emoji: product.emoji, qty: 1 });
  }
  saveCart();
}

function changeQty(productId, delta) {
  const item = cart.find((i) => i.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter((i) => i.id !== productId);
  }
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter((i) => i.id !== productId);
  saveCart();
  renderCart();
}

function renderCart() {
  if (!cart.length) {
    appEl.innerHTML = `
      <div class="view-header"><h2>🛒 Kikapu Chako</h2></div>
      <div class="empty-msg">Kikapu chako kiko tupu. <br><br>
        <button class="primary-btn" onclick="show('shop')" style="border:0;border-radius:9px;padding:12px 20px;background:var(--green);color:white;font-weight:800;">
          Anza Kununua
        </button>
      </div>`;
    return;
  }

  const rows = cart
    .map(
      (item) => `
      <div class="cart-item">
        <div class="emoji">${item.emoji}</div>
        <div class="info">
          <div style="font-weight:700;">${escapeHTML(item.name)}</div>
          <div style="color:var(--muted);font-size:.88rem;">${formatPrice(item.price)}</div>
        </div>
        <div class="qty-controls">
          <button data-action="dec" data-id="${item.id}">−</button>
          <b>${item.qty}</b>
          <button data-action="inc" data-id="${item.id}">+</button>
        </div>
        <div style="font-weight:800;min-width:110px;text-align:right;">${formatPrice(item.price * item.qty)}</div>
        <button class="remove-btn" data-action="remove" data-id="${item.id}">Ondoa</button>
      </div>`
    )
    .join("");

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  appEl.innerHTML = `
    <div class="view-header"><h2>🛒 Kikapu Chako</h2></div>
    <div class="cart-list">${rows}</div>
    <div class="cart-summary">
      <div class="total">Jumla: ${formatPrice(total)}</div>
      <button class="checkout-btn" id="checkoutBtn">Lipia Sasa</button>
    </div>
  `;

  appEl.querySelectorAll("[data-action]").forEach((btn) => {
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    btn.addEventListener("click", () => {
      if (action === "inc") changeQty(id, 1);
      if (action === "dec") changeQty(id, -1);
      if (action === "remove") removeFromCart(id);
    });
  });

  const checkoutBtn = document.getElementById("checkoutBtn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", checkout);
}

function checkout() {
  if (!currentUser) {
    alert("Tafadhali ingia kwanza kabla ya kulipia.");
    show("login", { mode: "login" });
    return;
  }
  alert("Asante " + currentUser.name + "! Order yako imepokelewa. (Huu ni mfumo wa mfano — hakuna malipo halisi yanayofanyika.)");
  cart = [];
  saveCart();
  show("home");
}

/* ---------- 8. UKURASA: MUUZAJI (SELLER) ---------- */
function renderSeller() {
  appEl.innerHTML = `
    <div class="form-wrap">
      <h2>🏪 Ongeza Bidhaa Yako</h2>
      <form id="sellerForm">
        <div class="form-group">
          <label for="pName">Jina la Bidhaa</label>
          <input id="pName" type="text" required placeholder="Mfano: Kiatu cha Michezo">
        </div>
        <div class="form-group">
          <label for="pPrice">Bei (Tsh)</label>
          <input id="pPrice" type="number" min="0" required placeholder="Mfano: 45000">
        </div>
        <div class="form-group">
          <label for="pCategory">Kundi</label>
          <select id="pCategory" required>
            <option value="electronics">Simu & Electronics</option>
            <option value="fashion">Fashion</option>
            <option value="home">Nyumbani</option>
            <option value="sports">Michezo</option>
          </select>
        </div>
        <div class="form-group">
          <label for="pEmoji">Emoji ya Bidhaa (hiari)</label>
          <input id="pEmoji" type="text" maxlength="2" placeholder="📦">
        </div>
        <button type="submit" class="submit-btn">Chapisha Bidhaa</button>
      </form>
    </div>
  `;

  document.getElementById("sellerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("pName").value.trim();
    const price = Number(document.getElementById("pPrice").value);
    const category = document.getElementById("pCategory").value;
    const emoji = document.getElementById("pEmoji").value.trim() || "📦";

    if (!name || !price) return;

    PRODUCTS.push({ id: nextProductId++, name, price, category, emoji });
    alert("Bidhaa '" + name + "' imeongezwa kikamilifu!");
    show("shop", { category });
  });
}

/* ---------- 9. UKURASA: INGIA / JISAJILI (LOGIN) ---------- */
function renderLogin(mode = "login") {
  const isLogin = mode === "login";

  appEl.innerHTML = `
    <div class="form-wrap">
      <h2>${isLogin ? "🔐 Ingia" : "📝 Fungua Akaunti"}</h2>
      <form id="authForm">
        ${
          !isLogin
            ? `<div class="form-group">
                <label for="authName">Jina Kamili</label>
                <input id="authName" type="text" required placeholder="Jina lako">
              </div>`
            : ""
        }
        <div class="form-group">
          <label for="authEmail">Barua pepe / Namba ya simu</label>
          <input id="authEmail" type="text" required placeholder="mfano@barua.com">
        </div>
        <div class="form-group">
          <label for="authPass">Nenosiri</label>
          <input id="authPass" type="password" required placeholder="••••••••">
        </div>
        <button type="submit" class="submit-btn">${isLogin ? "Ingia" : "Jisajili"}</button>
      </form>
      <div class="switch-link">
        ${
          isLogin
            ? `Huna akaunti? <a id="switchMode">Jisajili hapa</a>`
            : `Una akaunti tayari? <a id="switchMode">Ingia hapa</a>`
        }
      </div>
    </div>
  `;

  document.getElementById("switchMode").addEventListener("click", () => {
    show("login", { mode: isLogin ? "register" : "login" });
  });

  document.getElementById("authForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const name = isLogin ? email.split("@")[0] : document.getElementById("authName").value.trim();

    currentUser = { name: name || "Mtumiaji", email };
    localStorage.setItem("megamart_user", JSON.stringify(currentUser));

    alert((isLogin ? "Karibu tena, " : "Akaunti imetengenezwa, karibu ") + currentUser.name + "!");
    show("home");
  });
}

/* ---------- 10. ANZISHA APP ---------- */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
});
