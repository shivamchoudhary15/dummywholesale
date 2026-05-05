const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

let state;
let demoMode = false;

const demoState = {
  buyer: {
    businessName: "Metro Fresh Retail LLP",
    taxId: "27AAHCM9988Q1Z5",
    email: "purchasing@metrofresh.example",
    approved: false,
    requestedCredit: 350000,
    creditLimit: 300000,
    amountDue: 84500,
  },
  products: [
    product("RICE-25-BAS", "Premium Basmati Rice 25 kg", "Staples", 40, 2800, 1480, 1410, 1355),
    product("OIL-15-SUN", "Sunflower Oil 15 L Tin", "Edible oils", 30, 1180, 1725, 1650, 1588),
    product("DET-10-LIQ", "Liquid Detergent 10 L Can", "Home care", 50, 3400, 820, 775, 730),
    product("BIS-24-GLU", "Glucose Biscuit Carton 24 pk", "Packaged foods", 80, 5200, 510, 480, 452),
    product("SOAP-72-ANT", "Antibacterial Soap Master Carton", "Personal care", 60, 2400, 960, 908, 870),
  ],
  cart: {},
  orders: [
    { id: "SO-1028", buyer: "Metro Fresh Retail LLP", total: 184260, status: "Packed", terms: "Credit / Net 30" },
    { id: "SO-1021", buyer: "City Basket Stores", total: 92740, status: "Dispatched", terms: "Pay now" },
  ],
  latestInvoice: null,
};

const els = {
  sections: document.querySelectorAll(".section"),
  navItems: document.querySelectorAll(".nav-item"),
  buyerStatusCard: document.querySelector("#buyerStatusCard"),
  workflowNotice: document.querySelector("#workflowNotice"),
  registrationForm: document.querySelector("#registrationForm"),
  kycStatus: document.querySelector("#kycStatus"),
  creditLimit: document.querySelector("#creditLimit"),
  amountDue: document.querySelector("#amountDue"),
  creditAvailable: document.querySelector("#creditAvailable"),
  creditHealth: document.querySelector("#creditHealth"),
  creditProgress: document.querySelector("#creditProgress"),
  skuSearch: document.querySelector("#skuSearch"),
  csvUpload: document.querySelector("#csvUpload"),
  catalogBody: document.querySelector("#catalogBody"),
  catalogCount: document.querySelector("#catalogCount"),
  cartBody: document.querySelector("#cartBody"),
  cartLines: document.querySelector("#cartLines"),
  totalsBox: document.querySelector("#totalsBox"),
  validationBox: document.querySelector("#validationBox"),
  paymentTerms: document.querySelector("#paymentTerms"),
  shippingCity: document.querySelector("#shippingCity"),
  checkoutBtn: document.querySelector("#checkoutBtn"),
  seedOrderBtn: document.querySelector("#seedOrderBtn"),
  rfqBtn: document.querySelector("#rfqBtn"),
  approveBtn: document.querySelector("#approveBtn"),
  kycReview: document.querySelector("#kycReview"),
  adminCreditLimit: document.querySelector("#adminCreditLimit"),
  adminAmountDue: document.querySelector("#adminAmountDue"),
  saveCreditBtn: document.querySelector("#saveCreditBtn"),
  adminProducts: document.querySelector("#adminProducts"),
  ordersBoard: document.querySelector("#ordersBoard"),
  invoicePanel: document.querySelector("#invoicePanel"),
  printInvoiceBtn: document.querySelector("#printInvoiceBtn"),
  kpiSkus: document.querySelector("#kpiSkus"),
  kpiCart: document.querySelector("#kpiCart"),
  kpiCredit: document.querySelector("#kpiCredit"),
  kpiState: document.querySelector("#kpiState"),
};

function product(sku, name, category, moq, stock, base, hundred, fiveHundred) {
  return {
    sku,
    name,
    category,
    moq,
    stock,
    tiers: [
      { min: 1, price: base },
      { min: 100, price: hundred },
      { min: 500, price: fiveHundred },
    ],
  };
}

function money(value) {
  return INR.format(Math.round(Number(value || 0)));
}

