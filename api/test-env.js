module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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

  // Kiểm tra các biến môi trường
  const envCheck = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 
      `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 
      'NOT_SET',
    SUPABASE_URL: process.env.SUPABASE_URL ? 
      `${process.env.SUPABASE_URL.substring(0, 20)}...` : 
      'NOT_SET',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 
      `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...` : 
      'NOT_SET',
    timestamp: new Date().toISOString()
  };

  res.status(200).json(envCheck);
}; 