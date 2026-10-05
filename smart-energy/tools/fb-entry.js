// Bundled into public/vendor/firebase.bundle.js  (npm run build in /tools)
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInWithEmailAndPassword, signOut, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy, limit, connectFirestoreEmulator } from 'firebase/firestore';
import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

const cfg = window.FIREBASE_CONFIG || {};
const configured = cfg.apiKey && !String(cfg.apiKey).startsWith('YOUR_');
const FB = { configured };
if (configured) {
  const app = initializeApp(cfg);
  const auth = getAuth(app), db = getFirestore(app), fns = getFunctions(app, window.FUNCTIONS_REGION || 'us-central1');
  const emu = ['localhost', '127.0.0.1'].includes(location.hostname) && location.search.includes('emu');
  if (emu) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  }
  FB.emu = emu;
  Object.assign(FB, {
    auth, db, doc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy, limit,
    signInWithCustomToken, signInWithEmailAndPassword, signOut,
    call: (name) => httpsCallable(fns, name),
    push: {
      supported: () => isSupported().catch(() => false),
      // returns an FCM token for this device (needs notification permission + the app's service worker)
      getToken: async (reg) => getToken(getMessaging(app), { vapidKey: window.FCM_VAPID_KEY, serviceWorkerRegistration: reg }),
      deleteToken: () => deleteToken(getMessaging(app)).catch(() => {}),
    },
    ready: new Promise((res) => { const un = onAuthStateChanged(auth, (u) => { un(); res(u); }); }),
  });
}
window.FB = FB;
window.dispatchEvent(new Event('fb-ready'));
