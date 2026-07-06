// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    onSnapshot,
    setDoc,
    doc,
    deleteDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. Firebase Configuration ---
// REPLACE WITH YOUR OWN CONFIG FROM FIREBASE CONSOLE
const firebaseConfig = {
    apiKey: "AIzaSyCU6pM8XGyBF15O_7Fe7pQSxZWtu4PG8ns",
    authDomain: "amma-mess.firebaseapp.com",
    projectId: "amma-mess",
    storageBucket: "amma-mess.firebasestorage.app",
    messagingSenderId: "744035726002",
    appId: "1:744035726002:web:2905c256baed62b2c6cfab"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 2. State & Constants ---
let currentSession = 'morning';
let currentPaymentMethod = 'cash';
let editingItemId = null;
let cart = []; // New: Temporary Cart
window.currentItemStats = {}; // Global track for popular items
const today = new Date().toISOString().split('T')[0];

// Custom Rounding: > 0.4 decimal rounds up, <= 0.4 decimal rounds down
window.customRound = (val) => {
    const floorVal = Math.floor(val);
    const decimal = Number((val - floorVal).toFixed(4));
    return decimal > 0.4 ? Math.ceil(val) : floorVal;
};

// Display today's date
document.getElementById('current-date-display').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// --- 3. Core Functions ---

/**
 * Toggle Menu Management Panel
 */
window.toggleManagePanel = () => {
    const panel = document.getElementById('manage-panel');
    const isClosing = panel.style.display !== 'none';
    panel.style.display = isClosing ? 'none' : 'block';

    if (isClosing) {
        resetForm();
    } else {
        loadManageItemsList();
    }
};

async function loadManageItemsList() {
    const listContainer = document.getElementById('manage-items-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted); grid-column: 1/-1;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const q = query(collection(db, "items"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        listContainer.innerHTML = '';

        if (querySnapshot.empty) {
            listContainer.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">No items in menu yet.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const id = docSnap.id;
            const row = document.createElement('div');
            row.className = 'manage-item-row';
            row.style.background = '#f8fafc';
            row.style.padding = '12px';
            row.style.borderRadius = '12px';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '12px';
            row.style.border = '1px solid #edf2f7';

            row.innerHTML = `
                        <img src="${item.image || ''}" style="width: 45px; height: 45px; border-radius: 8px; object-fit: cover; background: #eee;" onerror="this.src='https://via.placeholder.com/50'">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 700; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${item.session.toUpperCase()} • ₹${item.price}</div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button onclick="window.editItem('${id}', '${item.name.replace(/'/g, "\\'")}', ${item.price}, '${item.session}', '${item.image || ''}', ${item.defaultQty || 1})" 
                                    style="border: none; background: #3498db; color: white; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-pencil-alt" style="font-size: 0.8rem;"></i>
                            </button>
                            <button onclick="window.deleteItem('${id}', '${item.name.replace(/'/g, "\\'")}')" 
                                    style="border: none; background: #e74c3c; color: white; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-trash" style="font-size: 0.8rem;"></i>
                            </button>
                        </div>
                    `;
            listContainer.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading manage list:", error);
        listContainer.innerHTML = '<p style="color: red; grid-column: 1/-1;">Error loading items.</p>';
    }
}

// Image Upload Logic
let uploadedImageBase64 = null;

const imageUploadInput = document.getElementById('image-upload');
const uploadStatusText = document.getElementById('upload-status');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeUploadedImageBtn = document.getElementById('remove-uploaded-image');

if (imageUploadInput) {
    imageUploadInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        uploadStatusText.textContent = 'Reading file...';

        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                // Compress using Canvas
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 250;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Save as JPEG with 0.7 quality
                uploadedImageBase64 = canvas.toDataURL('image/jpeg', 0.7);

                // Update UI
                imagePreview.src = uploadedImageBase64;
                imagePreviewContainer.style.display = 'block';
                uploadStatusText.textContent = file.name;

                // Clear text input URL to avoid confusion
                document.getElementById('new-item-image').value = '';
            };
            img.onerror = function () {
                uploadStatusText.textContent = 'Invalid image file';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

if (removeUploadedImageBtn) {
    removeUploadedImageBtn.addEventListener('click', function () {
        uploadedImageBase64 = null;
        imageUploadInput.value = '';
        imagePreview.src = '';
        imagePreviewContainer.style.display = 'none';
        uploadStatusText.textContent = 'No file chosen';
    });
}

function resetForm() {
    editingItemId = null;
    document.getElementById('add-item-form').reset();
    const btn = document.querySelector('.save-item-btn');
    btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Save to Menu';
    document.querySelector('.panel-header h3').innerHTML = '<i class="fas fa-plus-circle"></i> Add New Menu Item';

    // Clear image upload states
    uploadedImageBase64 = null;
    if (imageUploadInput) imageUploadInput.value = '';
    if (imagePreview) imagePreview.src = '';
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
    if (uploadStatusText) uploadStatusText.textContent = 'No file chosen';

    // Reset default qty field
    const defaultQtyInput = document.getElementById('new-item-default-qty');
    if (defaultQtyInput) defaultQtyInput.value = '1';
}

/**
 * Handle Add/Edit Item Form
 */
document.getElementById('add-item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-item-name').value;
    const price = parseFloat(document.getElementById('new-item-price').value);
    const defaultQty = parseInt(document.getElementById('new-item-default-qty').value) || 1;
    const imageInputVal = document.getElementById('new-item-image').value;
    const image = uploadedImageBase64 || imageInputVal || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop';
    const session = document.getElementById('new-item-session').value;
    const btn = e.target.querySelector('button');

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        if (editingItemId) {
            await updateDoc(doc(db, "items", editingItemId), {
                name, price, defaultQty, image, session
            });
            showToast(`"${name}" updated!`);
        } else {
            await addDoc(collection(db, "items"), {
                name, price, defaultQty, image, session
            });
            showToast(`"${name}" added!`);
        }

        resetForm();
        fetchItems(currentSession);
        loadManageItemsList();
    } catch (error) {
        console.error("Error saving item:", error);
        alert("Error saving item. Check console.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = editingItemId ? '<i class="fas fa-sync"></i> Update Item' : '<i class="fas fa-cloud-upload-alt"></i> Save to Menu';
    }
});

/**
 * Fetch items for the active session and render them
 */
async function fetchItems(session) {
    const container = document.getElementById('items-container');
    const loader = document.getElementById('loading-overlay');

    // Don't clear immediately to avoid flicker if we're just updating stats
    if (!container.innerHTML) loader.style.display = 'flex';

    try {
        const q = query(collection(db, "items"), where("session", "==", session));
        const querySnapshot = await getDocs(q);

        loader.style.display = 'none';

        if (querySnapshot.empty) {
            container.innerHTML = `
                        <div class="empty-state" style="grid-column: 1 / -1;">
                            <i class="fas fa-utensils"></i>
                            <p>No items found for ${session} session.</p>
                            <button onclick="window.seedDatabase()" style="margin-top: 1rem; border: none; background: #34495e; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer;">
                                Add Demo Items
                            </button>
                        </div>`;
            return;
        }

        const itemsList = [];
        querySnapshot.forEach((doc) => {
            itemsList.push({ id: doc.id, ...doc.data() });
        });

        // Sort by popularity (order count)
        itemsList.sort((a, b) => {
            const countA = window.currentItemStats[a.name] || 0;
            const countB = window.currentItemStats[b.name] || 0;
            return countB - countA; // DESC order
        });

        // Get max count for badges
        const maxCount = Math.max(...Object.values(window.currentItemStats), 0);

        container.innerHTML = '';
        itemsList.forEach((item) => {
            const isPopular = maxCount > 0 && (window.currentItemStats[item.name] || 0) >= (maxCount * 0.7) && (window.currentItemStats[item.name] > 0);
            renderItemCard(item, item.id, isPopular);
        });
    } catch (error) {
        console.error("Error fetching items: ", error);
        container.innerHTML = `<p style="color: red; text-align: center;">Error connecting to Firestore. Please check your config.</p>`;
    }
}

/**
 * Create and append an item card to the UI
 */
function renderItemCard(item, id, isPopular = false) {
    const container = document.getElementById('items-container');
    const card = document.createElement('div');
    card.className = `item-card ${isPopular ? 'is-popular' : ''}`;

    const imageUrl = item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop';
    const popularBadge = isPopular ? `<div class="popular-badge"><i class="fas fa-fire"></i> Best Seller</div>` : '';

    card.innerHTML = `
                ${popularBadge}
                <img src="${imageUrl}" alt="${item.name}" class="item-image" style="cursor: pointer;" onclick="window.processOrder('${item.name.replace(/'/g, "\\'")}', ${item.price}, ${item.defaultQty || 1})" onerror="this.src='https://via.placeholder.com/300x150?text=No+Image'">
                <div class="item-details">
                    <div class="item-info">
                        <h3>${item.name}</h3>
                        <div class="price" id="price-${item.name.replace(/\s+/g, '-')}">₹${item.price}</div>
                    </div>
                    <div class="item-controls-container">
                        <div class="qty-selector">
                            <button class="qty-btn" onclick="window.adjustQty('${item.name.replace(/\s+/g, '-')}', -1)">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" class="qty-input" value="${item.defaultQty || 1}" min="1" id="qty-${item.name.replace(/\s+/g, '-')}" data-price="${item.price}" data-default-qty="${item.defaultQty || 1}" oninput="window.updateCardPrice('${item.name.replace(/\s+/g, '-')}')" onfocus="this.select()">
                            <button class="qty-btn" onclick="window.adjustQty('${item.name.replace(/\s+/g, '-')}', 1)">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <div class="item-controls">
                            <button class="add-btn" onclick="window.processOrder('${item.name}', ${item.price}, ${item.defaultQty || 1})">
                                <i class="fas fa-plus"></i> ADD
                            </button>
                        </div>
                    </div>
                </div>
            `;
    container.appendChild(card);
}

window.updateCardPrice = (idName) => {
    const input = document.getElementById(`qty-${idName}`);
    const priceDisplay = document.getElementById(`price-${idName}`);
    if (input && priceDisplay) {
        const setPrice = parseFloat(input.getAttribute('data-price')) || 0;
        const defaultQty = parseInt(input.getAttribute('data-default-qty')) || 1;
        const quantity = parseInt(input.value) || 1;
        const unitPrice = setPrice / defaultQty;
        const total = unitPrice * quantity;
        priceDisplay.textContent = `₹${Number(total.toFixed(2))}`;
    }
};

window.adjustQty = (idName, amount) => {
    const input = document.getElementById(`qty-${idName}`);
    if (input) {
        let current = parseInt(input.value) || 1;
        let newValue = current + amount;
        if (newValue < 1) newValue = 1;
        input.value = newValue;
        window.updateCardPrice(idName);
    }
};

window.deleteItem = async (id, name) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
        try {
            await deleteDoc(doc(db, "items", id));
            showToast(`"${name}" deleted.`);
            fetchItems(currentSession);
            loadManageItemsList();
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Delete failed.");
        }
    }
};

