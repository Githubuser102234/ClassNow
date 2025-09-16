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

  const { title, userId, displayName, photoURL, appId, token } = req.body;

  if (!title || !userId || !displayName || !appId || !token) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await getAuth().verifyIdToken(token); // Verify user is authenticated

    const db = getFirestore();
    const classesRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('classes');
    const newClassRef = classesRef.doc();

    await newClassRef.set({
      title,
      creatorId: userId,
      creatorName: displayName,
      createdAt: Date.now(),
      chatDisabled: false,
      chatLocked: false,
    });

    // Add the creator as the first member
    const membersRef = newClassRef.collection('members');
    await membersRef.doc(userId).set({
      userId,
      displayName,
      photoURL
    });

    res.status(201).json({ classId: newClassRef.id, message: 'Class created successfully' });
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

