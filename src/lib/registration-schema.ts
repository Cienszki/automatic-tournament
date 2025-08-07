import { z } from 'zod';

// Server-side registration schema (must match client formSchema)
export const registrationSchema = z.object({
  name: z.string()
    .min(3)
    .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _\-']+$/, "Nazwa zespołu może zawierać tylko litery (w tym polskie), cyfry, spacje, myślniki, podkreślenia i apostrof ('')."),
  tag: z.string().min(2).max(4),
  discordUsername: z.string().min(2),
  motto: z.string().min(5),
  logoUrl: z.string().url().optional(),
  captainId: z.string(),
  players: z.array(z.object({
    nickname: z.string()
      .min(2)
      .regex(/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż0-9 _\-']+$/, "Nick może zawierać tylko litery (w tym polskie), cyfry, spacje, myślniki, podkreślenia i apostrof ('')."),
    role: z.string(),
    mmr: z.number().min(1000).max(12000),
    steamProfileUrl: z.string().url(),
    profileScreenshotUrl: z.string().url(),
  })).min(5).max(5),
});
