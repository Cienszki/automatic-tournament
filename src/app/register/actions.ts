
"use server";

import type { RegistrationFormState } from "@/lib/definitions";
import { registrationFormSchema } from "@/lib/registration-schema";

export async function registerTeamAction(
  prevState: RegistrationFormState,
  formData: FormData
): Promise<RegistrationFormState> {
  try {
    // Construct the object for Zod parsing from FormData
    // FormData values are strings or File objects.
    const dataToValidate: Record<string, any> = {
      teamName: formData.get("teamName"),
      teamLogo: formData.get("teamLogo"), // This will be a File object or null
      rulesAgreed: formData.get("rulesAgreed") === "true", // Convert string "true" to boolean
    };

    for (let i = 1; i <= 5; i++) {
      dataToValidate[`player${i}`] = {
        nickname: formData.get(`player${i}.nickname`),
        mmr: formData.get(`player${i}.mmr`), // Zod schema will transform this string to number
        profileScreenshot: formData.get(`player${i}.profileScreenshot`), // File object or null
        steamProfileUrl: formData.get(`player${i}.steamProfileUrl`),
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

    // validatedFields.data now contains data according to Zod schema output types
    // (e.g., teamLogo is File, mmr is number, rulesAgreed is true)
    const teamData = validatedFields.data;

    // In a real app, you would:
    // 1. Authenticate user (e.g., Discord OAuth)
    // 2. Upload files (teamData.teamLogo, teamData.playerX.profileScreenshot) to a storage service
    //    and get their URLs.
    // 3. Save the teamData (with file URLs and other processed data) to a database.

    console.log("Team Registration Data (Server Action):", teamData);
    
    // Simulate successful registration
    return {
      message: `Team "${teamData.teamName}" registered successfully! Ensure all player MMRs and Steam URLs are correct.`,
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
