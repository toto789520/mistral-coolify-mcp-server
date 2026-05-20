const AUTH_SECRET = process.env.AUTH_SECRET;

async function verifyRequest(req) {
  if (!AUTH_SECRET) {
    return;
  }

  if (!req) {
    throw new Error('Request object is required for authentication');
  }

  const authHeader = req.headers && req.headers.authorization;
  
  if (!authHeader) {
    throw new Error('Authorization header is required');
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (token !== AUTH_SECRET) {
    throw new Error('Invalid authorization token');
  }
}

export default {
  verifyRequest,
};