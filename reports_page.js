import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    query,
    where,
    orderBy
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

// State variables
let reportMode = 'daily';
window.fetchedHistoryOrders = [];
window.fetchedHistoryTitle = "";

// Custom Rounding: > 0.4 decimal rounds up, <= 0.4 decimal rounds down
window.customRound = (val) => {
    const floorVal = Math.floor(val);
    const decimal = Number((val - floorVal).toFixed(4));
    return decimal > 0.4 ? Math.ceil(val) : floorVal;
};

// Real-time Date Display
document.getElementById('current-date-display').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

window.switchReportMode = (mode) => {
    reportMode = mode;
    document.getElementById('btn-daily-report').classList.toggle('active', mode === 'daily');
    document.getElementById('btn-weekly-report').classList.toggle('active', mode === 'weekly');
    document.getElementById('btn-monthly-report').classList.toggle('active', mode === 'monthly');
    
    document.getElementById('daily-picker-container').style.display = mode === 'daily' ? 'flex' : 'none';
    document.getElementById('weekly-picker-container').style.display = mode === 'weekly' ? 'flex' : 'none';
    document.getElementById('monthly-picker-container').style.display = mode === 'monthly' ? 'flex' : 'none';
    
    document.getElementById('monthly-results').style.display = 'none';
};

window.fetchHistoryStats = async () => {
    const dateInput = document.getElementById('history-date-picker').value;
    const weekInput = document.getElementById('history-week-picker').value;
    const monthInput = document.getElementById('history-month-picker').value;

    let target = '';
    if (reportMode === 'daily') target = dateInput;
    else if (reportMode === 'weekly') target = weekInput;
    else if (reportMode === 'monthly') target = monthInput;

    if (!target) {
        alert("Please select a date/month to search.");
        return;
    }

    const loader = document.getElementById('month-loader');
    const results = document.getElementById('monthly-results');
    const noData = document.getElementById('month-no-data');

    // Show loading
    loader.style.display = 'block';
    results.style.display = 'none';
    if (noData) noData.style.display = 'none';

    try {
        const q = query(collection(db, "orders"));
        const querySnapshot = await getDocs(q);

        let rev = 0, csh = 0, onl = 0, cnt = 0;
        const matchingOrders = [];

        let startDate, endDate;
        if (reportMode === 'weekly') {
            startDate = new Date(weekInput);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const orderDate = data.date;
            if (!orderDate) return;

            let matches = false;
            if (reportMode === 'daily' && orderDate === dateInput) {
                matches = true;
            } else if (reportMode === 'weekly') {
                const orderTime = new Date(orderDate);
                orderTime.setHours(0, 0, 0, 0);
                if (orderTime >= startDate && orderTime <= endDate) {
                    matches = true;
                }
            } else if (reportMode === 'monthly' && orderDate.startsWith(monthInput)) {
                matches = true;
            }

            if (matches) {
                matchingOrders.push({ id: docSnap.id, ...data });
                rev += (data.total || 0);
                cnt += (data.quantity || 0);
                
                if (data.paymentMethod === 'online') {
                    onl += (data.total || 0);
                } else if (data.paymentMethod === 'both') {
                    onl += (data.onlineAmount || 0);
                    csh += (data.cashAmount || 0);
                } else {
                    csh += (data.total || 0);
                }
            }
        });

        // Store matching orders globally
        window.fetchedHistoryOrders = matchingOrders;
        window.fetchedHistoryTitle = reportMode === 'daily' ? `Daily Report (${dateInput})` : (reportMode === 'weekly' ? `Weekly Report (${weekInput} to ${new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]})` : `Monthly Report (${monthInput})`);

        loader.style.display = 'none';

        if (rev === 0) {
            if (noData) noData.style.display = 'block';
        } else {
            // Render Stats
            document.getElementById('m-revenue').textContent = `₹${window.customRound(rev).toLocaleString('en-IN')}`;
            document.getElementById('m-cash').textContent = `₹${window.customRound(csh).toLocaleString('en-IN')}`;
            document.getElementById('m-online').textContent = `₹${window.customRound(onl).toLocaleString('en-IN')}`;
            document.getElementById('m-count').textContent = cnt;

            // Render Detailed History
            const detailedHistoryContainer = document.getElementById('detailed-history-container');
            detailedHistoryContainer.innerHTML = '';
            
            // Sort matching orders by date desc, then by timestamp desc
            matchingOrders.sort((a, b) => {
                if (a.date !== b.date) {
                    return b.date.localeCompare(a.date);
                }
                const timeA = a.timestamp?.seconds || 0;
                const timeB = b.timestamp?.seconds || 0;
                return timeB - timeA;
            });

            matchingOrders.forEach((order, idx) => {
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
                        itemsHTML += `<div class="bill-item-row" style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="font-weight:500;">${it.name} (x${it.quantity})</span><span style="font-weight:700; color:var(--primary);">₹${window.customRound(it.total)}</span></div>`;
                    });
                } else {
                    itemsHTML = `<div class="bill-item-row" style="display:flex; justify-content:space-between; font-size:0.85rem;"><span style="font-weight:500;">${order.name} (x${order.quantity})</span><span style="font-weight:700; color:var(--primary);">₹${window.customRound(order.total)}</span></div>`;
                }

                let paymentLabel = "";
                if (order.paymentMethod === 'both') {
                    paymentLabel = `Split (Cash: ₹${window.customRound(order.cashAmount || 0)}, Online: ₹${window.customRound(order.onlineAmount || 0)})`;
                } else {
                    paymentLabel = order.paymentMethod?.toUpperCase() || 'CASH';
                }

                billCard.innerHTML = `
                    <div class="bill-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #edf2f7; padding-bottom:8px;">
                        <span class="bill-id" style="font-weight:800; color:var(--primary); font-size:0.9rem;">#${matchingOrders.length - idx} Bill (${order.date})</span>
                        <span class="bill-time" style="font-size:0.75rem; color:var(--text-muted);"><i class="far fa-clock"></i> ${timeStr || '---'}</span>
                    </div>
                    <div class="bill-items-list" style="display:flex; flex-direction:column; gap:6px; margin: 5px 0;">
                        ${itemsHTML}
                    </div>
                    <div class="bill-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #edf2f7; padding-top:8px; font-size:0.8rem;">
                        <span style="font-weight:700; color:${order.paymentMethod === 'online' ? '#3498db' : (order.paymentMethod === 'both' ? 'var(--accent)' : '#27ae60')}">
                            <i class="fas fa-credit-card"></i> ${paymentLabel}
                        </span>
                        <span style="font-weight:800; font-size:0.95rem; color:var(--primary);">Total: ₹${window.customRound(order.total)}</span>
                    </div>
                `;
                detailedHistoryContainer.appendChild(billCard);
            });

            results.style.display = 'block';
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        loader.style.display = 'none';
        alert("Data sync error. Please try again.");
    }
};