window.editItem = (id, name, price, session, image, defaultQty) => {
    editingItemId = id;
    document.getElementById('new-item-name').value = name;
    document.getElementById('new-item-price').value = price;
    document.getElementById('new-item-session').value = session;

    const defaultQtyInput = document.getElementById('new-item-default-qty');
    if (defaultQtyInput) defaultQtyInput.value = defaultQty || 1;

    // Reset upload inputs first
    uploadedImageBase64 = null;
    if (imageUploadInput) imageUploadInput.value = '';

    if (image && image.startsWith('data:')) {
        uploadedImageBase64 = image;
        if (imagePreview) imagePreview.src = image;
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'block';
        if (uploadStatusText) uploadStatusText.textContent = 'Uploaded Image';
        document.getElementById('new-item-image').value = '';
    } else {
        document.getElementById('new-item-image').value = image || '';
        if (imagePreview) imagePreview.src = '';
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
        if (uploadStatusText) uploadStatusText.textContent = 'No file chosen';
    }

    // Show panel and focus
    document.getElementById('manage-panel').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update UI
    document.querySelector('.save-item-btn').innerHTML = '<i class="fas fa-sync"></i> Update Item';
    document.querySelector('.panel-header h3').innerHTML = `<i class="fas fa-edit"></i> Editing: ${name}`;
};

