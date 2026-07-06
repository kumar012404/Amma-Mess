import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    query,
    where,
    onSnapshot,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Firebase Setup ---
const firebaseConfig = {
    apiKey: "AIzaSyCU6pM8XGyBF15O_7Fe7pQSxZWtu4PG8ns",
    authDomain: "amma-mess.firebaseapp.com",
    projectId: "amma-mess",
    storageBucket: "amma-mess.firebasestorage.app",
    messagingSenderId: "744035726002",
    appId: "1:744035726002:web:2905c256baed62b2c6cfab"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const today = new Date().toISOString().split('T')[0];

// Custom Rounding Helper
const customRound = (val) => {
    const floorVal = Math.floor(val);
    const decimal = Number((val - floorVal).toFixed(4));
    return decimal > 0.4 ? Math.ceil(val) : floorVal;
};

// Toast notification helper
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// Display Date
document.getElementById('current-date-display').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// Real-time listener for today's sales logs
const q = query(
    collection(db, "orders"),
    where("date", "==", today)
);

const loader = document.getElementById('history-loader');
const noData = document.getElementById('history-no-data');
const container = document.getElementById('detailed-history-container');

onSnapshot(q, (snapshot) => {
    loader.style.display = 'none';
    container.innerHTML = '';

    if (snapshot.empty) {
        noData.style.display = 'block';
        return;
    }
    
    noData.style.display = 'none';

    // Sort in memory (descending by timestamp)
    const docs = [];
    snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0) || b.timestamp - a.timestamp);

    docs.forEach((order, idx) => {
        let timeStr = "";
        if (order.timestamp) {
            try {
                const date = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
                timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
        }

        const billCard = document.createElement('div');
        billCard.className = 'detailed-bill-card';
        billCard.style.background = '#f8fafc';
        billCard.style.border = '1px solid #edf2f7';
        billCard.style.padding = '20px';
        billCard.style.borderRadius = '16px';
        billCard.style.display = 'flex';
        billCard.style.flexDirection = 'column';
        billCard.style.gap = '10px';

        let itemsHTML = '';
        if (order.items) {
            order.items.forEach(it => {
                itemsHTML += `<div class="bill-item-row" style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="font-weight:500;">${it.name} (x${it.quantity})</span><span style="font-weight:700; color:var(--primary);">₹${customRound(it.total)}</span></div>`;
            });
        } else {
            itemsHTML = `<div class="bill-item-row" style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="font-weight:500;">${order.name} (x${order.quantity})</span><span style="font-weight:700; color:var(--primary);">₹${customRound(order.total)}</span></div>`;
        }

        let paymentLabel = "";
        if (order.paymentMethod === 'both') {
            paymentLabel = `Split (Cash: ₹${customRound(order.cashAmount || 0)}, Online: ₹${customRound(order.onlineAmount || 0)})`;
        } else {
            paymentLabel = order.paymentMethod?.toUpperCase() || 'CASH';
        }

        billCard.innerHTML = `
            <div class="bill-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #edf2f7; padding-bottom:8px;">
                <span class="bill-id" style="font-weight:800; color:var(--primary); font-size:0.9rem;">#${docs.length - idx} Bill</span>
                <span class="bill-time" style="font-size:0.75rem; color:var(--text-muted);"><i class="far fa-clock"></i> ${timeStr || '---'}</span>
            </div>
            <div class="bill-items-list" style="display:flex; flex-direction:column; gap:6px; margin: 5px 0;">
                ${itemsHTML}
            </div>
            <div class="bill-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #edf2f7; padding-top:8px; font-size:0.8rem;">
                <span style="font-weight:700; color:${order.paymentMethod === 'online' ? '#3498db' : (order.paymentMethod === 'both' ? 'var(--accent)' : '#27ae60')}">
                    <i class="fas fa-credit-card"></i> ${paymentLabel}
                </span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:800; font-size:0.95rem; color:var(--primary);">Total: ₹${customRound(order.total)}</span>
                    <button class="delete-order-btn" style="border:none; background:#fee2e2; color:#ef4444; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;" data-id="${order.id}" data-name="Bill #${docs.length - idx}">
                        <i class="fas fa-trash-alt" style="font-size: 0.75rem;"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(billCard);
    });

    // Bind delete actions
    container.querySelectorAll('.delete-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const orderId = btn.getAttribute('data-id');
            const orderName = btn.getAttribute('data-name');
            
            if (confirm(`Are you sure you want to delete ${orderName}?`)) {
                try {
                    await deleteDoc(doc(db, "orders", orderId));
                    showToast(`${orderName} deleted successfully.`);
                } catch (error) {
                    console.error("Error deleting order:", error);
                    alert("Delete failed.");
                }
            }
        });
    });
});