async function api(path, options = {}) {
  if (demoMode) return demoApi(path, options);

  const response = await fetch(path, {
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(error.message);
  }

  return response.json();
}

async function refresh() {
  try {
    state = await api(`/api/state?paymentTerms=${els.paymentTerms.value}`);
  } catch (error) {
    demoMode = true;
    state = await demoApi(`/api/state?paymentTerms=${els.paymentTerms.value}`);
  }
  render();
}

async function mutate(path, body) {
  state = await api(path, { method: "POST", body: JSON.stringify(body) });
  render();
}

function getProduct(sku) {
  return state.products.find((product) => product.sku === sku);
}

function getUnitPrice(product, quantity) {
  return product.tiers.reduce((price, tier) => (quantity >= tier.min ? Number(tier.price) : price), Number(product.tiers[0].price));
}

function demoApi(path, options = {}) {
  const body = options.body instanceof FormData ? options.body : options.body ? JSON.parse(options.body) : {};
  const route = path.split("?")[0];

  if (route === "/api/register") {
    demoState.buyer = { ...demoState.buyer, ...body, approved: false };
  }

  if (route === "/api/approve") {
    demoState.buyer.approved = true;
  }

  if (route === "/api/credit") {
    demoState.buyer.creditLimit = body.creditLimit;
    demoState.buyer.amountDue = body.amountDue;
  }

  if (route === "/api/cart/quantity") {
    if (body.quantity === 0) delete demoState.cart[body.sku];
    else demoState.cart[body.sku] = body.quantity;
  }

  if (route === "/api/cart/reorder") {
    demoState.cart = { "RICE-25-BAS": 120, "OIL-15-SUN": 90, "DET-10-LIQ": 130, "BIS-24-GLU": 240 };
  }

  if (route === "/api/cart/upload") {
    return body.get("file").text().then((text) => {
      text.split(/\r?\n/).forEach((row, index) => {
        const [sku, rawQuantity] = row.split(",").map((cell) => cell?.trim());
        if (index === 0 || !sku) return;
        const quantity = Number.parseInt(rawQuantity, 10);
        if (demoState.products.some((item) => item.sku === sku) && quantity > 0) demoState.cart[sku] = quantity;
      });
      return buildDemoState();
    });
  }

  if (route === "/api/products") {
    const item = demoState.products.find((entry) => entry.sku === body.sku);
    item.moq = body.moq;
    item.stock = body.stock;
    item.tiers = [
      { min: 1, price: body.prices[0] },
      { min: 100, price: body.prices[1] },
      { min: 500, price: body.prices[2] },
    ];
  }

  if (route === "/api/rfq") {
    const line = buildDemoState().validation.lines.sort((a, b) => b.quantity - a.quantity)[0];
    if (!line) throw new Error("Add high-volume SKUs before requesting a quote.");
    return Promise.resolve({ message: `RFQ drafted for ${line.product.sku} at ${line.quantity} units. Seller can counter from the admin pricing engine.` });
  }

  if (route === "/api/checkout") {
    const next = buildDemoState();
    if (next.validation.problems.length) throw new Error(next.validation.problems.join(" "));
    const invoice = {
      id: `INV-${new Date().getFullYear()}-${String(demoState.orders.length + 1001).padStart(4, "0")}`,
      date: new Date().toISOString().slice(0, 10),
      buyer: { ...demoState.buyer },
      shippingCity: body.shippingCity,
      terms: body.paymentTerms === "credit" ? "Credit / Net 30" : "Pay now",
      ...next.validation,
    };
    demoState.latestInvoice = invoice;
    if (body.paymentTerms === "credit") demoState.buyer.amountDue += Number(next.validation.total);
    demoState.orders.unshift({ id: invoice.id.replace("INV", "SO"), buyer: demoState.buyer.businessName, total: invoice.total, status: "Invoice generated", terms: invoice.terms });
    demoState.cart = {};
    return Promise.resolve(invoice);
  }

  return Promise.resolve(buildDemoState());
}

function buildDemoState() {
  const lines = Object.entries(demoState.cart)
    .map(([sku, quantity]) => {
      const product = demoState.products.find((entry) => entry.sku === sku);
      const unitPrice = getUnitPrice(product, quantity);
      return { product, quantity, unitPrice, lineTotal: unitPrice * quantity };
    })
    .filter((line) => line.product);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const tax = subtotal * 0.18;
  const shipping = subtotal === 0 || subtotal > 250000 ? 0 : 2400;
  const total = subtotal + tax + shipping;
  const problems = [];

  if (!demoState.buyer.approved) problems.push("Buyer approval is required before wholesale prices and checkout are available.");
  if (!lines.length) problems.push("Add at least one SKU to create a bulk order.");
  lines.forEach((line) => {
    if (line.quantity < line.product.moq) problems.push(`${line.product.sku} needs MOQ ${line.product.moq}; current quantity is ${line.quantity}.`);
    if (line.quantity > line.product.stock) problems.push(`${line.product.sku} exceeds available stock of ${line.product.stock}.`);
  });
  if (els.paymentTerms.value === "credit" && demoState.buyer.amountDue + total > demoState.buyer.creditLimit) {
    problems.push(`Credit limit exceeded by ${money(demoState.buyer.amountDue + total - demoState.buyer.creditLimit)}.`);
  }

  return {
    ...demoState,
    products: demoState.products.map((item) => ({ ...item, tiers: item.tiers.map((tier) => ({ ...tier })) })),
    cart: { ...demoState.cart },
    orders: demoState.orders.map((order) => ({ ...order })),
    validation: { lines, subtotal, tax, shipping, total, problems },
  };
}

function renderBuyerStatus() {
  const status = state.buyer.approved ? "Approved buyer" : "Verification pending";
  const detail = state.buyer.approved
    ? "Wholesale prices unlocked. Credit checkout is enabled subject to limit."
    : "Admin must approve KYC before checkout.";

  els.buyerStatusCard.innerHTML = `<strong>${status}</strong><span>${detail}</span>`;
  els.kycStatus.textContent = state.buyer.approved ? "Approved" : "Pending approval";
  els.kycStatus.className = `status-chip ${state.buyer.approved ? "" : "pending"}`;
  els.workflowNotice.textContent = state.buyer.approved
    ? `${demoMode ? "Fast preview mode" : "Spring Boot flow active"}: catalog pricing, RFQ, CSV upload, reorder, credit checkout, and invoice generation are ready.`
    : "Demo flow starts with retailer registration. Use Seller Admin to approve the account and unlock buyer checkout.";
}

function renderCredit() {
  const available = Number(state.buyer.creditLimit) - Number(state.buyer.amountDue);
  const usedPercent = state.buyer.creditLimit ? Math.min(100, (Number(state.buyer.amountDue) / Number(state.buyer.creditLimit)) * 100) : 100;
  els.creditLimit.textContent = money(state.buyer.creditLimit);
  els.amountDue.textContent = money(state.buyer.amountDue);
  els.creditAvailable.textContent = money(Math.max(available, 0));
  els.creditProgress.style.width = `${usedPercent}%`;
  els.creditHealth.textContent = available > 0 ? "Healthy" : "Blocked";
  els.creditHealth.className = `status-chip ${available > 0 ? "" : "blocked"}`;
  els.adminCreditLimit.value = Number(state.buyer.creditLimit);
  els.adminAmountDue.value = Number(state.buyer.amountDue);
}

function renderCatalog() {
  const query = els.skuSearch.value.trim().toLowerCase();
  const products = state.products.filter((product) => {
    const haystack = `${product.sku} ${product.name} ${product.category}`.toLowerCase();
    return haystack.includes(query);
  });

  els.catalogCount.textContent = `${products.length} SKUs`;
  els.catalogBody.innerHTML = products
    .map((product) => {
      const quantity = state.cart[product.sku] || 0;
      const unitPrice = quantity ? getUnitPrice(product, quantity) : Number(product.tiers[0].price);
      const tiers = product.tiers.map((tier) => `${tier.min}+ ${money(tier.price)}`).join(" / ");
      return `
        <tr>
          <td><strong>${product.sku}</strong><br><small>${product.category}</small></td>
          <td>${product.name}</td>
          <td>${product.moq}</td>
          <td>${product.stock.toLocaleString("en-IN")}</td>
          <td><strong>${money(unitPrice)}</strong><br><small>${tiers}</small></td>
          <td>
            <div class="qty-control" data-sku="${product.sku}">
              <button type="button" data-delta="-10">-</button>
              <input value="${quantity}" inputmode="numeric" aria-label="${product.sku} quantity" />
              <button type="button" data-delta="10">+</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderCart() {
  const validation = state.validation;
  els.cartLines.textContent = `${validation.lines.length} lines`;

  if (!validation.lines.length) {
    els.cartBody.innerHTML = `<div class="cart-line"><span>No SKUs added yet.</span><small>Use quantities, CSV upload, or reorder.</small></div>`;
  } else {
    els.cartBody.innerHTML = validation.lines
      .map(({ product, quantity, unitPrice, lineTotal }) => {
        const invalid = quantity < product.moq || quantity > product.stock;
        return `
          <div class="cart-line ${invalid ? "invalid" : ""}">
            <strong><span>${product.sku}</span><span>${money(lineTotal)}</span></strong>
            <span><small>${product.name}</small><small>${quantity} x ${money(unitPrice)}</small></span>
            <small>MOQ ${product.moq} | Stock ${product.stock.toLocaleString("en-IN")}</small>
          </div>
        `;
      })
      .join("");
  }

  els.totalsBox.innerHTML = `
    <div><span>Subtotal</span><span>${money(validation.subtotal)}</span></div>
    <div><span>GST 18%</span><span>${money(validation.tax)}</span></div>
    <div><span>Shipping</span><span>${money(validation.shipping)}</span></div>
    <div><strong>Total</strong><strong>${money(validation.total)}</strong></div>
  `;

  els.validationBox.innerHTML = validation.problems.length
    ? validation.problems.map((problem) => `<p>${problem}</p>`).join("")
    : `<p class="ok">Order passes MOQ, inventory, approval, and credit checks.</p>`;

  els.checkoutBtn.disabled = validation.problems.length > 0;
}

function renderKpis() {
  const available = Number(state.buyer.creditLimit) - Number(state.buyer.amountDue);
  els.kpiSkus.textContent = state.products.length;
  els.kpiCart.textContent = money(state.validation.total);
  els.kpiCredit.textContent = money(Math.max(available, 0));
  els.kpiState.textContent = state.validation.problems.length ? "Blocked" : "Ready";
}

function renderAdmin() {
  els.kycReview.innerHTML = `
    <div>
      <strong>${state.buyer.businessName}</strong>
      <span>GST / Tax ID: ${state.buyer.taxId}</span>
      <span>Email: ${state.buyer.email}</span>
      <span>Requested credit: ${money(state.buyer.requestedCredit)}</span>
    </div>
  `;

  els.adminProducts.innerHTML = state.products
    .map((product) => `
      <tr>
        <td><strong>${product.sku}</strong></td>
        <td>${product.name}</td>
        <td><input data-admin-field="moq" data-sku="${product.sku}" type="number" min="1" value="${product.moq}" /></td>
        <td><input data-admin-field="stock" data-sku="${product.sku}" type="number" min="0" value="${product.stock}" /></td>
        <td><input data-admin-field="tier-0" data-sku="${product.sku}" type="number" min="0" value="${product.tiers[0].price}" /></td>
        <td><input data-admin-field="tier-1" data-sku="${product.sku}" type="number" min="0" value="${product.tiers[1].price}" /></td>
        <td><input data-admin-field="tier-2" data-sku="${product.sku}" type="number" min="0" value="${product.tiers[2].price}" /></td>
      </tr>
    `)
    .join("");

  els.ordersBoard.innerHTML = state.orders
    .map((order) => `
      <div class="order-card">
        <strong>${order.id} - ${money(order.total)}</strong>
        <span>${order.buyer}</span>
        <span>${order.status} | ${order.terms}</span>
      </div>
    `)
    .join("");
}

function renderInvoice() {
  const invoice = state.latestInvoice;
  if (!invoice) {
    els.invoicePanel.innerHTML = `<div class="invoice-empty">Complete checkout to generate an invoice with tax and shipping details.</div>`;
    return;
  }

  els.invoicePanel.innerHTML = `
    <div class="invoice-document">
      <div class="invoice-head">
        <div>
          <p class="eyebrow">Tax invoice</p>
          <h2>${invoice.id}</h2>
          <p>Date: ${invoice.date}<br>BulkFlow Distribution Pvt Ltd<br>GST: 27AABCB4422F1Z8</p>
        </div>
        <div>
          <strong>${invoice.buyer.businessName}</strong>
          <p>${invoice.buyer.taxId}<br>${invoice.buyer.email}<br>${invoice.shippingCity}</p>
          <p>Terms: ${invoice.terms}</p>
        </div>
      </div>
      <table class="invoice-table">
        <thead>
          <tr><th>SKU</th><th>Item</th><th>Qty</th><th>Unit</th><th>Line total</th></tr>
        </thead>
        <tbody>
          ${invoice.lines
            .map((line) => `
              <tr>
                <td>${line.product.sku}</td>
                <td>${line.product.name}</td>
                <td>${line.quantity}</td>
                <td>${money(line.unitPrice)}</td>
                <td>${money(line.lineTotal)}</td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>
      <div class="invoice-total">
        <div><span>Subtotal</span><span>${money(invoice.subtotal)}</span></div>
        <div><span>CGST 9%</span><span>${money(Number(invoice.tax) / 2)}</span></div>
        <div><span>SGST 9%</span><span>${money(Number(invoice.tax) / 2)}</span></div>
        <div><span>Shipping</span><span>${money(invoice.shipping)}</span></div>
        <div><strong>Invoice total</strong><strong>${money(invoice.total)}</strong></div>
      </div>
    </div>
  `;
}

function render() {
  renderBuyerStatus();
  renderCredit();
  renderCatalog();
  renderCart();
  renderKpis();
  renderAdmin();
  renderInvoice();
}

function switchSection(sectionId) {
  els.sections.forEach((section) => section.classList.toggle("active", section.id === sectionId));
  els.navItems.forEach((item) => item.classList.toggle("active", item.dataset.section === sectionId));
}

function showProblem(message) {
  els.validationBox.innerHTML = `<p>${message}</p>`;
}

els.navItems.forEach((item) => item.addEventListener("click", () => switchSection(item.dataset.section)));

els.registrationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(els.registrationForm);
  try {
    await mutate("/api/register", {
      businessName: data.get("businessName"),
      taxId: data.get("taxId"),
      email: data.get("email"),
      requestedCredit: Number(data.get("requestedCredit")) || 0,
    });
    switchSection("admin");
  } catch (error) {
    showProblem(error.message);
  }
});

els.catalogBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-delta]");
  if (!button) return;
  const control = button.closest(".qty-control");
  const sku = control.dataset.sku;
  const quantity = Math.max(0, (state.cart[sku] || 0) + Number(button.dataset.delta));
  await mutate("/api/cart/quantity", { sku, quantity });
});