/**
 * Process and add item to temporary cart
 */
window.processOrder = (name, price, defaultQty = 1) => {
    const qtyInput = document.getElementById(`qty-${name.replace(/\s+/g, '-')}`);
    const quantity = parseInt(qtyInput.value) || 0;

    if (quantity <= 0) return;

    const unitPrice = price / defaultQty;
    const existingItem = cart.find(item => item.name === name);
    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.total = existingItem.price * existingItem.quantity;
    } else {
        cart.push({
            name: name,
            price: unitPrice,
            quantity: quantity,
            total: unitPrice * quantity
        });
    }

    qtyInput.value = defaultQty; // Reset qty to its default
    window.updateCardPrice(name.replace(/\s+/g, '-')); // Reset card price display
    renderCart();
    showToast(`Added ${quantity}x ${name} to bill`);
};

window.clearCart = () => {
    if (confirm("Clear all items from bill?")) {
        cart = [];
        renderCart();
    }
};

window.renderCart = () => {
    const cartContainer = document.getElementById('current-bill-items');
    const cartPanel = document.getElementById('current-bill-panel');
    const cartTotal = document.getElementById('bill-total-amount');
    const floatingCart = document.getElementById('floating-cart');
    const cartCount = document.getElementById('cart-count');

    if (cart.length === 0) {
        document.body.classList.remove('cart-open');
        if (window.innerWidth > 768) {
            cartPanel.style.display = 'none';
        } else {
            cartPanel.classList.remove('open');
            if (floatingCart) floatingCart.classList.remove('active');
        }
        return;
    }

    // Desktop view or mobile drawer logic
    if (window.innerWidth > 768) {
        cartPanel.style.display = 'block';
        document.body.classList.add('cart-open');
        if (floatingCart) floatingCart.classList.remove('active');
    } else {
        // On mobile, never set display:block directly to avoid flickering
        // The CSS media query with !important handles the display
        if (floatingCart) {
            floatingCart.classList.add('active');
            cartCount.textContent = cart.reduce((acc, item) => acc + item.quantity, 0);
        }
    }

    cartContainer.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        total += item.total;
        const div = document.createElement('div');
        div.className = 'order-item';
        div.style.borderBottom = '1px solid #f0f0f0';
        div.style.padding = '12px 15px';
        div.innerHTML = `
                    <div class="order-details-row" style="align-items: center; width: 100%;">
                        <div class="order-main-info" style="flex: 1;">
                            <span class="order-name-qty" style="font-size: 0.9rem; font-weight: 600;">${item.name}</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="cart-qty-selector" style="display: flex; align-items: center; gap: 8px; background: #f8f9fa; padding: 2px 6px; border-radius: 8px; border: 1px solid #eee;">
                                <button class="cart-qty-btn-minus" data-index="${index}" style="background: none; border: none; cursor: pointer; padding: 4px; color: var(--primary);"><i class="fas fa-minus" style="font-size: 0.7rem;"></i></button>
                                <span style="font-weight: 700; font-size: 0.85rem; min-width: 15px; text-align: center;">${item.quantity}</span>
                                <button class="cart-qty-btn-plus" data-index="${index}" style="background: none; border: none; cursor: pointer; padding: 4px; color: var(--primary);"><i class="fas fa-plus" style="font-size: 0.7rem;"></i></button>
                            </div>
                            
                            <span class="order-total-price" style="font-size: 0.9rem; font-weight: 700; min-width: 45px; text-align: right;">₹${Number(item.total.toFixed(2))}</span>
                            
                            <button class="delete-order-btn" data-index="${index}" style="font-size: 0.9rem; opacity: 0.5;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                `;
        cartContainer.appendChild(div);
    });

    // Bind Qty Minus buttons
    cartContainer.querySelectorAll('.cart-qty-btn-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            window.updateCartQty(idx, -1);
        });
    });

    // Bind Qty Plus buttons
    cartContainer.querySelectorAll('.cart-qty-btn-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            window.updateCartQty(idx, 1);
        });
    });

    // Bind Delete buttons
    cartContainer.querySelectorAll('.delete-order-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            window.removeFromCart(idx);
        });
    });

    cartTotal.textContent = `₹${window.customRound(total).toLocaleString('en-IN')}`;
};

