# Firestore Database Schema Documentation

This document outlines the structure of the Firestore database for the tournament tracker application.

---

### 1. `admins` Collection

This collection stores the User IDs (UIDs) of users who have administrative privileges.

-   **Path:** `/admins/{userId}`
-   **Document ID:** The Firebase Auth UID of the user.
-   **Purpose:** To control access to the admin panel. The application checks if a user's UID exists as a document ID in this collection to grant admin rights.
-   **Fields:** This collection does not require any specific fields within the documents. The existence of the document itself grants admin privileges.

**Example:**
To make the user with UID `abc123xyz` an admin, you would create an empty document at `/admins/abc123xyz`.

---

### 2. `teams` Collection

This collection stores all the information about the teams registered for the tournament.

-   **Path:** `/teams/{teamId}`
-   **Document ID:** An auto-generated unique ID.
-   **Fields:**
    -   `captainId` (string): The Firebase Auth UID of the user who registered the team.
    -   `createdAt` (timestamp): The date and time the team was registered.
    -   `logoUrl` (string): A URL to the team's logo.
    -   `motto` (string): The team's motto.
    -   `name` (string): The full name of the team.
    -   `status` (string): The verification status of the team (e.g., 'pending', 'verified', 'banned').
    -   `tag` (string): The short tag or acronym for the team.
-   **Subcollections:**
    -   `players`: Contains documents for each player on the team.

---

### 3. `players` Subcollection

This is a subcollection within each `team` document. It stores the details for each of the 5 players on that team.

-   **Path:** `/teams/{teamId}/players/{playerId}`
-   **Document ID:** An auto-generated unique ID.
-   **Fields:**
    -   `fantasyPointsEarned` (number): Total fantasy points the player has earned.
    -   `mmr` (number): The player's MMR.
    -   `mmrScreenshotUrl` (string): A URL to the screenshot proving the player's MMR.
    -   `nickname` (string): The player's in-game nickname.
    -   `openDotaAccountId` (number): The player's numerical ID from OpenDota.
    -   `openDotaProfileUrl` (string): A full URL to the player's OpenDota profile.
    -   `role` (string): The player's role (e.g., 'Carry', 'Mid', etc.).
    -   `steamProfileUrl` (string): A URL to the player's Steam profile.

---

### 4. `tournament` Collection

This collection holds documents related to the overall state and management of the tournament.

-   **Path:** `/tournament/status`
-   **Document:** There is a single document in this collection with the hardcoded ID `status`.
-   **Purpose:** This document acts as the single source of truth for the current stage of the tournament.
-   **Fields:**
    -   `roundId` (string): A string identifier for the current tournament stage (e.g., 'initial', 'pre_season', 'group_stage').
