"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TimeContextType {
  simulatedTime: Date;
  setSimulatedTime: (date: Date) => void;
}

const TimeContext = createContext<TimeContextType | undefined>(undefined);

export const TimeProvider = ({ children }: { children: ReactNode }) => {
  const [simulatedTime, setSimulatedTime] = useState(new Date());

  return (
    <TimeContext.Provider value={{ simulatedTime, setSimulatedTime }}>
      {children}
    </TimeContext.Provider>
  );
};

export const useTime = (): TimeContextType => {
  const context = useContext(TimeContext);
  if (context === undefined) {
    throw new Error('useTime must be used within a TimeProvider');
  }
  return context;
};
