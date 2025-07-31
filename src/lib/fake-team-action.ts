"use server";
import { createFakeTeam as createFakeTeamImpl } from "./admin-actions";

// Server action wrapper for createFakeTeam
export async function createFakeTeamServerAction(isTestTeam: boolean) {
  return await createFakeTeamImpl(isTestTeam);
}