window.toggleCart = () => {
    const cartPanel = document.getElementById('current-bill-panel');
    if (window.innerWidth > 768) {
        const isOpen = cartPanel.style.display !== 'none';
        if (isOpen) {
            cartPanel.style.display = 'none';
            document.body.classList.remove('cart-open');
        } else {
            cartPanel.style.display = 'block';
            document.body.classList.add('cart-open');
        }
    } else {
        cartPanel.classList.toggle('open');
    }
};

window.removeFromCart = (index) => {
    cart.splice(index, 1);
    renderCart();
    if (cart.length === 0 && window.innerWidth <= 768) {
        document.getElementById('current-bill-panel').classList.remove('open');
    }
};

window.updateCartQty = (index, delta) => {
    const item = cart[index];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
        window.removeFromCart(index);
    } else {
        item.quantity = newQty;
        item.total = item.price * item.quantity;
        renderCart();
    }
};

window.confirmBill = async () => {
    if (cart.length === 0) return;

    const btn = document.getElementById('confirm-bill-btn');
    const originalText = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const totalBill = window.customRound(cart.reduce((sum, i) => sum + i.total, 0));
        const totalQty = cart.reduce((sum, i) => sum + i.quantity, 0);

        let cashAmt = 0;
        let onlineAmt = 0;
        if (currentPaymentMethod === 'both') {
            cashAmt = parseFloat(document.getElementById('split-cash-amount').value) || 0;
            onlineAmt = parseFloat(document.getElementById('split-online-amount').value) || 0;
            const diff = Math.abs((cashAmt + onlineAmt) - totalBill);
            if (diff > 0.01) {
                onlineAmt = totalBill - cashAmt;
                if (onlineAmt < 0) {
                    onlineAmt = 0;
                    cashAmt = totalBill;
                }
            }
        }

        // Save as a single Bill document
        await addDoc(collection(db, "orders"), {
            items: cart,
            name: `Bill (${cart.length} items)`,
            total: totalBill,
            quantity: totalQty,
            session: currentSession,
            paymentMethod: currentPaymentMethod,
            cashAmount: cashAmt,
            onlineAmount: onlineAmt,
            date: today,
            timestamp: serverTimestamp()
        });

        showToast("Bill Confirmed & Saved!");
        cart = [];
        if (window.innerWidth <= 768) {
            document.getElementById('current-bill-panel').classList.remove('open');
        }
        renderCart();
    } catch (error) {
        console.error("Error confirming bill:", error);
        alert("Failed to save bill.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

/**
 * Update Summary Real-time
 */
function startSummaryListener() {
    const q = query(
        collection(db, "orders"),
        where("date", "==", today)
    );
    const ordersListContainer = document.getElementById('orders-list-container');

    onSnapshot(q, (snapshot) => {
        let totalAmount = 0;
        let cashAmount = 0;
        let onlineAmount = 0;
        let totalItems = 0;

        ordersListContainer.innerHTML = '';

        if (snapshot.empty) {
            ordersListContainer.innerHTML = '<div class="empty-state" style="padding: 1rem;"><p style="font-size: 0.9rem;">No orders yet today.</p></div>';
        }

        // Manual sorting in memory to avoid Firebase Index requirement
        const docs = [];
        snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0) || b.timestamp - a.timestamp);

        let currentIndex = 1;
        let lastSession = '';

        docs.forEach((order) => {
            const orderId = order.id;
            const amount = (order.total || 0);
            const qty = (order.quantity || 0);

            totalAmount += amount;
            totalItems += qty;

            if (order.paymentMethod === 'online') {
                onlineAmount += amount;
            } else if (order.paymentMethod === 'both') {
                cashAmount += (order.cashAmount || 0);
                onlineAmount += (order.onlineAmount || 0);
            } else {
                cashAmount += amount;
            }

            // Add Session Header "Break"
            if (order.session !== lastSession) {
                const header = document.createElement('div');
                header.className = 'session-group-header';
                const icon = order.session === 'morning' ? 'fa-sun' : (order.session === 'afternoon' ? 'fa-cloud-sun' : 'fa-moon');
                header.innerHTML = `<i class="fas ${icon}"></i> ${order.session} Sales`;
                ordersListContainer.appendChild(header);
                lastSession = order.session;
            }

            // Format time if timestamp exists
            let timeStr = "";
            if (order.timestamp) {
                try {
                    const date = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
                    timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch (e) { }
            }

            // Build Summary String for history
            let summaryText = order.name || 'Order';
            if (order.items && order.items.length > 0) {
                summaryText = order.items.map(i => `${i.name} (x${i.quantity})`).join(', ');
            }

            // Render order item in line-wise mode
            const orderItem = document.createElement('div');
            orderItem.className = 'order-item';
            orderItem.innerHTML = `
                        <div class="order-num">#${docs.length - (currentIndex - 1)}</div>
                        <div class="payment-status-dot dot-${order.paymentMethod || 'cash'}" title="${order.paymentMethod}"></div>
                        <div class="order-details-row">
                            <div class="order-main-info" style="flex: 1; overflow: hidden;">
                                <span class="order-name-qty" style="font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; max-width: 180px;">
                                    ${summaryText}
                                </span>
                                ${timeStr ? `<span class="order-time-tag" style="font-size: 0.65rem;">${timeStr}</span>` : ''}
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="order-total-price" style="font-size: 0.8rem; font-weight: 800;">₹${amount}</span>
                                <button class="delete-order-btn" onclick="window.deleteOrder('${orderId}', 'Bill #${docs.length - (currentIndex - 1)}')" style="font-size: 0.8rem;">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    `;
            ordersListContainer.appendChild(orderItem);
            currentIndex++;
        });

        document.getElementById('summary-total-amount').textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
        document.getElementById('summary-cash-amount').textContent = `₹${cashAmount.toLocaleString('en-IN')}`;
        document.getElementById('summary-online-amount').textContent = `₹${onlineAmount.toLocaleString('en-IN')}`;
        document.getElementById('summary-items-count').textContent = totalItems;

        // --- Calculate & Render Top Selling Items ---
        const itemStats = {};
        docs.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    const itemName = item.name || 'Unknown';
                    const qty = parseInt(item.quantity) || 0;
                    itemStats[itemName] = (itemStats[itemName] || 0) + qty;
                });
            } else {
                // Backward compatibility
                const itemName = order.name || 'Unknown';
                const qty = parseInt(order.quantity) || 0;
                itemStats[itemName] = (itemStats[itemName] || 0) + qty;
            }
        });

        // --- Populate Detailed History Modal ---
        const detailedHistoryContainer = document.getElementById('detailed-history-container');
        if (detailedHistoryContainer) {
            detailedHistoryContainer.innerHTML = '';
            if (docs.length === 0) {
                detailedHistoryContainer.innerHTML = '<p style="text-align:center; opacity:0.5; padding:20px;">No sales recorded yet today.</p>';
            } else {
                docs.forEach((order, idx) => {
                    let timeStr = "---";
                    if (order.timestamp) {
                        try {
                            const date = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
                            timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        } catch (e) { }
                    }

                    const billCard = document.createElement('div');
                    billCard.className = 'detailed-bill-card';

                    let itemsHTML = '';
                    if (order.items) {
                        order.items.forEach(it => {
                            itemsHTML += `<div class="bill-item-row"><span>${it.name} (x${it.quantity})</span><span>₹${it.total}</span></div>`;
                        });
                    } else {
                        itemsHTML = `<div class="bill-item-row"><span>${order.name} (x${order.quantity})</span><span>₹${order.total}</span></div>`;
                    }

                    billCard.innerHTML = `
                                <div class="bill-header">
                                    <span class="bill-id">#${docs.length - idx} Bill</span>
                                    <span class="bill-time"><i class="far fa-clock"></i> ${timeStr}</span>
                                </div>
                                <div class="bill-items-list">${itemsHTML}</div>
                                <div class="bill-footer">
                                    <span style="font-size:0.7rem; color:${order.paymentMethod === 'online' ? '#3498db' : '#27ae60'}">
                                        <i class="fas fa-credit-card"></i> ${order.paymentMethod?.toUpperCase() || 'CASH'}
                                    </span>
                                    <span>Total: ₹${order.total}</span>
                                </div>
                            `;
                    detailedHistoryContainer.appendChild(billCard);
                });
            }
        }

        const sortedItems = Object.entries(itemStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Show top 5

        const topItemsContainer = document.getElementById('top-selling-items-container');
        if (topItemsContainer) {
            topItemsContainer.innerHTML = '';
            const maxQty = sortedItems.length > 0 ? sortedItems[0][1] : 0;

            if (sortedItems.length === 0) {
                topItemsContainer.innerHTML = '<p style="font-size: 0.8rem; opacity: 0.6; text-align: center; padding: 10px;">No items sold yet today.</p>';
            } else {
                sortedItems.forEach(([name, qty]) => {
                    const width = maxQty > 0 ? (qty / maxQty) * 100 : 0;
                    topItemsContainer.innerHTML += `
                                <div class="top-item-row">
                                    <div class="top-item-info">
                                        <span>${name}</span>
                                        <span>${qty} Qty</span>
                                    </div>
                                    <div class="top-item-bar-bg">
                                        <div class="top-item-bar-fill" style="width: ${width}%"></div>
                                    </div>
                                </div>
                            `;
                });
            }
        }

        // Store global item stats for menu sorting
        window.currentItemStats = itemStats;

        // Refresh menu to apply sorting and popular badges
        fetchItems(currentSession);

        // Store today's data globally for PDF generation
        window.todayOrders = docs;
    });
}

