
"use server";

import type { TeamRegistrationFormData, RegistrationFormState } from "@/lib/definitions";
import { registrationFormSchema } from "@/lib/registration-schema";

export async function registerTeamAction(
  prevState: RegistrationFormState,
  formData: FormData
): Promise<RegistrationFormState> {
  try {
    // Manually construct the object for Zod parsing from FormData
    const dataToValidate: Record<string, any> = {
      teamName: formData.get("teamName"),
      teamLogo: formData.get("teamLogo"),
    };

    for (let i = 1; i <= 5; i++) {
      dataToValidate[`player${i}`] = {
        nickname: formData.get(`player${i}.nickname`),
        mmr: formData.get(`player${i}.mmr`),
        profileScreenshot: formData.get(`player${i}.profileScreenshot`),
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

    const teamData = validatedFields.data as TeamRegistrationFormData; // Note: Zod schema output might differ from TeamRegistrationFormData due to transforms/file handling.

    // In a real app, you would:
    // 1. Authenticate user (e.g., Discord OAuth)
    // 2. Upload files (teamLogo, profileScreenshots) to a storage service (e.g., Firebase Storage, S3)
    //    and get their URLs.
    // 3. Save the teamData (with file URLs) to a database.

    console.log("Team Registration Data (Server Action):", teamData);
    
    // Simulate successful registration
    return {
      message: `Team "${teamData.teamName}" registered successfully!`,
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
