
"use server";

import type { RegistrationFormState } from "@/lib/definitions";
import { registrationFormSchema } from "@/lib/registration-schema";

export async function registerTeamAction(
  prevState: RegistrationFormState,
  formData: FormData
): Promise<RegistrationFormState> {
  try {
    const dataToValidate: Record<string, any> = {
      teamName: formData.get("teamName"),
      teamLogo: formData.get("teamLogo"),
      teamMotto: formData.get("teamMotto") || undefined, // Handle optional motto
      rulesAgreed: formData.get("rulesAgreed") === "true",
    };

    for (let i = 1; i <= 5; i++) {
      dataToValidate[`player${i}`] = {
        nickname: formData.get(`player${i}.nickname`),
        mmr: formData.get(`player${i}.mmr`),
        profileScreenshot: formData.get(`player${i}.profileScreenshot`),
        steamProfileUrl: formData.get(`player${i}.steamProfileUrl`),
        role: formData.get(`player${i}.role`),
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

    const teamData = validatedFields.data;

    console.log("Team Registration Data (Server Action):", {
        teamName: teamData.teamName,
        teamMotto: teamData.teamMotto, // Log motto
        player1: teamData.player1.nickname,
        // ... (log other player details if needed)
    });
    
    return {
      message: `Team "${teamData.teamName}" registered successfully! ${teamData.teamMotto ? `Motto: "${teamData.teamMotto}". ` : ''}Ensure all player MMRs, roles, and Steam URLs are correct.`,
      success: true,
    };

  } catch (error) {
    console.error("Registration error:", error);
    return {
      message: "An unexpected error occurred. Please try again.",
      success: false,
    };
  }
}

