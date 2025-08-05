const OpenAI = require('openai');
const db = require('../lib/database');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function để kiểm tra thông tin khách hàng còn thiếu
function checkMissingCustomerInfo(conversationHistory) {
  const requiredInfo = ['name', 'email', 'phone', 'company'];
  const missingInfo = [];
  
  // Tạo text từ conversation history để phân tích
  const conversationText = conversationHistory
    .map(msg => msg.content)
    .join(' ')
    .toLowerCase();
  
  // Kiểm tra email (tìm pattern email hoặc từ khóa)
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (!emailPattern.test(conversationText) && 
      !conversationText.includes('email') && 
      !conversationText.includes('gmail') && 
      !conversationText.includes('yahoo') && 
      !conversationText.includes('hotmail')) {
    missingInfo.push('email');
  }
  
  // Kiểm tra số điện thoại (tìm pattern số điện thoại Việt Nam)
  const phonePattern = /(0|\+84)[3|5|7|8|9][0-9]{8}/;
  if (!phonePattern.test(conversationText) && 
      !conversationText.includes('số điện thoại') && 
      !conversationText.includes('sdt') && 
      !conversationText.includes('phone')) {
    missingInfo.push('phone');
  }
  
  // Kiểm tra tên (tìm các từ có thể là tên)
  const namePattern = /(tôi là|tên tôi|gọi tôi|tên của tôi|tôi tên)\s+([a-zA-ZÀ-ỹ\s]+)/;
  if (!namePattern.test(conversationText) && 
      !conversationText.includes('tên') && 
      !conversationText.includes('gọi')) {
    missingInfo.push('name');
  }
  
  // Kiểm tra công ty/ngành nghề
  if (!conversationText.includes('công ty') && 
      !conversationText.includes('ngành') && 
      !conversationText.includes('làm việc') && 
      !conversationText.includes('công việc') && 
      !conversationText.includes('văn phòng') && 
      !conversationText.includes('doanh nghiệp')) {
    missingInfo.push('company');
  }
  
  return missingInfo;
}

// Function để trích xuất thông tin user từ conversation
function extractUserInfoFromConversation(conversationHistory) {
  const conversationText = conversationHistory
    .map(msg => msg.content)
    .join(' ')
    .toLowerCase();
  
  const userInfo = {};
  
  // Trích xuất email
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const emailMatch = conversationText.match(emailPattern);
  if (emailMatch) {
    userInfo.email = emailMatch[0];
  }
  
  // Trích xuất số điện thoại
  const phonePattern = /(0|\+84)[3|5|7|8|9][0-9]{8}/;
  const phoneMatch = conversationText.match(phonePattern);
  if (phoneMatch) {
    userInfo.phone_number = phoneMatch[0];
  }
  
  // Trích xuất tên (đơn giản)
  const namePattern = /(tôi là|tên tôi|gọi tôi|tên của tôi|tôi tên)\s+([a-zA-ZÀ-ỹ\s]{2,20})/;
  const nameMatch = conversationText.match(namePattern);
  if (nameMatch) {
    userInfo.name = nameMatch[2].trim();
  }
  
  // Trích xuất công ty (đơn giản)
  const companyPatterns = [
    /(công ty|cty|company)\s+([a-zA-ZÀ-ỹ\s]{2,30})/,
    /(làm việc tại|làm tại)\s+([a-zA-ZÀ-ỹ\s]{2,30})/,
    /(ngành|industry)\s+([a-zA-ZÀ-ỹ\s]{2,30})/
  ];
  
  for (const pattern of companyPatterns) {
    const match = conversationText.match(pattern);
    if (match) {
      userInfo.company = match[2].trim();
      break;
    }
  }
  
  return userInfo;
}

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

CUSTOMER INFO TO COLLECT (REQUIRED):
- Tên khách hàng (bắt buộc)
- Email (bắt buộc)
- Số điện thoại (bắt buộc)
- Ngành nghề/Công ty (bắt buộc)
- Vị trí công việc (nếu có)
- Thời gian rảnh
- Nhu cầu/Vấn đề cụ thể
- Ghi chú bổ sung

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ALWAYS respond in Vietnamese
2. ALWAYS check conversation history before responding
3. NEVER ask for information that has already been provided
4. If customer already gave their name, email, phone, company - DO NOT ask again
5. Ask ONLY ONE question at a time
6. If customer asks about menu, provide specific items and prices
7. If customer wants to order, guide them through the process
8. If customer has complaints, be empathetic and offer solutions
9. Be friendly, professional, and helpful
10. Keep responses concise but informative

