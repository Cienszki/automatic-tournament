
import { adminApp } from '../lib/admin';
import { getFirestore } from 'firebase-admin/firestore';

async function listCollections() {
  const db = getFirestore(adminApp);
  const collections = await db.listCollections();
  collections.forEach(collection => {
    console.log('Found collection with id:', collection.id);
  });
}

listCollections().catch(console.error);
