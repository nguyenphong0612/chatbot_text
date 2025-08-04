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
        // Trả về menu
        const menu = {
          categories: [
            {
              name: "Bánh ngọt tươi",
              items: [
                { id: 1, name: "Bánh tiramisu", price: 45000, description: "Bánh tiramisu truyền thống Ý" },
                { id: 2, name: "Bánh chocolate", price: 35000, description: "Bánh chocolate đậm đà" },
                { id: 3, name: "Bánh cheesecake", price: 40000, description: "Cheesecake mềm mịn" },
                { id: 4, name: "Bánh croissant", price: 25000, description: "Croissant giòn xốp" }
              ]
            },
            {
              name: "Đồ ăn nhanh",
              items: [
                { id: 5, name: "Burger bò", price: 65000, description: "Burger bò với rau tươi" },
                { id: 6, name: "Sandwich gà", price: 55000, description: "Sandwich gà nướng" },
                { id: 7, name: "Khoai tây chiên", price: 30000, description: "Khoai tây chiên giòn" },
                { id: 8, name: "Gà rán", price: 75000, description: "Gà rán giòn với sốt đặc biệt" }
              ]
            },
            {
              name: "Đồ uống",
              items: [
                { id: 9, name: "Cà phê đen", price: 25000, description: "Cà phê đen đậm đà" },
                { id: 10, name: "Cà phê sữa", price: 30000, description: "Cà phê sữa ngọt ngào" },
                { id: 11, name: "Smoothie dâu", price: 45000, description: "Smoothie dâu tươi" },
                { id: 12, name: "Trà sữa", price: 35000, description: "Trà sữa thơm ngon" }
              ]
            }
          ],
          promotions: [
            {
              id: 1,
              name: "Combo bữa sáng",
              description: "Bánh + cà phê chỉ 50,000đ",
              discount: 20,
              valid_until: "2024-12-31"
            },
            {
              id: 2,
              name: "Giảm giá giao hàng",
              description: "Miễn phí giao hàng cho đơn từ 200,000đ",
              discount: 0,
              valid_until: "2024-12-31"
            }
          ]
        };
        
        res.status(200).json({ 
          success: true, 
          menu 
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
        const order = {
          order_id: `ORD-${Date.now()}`,
          items: items,
          total: total,
          customer_info: customer_info || {},
          delivery_info: delivery_info || {},
          status: 'pending',
          created_at: new Date().toISOString()
        };

        // Lưu vào database (có thể mở rộng sau)
        console.log('New order:', order);
        
        res.status(201).json({ 
          success: true, 
          order,
          message: 'Đơn hàng đã được tạo thành công!'
        });
        break;

      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in menu API:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
}; 