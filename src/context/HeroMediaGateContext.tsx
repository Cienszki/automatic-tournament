"use client";

import { createContext, useContext } from 'react';

/**
 * Lets the home page hero tell the tournament layout that a video has painted
 * its first frame (or settled on its poster), so the layout's LoadingScreen can
 * fade out onto a hero that is already playing instead of empty boxes. Each
 * HeroVideo signals with its own src; the layout waits for every video the hero
 * shows and owns the timeout — this is only the "ready" half of the handshake.
 */
const HeroMediaGateContext = createContext<(src: string) => void>(() => {});

export const HeroMediaGateProvider = HeroMediaGateContext.Provider;

export const useSignalHeroMediaReady = () => useContext(HeroMediaGateContext);
