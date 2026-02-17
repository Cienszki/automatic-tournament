// src/config/organization.ts
// Organization-level configuration for PD2IH
// TODO: Move this to Firestore when implementing multi-tenant system

export const organizationConfig = {
  name: 'PD2IH',
  displayName: 'Polish Dota 2 Inhouse',
  
  // Social links for the organization (used on landing page)
  social: {
    discord: 'https://discord.gg/pd2ih',
    twitch: 'https://www.twitch.tv/polishdota2inhouse',
    instagram: 'https://www.instagram.com/polishdota2inhouse',
    youtube: 'https://www.youtube.com/@Dota2_Polska',
  },
  
  // Default values for new tournaments
  defaults: {
    discord: 'https://discord.gg/pd2ih',
    twitch: 'https://www.twitch.tv/polishdota2inhouse',
  }
};
