module.exports = async (req, res) => {
  console.log('Debug API called');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', req.headers);
  
  res.status(200).json({
    message: 'Debug API working!',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    env: {
      HAS_OPENAI: !!process.env.OPENAI_API_KEY,
      HAS_SUPABASE: !!process.env.SUPABASE_URL,
      HAS_SUPABASE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
}; 