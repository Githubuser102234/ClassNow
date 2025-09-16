const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

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

  const { classId, userId, displayName, photoURL, appId, token } = req.body;

  if (!classId || !userId || !displayName || !appId || !token) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await getAuth().verifyIdToken(token); // Verify user is authenticated

    const db = getFirestore();
    const classRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('classes').doc(classId);
    const classDoc = await classRef.get();

    if (!classDoc.exists) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Add user to members subcollection
    const membersRef = classRef.collection('members');
    await membersRef.doc(userId).set({
      userId,
      displayName,
      photoURL
    });

    res.status(200).json({ message: 'Successfully joined class' });
  } catch (error) {
    console.error('Error joining class:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

