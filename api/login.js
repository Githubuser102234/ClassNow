const { getAuth } = require('firebase-admin/auth');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let initialized = false;
if (!initialized) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
    initialized = true;
  } catch (e) {
    if (!e.message.includes('already exists')) {
      console.error('Firebase Admin initialization error:', e);
    }
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'ID token is required' });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const customToken = await getAuth().createCustomToken(uid);
    res.status(200).json({ customToken });
  } catch (error) {
    console.error('Error creating custom token:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

