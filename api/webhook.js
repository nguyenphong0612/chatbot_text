const axios = require('axios');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { conversation_data } = req.body;
    
    if (!conversation_data) {
      return res.status(400).json({ error: 'conversation_data is required' });
    }

    // Webhook URL
    const webhookUrl = 'https://hook.eu2.make.com/iffn0r2fo7uex5vxeic3y2t93r8ul66t';

    // Gửi dữ liệu đến webhook
    const webhookResponse = await axios.post(webhookUrl, {
      conversation_data: conversation_data
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 giây timeout
    });

    // Kiểm tra response từ webhook
    if (webhookResponse.status === 200) {
      const webhookData = webhookResponse.data;
      
      // Kiểm tra và xử lý conversation_id từ webhook
      let conversationId = webhookData.conversation_id;
      
      // Nếu webhook trả về conversation_id không phải UUID format, 
      // chúng ta sẽ không sử dụng nó để tránh lỗi database
      if (conversationId && !conversationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
        console.warn('Webhook returned invalid conversation_id format:', conversationId);
        conversationId = null; // Không sử dụng conversation_id không hợp lệ
      }
      
      // Trả về dữ liệu từ webhook
      res.status(200).json({
        success: true,
        conversation_id: conversationId, // Có thể là null nếu không hợp lệ
        messages: webhookData.messages,
        timestamp: webhookData.timestamp,
        webhook_response: webhookData
      });
    } else {
      throw new Error(`Webhook returned status: ${webhookResponse.status}`);
    }

  } catch (error) {
    console.error('Webhook Error:', error);
    
    let errorMessage = 'Có lỗi xảy ra khi kết nối với webhook';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Không thể kết nối đến webhook. Vui lòng kiểm tra URL.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Webhook không phản hồi trong thời gian chờ.';
    } else if (error.response) {
      errorMessage = `Webhook trả về lỗi: ${error.response.status}`;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
}; 