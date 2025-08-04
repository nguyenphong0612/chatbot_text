const db = require('../lib/database');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    switch (req.method) {
      case 'GET':
        // Lấy tất cả đơn hàng
        const orders = await db.getAllOrders();
        res.status(200).json({ 
          success: true, 
          orders 
        });
        break;

      case 'POST':
        // Tạo đơn hàng mới
        const { items, customer_info, delivery_info } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: 'Danh sách sản phẩm không hợp lệ' });
        }

        // Tính tổng tiền
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Tạo đơn hàng
        const orderData = {
          order_id: `ORD-${Date.now()}`,
          items: items,
          total: total,
          customer_info: customer_info || {},
          delivery_info: delivery_info || {},
          status: 'pending',
          created_at: new Date().toISOString()
        };

        // Lưu vào database
        const newOrder = await db.createOrder(orderData);
        
        res.status(201).json({ 
          success: true, 
          order: newOrder,
          message: 'Đơn hàng đã được tạo thành công!'
        });
        break;

      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in orders API:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
}; 