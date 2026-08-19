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

let cart = [];

// حساب دورة اليوم (الساعة 8 صباحاً)
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

// التنقل بين الأقسام
function switchMeal(mealType) {
  const sections = document.querySelectorAll('.meal-section');
  sections.forEach(sec => sec.style.display = 'none');

  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  const targetSection = document.getElementById(mealType);
  if (targetSection) {
    targetSection.style.display = 'block';
  }
}

// إضافة صنف للسلة
function addToCart(itemName, itemPrice, qtyInputId) {
  const qtyInput = document.getElementById(qtyInputId);
  const quantity = parseInt(qtyInput.value);

  if (isNaN(quantity) || quantity < 1) {
    alert("يرجى إدخال كمية صحيحة!");
    return;
  }

  const existingItemIndex = cart.findIndex(item => item.name === itemName);

  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += quantity;
  } else {
    cart.push({
      name: itemName,
      price: itemPrice,
      quantity: quantity
    });
  }

  qtyInput.value = 1;
  renderCart();
}

// عرض السلة
function renderCart() {
  const cartList = document.getElementById('cart-items-list');
  const totalPriceElement = document.getElementById('cart-total-price');
  const checkoutBtn = document.getElementById('checkout-btn');

  cartList.innerHTML = '';

  if (cart.length === 0) {
    cartList.innerHTML = '<li class="empty-msg">السلة فارغة حالياً</li>';
    totalPriceElement.innerText = '0 ج.م';
    checkoutBtn.disabled = true;
    return;
  }

  let total = 0;

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.name} (x${item.quantity})</span>
      <span>${itemTotal} ج.م <button onclick="removeFromCart(${index})" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold; margin-right:8px;">✕</button></span>
    `;
    cartList.appendChild(li);
  });

  totalPriceElement.innerText = `${total} ج.م`;
  checkoutBtn.disabled = false;
}

// حذف صنف
function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

// الانتقال لخطوة الدفع
function goToPayment() {
  if (cart.length === 0) return;

  const paymentSection = document.getElementById('payment-section');
  paymentSection.style.display = 'block';

  document.getElementById('order-id-display').value = "سيتم استخراج الرقم التسلسلي تلقائياً عند تأكيد الطلب";
  paymentSection.scrollIntoView({ behavior: 'smooth' });
}

// إرسال الطلب مع رقم التليفون والملاحظات
function submitOrder() {
  const phoneInput = document.getElementById('phone-input').value.trim();
  const notesInput = document.getElementById('order-notes-input').value.trim();
  const fileInput = document.getElementById('screenshot-input');
  const confirmBtn = document.querySelector('.confirm-btn');

  // التحقق من إدخال رقم الهاتف
  if (!phoneInput || phoneInput.length < 10) {
    alert("يرجى إدخال رقم هاتف صحيح للتواصل!");
    return;
  }

  // التحقق من رفع السكرين شوت
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("يرجى إرفاق صورة السكرين شوت الخاصة بتم التحويل أولاً!");
    return;
  }

  confirmBtn.disabled = true;
  confirmBtn.innerText = "جاري معالجة الأوردر واستخراج الرقم...";

  const currentCycleDate = getOrderCycleDate();
  const counterRef = database.ref('daily_counters/' + currentCycleDate);

  // زيادة العداد اليومي
  counterRef.transaction((currentValue) => {
    return (currentValue || 0) + 1;
  }, (error, committed, snapshot) => {
    if (error || !committed) {
      alert("حدث خطأ أثناء استخراج رقم الأوردر: " + (error ? error.message : "يرجى المحاولة مجدداً"));
      confirmBtn.disabled = false;
      confirmBtn.innerText = "تأكيد الدفع وإرسال الطلب 🚀";
      return;
    }

    const orderNumber = snapshot.val();
    const displayOrderId = `#${orderNumber}`;
    const dbOrderKey = `${currentCycleDate}_${orderNumber}`;

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
      const imageBase64 = e.target.result;
      
      let totalAmount = 0;
      cart.forEach(item => totalAmount += (item.price * item.quantity));

      const orderData = {
        orderId: displayOrderId,
        orderNumber: orderNumber,
        cycleDate: currentCycleDate,
        phone: phoneInput,
        notes: notesInput || 'لا يوجد',
        items: cart,
        totalAmount: totalAmount,
        screenshot: imageBase64,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // حفظ الأوردر في Firebase
      database.ref('orders/' + dbOrderKey).set(orderData)
        .then(() => {
          localStorage.setItem('lastOrder', JSON.stringify(orderData));
          window.location.href = "success.html";
        })
        .catch((err) => {
          alert("حدث خطأ في حفظ الأوردر: " + err.message);
          confirmBtn.disabled = false;
          confirmBtn.innerText = "تأكيد الدفع وإرسال الطلب 🚀";
        });
    };

    reader.readAsDataURL(file);
  });
}