/* ==========================================================
   honey bee — script.js (shared by every page)
   - product.html : load products.json, render cards, filter
   - order.html   : fill #items / #total from URL, POST order
   - admin.html   : load published Google Sheet CSV into a table
   ========================================================== */

const ORDER_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzxyiAMYpi8RU0lv7rBrmrNpGeJS_G8iMHUxgD_5c9XG4Tj6VTWfgJLBnudZMlA4s3S/exec";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQjJCS4fYV3-i7uLycba9xBbRFbGK8FA3FkRHO1tQvMWTs9ikesdvFbHYqmoOHU-JegguEimSsOzXQk/pub?gid=0&single=true&output=csv";

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("product-list")) initProductPage();
  if (document.getElementById("orderForm")) initOrderPage();
  if (document.querySelector("#ordersTable tbody")) initAdminPage();
});

/* ----------------------------------------------------------
   Helpers
---------------------------------------------------------- */
function formatPrice(n) {
  return Number(n).toLocaleString("th-TH") + " บาท";
}

function setField(el, value) {
  if (!el) return;
  if ("value" in el) el.value = value;
  else el.textContent = value;
}

/* ----------------------------------------------------------
   1) product.html
---------------------------------------------------------- */
async function initProductPage() {
  const list = document.getElementById("product-list");
  const filterBar = document.getElementById("filter-bar");

  let products = [];
  try {
    const res = await fetch("products.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    products = await res.json();
  } catch (err) {
    console.error(err);
    list.innerHTML = '<p class="text-center">ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
    return;
  }

  // Build filter buttons: ทั้งหมด + one per product name
  const filters = ["ทั้งหมด", ...products.map((p) => p.name)];
  if (filterBar) {
    filterBar.innerHTML = "";
    filters.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.textContent = label;
      btn.dataset.filter = label;
      btn.addEventListener("click", () => applyFilter(label));
      filterBar.appendChild(btn);
    });
  }

  function applyFilter(label) {
    const shown =
      label === "ทั้งหมด" ? products : products.filter((p) => p.name === label);
    renderProducts(shown);
    if (filterBar) {
      filterBar.querySelectorAll(".filter-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.filter === label);
      });
    }
  }

  function renderProducts(items) {
    list.innerHTML = "";
    list.classList.add("product-grid");

    if (items.length === 0) {
      list.innerHTML = '<p class="text-center">ไม่พบสินค้า</p>';
      return;
    }

    items.forEach((p) => {
      const card = document.createElement("article");
      card.className = "product-card";
      card.dataset.id = p.id;

      const img = document.createElement("img");
      img.className = "thumb";
      img.src = p.image;
      img.alt = p.name;
      img.loading = "lazy";

      const title = document.createElement("h3");
      title.textContent = p.name;

      const price = document.createElement("div");
      price.className = "price";
      price.textContent = formatPrice(p.price);

      const btn = document.createElement("a");
      btn.className = "btn btn-gold btn-sm";
      btn.textContent = "สั่งซื้อ";
      btn.href =
        "order.html?item=" + encodeURIComponent(p.name) +
        "&price=" + encodeURIComponent(p.price);

      card.append(img, title, price, btn);
      list.appendChild(card);
    });
  }

  // Auto-filter from ?mood=xxx (also accepts ?สินค้า=xxx from index.html)
  const params = new URLSearchParams(window.location.search);
  const wanted = (params.get("mood") || params.get("สินค้า") || "").trim().toLowerCase();
  const match = filters.find((f) => f.toLowerCase() === wanted);
  applyFilter(match || "ทั้งหมด");
}

/* ----------------------------------------------------------
   2) order.html
---------------------------------------------------------- */
function initOrderPage() {
  const params = new URLSearchParams(window.location.search);
  const item = params.get("item") || "";
  const price = params.get("price") || "";

  // Fill BOTH fields as soon as the page loads
  setField(document.getElementById("items"), item);
  setField(document.getElementById("total"), price);

  const form = document.getElementById("orderForm");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const val = (id) => {
      const el = document.getElementById(id);
      if (!el) return "";
      return ("value" in el ? el.value : el.textContent).trim();
    };

    const payload = {
      customerName: val("customerName"),
      contact: val("contact"),
      items: val("items"),
      total: val("total"),
      note: val("note"),
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    })
      .then(() => {
        window.location.href = "thankyou.html";
      })
      .catch((error) => {
        console.error(error);
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        if (submitBtn) submitBtn.disabled = false;
      });
  });
}

/* ----------------------------------------------------------
   3) admin.html
---------------------------------------------------------- */

// Minimal CSV parser: handles quoted fields, "" escapes, commas and
// newlines inside quotes, and both \n and \r\n line endings.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  // last field / row without trailing newline
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

async function initAdminPage() {
  const tbody = document.querySelector("#ordersTable tbody");
  const COLS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

  const message = (text) => {
    tbody.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = COLS;
    td.textContent = text;
    tr.appendChild(td);
    tbody.appendChild(tr);
  };

  message("กำลังโหลดข้อมูล...");

  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();

    const rows = parseCSV(text)
      .slice(1) // skip header row
      .filter((r) => r.some((c) => c.trim() !== ""))
      .reverse(); // newest first (sheet rows are appended in time order)

    if (rows.length === 0) {
      message("ยังไม่มีรายการสั่งซื้อ");
      return;
    }

    tbody.innerHTML = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      for (let i = 0; i < COLS; i++) {
        const td = document.createElement("td");
        td.textContent = r[i] !== undefined ? r[i] : "";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    message("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
  }
}
