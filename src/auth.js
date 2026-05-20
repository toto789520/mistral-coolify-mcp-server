const AUTH_SECRET = process.env.AUTH_SECRET;

async function verifyRequest(req) {
  if (!AUTH_SECRET) {
    console.log('[AUTH] No AUTH_SECRET configured, allowing all requests');
    return true;
  }

  if (!req) {
    console.log('[AUTH] No request object provided, but AUTH_SECRET is set');
    return false;
  }

  const authHeader = req.headers && req.headers.authorization;
  console.log('[AUTH] authHeader present:', !!authHeader);
  
  if (!authHeader) {
    console.log('[AUTH] Authorization header missing');
    return false;
  }

  const token = authHeader.replace('Bearer ', '');
  console.log('[AUTH] Token extracted, length:', token.length);
  
  if (token !== AUTH_SECRET) {
    console.log('[AUTH] Token mismatch');
    return false;
  }
  
  console.log('[AUTH] Authentication successful');
  return true;
}

export default {
  verifyRequest,
};