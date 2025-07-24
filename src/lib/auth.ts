// src/lib/auth.ts
import { type User } from "firebase/auth";

/**
 * Checks if a user is an administrator by calling a dedicated API route.
 * This is the secure way to check for admin privileges from the client.
 *
 * @param user The Firebase user object.
 * @returns A promise that resolves to true if the user is an admin, otherwise false.
 */
export async function checkIfAdmin(user: User): Promise<boolean> {
  if (!user) return false;

  try {
    const token = await user.getIdToken(true);
    
    const response = await fetch('/api/checkAdmin', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        // Log the error but still return false for security.
        const errorData = await response.json();
        console.error("Error from checkAdmin API:", errorData.error);
        return false;
    }

    const data = await response.json();
    return data.isAdmin === true;

  } catch (error) {
    console.error("Error calling checkAdmin API route:", error);
    // In case of any client-side error (e.g., network), default to not being an admin.
    return false;
  }
}
