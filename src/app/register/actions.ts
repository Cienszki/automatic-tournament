
"use server";

import type { RegistrationFormState } from "@/lib/definitions";
import { registrationFormSchema } from "@/lib/registration-schema";
import { mockAllTournamentPlayersFlat } from "@/lib/mock-data"; // For checking existing players

export async function registerTeamAction(
  prevState: RegistrationFormState,
  formData: FormData
): Promise<RegistrationFormState> {
  try {
    const dataToValidate: Record<string, any> = {
      teamName: formData.get("teamName"),
      teamLogo: formData.get("teamLogo"),
      teamMotto: formData.get("teamMotto") || undefined, 
      rulesAgreed: formData.get("rulesAgreed") === "true",
    };

    const submittedSteamUrls: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const playerKey = `player${i}`;
      const steamUrl = formData.get(`${playerKey}.steamProfileUrl`) as string | null;
      if (steamUrl) {
        submittedSteamUrls.push(steamUrl);
      }
      dataToValidate[playerKey] = {
        nickname: formData.get(`${playerKey}.nickname`),
        mmr: formData.get(`${playerKey}.mmr`),
        profileScreenshot: formData.get(`${playerKey}.profileScreenshot`),
        steamProfileUrl: steamUrl,
        role: formData.get(`${playerKey}.role`),
      };
    }
    
    const validatedFields = registrationFormSchema.safeParse(dataToValidate);

    if (!validatedFields.success) {
      console.log("Validation errors:", validatedFields.error.flatten().fieldErrors);
      return {
        message: "Validation failed. Please check your inputs.",
        errors: validatedFields.error.issues,
        success: false,
      };
    }

    // Simulate checking for duplicate Steam URLs against existing players
    const existingSteamUrls = new Set(mockAllTournamentPlayersFlat.map(p => p.steamProfileUrl));
    for (const submittedUrl of submittedSteamUrls) {
      if (existingSteamUrls.has(submittedUrl)) {
        return {
          message: `Player with Steam Profile URL "${submittedUrl}" is already registered in the tournament. Please ensure all players are unique.`,
          success: false,
        };
      }
    }

    const teamData = validatedFields.data;

    // Simulate successful registration (in a real app, this would save to DB)
    // And the team would initially have a "Not Verified" status.
    console.log("Team Registration Data (Server Action):", {
        teamName: teamData.teamName,
        teamMotto: teamData.teamMotto,
        player1Nickname: teamData.player1.nickname,
        player1SteamUrl: teamData.player1.steamProfileUrl,
        // ... log other player details if needed
    });
    
    return {
      message: `Team "${teamData.teamName}" registered successfully! Your registration is pending admin verification. ${teamData.teamMotto ? `Motto: "${teamData.teamMotto}". ` : ''}`,
      success: true,
    };

  } catch (error) {
    console.error("Registration error:", error);
    return {
      message: "An unexpected error occurred during registration. Please try again.",
      success: false,
    };
  }
}
