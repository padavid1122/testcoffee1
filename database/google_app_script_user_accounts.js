function doPost(e) {
  try {
    // Validate event object and parameters
    if (!e || !e.parameter) {
      Logger.log('Invalid request: No parameters provided');
      return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Invalid request: No parameters provided' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const params = e.parameter;
    const action = params.action;
    Logger.log('Received request: action=%s, params=%s', action, JSON.stringify(params));

    if (!action) {
      return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Action is required' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ordersSheet = ss.getSheetByName('Orders');

    if (action === 'getOrdersByDate') {
      const dateStr = params.date; // e.g., '2025-05-03'
      if (!dateStr) {
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Date is required' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const data = ordersSheet.getDataRange().getValues();
      const startDate = new Date(dateStr + 'T00:00:00Z');
      const endDate = new Date(dateStr + 'T23:59:59.999Z');

      const orders = data.slice(1).filter(row => {
        const orderDate = new Date(row[3]);
        return orderDate >= startDate && orderDate <= endDate;
      }).map(row => ({
        username: row[0],
        items: row[1],
        total: row[2],
        timestamp: new Date(row[3]).toISOString()
      }));

      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        orders: orders
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getDailyOrderTotals') {
      const dateStr = params.date; // e.g., '2025-05-03'
      if (!dateStr) {
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Date is required' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const data = ordersSheet.getDataRange().getValues();
      const startDate = new Date(dateStr + 'T00:00:00Z');
      const endDate = new Date(dateStr + 'T23:59:59.999Z');

      let orderCount = 0;
      let totalValue = 0;
      const uniqueCustomers = new Set();

      // Skip header row
      for (let i = 1; i < data.length; i++) {
        const orderDate = new Date(data[i][3]); // Timestamp column
        if (orderDate >= startDate && orderDate <= endDate) {
          orderCount++;
          totalValue += parseFloat(data[i][2]); // Total column
          uniqueCustomers.add(data[i][0]); // Username column
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        result: 'success',
        date: dateStr,
        orderCount: orderCount,
        uniqueCustomers: uniqueCustomers.size,
        totalValue: totalValue
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getAllOrders') {
      const data = ordersSheet.getDataRange().getValues();
      const headers = data[0];
      const orders = data.slice(1).map(row => ({
        username: row[0],
        items: row[1],
        total: row[2],
        timestamp: new Date(row[3]).toISOString()
      }));
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', orders }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'saveOrder') {
      const username = params.username;
      const items = params.items;
      const total = parseFloat(params.total);
      const timestamp = new Date().toISOString();
      if (!username || !items || isNaN(total)) {
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Missing required fields' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      ordersSheet.appendRow([username, items, total, timestamp]);
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Order saved' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getOrders') {
      const username = params.username;
      if (!username) {
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Username is required' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const data = ordersSheet.getDataRange().getValues();
      const orders = data.slice(1).filter(row => row[0] === username).map(row => ({
        username: row[0],
        items: row[1],
        total: row[2],
        timestamp: new Date(row[3]).toISOString()
      }));
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', orders }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'register') {
      const usersSheet = ss.getSheetByName('Users');
      const username = params.username;
      const email = params.email;
      const password = params.password;
      if (!username || !email || !password) {
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Missing required fields' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const timestamp = new Date().toISOString();
      const isAdmin = (email === 'admin@coffee.com') ? 'TRUE' : 'FALSE';
      usersSheet.appendRow([email, password, username, timestamp, isAdmin]);
      return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Registration saved' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'login') {
      const usersSheet = ss.getSheetByName('Users');
      const email = params.email;
      const password = params.password;
      if (!email || !password) {
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Email and password are required' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const data = usersSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === email && data[i][1] === password) {
          Logger.log('Login successful: username=%s, isAdmin=%s', data[i][2], data[i][4]);
          return ContentService.createTextOutput(JSON.stringify({
            result: 'success',
            message: 'Login successful',
            username: data[i][2],
            isAdmin: data[i][4] === 'TRUE'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Invalid email or password' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error: action=%s, message=%s', action || 'unknown', error.message);
    return ContentService.createTextOutput(JSON.stringify({ result: 'error', error: 'Server error: ' + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}