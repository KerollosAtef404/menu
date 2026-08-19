// 1. تهيئة Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDpgEqkiVE4W5iwZk29QDyxYmOS01xltDY",
  authDomain: "deir-restaurant-db.firebaseapp.com",
  databaseURL: "https://deir-restaurant-db-default-rtdb.firebaseio.com",
  projectId: "deir-restaurant-db",
  storageBucket: "deir-restaurant-db.firebasestorage.app",
  messagingSenderId: "843725289967",
  appId: "1:843725289967:web:3487430a998a16195e5e1a"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// التأكد من تسجيل دخول الكاشير وحماية الصفحة
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    // الكاشير مسجل دخول - ابدأ الاستماع للطلبات
    listenToOrders();
  } else {
    // غير مسجل دخول - إعادة توجيه لصفحة اللوجين فوراً
    window.location.href = "login.html";
  }
});

let allOrders = {};
let currentTab = 'pending';

function getOrderCycleDate() {
  const now = new Date();
  if (now.getHours() < 8) {
    now.setDate(now.getDate() - 1);
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateHeaderInfo() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' };
  const dateStr = now.toLocaleDateString('ar-EG', options);
  document.getElementById('header-date').innerText = `📅 ${dateStr}`;
}

function listenToOrders() {
  database.ref('orders').on('value', (snapshot) => {
    allOrders = snapshot.val() || {};
    autoCleanOrders();
    updateCountsAndRender();
  });
}

function autoCleanOrders() {
  const currentCycle = getOrderCycleDate();
  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  Object.keys(allOrders).forEach(key => {
    const order = allOrders[key];

    if (order.cycleDate && order.cycleDate < currentCycle) {
      database.ref(`orders/${key}`).remove();
      delete allOrders[key];
      return;
    }

    if (order.status === 'rejected' && order.rejectedAt) {
      if (now - order.rejectedAt > ONE_HOUR_MS) {
        database.ref(`orders/${key}`).remove();
        delete allOrders[key];
        return;
      }
    }
  });
}

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  applyFilters();
}

function updateCountsAndRender() {
  let pendingCount = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;

  Object.values(allOrders).forEach(order => {
    const status = order.status || 'pending';
    if (status === 'pending') pendingCount++;
    if (status === 'accepted') acceptedCount++;
    if (status === 'rejected') rejectedCount++;
  });

  document.getElementById('cnt-pending').innerText = pendingCount;
  document.getElementById('cnt-accepted').innerText = acceptedCount;
  document.getElementById('cnt-rejected').innerText = rejectedCount;
  document.getElementById('header-total-count').innerText = `📊 إجمالي أوردرات اليوم: ${Object.keys(allOrders).length}`;

  applyFilters();
}

function applyFilters() {
  const searchVal = document.getElementById('search-box').value.trim().toLowerCase();
  const container = document.getElementById('orders-container');
  container.innerHTML = '';

  const filteredKeys = Object.keys(allOrders).filter(key => {
    const order = allOrders[key];
    const matchTab = (order.status || 'pending') === currentTab;
    const orderNum = String(order.orderNumber || order.orderId || '');
    const phoneNum = String(order.phone || '');
    const matchSearch = searchVal === '' || orderNum.toLowerCase().includes(searchVal) || phoneNum.includes(searchVal);
    return matchTab && matchSearch;
  });

  if (filteredKeys.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #777; padding: 20px;">لا توجد طلبات في هذه الخانة حالياً.</p>';
    return;
  }

  filteredKeys.reverse().forEach(key => {
    const order = allOrders[key];
    const card = createOrderCard(key, order);
    container.appendChild(card);
  });
}

