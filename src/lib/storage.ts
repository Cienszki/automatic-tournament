
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import { storage } from "./firebase";

export const uploadScreenshot = async (file: File, teamId: string) => {
    const storageRef = ref(storage, `screenshots/${teamId}/${uuidv4()}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

export const uploadTeamLogo = async (file: File, teamName: string) => {
    const fileExtension = file.name.split('.').pop();
    const logoFileName = `${teamName.toLowerCase().replace(/\s+/g, '-')}-logo-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `team-logos/${logoFileName}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

export const uploadStandinScreenshot = async (file: File, standinId: string) => {
    const fileExtension = file.name.split('.').pop();
    const screenshotFileName = `standin-${standinId}-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `standin-screenshots/${screenshotFileName}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

export const uploadTournamentLogo = async (file: File, tournamentSlug: string) => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${tournamentSlug}-logo-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `tournament-assets/${tournamentSlug}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const uploadTournamentInlineLogo = async (file: File, tournamentSlug: string) => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${tournamentSlug}-inline-logo-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `tournament-assets/${tournamentSlug}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const uploadTournamentOrganizerLogo = async (file: File, tournamentSlug: string) => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${tournamentSlug}-organizer-logo-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `tournament-assets/${tournamentSlug}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const uploadTournamentBackground = async (file: File, tournamentSlug: string) => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${tournamentSlug}-bg-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `tournament-assets/${tournamentSlug}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const uploadTournamentFavicon = async (file: File, tournamentSlug: string) => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${tournamentSlug}-favicon-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `tournament-assets/${tournamentSlug}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const uploadTournamentPromotionalImage = async (file: File, tournamentSlug: string) => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${tournamentSlug}-promo-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `tournament-assets/${tournamentSlug}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const uploadTournamentHeroLeftImage = async (file: File, tournamentSlug: string) => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${tournamentSlug}-hero-left-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `tournament-assets/${tournamentSlug}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const uploadTournamentHeroRightImage = async (file: File, tournamentSlug: string) => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${tournamentSlug}-hero-right-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `tournament-assets/${tournamentSlug}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const uploadTournamentSponsorImage = async (file: File, tournamentSlug: string) => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${tournamentSlug}-sponsor-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `tournament-assets/${tournamentSlug}/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
};

export const uploadTournamentFont = async (file: File, tournamentSlug: string) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(fileExtension || '')) {
        throw new Error('Only TTF, OTF, WOFF, and WOFF2 fonts are supported');
    }
    const fontName = file.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '-').toLowerCase();
    const fileName = `${fontName}-${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `tournament-assets/${tournamentSlug}/fonts/${fileName}`);
    await uploadBytes(storageRef, file, { contentType: `font/${fileExtension}` });
    return getDownloadURL(storageRef);
};
