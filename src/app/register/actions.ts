
"use server";

import { z } from "zod";
import type { TeamRegistrationFormData } from "@/lib/definitions";

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const fileSchema = z.instanceof(File).optional()
  .refine(file => !file || file.size <= MAX_FILE_SIZE, `Max file size is 1MB.`)
  .refine(
    file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
    ".jpg, .jpeg, .png and .webp files are accepted."
  );

const playerSchema = z.object({
  nickname: z.string().min(2, "Nickname must be at least 2 characters."),
  mmr: z.string().regex(/^\d+$/, "MMR must be a number.").transform(Number),
  profileScreenshot: fileSchema,
  steamProfileUrl: z.string().url("Invalid Steam profile URL."),
});

export const registrationFormSchema = z.object({
  teamName: z.string().min(3, "Team name must be at least 3 characters."),
  teamLogo: fileSchema,
  player1: playerSchema,
  player2: playerSchema,
  player3: playerSchema,
  player4: playerSchema,
  player5: playerSchema,
});

export type RegistrationFormState = {
  message: string;
  errors?: z.ZodIssue[];
  success: boolean;
};

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

    const teamData = validatedFields.data as TeamRegistrationFormData;

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