// عرض الكارت للكاشير شامل التليفون والملاحظات
function createOrderCard(key, order) {
  const card = document.createElement('div');
  const status = order.status || 'pending';
  card.className = `order-card ${status}`;

  let itemsHTML = '';
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach(item => {
      itemsHTML += `<div style="display:flex; justify-content:space-between; margin:4px 0;">
        <span>${item.name} (x${item.quantity})</span>
        <span><b>${item.price * item.quantity} ج.م</b></span>
      </div>`;
    });
  }

  const dateFormatted = order.createdAt ? new Date(order.createdAt).toLocaleString('ar-EG') : '';

  card.innerHTML = `
    <div class="card-header">
      <span class="status-badge status-${status}">
        ${status === 'pending' ? 'قيد المراجعة' : status === 'accepted' ? 'مقبول' : 'مرفوض'}
      </span>
      <span>${order.orderId || ('#' + order.orderNumber)}</span>
    </div>

    <div style="color:#666; font-size:0.85rem; margin: 5px 0;">📅 ${dateFormatted}</div>
    <div style="color:#1b4332; font-weight:bold; margin: 5px 0; font-size: 1rem;">📞 التليفون: <a href="tel:${order.phone}" style="color:#2a9d8f; text-decoration:none;">${order.phone || 'غير محدد'}</a></div>
    ${order.notes && order.notes !== 'لا يوجد' ? `<div style="background:#fff3cd; color:#856404; padding:6px 10px; border-radius:6px; font-size:0.9rem; margin:6px 0;">📝 <b>ملاحظات:</b> ${order.notes}</div>` : ''}

    <hr style="border:0; border-top:1px dashed #ddd; margin:8px 0;">

    <div class="items-list">${itemsHTML}</div>
    <div style="font-size:1.1rem; color:#d90429; font-weight:bold; margin-top:8px;">الإجمالي: ${order.totalAmount} ج.م</div>

    ${order.screenshot ? `<img src="${order.screenshot}" class="order-img" alt="إيصال التحويل">` : ''}

    <div class="actions-bar">
      ${status !== 'accepted' ? `<button class="btn-accept" onclick="acceptAndPrint('${key}')">✔ قبول وطباعة</button>` : ''}
      ${status !== 'rejected' ? `<button class="btn-reject" onclick="changeStatus('${key}', 'rejected')">✖ رفض</button>` : ''}
      <button class="btn-delete" onclick="deleteOrder('${key}')">🗑️</button>
    </div>
  `;

  return card;
}

// قبول وطباعة الإيصال الحراري شامل الملاحظات والتليفون
function acceptAndPrint(key) {
  const order = allOrders[key];
  if (!order) return;

  const receiptArea = document.getElementById('thermal-receipt');
  
  let itemsRows = '';
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach(i => {
      itemsRows += `<tr>
        <td>${i.name} x${i.quantity}</td>
        <td style="text-align:left">${i.price * i.quantity}</td>
      </tr>`;
    });
  }

  receiptArea.innerHTML = `
    <div class="receipt-header">
      <h3 style="margin:0;">مطعم دير بياض</h3>
      <p style="margin:3px 0; font-size:11px;">أوردر رقم: ${order.orderId || ('#' + order.orderNumber)}</p>
      <p style="margin:0; font-size:10px;">${new Date().toLocaleString('ar-EG')}</p>
      <p style="margin:3px 0; font-size:11px; font-weight:bold;">تليفون: ${order.phone || 'بدون'}</p>
    </div>
    <table class="receipt-table">
      <thead><tr><th>الصنف</th><th style="text-align:left">السعر</th></tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    ${order.notes && order.notes !== 'لا يوجد' ? `<p style="font-size:11px; border:1px dashed #000; padding:4px; margin:5px 0;"><b>ملاحظات:</b> ${order.notes}</p>` : ''}
    <div class="receipt-total">
      الإجمالي: ${order.totalAmount} ج.م
    </div>
    <p style="text-align:center; font-size:10px; margin-top:10px;">شكراً لزيارتكم! 🙏</p>
  `;

  receiptArea.style.display = 'block';

  const updates = {
    status: 'accepted',
    screenshot: null
  };

  database.ref(`orders/${key}`).update(updates)
    .then(() => {
      window.print();
      receiptArea.style.display = 'none';
    })
    .catch(err => alert("حدث خطأ أثناء القبول: " + err.message));
}

function changeStatus(key, newStatus) {
  const updates = {};
  updates['status'] = newStatus;
  
  if (newStatus === 'rejected') {
    updates['rejectedAt'] = Date.now();
  }

  database.ref(`orders/${key}`).update(updates)
    .catch(err => alert("حدث خطأ: " + err.message));
}

function deleteOrder(key) {
  if (confirm("هل أنت تأكد من حذف هذا الأوردر نهائياً؟")) {
    database.ref(`orders/${key}`).remove();
  }
}

// التشغيل والتهيئة المبدئية
updateHeaderInfo();
setInterval(autoCleanOrders, 5 * 60 * 1000);
