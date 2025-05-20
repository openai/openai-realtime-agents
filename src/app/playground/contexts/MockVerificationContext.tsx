"use client";

import React, { createContext, useContext, useState } from "react";
import { VerificationState } from "../../simple/types";

const initialState: VerificationState = {
  active: false,
  step: 0,
  startTime: null,
  completionTime: null,
  error: null,
  faceDetectionStatus: {
    detected: false,
    centered: false,
    verified: false,
  },
  pendingMessages: [],
};

interface VerificationContextType {
  state: VerificationState;
  startVerification: () => void;
  cancelVerification: () => void;
  processPendingMessages: () => void;
}

const MockVerificationContext = createContext<VerificationContextType | undefined>(undefined);

export const MockVerificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<VerificationState>(initialState);

  const startVerification = () => {
    setState(prev => ({
      ...prev,
      active: true,
      step: 1,
      startTime: Date.now(),
    }));
  };

  const cancelVerification = () => {
    setState(initialState);
  };

  const processPendingMessages = () => {
    setState(prev => ({ ...prev, pendingMessages: [] }));
  };

  return (
    <MockVerificationContext.Provider value={{ state, startVerification, cancelVerification, processPendingMessages }}>
      {children}
    </MockVerificationContext.Provider>
  );
};

export const useVerification = () => {
  const ctx = useContext(MockVerificationContext);
  if (!ctx) {
    throw new Error("useVerification must be used within a MockVerificationProvider");
  }
  return ctx;
};
