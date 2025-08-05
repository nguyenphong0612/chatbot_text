const db = require('../lib/database');

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

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { conversation_id } = req.query;
    
    if (!conversation_id) {
      return res.status(400).json({ error: 'conversation_id is required' });
    }

    console.log('Getting user info for conversation:', conversation_id);

    // Lấy thông tin user
    const userInfo = await db.getUserInfo(conversation_id);
    
    if (!userInfo) {
      return res.status(404).json({ 
        error: 'User info not found',
        message: 'No user information found for this conversation'
      });
    }

    console.log('✅ User info retrieved:', userInfo);

    res.status(200).json({
      success: true,
      user_info: userInfo,
      conversation_id: conversation_id
    });

  } catch (error) {
    console.error('Error in user-info API:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Có lỗi xảy ra khi lấy thông tin user',
      details: error.message 
    });
  }
}; 