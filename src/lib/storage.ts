
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
