// Ambient declaration for the existing, un-sourced dist/firebase.js — see
// src/inhouse/core/VENDORED.md for why this repo has compiled JS with no
// TypeScript source. Accurate as of dist/firebase.js (33 lines, read in full).
import type { Firestore } from 'firebase-admin/firestore';

export declare function initFirebase(): Firestore;
