// ==================== CONFIG & STATE ====================
const API_BASE = "http://localhost:8000/api";
let currentUser = null;
let token = null;
let cart = [];
let allMenuItems = [];

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", function() {
    initializeEventListeners();
    checkAuthStatus();
});

function initializeEventListeners() {
    // Auth
    document.getElementById("loginForm").addEventListener("submit", handleLogin);
    document.getElementById("registerForm").addEventListener("submit", handleRegister);
    document.getElementById("logoutBtn").addEventListener("click", handleLogout);
    
    // Tab switching
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", switchAuthTab);
    });
    
    // Navigation
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", navigateTo);
    });
    
    // Menu page
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", filterMenu);
    });
    document.getElementById("addMenuItemBtn").addEventListener("click", openAddMenuItemModal);
    document.getElementById("placeOrderBtn").addEventListener("click", placeOrder);
    document.getElementById("clearCartBtn").addEventListener("click", clearCart);
    
    // Admin
    document.querySelectorAll(".admin-tab").forEach(btn => {
        btn.addEventListener("click", switchAdminTab);
    });
    document.getElementById("addMenuItemAdminBtn").addEventListener("click", openAddMenuItemModal);
    
    // Forms
    document.getElementById("addMenuItemForm").addEventListener("submit", handleAddMenuItem);
    document.getElementById("editMenuItemForm").addEventListener("submit", handleEditMenuItem);
    
    // Modals
    document.querySelectorAll(".close-modal").forEach(btn => {
        btn.addEventListener("click", closeAllModals);
    });
}

function checkAuthStatus() {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    
    if (savedToken && savedUser) {
        token = savedToken;
        currentUser = JSON.parse(savedUser);
        showMainApp();
        loadMenu();
    } else {
        showAuthPage();
    }
}

// ==================== AUTH HANDLERS ====================
function switchAuthTab(e) {
    const tab = e.target.dataset.tab;
    
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    e.target.classList.add("active");
    
    document.querySelectorAll(".auth-form").forEach(form => form.classList.add("hidden"));
    document.getElementById(tab + "Form").classList.remove("hidden");
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) throw new Error("Invalid credentials");
        
        const data = await response.json();
        token = data.access_token;
        
        // Get user info
        const userResponse = await fetch(`${API_BASE}/auth/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const userData = await userResponse.json();
        currentUser = userData;
        
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(currentUser));
        
        showMainApp();
        loadMenu();
    } catch (error) {
        document.getElementById("loginError").textContent = error.message;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById("regUsername").value;
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;
    
    if (password !== confirmPassword) {
        document.getElementById("registerError").textContent = "Passwords do not match";
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });
        
        if (!response.ok) throw new Error("Registration failed");
        
        document.getElementById("registerError").textContent = "";
        alert("Registration successful! Please login.");
        
        // Switch to login tab
        document.querySelector('[data-tab="login"]').click();
        document.getElementById("loginUsername").value = username;
    } catch (error) {
        document.getElementById("registerError").textContent = error.message;
    }
}

function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    currentUser = null;
    token = null;
    cart = [];
    showAuthPage();
}

// ==================== NAVIGATION ====================
function showAuthPage() {
    document.getElementById("authPage").classList.remove("hidden");
    document.getElementById("mainApp").classList.add("hidden");
}

function showMainApp() {
    document.getElementById("authPage").classList.add("hidden");
    document.getElementById("mainApp").classList.remove("hidden");
    
    // Show/hide admin tab
    if (currentUser.is_admin) {
        document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
    } else {
        document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
    }
    
    navigateTo({ target: { dataset: { page: "menu" } } });
}

function navigateTo(e) {
    const page = e.target.dataset.page;
    
    // Update active nav button
    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
    e.target.classList.add("active");
    
    // Hide all pages
    document.querySelectorAll(".content-page").forEach(p => p.classList.remove("active"));
    
    // Show selected page
    document.getElementById(page + "Page").classList.add("active");
    
    // Load data
    if (page === "orders") {
        loadUserOrders();
    } else if (page === "admin") {
        loadAdminDashboard();
    }
}

// ==================== MENU ====================
async function loadMenu() {
    try {
        const response = await fetch(`${API_BASE}/menu`);
        const data = await response.json();
        allMenuItems = data;
        displayMenu(data);
    } catch (error) {
        console.error("Error loading menu:", error);
    }
}

function displayMenu(items) {
    const menuGrid = document.getElementById("menuGrid");
    menuGrid.innerHTML = "";
    
    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "menu-item-card";
        card.innerHTML = `
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <div class="menu-item-category">${item.category}</div>
            <div class="menu-item-price">₹${item.price.toFixed(2)}</div>
            <div class="menu-item-actions">
                <input type="number" min="1" value="1" class="quantity-input" data-item-id="${item.id}">
                <button class="btn btn-primary btn-sm" onclick="addToCart(${item.id})">Add to Cart</button>
            </div>
        `;
        menuGrid.appendChild(card);
    });
}

function filterMenu(e) {
    const category = e.target.dataset.category;
    
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
    e.target.classList.add("active");
    
    if (category === "all") {
        displayMenu(allMenuItems);
    } else {
        const filtered = allMenuItems.filter(item => item.category === category);
        displayMenu(filtered);
    }
}

function addToCart(itemId) {
    const item = allMenuItems.find(i => i.id === itemId);
    const qtyInput = document.querySelector(`input[data-item-id="${itemId}"]`);
    const quantity = parseInt(qtyInput.value) || 1;
    
    const existingItem = cart.find(ci => ci.id === itemId);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: itemId,
            name: item.name,
            price: item.price,
            quantity: quantity
        });
    }
    
    updateCartDisplay();
    alert(`${item.name} added to cart!`);
}

function updateCartDisplay() {
    const cartItems = document.getElementById("cartItems");
    const cartTotal = document.getElementById("cartTotal");
    
    cartItems.innerHTML = "";
    let total = 0;
    
    cart.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        
        const cartItem = document.createElement("div");
        cartItem.className = "cart-item";
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-qty">Qty: ${item.quantity}</div>
            </div>
            <div class="cart-item-price">₹${subtotal.toFixed(2)}</div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})">×</button>
        `;
        cartItems.appendChild(cartItem);
    });
    
    cartTotal.textContent = `₹${total.toFixed(2)}`;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();
}

