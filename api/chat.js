const OpenAI = require('openai');
const db = require('../lib/database');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const { message, conversation_id, user_info } = req.body;
    
    console.log('=== CHAT API DEBUG ===');
    console.log('Received request with conversation_id:', conversation_id);
    console.log('Message:', message);
    console.log('User info:', user_info);
    
    // Kiểm tra cấu trúc bảng trước khi thực hiện các thao tác
    console.log('Checking database table structure...');
    const tableStructureOk = await db.checkTableStructure();
    if (!tableStructureOk) {
      console.error('❌ Database table structure check failed');
      return res.status(500).json({ 
        error: 'Database configuration error',
        details: 'Table structure check failed'
      });
    }
    console.log('✅ Database table structure check passed');
    
    if (!message) {
      return res.status(400).json({ error: 'Vui lòng nhập tin nhắn' });
    }

    // Tạo conversation mới nếu chưa có hoặc conversation_id không hợp lệ
    let currentConversationId = conversation_id;
    try {
      if (!currentConversationId) {
        // Tạo conversation mới khi không có conversation_id
        console.log('Creating new conversation...');
        const newConversation = await db.createConversation();
        currentConversationId = newConversation.conversation_id;
        console.log('✅ Created new conversation with ID:', currentConversationId);
        
        // Lưu thông tin user nếu có
        if (user_info) {
          console.log('Saving user info...');
          await db.saveUserInfo(currentConversationId, user_info);
          console.log('✅ User info saved');
        }
      } else {
        // Kiểm tra conversation_id có hợp lệ không
        try {
          db.validateConversationId(currentConversationId);
          console.log('✅ Using existing conversation ID:', currentConversationId);
        } catch (error) {
          // Nếu conversation_id không hợp lệ, tạo mới
          console.warn('❌ Invalid conversation ID format, creating new conversation:', currentConversationId);
          const newConversation = await db.createConversation();
          currentConversationId = newConversation.conversation_id;
          console.log('✅ Created new conversation with ID:', currentConversationId);
          
          // Lưu thông tin user nếu có
          if (user_info) {
            console.log('Saving user info...');
            await db.saveUserInfo(currentConversationId, user_info);
            console.log('✅ User info saved');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error creating/validating conversation:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    // Lấy conversation history từ database để context
    let conversationHistory = [];
    try {
      console.log('Loading conversation history...');
      const conversation = await db.getConversation(currentConversationId);
      if (conversation && conversation.content) {
        conversationHistory = conversation.content;
        console.log('✅ Loaded conversation history, messages count:', conversationHistory.length);
      } else {
        console.log('No existing conversation history found');
      }
    } catch (error) {
      console.log('❌ Could not load conversation history:', error.message);
    }

    // Lưu user message vào database
    console.log('Saving user message to database...');
    try {
      await db.addMessage(currentConversationId, {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
      console.log('✅ User message saved');
    } catch (error) {
      console.error('❌ Error saving user message:', error);
      throw new Error(`Failed to save user message: ${error.message}`);
    }

    // Chuẩn bị messages cho OpenAI
    const messages = [
      {
        role: "system",
        content: `You are a friendly Vietnamese virtual assistant for "Sweet & Fast Delights" bakery and fast food company.

COMPANY INFO:
- Name: Sweet & Fast Delights
- Website: https://metzbakery.vn/
- Phone: 0967149228
- Address: CT7C Spark Dương Nội, Hà Đông, Hà Nội
- Hours: 7AM-10PM
- Delivery: $2 within 5 miles

MENU CATEGORIES:
🍰 Baked Goods: Bánh ngọt, bánh kem, bánh mì
🍔 Fast Food: Burger, pizza, gà rán
🥤 Beverages: Nước ép, cà phê, trà sữa
🌱 Vegan/Gluten-free: Bánh chay, không gluten

CUSTOMER INFO TO COLLECT (subtly):
- Tên khách hàng
- Email
- Số điện thoại
- Ngành nghề/Công ty
- Thời gian rảnh
- Nhu cầu/Vấn đề
- Ghi chú

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ALWAYS respond in Vietnamese
2. ALWAYS check conversation history before responding
3. NEVER ask for information that has already been provided
4. If customer already gave their name, email, phone - DO NOT ask again
5. Ask ONLY ONE question at a time
6. If customer asks about menu, provide specific items and prices
7. If customer wants to order, guide them through the process
8. If customer has complaints, be empathetic and offer solutions
9. Be friendly, professional, and helpful
10. Keep responses concise but informative

CONVERSATION FLOW:
- First, check if this is a new conversation or continuing
- If new: Welcome and ask what they need
- If continuing: Use previous context to provide personalized help
- Always acknowledge what you already know about the customer
- Focus on their current request while using their known information

EXAMPLE RESPONSES:
- "Chào bạn [tên]! Tôi nhớ bạn đã hỏi về [thông tin trước đó]. Bây giờ bạn cần gì thêm?"
- "Cảm ơn bạn đã cung cấp thông tin. Bây giờ tôi có thể giúp bạn [yêu cầu hiện tại]"
- "Tôi thấy bạn quan tâm đến [sản phẩm]. Đây là thông tin chi tiết..."`

      }
    ];

    // Thêm conversation history (chỉ lấy 10 messages gần nhất để tránh token limit)
    const recentMessages = conversationHistory.slice(-10);
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // Thêm message hiện tại
    messages.push({
      role: "user",
      content: message
    });

    console.log('Calling OpenAI API...');
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: 800,
      temperature: 0.7,
    });

    const botResponse = completion.choices[0].message.content;
    console.log('✅ Received OpenAI response');
    
    // Lưu bot response vào database
    console.log('Saving bot response to database...');
    try {
      await db.addMessage(currentConversationId, {
        role: 'assistant',
        content: botResponse,
        timestamp: new Date().toISOString()
      });
      console.log('✅ Bot response saved');
    } catch (error) {
      console.error('❌ Error saving bot response:', error);
      throw new Error(`Failed to save bot response: ${error.message}`);
    }

    // Tự động phân tích và lưu thông tin khách hàng sau mỗi 3 messages
    const totalMessages = conversationHistory.length + 2; // +2 vì đã thêm user message và bot response
    if (totalMessages % 3 === 0) {
      try {
        console.log('Auto-analyzing conversation for customer info...');
        // Gọi API analyze để trích xuất thông tin
        const analyzeResponse = await fetch(`${req.protocol}://${req.get('host')}/api/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversation_id: currentConversationId })
        });
        
        if (analyzeResponse.ok) {
          const analyzeData = await analyzeResponse.json();
          console.log('✅ Analysis result:', analyzeData.analysis);
        }
      } catch (analyzeError) {
        console.log('❌ Auto-analysis failed:', analyzeError.message);
      }
    }
    
    console.log('=== CHAT API COMPLETED ===');
    res.status(200).json({ 
      response: botResponse,
      conversation_id: currentConversationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== CHAT API ERROR ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    let errorMessage = 'Có lỗi xảy ra khi xử lý yêu cầu';
    
    if (error.status === 401) {
      errorMessage = 'API key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.';
    } else if (error.status === 429) {
      errorMessage = 'Đã vượt quá giới hạn API. Vui lòng thử lại sau.';
    } else if (error.status === 500) {
      errorMessage = 'Lỗi server OpenAI. Vui lòng thử lại sau.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
}; 