els.catalogBody.addEventListener("change", async (event) => {
  const input = event.target.closest(".qty-control input");
  if (!input) return;
  await mutate("/api/cart/quantity", {
    sku: input.closest(".qty-control").dataset.sku,
    quantity: Math.max(0, Number.parseInt(input.value, 10) || 0),
  });
});

els.skuSearch.addEventListener("input", renderCatalog);
els.paymentTerms.addEventListener("change", refresh);
els.seedOrderBtn.addEventListener("click", async () => mutate("/api/cart/reorder", {}));

els.checkoutBtn.addEventListener("click", async () => {
  try {
    await api("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ paymentTerms: els.paymentTerms.value, shippingCity: els.shippingCity.value }),
    });
    await refresh();
    switchSection("invoice");
  } catch (error) {
    showProblem(error.message);
  }
});

els.rfqBtn.addEventListener("click", async () => {
  try {
    const response = await api("/api/rfq", { method: "POST", body: JSON.stringify({}) });
    els.validationBox.innerHTML = `<p class="ok">${response.message}</p>`;
  } catch (error) {
    showProblem(error.message);
  }
});

els.csvUpload.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const body = new FormData();
  body.append("file", file);
  try {
    state = await api("/api/cart/upload", { method: "POST", body });
    render();
  } catch (error) {
    showProblem(error.message);
  } finally {
    event.target.value = "";
  }
});

els.approveBtn.addEventListener("click", async () => {
  await mutate("/api/approve", {});
  switchSection("buyer");
});

els.saveCreditBtn.addEventListener("click", async () => {
  await mutate("/api/credit", {
    creditLimit: Number(els.adminCreditLimit.value) || 0,
    amountDue: Number(els.adminAmountDue.value) || 0,
  });
});

els.adminProducts.addEventListener("change", async (event) => {
  const input = event.target.closest("input[data-admin-field]");
  if (!input) return;
  const row = input.closest("tr");
  const sku = input.dataset.sku;
  const product = getProduct(sku);
  const values = [...row.querySelectorAll("input")].map((field) => Number(field.value) || 0);
  state = await api("/api/products", {
    method: "PUT",
    body: JSON.stringify({
      sku,
      moq: Math.max(1, values[0]),
      stock: Math.max(0, values[1]),
      prices: [values[2], values[3], values[4]],
    }),
  });
  render();
});

els.printInvoiceBtn.addEventListener("click", () => {
  if (state?.latestInvoice) window.print();
});

refresh();