CUSTOMER INFO COLLECTION STRATEGY:
- Mục tiêu: Thu thập đầy đủ thông tin khách hàng trong mỗi cuộc trò chuyện
- Phương pháp: Hỏi một cách tự nhiên, không quá trực tiếp
- Thứ tự ưu tiên: Tên → Email → Số điện thoại → Công ty/Ngành nghề
- Nếu khách hàng chưa cung cấp thông tin nào, bắt đầu hỏi từ tên
- LUÔN chủ động hỏi thông tin còn thiếu trong quá trình trò chuyện
- Nếu khách hàng chưa cung cấp email, số điện thoại, hoặc thông tin công ty, hãy hỏi một cách lịch sự
- Kết hợp việc hỏi thông tin với việc tư vấn sản phẩm
- THÔNG TIN SẼ ĐƯỢC TỰ ĐỘNG LƯU VÀO HỆ THỐNG khi khách hàng cung cấp
- Đảm bảo hỏi đủ 4 thông tin: tên, email, số điện thoại, công ty/ngành nghề

CONVERSATION FLOW:
1. Chào hỏi và giới thiệu
2. Hỏi nhu cầu của khách hàng
3. Thu thập thông tin cá nhân (nếu chưa có)
4. Tư vấn sản phẩm/dịch vụ
5. Hướng dẫn đặt hàng (nếu cần)
6. Kết thúc và cảm ơn

EXAMPLE RESPONSES FOR INFO COLLECTION:
- "Chào bạn! Tôi có thể gọi bạn là gì ạ?" (hỏi tên)
- "Để tôi có thể gửi thông tin chi tiết, bạn có thể cho tôi email của bạn không?" (hỏi email)
- "Để liên hệ thuận tiện, bạn có thể cho tôi số điện thoại không?" (hỏi số điện thoại)
- "Bạn làm việc ở công ty nào vậy? Để tôi có thể tư vấn phù hợp hơn." (hỏi công ty)
- "Cảm ơn bạn [tên]! Tôi đã ghi nhận thông tin. Bây giờ tôi có thể giúp bạn [yêu cầu hiện tại]"

COMBINED INFO COLLECTION EXAMPLES:
- "Bánh su kem của chúng tôi rất phù hợp cho văn phòng. Bạn làm việc ở công ty nào vậy? Để tôi có thể tư vấn số lượng phù hợp."
- "Tôi sẽ gửi thông tin chi tiết về menu qua email. Bạn có thể cho tôi email của bạn không?"
- "Để đặt hàng thuận tiện, bạn có thể cho tôi số điện thoại để chúng tôi liên hệ xác nhận không?"
- "Dựa trên nhu cầu của bạn, tôi nghĩ combo này sẽ phù hợp. Bạn làm việc ở ngành nào vậy? Để tôi có thể tư vấn thêm."

EXAMPLE RESPONSES FOR CONTINUING CONVERSATION:
- "Chào bạn [tên]! Tôi nhớ bạn đã hỏi về [thông tin trước đó]. Bây giờ bạn cần gì thêm?"
- "Tôi thấy bạn quan tâm đến [sản phẩm]. Đây là thông tin chi tiết..."
- "Dựa trên thông tin bạn đã cung cấp, tôi nghĩ [sản phẩm] sẽ phù hợp với nhu cầu của bạn."`

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
          
          // Log thông tin user được lưu
          if (analyzeData.analysis && analyzeData.analysis.user_info) {
            const userInfo = analyzeData.analysis.user_info;
            console.log('📝 User info extracted and saved:');
            console.log('- Name:', userInfo.name || 'Not provided');
            console.log('- Email:', userInfo.email || 'Not provided');
            console.log('- Phone:', userInfo.phone_number || 'Not provided');
            console.log('- Company:', userInfo.company || 'Not provided');
            console.log('- Position:', userInfo.position || 'Not provided');
            console.log('- Lead Quality:', analyzeData.analysis.lead_quality || 'Not assessed');
          }
        } else {
          console.log('❌ Analysis API returned error:', analyzeResponse.status);
        }
      } catch (analyzeError) {
        console.log('❌ Auto-analysis failed:', analyzeError.message);
      }
    }

    // Kiểm tra và nhắc nhở thu thập thông tin nếu chưa đầy đủ
    const missingInfo = checkMissingCustomerInfo(conversationHistory);
    if (missingInfo.length > 0 && totalMessages >= 4) {
      console.log('Missing customer info:', missingInfo);
      // Thêm gợi ý vào response nếu cần
    }

    // Tự động lưu thông tin user nếu có đủ thông tin
    if (totalMessages >= 3) {
      try {
        const extractedUserInfo = extractUserInfoFromConversation(conversationHistory);
        if (Object.keys(extractedUserInfo).length > 0) {
          console.log('📝 Extracted user info:', extractedUserInfo);
          
          // Kiểm tra xem đã có user info chưa
          const existingUserInfo = await db.getUserInfo(currentConversationId);
          
          if (existingUserInfo) {
            // Cập nhật thông tin hiện có
            const updatedUserInfo = { ...existingUserInfo, ...extractedUserInfo };
            await db.updateUserInfo(currentConversationId, updatedUserInfo);
            console.log('✅ Updated existing user info');
          } else {
            // Lưu thông tin mới
            await db.saveUserInfo(currentConversationId, extractedUserInfo);
            console.log('✅ Saved new user info');
          }
        }
      } catch (userInfoError) {
        console.log('❌ Error saving user info:', userInfoError.message);
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