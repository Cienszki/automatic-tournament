"use server";

import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Team } from "./definitions";

const FormSchema = z.object({
  id: z.string(),
  name: z.string().min(3, { message: "Team name must be at least 3 characters." }),
  tag: z.string().min(2, { message: "Team tag must be 2-4 characters." }).max(4),
  motto: z.string().min(5, { message: "Motto must be at least 5 characters." }),
  logoUrl: z.string().url({ message: "Please enter a valid URL." }),
  captainId: z.string(),
  players: z.array(z.object({
    id: z.string(),
    nickname: z.string().min(2),
    role: z.string(),
    mmr: z.number().min(1),
    steamProfileUrl: z.string().url(),
  })).min(5, { message: "You must register a full roster of 5 players." }),
});

const CreateTeam = FormSchema.omit({ id: true, captainId: true });

export async function registerTeam(captainId: string, prevState: any, formData: FormData) {
  // Basic validation
  if (!captainId) {
    return { message: "You must be logged in to register a team." };
  }

  const players = [0,1,2,3,4].map(i => ({
      id: formData.get(`players[${i}].id`) as string,
      nickname: formData.get(`players[${i}].nickname`) as string,
      role: formData.get(`players[${i}].role`) as string,
      mmr: Number(formData.get(`players[${i}].mmr`)),
      steamProfileUrl: formData.get(`players[${i}].steamProfileUrl`) as string,
  }));
  
  const validatedFields = CreateTeam.safeParse({
    name: formData.get("name"),
    tag: formData.get("tag"),
    motto: formData.get("motto"),
    logoUrl: formData.get("logoUrl"),
    players: players
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to create team. Please check the fields.',
    };
  }
  
  const { name, tag, motto, logoUrl } = validatedFields.data;

  const newTeam: Omit<Team, 'id'> = {
    name,
    tag,
    motto,
    logoUrl,
    captainId,
    wins: 0,
    losses: 0,
    players: validatedFields.data.players,
    status: "Not Verified", // Default status
  };

  try {
    await addDoc(collection(db, "teams"), newTeam);
  } catch (e) {
    return { message: 'Database Error: Failed to create team.' };
  }

  revalidatePath('/teams');
  redirect('/my-team');
}
