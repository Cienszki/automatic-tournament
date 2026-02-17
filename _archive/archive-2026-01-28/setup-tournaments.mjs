// Add/update tournaments in Firestore with correct visibility
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDo5BwqJNoyM1tpfmRfYYMdxLvqj8j8D4s",
  authDomain: "automatic-tournament-letnia.firebaseapp.com",
  projectId: "automatic-tournament-letnia",
  storageBucket: "automatic-tournament-letnia.firebasestorage.app",
  messagingSenderId: "558647338044",
  appId: "1:558647338044:web:4ca2b8e7e41b85c7df3a82"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setupTournaments() {
  try {
    console.log('Setting up tournaments...\n');
    
    // Check existing tournaments
    const tournamentsRef = collection(db, 'tournaments');
    const snapshot = await getDocs(tournamentsRef);
    
    console.log(`Found ${snapshot.size} existing tournaments`);
    
    // Letnia Batalia Tournament
    const letniaData = {
      slug: 'letnia',
      name: 'Letnia Batalia',
      shortName: 'Letnia',
      description: 'Turniej z limitem MMR dla polskiej społeczności Dota 2',
      organizerId: 'pd2ih',
      type: 'mmr-limited',
      status: 'completed',
      visibility: 'active', // Make sure it's visible on landing page
      startDate: '2025-06-01',
      endDate: '2025-09-30',
      leagueId: 18559,
      registration: {
        enabled: false,
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        requireApproval: true,
        maxTeams: 16,
      },
      teams: {
        minPlayers: 5,
        maxPlayers: 5,
        allowSubstitutes: true,
        maxSubstitutes: 2,
        requireCoach: false,
        mmrCap: 24000,
        mmrVerification: true,
      },
      theme: {
        logoUrl: '/logos/letnia/letnia-logo-transparent.png',
        primaryColor: 'hsl(330, 100%, 54%)',
        secondaryColor: 'hsl(180, 100%, 50%)',
        accentColor: 'hsl(330, 100%, 54%)',
        backgroundGradient: 'linear-gradient(135deg, hsl(330 100% 10%) 0%, hsl(180 100% 10%) 100%)',
        cardColor: 'hsl(240 15% 10%)',
        textColor: 'hsl(0 0% 100%)',
        mutedTextColor: 'hsl(240 8% 66%)',
        borderColor: 'hsl(240 16% 20%)',
        headerFont: 'var(--font-space-mono)',
        bodyFont: 'var(--font-neon-bines)',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Polish Dota League Tournament
    const pdlData = {
      slug: 'pdl',
      name: 'Polish Dota League',
      shortName: 'PDL',
      description: 'Profesjonalna liga dla najlepszych polskich drużyn Dota 2',
      organizerId: 'pd2ih',
      type: 'league',
      status: 'registration',
      visibility: 'active', // Make sure it's visible on landing page
      startDate: '2026-02-21',
      leagueId: 19206,
      registration: {
        enabled: true,
        startDate: '2026-01-01',
        endDate: '2026-02-14',
        requireApproval: true,
        maxTeams: 24,
      },
      teams: {
        minPlayers: 5,
        maxPlayers: 5,
        allowSubstitutes: true,
        maxSubstitutes: 2,
        requireCoach: true,
        mmrCap: null,
        mmrVerification: false,
      },
      league: {
        divisions: [
          { id: 'elite', name: 'Elite', order: 1, teamsCount: 8 },
          { id: 'challenger', name: 'Challenger', order: 2, teamsCount: 8 },
          { id: 'adept', name: 'Adept', order: 3, teamsCount: 8 },
        ],
        matchFormat: 'bo2',
        tiebreakFormat: 'bo1',
        promotionFormat: 'bo3',
        pointsForWin: 2,
        pointsForDraw: 1,
        pointsForLoss: 0,
      },
      theme: {
        logoUrl: '/logos/pdl/pdl-s1-logo-transparent.png',
        primaryColor: 'hsl(345, 75%, 31%)',
        secondaryColor: 'hsl(0, 0%, 30%)',
        accentColor: 'hsl(345, 75%, 50%)',
        backgroundGradient: 'linear-gradient(135deg, hsl(240 17% 6%) 0%, hsl(240 15% 10%) 100%)',
        cardColor: 'hsl(240 15% 10%)',
        textColor: 'hsl(0 0% 100%)',
        mutedTextColor: 'hsl(240 8% 66%)',
        borderColor: 'hsl(240 16% 20%)',
        headerFont: 'var(--font-logik)',
        bodyFont: 'system-ui',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Use specific document IDs
    const letniaRef = doc(db, 'tournaments', 'letnia-2025');
    const pdlRef = doc(db, 'tournaments', 'pdl-s1');
    
    console.log('\nAdding/updating Letnia Batalia...');
    await setDoc(letniaRef, letniaData);
    console.log('✓ Letnia Batalia added with ID: letnia-2025');
    
    console.log('\nAdding/updating Polish Dota League...');
    await setDoc(pdlRef, pdlData);
    console.log('✓ Polish Dota League added with ID: pdl-s1');
    
    console.log('\n✓ All tournaments set up successfully!');
    console.log('\nBoth tournaments should now appear on the landing page.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error setting up tournaments:', error);
    process.exit(1);
  }
}

setupTournaments();