function clearCart() {
    cart = [];
    updateCartDisplay();
}

async function placeOrder() {
    if (cart.length === 0) {
        alert("Cart is empty!");
        return;
    }
    
    const paymentMethod = document.getElementById("paymentMethod").value;
    
    const orderData = {
        items: cart.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity
        })),
        payment_method: paymentMethod
    };
    
    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(orderData)
        });
        
        if (!response.ok) throw new Error("Order failed");
        
        const order = await response.json();
        alert(`Order placed successfully!\nOrder #: ${order.order_number}\nTotal: ₹${order.total_amount.toFixed(2)}`);
        
        cart = [];
        updateCartDisplay();
        loadUserOrders();
        navigateTo({ target: { dataset: { page: "orders" } } });
    } catch (error) {
        alert("Error placing order: " + error.message);
    }
}

// ==================== ORDERS ====================
async function loadUserOrders() {
    try {
        const response = await fetch(`${API_BASE}/orders`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const orders = await response.json();
        displayOrders(orders);
    } catch (error) {
        console.error("Error loading orders:", error);
    }
}

function displayOrders(orders) {
    const ordersList = document.getElementById("ordersList");
    ordersList.innerHTML = "";
    
    if (orders.length === 0) {
        ordersList.innerHTML = "<p>No orders yet</p>";
        return;
    }
    
    orders.forEach(order => {
        const card = document.createElement("div");
        card.className = "order-card";
        
        const date = new Date(order.created_at).toLocaleDateString();
        
        card.innerHTML = `
            <div class="order-header">
                <div class="order-number">${order.order_number}</div>
                <span class="order-status ${order.status}">${order.status.toUpperCase()}</span>
            </div>
            
            <div class="order-info">
                <div class="order-info-item">
                    <div class="order-info-label">Date</div>
                    <div class="order-info-value">${date}</div>
                </div>
                <div class="order-info-item">
                    <div class="order-info-label">Payment</div>
                    <div class="order-info-value">${order.payment_method.toUpperCase()}</div>
                </div>
            </div>
            
            <div class="order-items-list">
                ${order.order_items.map(item => `
                    <div class="order-item-row">
                        <span class="order-item-name">${item.menu_item?.name || 'Item'}</span>
                        <span class="order-item-qty">×${item.quantity}</span>
                        <span class="order-item-price">₹${item.subtotal.toFixed(2)}</span>
                    </div>
                `).join("")}
            </div>
            
            <div class="order-total">Total: ₹${order.total_amount.toFixed(2)}</div>
            
            <button class="btn btn-primary btn-sm" onclick="viewOrderDetails(${order.id})">View Details</button>
        `;
        
        ordersList.appendChild(card);
    });
}

async function viewOrderDetails(orderId) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const order = await response.json();
        
        const modal = document.getElementById("orderDetailsModal");
        const content = document.getElementById("orderDetailsContent");
        
        const date = new Date(order.created_at).toLocaleString();
        
        content.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Order Number</span>
                <span class="detail-value">${order.order_number}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Date</span>
                <span class="detail-value">${date}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value order-status ${order.status}">${order.status.toUpperCase()}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Payment Method</span>
                <span class="detail-value">${order.payment_method.toUpperCase()}</span>
            </div>
            
            <h3 style="margin-top: 20px; color: var(--primary-color);">Order Items</h3>
            ${order.order_items.map(item => `
                <div class="detail-row">
                    <span class="detail-label">${item.menu_item?.name || 'Item'} (×${item.quantity})</span>
                    <span class="detail-value">₹${item.subtotal.toFixed(2)}</span>
                </div>
            `).join("")}
            
            <div class="detail-row" style="border-top: 2px solid var(--primary-color); font-size: 1.2em;">
                <span class="detail-label">Total Amount</span>
                <span class="detail-value">₹${order.total_amount.toFixed(2)}</span>
            </div>
        `;
        
        modal.classList.remove("hidden");
    } catch (error) {
        alert("Error loading order details: " + error.message);
    }
}

// ==================== ADMIN DASHBOARD ====================
async function loadAdminDashboard() {
    try {
        // Load stats
        const statsResponse = await fetch(`${API_BASE}/dashboard/stats`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const stats = await statsResponse.json();
        
        document.getElementById("totalOrders").textContent = stats.total_orders;
        document.getElementById("completedOrders").textContent = stats.completed_orders;
        document.getElementById("totalRevenue").textContent = `₹${stats.total_revenue.toFixed(2)}`;
        document.getElementById("totalItems").textContent = stats.total_menu_items;
        
        // Load sales data
        const salesResponse = await fetch(`${API_BASE}/dashboard/sales`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const sales = await salesResponse.json();
        displaySalesChart(sales);
        
        // Load admin orders
        const ordersResponse = await fetch(`${API_BASE}/orders/admin/all`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const allOrders = await ordersResponse.json();
        displayAdminOrders(allOrders);
        
        // Load menu management
        loadMenuManagement();
    } catch (error) {
        console.error("Error loading admin dashboard:", error);
    }
}

function displaySalesChart(sales) {
    const chart = document.getElementById("salesChart");
    chart.innerHTML = "";
    
    Object.entries(sales).forEach(([category, data]) => {
        const item = document.createElement("div");
        item.className = "chart-item";
        item.innerHTML = `
            <div class="chart-item-name">${category}</div>
            <div class="chart-item-stat">
                <span class="chart-item-stat-label">Items Sold</span>
                <span class="chart-item-stat-value">${data.count}</span>
            </div>
            <div class="chart-item-stat">
                <span class="chart-item-stat-label">Revenue</span>
                <span class="chart-item-stat-value">₹${data.revenue.toFixed(2)}</span>
            </div>
        `;
        chart.appendChild(item);
    });
}

function displayAdminOrders(orders) {
    const ordersList = document.getElementById("adminOrdersList");
    ordersList.innerHTML = "";
    
    orders.forEach(order => {
        const card = document.createElement("div");
        card.className = "order-card";
        
        const date = new Date(order.created_at).toLocaleDateString();
        
        card.innerHTML = `
            <div class="order-header">
                <div class="order-number">${order.order_number}</div>
                <span class="order-status ${order.status}">${order.status.toUpperCase()}</span>
            </div>
            
            <div class="order-info">
                <div class="order-info-item">
                    <div class="order-info-label">User</div>
                    <div class="order-info-value">${order.user?.username || 'N/A'}</div>
                </div>
                <div class="order-info-item">
                    <div class="order-info-label">Date</div>
                    <div class="order-info-value">${date}</div>
                </div>
                <div class="order-info-item">
                    <div class="order-info-label">Total</div>
                    <div class="order-info-value">₹${order.total_amount.toFixed(2)}</div>
                </div>
            </div>
            
            <div class="order-actions">
                <select onchange="updateOrderStatus(${order.id}, this.value)" class="btn">
                    <option value="">Change Status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>
        `;
        
        ordersList.appendChild(card);
    });
}

async function updateOrderStatus(orderId, status) {
    if (!status) return;
    
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) throw new Error("Failed to update status");
        
        loadAdminDashboard();
        alert("Order status updated!");
    } catch (error) {
        alert("Error updating status: " + error.message);
    }
}

async function loadMenuManagement() {
    try {
        const response = await fetch(`${API_BASE}/menu`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const items = await response.json();
        displayMenuManagement(items);
    } catch (error) {
        console.error("Error loading menu management:", error);
    }
}

function displayMenuManagement(items) {
    const list = document.getElementById("adminMenuList");
    list.innerHTML = "";
    
    items.forEach(item => {
        const row = document.createElement("div");
        row.className = "menu-item-row";
        row.innerHTML = `
            <div class="menu-item-details">
                <h4>${item.name}</h4>
                <p>${item.category} - ${item.description}</p>
            </div>
            <div class="menu-item-price-admin">₹${item.price.toFixed(2)}</div>
            <div class="menu-item-actions-admin">
                <button class="btn btn-primary btn-sm" onclick="openEditMenuItemModal(${item.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteMenuItem(${item.id})">Delete</button>
            </div>
        `;
        list.appendChild(row);
    });
}

async function deleteMenuItem(itemId) {
    if (!confirm("Are you sure?")) return;
    
    try {
        const response = await fetch(`${API_BASE}/menu/${itemId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Failed to delete");
        
        alert("Menu item deleted!");
        loadMenuManagement();
        loadMenu();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

// ==================== MODALS ====================
function openAddMenuItemModal() {
    document.getElementById("addMenuItemModal").classList.remove("hidden");
    document.getElementById("addMenuItemForm").reset();
}

function openEditMenuItemModal(itemId) {
    const item = allMenuItems.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById("editItemId").value = item.id;
    document.getElementById("editItemName").value = item.name;
    document.getElementById("editItemDescription").value = item.description;
    document.getElementById("editItemCategory").value = item.category;
    document.getElementById("editItemPrice").value = item.price;
    document.getElementById("editItemAvailable").checked = item.is_available;
    
    document.getElementById("editMenuItemModal").classList.remove("hidden");
}

function closeAllModals() {
    document.querySelectorAll(".modal").forEach(modal => {
        modal.classList.add("hidden");
    });
}

window.onclick = function(event) {
    if (event.target.classList.contains("modal")) {
        event.target.classList.add("hidden");
    }
}

async function handleAddMenuItem(e) {
    e.preventDefault();
    
    const itemData = {
        name: document.getElementById("itemName").value,
        description: document.getElementById("itemDescription").value,
        category: document.getElementById("itemCategory").value,
        price: parseFloat(document.getElementById("itemPrice").value)
    };
    
    try {
        const response = await fetch(`${API_BASE}/menu`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(itemData)
        });
        
        if (!response.ok) throw new Error("Failed to add item");
        
        alert("Menu item added!");
        closeAllModals();
        loadMenu();
        loadMenuManagement();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function handleEditMenuItem(e) {
    e.preventDefault();
    
    const itemId = document.getElementById("editItemId").value;
    const itemData = {
        name: document.getElementById("editItemName").value,
        description: document.getElementById("editItemDescription").value,
        category: document.getElementById("editItemCategory").value,
        price: parseFloat(document.getElementById("editItemPrice").value),
        is_available: document.getElementById("editItemAvailable").checked
    };
    
    try {
        const response = await fetch(`${API_BASE}/menu/${itemId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(itemData)
        });
        
        if (!response.ok) throw new Error("Failed to update item");
        
        alert("Menu item updated!");
        closeAllModals();
        loadMenu();
        loadMenuManagement();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

function switchAdminTab(e) {
    const tab = e.target.dataset.tab;
    
    document.querySelectorAll(".admin-tab").forEach(btn => btn.classList.remove("active"));
    e.target.classList.add("active");
    
    document.querySelectorAll(".admin-tab-content").forEach(content => {
        content.classList.remove("active");
    });
    
    document.getElementById(tab + "Tab").classList.add("active");
}