/**
 * PDF Report Generation using jsPDF
 */
window.generatePDFReport = () => {
    if (!window.todayOrders || window.todayOrders.length === 0) {
        alert("No orders to export for today.");
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
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 14, 30);

    const sessions = ['morning', 'afternoon', 'night'];
    let currentY = 40;

    sessions.forEach(session => {
        const sessionOrders = window.todayOrders.filter(o => (o.session || 'morning') === session);

        if (sessionOrders.length > 0) {
            // Session Header
            doc.setFontSize(16);
            doc.setTextColor(230, 126, 34);
            doc.text(`${session.charAt(0).toUpperCase() + session.slice(1)} Sales`, 14, currentY);
            currentY += 5;

            const tableData = [];
            sessionOrders.forEach(o => {
                if (o.items) {
                    o.items.forEach(item => {
                        tableData.push([
                            '', // No individual number to keep it grouped visually
                            item.name,
                            item.quantity,
                            `Rs. ${item.price}`,
                            `Rs. ${item.total}`,
                            o.paymentMethod?.toUpperCase() || 'CASH'
                        ]);
                    });
                    // Add a separator or subtotal if needed, but keeping it simple for now
                } else {
                    tableData.push([
                        '',
                        o.name,
                        o.quantity,
                        `Rs. ${o.price}`,
                        `Rs. ${o.total}`,
                        o.paymentMethod?.toUpperCase() || 'CASH'
                    ]);
                }
            });

            doc.autoTable({
                startY: currentY,
                head: [['#', 'Item Name', 'Qty', 'Price', 'Total', 'Payment']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [44, 62, 80] },
            });

            currentY = doc.lastAutoTable.finalY + 15;

            if (currentY > 260) {
                doc.addPage();
                currentY = 20;
            }
        }
    });

    // Footer Summary
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    const totalText = document.getElementById('summary-total-amount').textContent.replace('₹', 'Rs. ');
    const cashText = document.getElementById('summary-cash-amount').textContent.replace('₹', 'Rs. ');
    const onlineText = document.getElementById('summary-online-amount').textContent.replace('₹', 'Rs. ');

    doc.text(`Total Sales: ${totalText}`, 14, currentY);
    doc.text(`Cash Total: ${cashText}`, 14, currentY + 8);
    doc.text(`Online Total: ${onlineText}`, 14, currentY + 16);

    // Save
    doc.save(`Amma_Mess_Report_${today}.pdf`);
    showToast("PDF Downloaded with Session Breaks!");
};

