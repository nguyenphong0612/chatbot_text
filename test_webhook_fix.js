// Script test để kiểm tra fix webhook
const axios = require('axios');

async function testWebhookFix() {
  console.log('🧪 Testing webhook fix...\n');

  // Test 1: Kiểm tra webhook với conversation_id hợp lệ
  console.log('Test 1: Webhook với conversation_id hợp lệ');
  try {
    const response1 = await axios.post('http://localhost:3000/api/webhook', {
      conversation_data: {
        messages: [
          { role: 'user', content: 'Test message' }
        ],
        timestamp: new Date().toISOString(),
        total_messages: 1,
        conversation_id: '550e8400-e29b-41d4-a716-446655440000' // UUID hợp lệ
      }
    });
    
    console.log('✅ Response:', response1.data);
    console.log('✅ conversation_id từ webhook:', response1.data.conversation_id);
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Kiểm tra webhook với conversation_id không hợp lệ
  console.log('Test 2: Webhook với conversation_id không hợp lệ');
  try {
    const response2 = await axios.post('http://localhost:3000/api/webhook', {
      conversation_data: {
        messages: [
          { role: 'user', content: 'Test message' }
        ],
        timestamp: new Date().toISOString(),
        total_messages: 1,
        conversation_id: 'conv_1754374488635_seje7a331' // Format không hợp lệ
      }
    });
    
    console.log('✅ Response:', response2.data);
    console.log('✅ conversation_id từ webhook:', response2.data.conversation_id);
    console.log('✅ Expected: null (vì format không hợp lệ)');
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Kiểm tra database service với UUID hợp lệ
  console.log('Test 3: Database service với UUID hợp lệ');
  try {
    const db = require('./lib/database');
    
    // Test validateConversationId
    const validId = '550e8400-e29b-41d4-a716-446655440000';
    const result = db.validateConversationId(validId);
    console.log('✅ validateConversationId:', result);
    
    // Test isValidUUID
    const isValid = db.isValidUUID(validId);
    console.log('✅ isValidUUID:', isValid);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Kiểm tra database service với UUID không hợp lệ
  console.log('Test 4: Database service với UUID không hợp lệ');
  try {
    const db = require('./lib/database');
    
    // Test validateConversationId với format không hợp lệ
    const invalidId = 'conv_1754374488635_seje7a331';
    try {
      db.validateConversationId(invalidId);
      console.log('❌ Should have thrown error');
    } catch (error) {
      console.log('✅ validateConversationId correctly threw error:', error.message);
    }
    
    // Test isValidUUID
    const isValid = db.isValidUUID(invalidId);
    console.log('✅ isValidUUID:', isValid);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n🎉 Test completed!');
}

// Chạy test
testWebhookFix().catch(console.error); 