window.downloadCustomReportPDF = () => {
    if (!window.fetchedHistoryOrders || window.fetchedHistoryOrders.length === 0) {
        alert("No data available to export.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(44, 62, 80);
    doc.text("Amma Mess Sales Report", 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(127, 140, 141);
    doc.text(window.fetchedHistoryTitle || "Sales Report", 14, 30);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 36);

    const tableData = [];
    let idx = 1;
    let grandTotal = 0;
    let grandCash = 0;
    let grandOnline = 0;

    window.fetchedHistoryOrders.forEach(o => {
        const orderDate = o.date || "Unknown Date";
        const sessionName = o.session || "morning";
        const paymentType = o.paymentMethod || "cash";
        const orderTotal = o.total || 0;
        
        grandTotal += orderTotal;
        if (paymentType === 'online') {
            grandOnline += orderTotal;
        } else if (paymentType === 'both') {
            grandOnline += (o.onlineAmount || 0);
            grandCash += (o.cashAmount || 0);
        } else {
            grandCash += orderTotal;
        }

        if (o.items) {
            o.items.forEach(item => {
                tableData.push([
                    idx++,
                    orderDate,
                    sessionName.toUpperCase(),
                    item.name,
                    item.quantity,
                    `Rs. ${window.customRound(item.price)}`,
                    `Rs. ${window.customRound(item.total)}`,
                    paymentType === 'both' ? `SPLIT (Cash: ${window.customRound(o.cashAmount)}, Online: ${window.customRound(o.onlineAmount)})` : paymentType.toUpperCase()
                ]);
            });
        } else {
            tableData.push([
                idx++,
                orderDate,
                sessionName.toUpperCase(),
                o.name,
                o.quantity,
                `Rs. ${window.customRound(o.price)}`,
                `Rs. ${window.customRound(o.total)}`,
                paymentType === 'both' ? `SPLIT (Cash: ${window.customRound(o.cashAmount)}, Online: ${window.customRound(o.onlineAmount)})` : paymentType.toUpperCase()
            ]);
        }
    });

    doc.autoTable({
        startY: 44,
        head: [['#', 'Date', 'Session', 'Item Name', 'Qty', 'Price', 'Total', 'Payment']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [44, 62, 80] },
    });

    const finalY = doc.lastAutoTable.finalY + 15;

    // Footer Summary
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text(`Total Sales: Rs. ${window.customRound(grandTotal).toLocaleString('en-IN')}`, 14, finalY);
    doc.text(`Cash portion: Rs. ${window.customRound(grandCash).toLocaleString('en-IN')}`, 14, finalY + 8);
    doc.text(`Online portion: Rs. ${window.customRound(grandOnline).toLocaleString('en-IN')}`, 14, finalY + 16);

    const filename = `Amma_Mess_Report_${(window.fetchedHistoryTitle || "Report").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    doc.save(filename);
    
    // Toast
    const toast = document.getElementById('toast');
    toast.textContent = "PDF Report downloaded!";
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
};

// Initialize dates at start
const now = new Date();
const dateStr = now.toISOString().split('T')[0];
document.getElementById('history-date-picker').value = dateStr;
document.getElementById('history-week-picker').value = dateStr;
document.getElementById('history-month-picker').value = dateStr.substring(0, 7);

// Fetch stats automatically for today
window.fetchHistoryStats();