window.togglePopularView = () => {
    const panel = document.getElementById('popular-items-panel');
    const bg = document.getElementById('popular-modal-bg');
    const isShowing = panel.style.display === 'block';

    if (isShowing) {
        panel.style.display = 'none';
        bg.style.display = 'none';
    } else {
        panel.style.display = 'block';
        bg.style.display = 'block';
    }
};

window.toggleRecentOrders = (btn) => {
    const container = document.getElementById('orders-list-container');
    const icon = btn.querySelector('i');
    const isHidden = container.style.display === 'none';

    if (isHidden) {
        container.style.display = 'block';
        icon.className = 'fas fa-eye';
        btn.classList.add('active');
    } else {
        container.style.display = 'none';
        icon.className = 'fas fa-eye-slash';
        btn.classList.remove('active');
    }
};

window.toggleHistoryView = () => {
    const panel = document.getElementById('history-items-panel');
    const bg = document.getElementById('history-modal-bg');
    const isShowing = panel.classList.contains('open');

    if (isShowing) {
        panel.classList.remove('open');
        panel.style.display = 'none';
        bg.style.display = 'none';
    } else {
        panel.classList.add('open');
        panel.style.display = 'flex';
        bg.style.display = 'block';
    }
};

window.toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen = sidebar.classList.contains('open');

    if (isOpen) {
        sidebar.classList.remove('open');
        overlay.style.display = 'none';
    } else {
        sidebar.classList.add('open');
        overlay.style.display = 'block';
    }
};

