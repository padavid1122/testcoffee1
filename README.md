<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coffee Shop - Admin Dashboard</title>
    <link href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@7.12.15/dist/sweetalert2.all.min.js"></script>
    <style>
        .table-responsive {
            margin-top: 20px;
        }
        .notification-alert {
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 1000;
            display: none;
            min-width: 250px;
        }
        .filter-section {
            margin-bottom: 20px;
        }
    </style>
</head>
<body class="bg-light">
    <!-- Navigation Bar -->
    <nav class="navbar navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" href="#">Coffee Shop Admin</a>
            <div>
                <span class="text-white mr-3" id="welcome-text"></span>
                <a href="coffee_shop_auth.html" class="text-white">Logout</a>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <div class="container mt-5">
        <h2 class="text-center mb-4">Admin Dashboard</h2>
        <div class="notification-alert" id="new-order-alert">
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <strong id="new-order-text">New Order!</strong> <span id="new-order-count"></span>
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                    <span aria-hidden="true">×</span>
                </button>
            </div>
        </div>

        <!-- Filter Section -->
        <div class="card filter-section">
            <div class="card-body">
                <h3 class="card-title">Filter Orders</h3>
                <div class="form-row">
                    <div class="form-group col-md-4">
                        <label for="filter-date">Date</label>
                        <input type="date" class="form-control" id="filter-date">
                    </div>
                    <div class="form-group col-md-4">
                        <label for="filter-username">Username</label>
                        <input type="text" class="form-control" id="filter-username" placeholder="Enter username">
                    </div>
                    <div class="form-group col-md-4 align-self-end">
                        <button class="btn btn-primary btn-block" onclick="applyFilters()">Filter</button>
                        <button class="btn btn-secondary btn-block mt-2" onclick="clearFilters()">Clear Filters</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Customer Orders Section -->
        <div class="card">
            <div class="card-body">
                <h3 class="card-title">Customer Orders</h3>
                <button class="btn btn-info btn-block mb-3" onclick="fetchOrders()">View All Orders</button>
                <div id="order-list" class="table-responsive">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody id="order-list-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Audio for notification sound -->
    <audio id="notification-sound" src="https://www.soundjay.com/buttons/beep-01a.mp3"></audio>

    <script>
        // Note: Replace with new scriptURL after redeploying Google Apps Script.
        const scriptURL = "https://script.google.com/macros/s/AKfycbytUFnVr_6QQBQIjoLV2I0DRyYAjjDx5giuLMrKxr0wE4yP6TlCZxMIJys0HmUUbGHm/exec";

        // Get username from URL
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('username') || 'Admin';
        document.getElementById('welcome-text').textContent = `Welcome, ${username}!`;

        // Store previous orders to detect new ones
        let previousOrders = [];
        let fetchRetryCount = 0;
        const maxRetries = 3;
        const baseRetryDelay = 5000; // 5 seconds
        let currentFilter = { date: null, username: null };

        // Debounce function to prevent rapid filter requests
        function debounce(func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        // Request notification permission
        function requestNotificationPermission() {
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        console.log('Notification permission granted');
                    }
                });
            }
        }

        // Show browser notification
        function showBrowserNotification(order) {
            if (Notification.permission === 'granted') {
                new Notification('New Coffee Order!', {
                    body: `Order from ${order.username}: ${order.items} ($${parseFloat(order.total).toFixed(2)})`,
                    icon: 'https://placehold.co/100x100?text=Coffee'
                });
            }
        }

        // Show visual notification with count
        function showVisualNotification(newOrderCount) {
            const alert = document.getElementById('new-order-alert');
            const text = document.getElementById('new-order-text');
            const count = document.getElementById('new-order-count');
            text.textContent = newOrderCount > 1 ? `${newOrderCount} New Orders!` : 'New Order!';
            count.textContent = newOrderCount > 1 ? `${newOrderCount} orders placed.` : 'A new customer order has been placed.';
            alert.style.display = 'block';
            // Keep visible until manually dismissed
        }

        // Play notification sound
        function playNotificationSound() {
            const sound = document.getElementById('notification-sound');
            sound.play().catch(error => {
                console.error('Failed to play notification sound:', error.message);
            });
        }

        // Client-side date filtering
        function filterOrdersByDate(orders, date) {
            console.log('Filtering orders by date:', { date, orderCount: orders.length });
            const startDate = new Date(date + 'T00:00:00Z');
            const endDate = new Date(date + 'T23:59:59.999Z');
            console.log('Date range:', { startDate: startDate.toISOString(), endDate: endDate.toISOString() });

            const filtered = orders.filter(order => {
                const orderDate = new Date(order.timestamp);
                const isMatch = orderDate >= startDate && orderDate <= endDate;
                console.log('Checking order:', { timestamp: order.timestamp, isMatch });
                return isMatch;
            });

            console.log('Filtered orders:', { count: filtered.length });
            return filtered;
        }

        // Client-side username filtering
        function filterOrdersByUsername(orders, username) {
            return orders.filter(order => order.username.toLowerCase() === username.toLowerCase());
        }

        // Fetch orders
        function fetchOrders(filter = currentFilter, autoFetch = false) {
            const formData = new FormData();
            const action = 'getAllOrders';
            formData.append('action', action.trim());

            console.log('Fetching orders:', { action, filter });

            fetch(scriptURL, { method: 'POST', body: formData })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Network error: HTTP ${response.status} ${response.statusText}`);
                    }
                    fetchRetryCount = 0; // Reset retry count on success
                    return response.text();
                })
                .then(text => {
                    let data;
                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        throw new Error('Invalid JSON response: ' + text.slice(0, 100));
                    }

                    if (data.result === 'success') {
                        let orders = data.orders;

                        // Apply client-side filters
                        if (filter.date) {
                            orders = filterOrdersByDate(orders, filter.date);
                        } else if (filter.username) {
                            orders = filterOrdersByUsername(orders, filter.username);
                        }

                        // Check for new orders (always check unfiltered orders for notifications)
                        if (!filter.date && !filter.username && previousOrders.length > 0) {
                            const newOrders = data.orders.filter(order => 
                                !previousOrders.some(prev => prev.timestamp === order.timestamp)
                            );
                            if (newOrders.length > 0) {
                                newOrders.forEach(order => {
                                    showBrowserNotification(order);
                                });
                                showVisualNotification(newOrders.length);
                                playNotificationSound();
                            }
                        }
                        previousOrders = [...data.orders];
                        displayOrders(orders);
                    } else {
                        const errorMsg = data.error || 'Unknown backend error';
                        console.error(`Fetch orders error: ${errorMsg}`, { action, filter, response: text });
                        if (!autoFetch) {
                            swal('Error', `Failed to fetch orders: ${errorMsg}`, 'error');
                        }
                    }
                })
                .catch(error => {
                    console.error('Fetch orders failed:', error.message, { action, filter, retryCount: fetchRetryCount });
                    fetchRetryCount++;
                    if (fetchRetryCount < maxRetries) {
                        const retryDelay = baseRetryDelay * Math.pow(2, fetchRetryCount);
                        setTimeout(() => fetchOrders(filter, autoFetch), retryDelay);
                    } else {
                        if (!autoFetch) {
                            swal('Error', `Failed to fetch orders: ${error.message}`, 'error');
                        }
                    }
                });
        }

        // Display orders in table
        function displayOrders(orders) {
            const orderListBody = document.getElementById('order-list-body');
            orderListBody.innerHTML = '';

            if (orders.length === 0) {
                orderListBody.innerHTML = '<tr><td colspan="4" class="text-center">No orders found for the selected filter.</td></tr>';
                if (currentFilter.date) {
                    swal('Info', `No orders found for ${currentFilter.date}.`, 'info');
                } else if (currentFilter.username) {
                    swal('Info', `No orders found for username "${currentFilter.username}".`, 'info');
                }
                return;
            }

            orders.forEach(order => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.username}</td>
                    <td>${order.items}</td>
                    <td>$${parseFloat(order.total).toFixed(2)}</td>
                    <td>${new Date(order.timestamp).toLocaleString()}</td>
                `;
                orderListBody.appendChild(row);
            });
        }

        // Apply filters with validation
        function applyFilters() {
            const date = document.getElementById('filter-date').value;
            const username = document.getElementById('filter-username').value.trim();

            if (date && username) {
                swal('Error', 'Please select only one filter: date or username', 'error');
                return;
            }

            if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                swal('Error', 'Invalid date format', 'error');
                return;
            }

            if (username && username.length < 1) {
                swal('Error', 'Username cannot be empty', 'error');
                return;
            }

            currentFilter = { date: date || null, username: username || null };
            debouncedFetchOrders(currentFilter);
        }

        // Clear filters
        function clearFilters() {
            document.getElementById('filter-date').value = '';
            document.getElementById('filter-username').value = '';
            currentFilter = { date: null, username: null };
            debouncedFetchOrders(currentFilter);
        }

        // Debounced fetchOrders to prevent rapid requests
        const debouncedFetchOrders = debounce(fetchOrders, 500);

        // Poll for new orders every 10 seconds, only if page is visible
        function startOrderPolling() {
            fetchOrders(currentFilter, true); // Initial fetch
            setInterval(() => {
                if (!document.hidden) {
                    fetchOrders(currentFilter, true);
                }
            }, 10000); // Poll every 10 seconds
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            requestNotificationPermission();
            startOrderPolling();
        });
    </script>
</body>
</html>
