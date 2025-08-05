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

    // Log dữ liệu đầu vào để debug
    console.log('Webhook input data:', JSON.stringify(conversation_data, null, 2));

    // Webhook URL
    const webhookUrl = 'https://hook.eu2.make.com/iffn0r2fo7uex5vxeic3y2t93r8ul66t';

    // Gửi dữ liệu đến webhook
    console.log('Sending data to webhook:', webhookUrl);
    
    const webhookResponse = await axios.post(webhookUrl, {
      conversation_data: conversation_data
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000 // Tăng timeout lên 15 giây
    });

    console.log('Webhook response status:', webhookResponse.status);
    console.log('Webhook response data:', webhookResponse.data);

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
    console.error('Webhook Error Details:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error status:', error.response?.status);
    console.error('Error data:', error.response?.data);
    console.error('Error config:', {
      url: error.config?.url,
      method: error.config?.method,
      timeout: error.config?.timeout,
      headers: error.config?.headers
    });
    
    let errorMessage = 'Có lỗi xảy ra khi kết nối với webhook';
    let statusCode = 500;
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Không thể kết nối đến webhook. Vui lòng kiểm tra URL.';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Webhook không phản hồi trong thời gian chờ.';
      statusCode = 504;
    } else if (error.response) {
      // Xử lý các status code khác nhau
      switch (error.response.status) {
        case 400:
          errorMessage = 'Dữ liệu gửi đến webhook không hợp lệ.';
          statusCode = 400;
          break;
        case 401:
          errorMessage = 'Không có quyền truy cập webhook.';
          statusCode = 401;
          break;
        case 403:
          errorMessage = 'Truy cập bị từ chối bởi webhook.';
          statusCode = 403;
          break;
        case 404:
          errorMessage = 'Webhook không tồn tại.';
          statusCode = 404;
          break;
        case 500:
          errorMessage = 'Webhook gặp lỗi nội bộ. Vui lòng thử lại sau.';
          statusCode = 502; // Bad Gateway
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = 'Webhook tạm thời không khả dụng. Vui lòng thử lại sau.';
          statusCode = 502;
          break;
        default:
          errorMessage = `Webhook trả về lỗi: ${error.response.status}`;
          statusCode = 502;
      }
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.message,
      status: error.response?.status,
      webhook_data: error.response?.data
    });
  }
}; 