/**
 * Monthly Stats Logic
 */
window.toggleMonthlyView = () => {
    const panel = document.getElementById('monthly-view-panel');
    const bg = document.getElementById('modal-bg');
    const isShowing = panel.style.display === 'block';

    if (isShowing) {
        panel.style.display = 'none';
        if (bg) bg.style.display = 'none';
    } else {
        panel.style.display = 'block';
        if (bg) bg.style.display = 'block';

        // Pre-fill and auto-fetch
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        document.getElementById('history-date-picker').value = dateStr;
        window.fetchHistoryStats();
    }
};

let reportMode = 'daily';
window.switchReportMode = (mode) => {
    reportMode = mode;
    document.getElementById('btn-daily-report').classList.toggle('active', mode === 'daily');
    document.getElementById('btn-monthly-report').classList.toggle('active', mode === 'monthly');
    document.getElementById('daily-picker-container').style.display = mode === 'daily' ? 'flex' : 'none';
    document.getElementById('monthly-picker-container').style.display = mode === 'monthly' ? 'flex' : 'none';
    document.getElementById('monthly-results').style.display = 'none';
};

window.fetchHistoryStats = async () => {
    const dateInput = document.getElementById('history-date-picker').value;
    const monthInput = document.getElementById('history-month-picker').value;

    const target = reportMode === 'daily' ? dateInput : monthInput;
    if (!target) return;

    const loader = document.getElementById('month-loader');
    const results = document.getElementById('monthly-results');
    const noData = document.getElementById('month-no-data');

    // Show loading
    loader.style.display = 'block';
    results.style.display = 'none';
    if (noData) noData.style.display = 'none';

    try {
        // For monthly, we fetch all and filter client-side for simplicity/no-extra-index
        // or we could use where with >= and < but date strings make it tricky.
        // Re-using the manual filtering logic.
        const q = query(collection(db, "orders"));
        const querySnapshot = await getDocs(q);

        let rev = 0, csh = 0, onl = 0, cnt = 0;

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const orderDate = data.date; // YYYY-MM-DD

            if (reportMode === 'daily' && orderDate === dateInput) {
                rev += (data.total || 0);
                cnt += (data.quantity || 0);
                if (data.paymentMethod === 'online') onl += (data.total || 0);
                else csh += (data.total || 0);
            } else if (reportMode === 'monthly' && orderDate && orderDate.startsWith(monthInput)) {
                rev += (data.total || 0);
                cnt += (data.quantity || 0);
                if (data.paymentMethod === 'online') onl += (data.total || 0);
                else csh += (data.total || 0);
            }
        });

        loader.style.display = 'none';

        if (rev === 0) {
            if (noData) noData.style.display = 'block';
        } else {
            document.getElementById('m-revenue').textContent = `₹${rev.toLocaleString('en-IN')}`;
            document.getElementById('m-cash').textContent = `₹${csh.toLocaleString('en-IN')}`;
            document.getElementById('m-online').textContent = `₹${onl.toLocaleString('en-IN')}`;
            document.getElementById('m-count').textContent = cnt;
            results.style.display = 'grid';
        }
    } catch (err) {
        console.error("Monthly Fetch Error:", err);
        loader.style.display = 'none';
        alert("Data sync error. Please try again.");
    }
};

/**
 * Delete an order
 */
window.deleteOrder = async (id, name) => {
    if (confirm(`Remove this ${name}?`)) {
        try {
            await deleteDoc(doc(db, "orders", id));
            showToast(`${name} removed.`);
        } catch (error) {
            console.error("Error deleting order:", error);
            alert("Failed to remove order.");
        }
    }
};

/**
 * Switch Payment Method
 */
window.switchPayment = (method) => {
    currentPaymentMethod = method;

    // Update payment buttons in the bill panel
    document.querySelectorAll('.payment-selector .payment-btn').forEach(btn => btn.classList.remove('active'));

    const activeBtn = document.getElementById(`bill-pay-${method}`);
    if (activeBtn) activeBtn.classList.add('active');

    const splitContainer = document.getElementById('both-split-container');
    if (splitContainer) {
        if (method === 'both') {
            splitContainer.style.display = 'flex';
            const totalBill = window.customRound(cart.reduce((sum, i) => sum + i.total, 0));
            document.getElementById('split-total-info').textContent = `Total: ₹${totalBill}`;
            
            const cashInput = document.getElementById('split-cash-amount');
            const onlineInput = document.getElementById('split-online-amount');
            const half = Math.floor(totalBill / 2);
            cashInput.value = half;
            onlineInput.value = totalBill - half;
        } else {
            splitContainer.style.display = 'none';
        }
    }
};

/**
 * Switch between sessions
 */
window.switchSession = (session) => {
    currentSession = session;

    // Update UI buttons
    document.querySelectorAll('.session-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.classList.contains(session)) btn.classList.add('active');
    });

    fetchItems(session);
};

/**
 * Helper for Toast with robust timeout
 */
window.toggleSummaryModal = () => {
    const panel = document.getElementById('summary-modal-panel');
    const bg = document.getElementById('summary-modal-bg');
    const isShowing = panel.style.display === 'block';

    if (isShowing) {
        panel.style.display = 'none';
        if (bg) bg.style.display = 'none';
    } else {
        panel.style.display = 'block';
        if (bg) bg.style.display = 'block';
    }
};

let toastTimeout;
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

/**
 * Seed Database with initial items (Demo)
 */
window.seedDatabase = async () => {
    const items = [
        { name: "Masala Dosa", price: 60, session: "morning", image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop" },
        { name: "Idli (2pcs)", price: 40, session: "morning", image: "https://images.unsplash.com/photo-1589301773839-9d7a9616d6ae?w=500&auto=format&fit=crop" },
        { name: "Coffee/Tea", price: 20, session: "morning", image: "https://images.unsplash.com/photo-1544787210-2211d40fd812?w=500&auto=format&fit=crop" },
        { name: "Veg Meals", price: 120, session: "afternoon", image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&auto=format&fit=crop" },
        { name: "Chicken Biryani", price: 220, session: "afternoon", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500&auto=format&fit=crop" },
        { name: "Curd Rice", price: 80, session: "afternoon", image: "https://images.unsplash.com/photo-1626777551341-10492ec663d8?w=500&auto=format&fit=crop" },
        { name: "Roti with Curry", price: 100, session: "night", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&auto=format&fit=crop" },
        { name: "Fried Rice", price: 150, session: "night", image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop" },
        { name: "Fruit Salad", price: 90, session: "night", image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=500&auto=format&fit=crop" }
    ];

    if (confirm("This will add demo items to your 'items' collection. Continue?")) {
        try {
            for (const item of items) {
                await addDoc(collection(db, "items"), item);
            }
            alert("Demo items added successfully!");
            fetchItems(currentSession);
        } catch (e) {
            alert("Error seeding: " + e.message);
        }
    }
};

// Initialize App
const clearAllBtn = document.getElementById('clear-all-btn');
if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
        window.clearCart();
    });
}

// Split payment auto-calculation
const splitCashInput = document.getElementById('split-cash-amount');
const splitOnlineInput = document.getElementById('split-online-amount');

if (splitCashInput && splitOnlineInput) {
    splitCashInput.addEventListener('input', () => {
        const totalBill = window.customRound(cart.reduce((sum, i) => sum + i.total, 0));
        let cashAmt = parseFloat(splitCashInput.value) || 0;
        if (cashAmt > totalBill) {
            cashAmt = totalBill;
            splitCashInput.value = totalBill;
        }
        if (cashAmt < 0) {
            cashAmt = 0;
            splitCashInput.value = 0;
        }
        const onlineAmt = totalBill - cashAmt;
        splitOnlineInput.value = window.customRound(onlineAmt);
    });

    splitOnlineInput.addEventListener('input', () => {
        const totalBill = window.customRound(cart.reduce((sum, i) => sum + i.total, 0));
        let onlineAmt = parseFloat(splitOnlineInput.value) || 0;
        if (onlineAmt > totalBill) {
            onlineAmt = totalBill;
            splitOnlineInput.value = totalBill;
        }
        if (onlineAmt < 0) {
            onlineAmt = 0;
            splitOnlineInput.value = 0;
        }
        const cashAmt = totalBill - onlineAmt;
        splitCashInput.value = window.customRound(cashAmt);
    });
}

fetchItems(currentSession);
startSummaryListener();