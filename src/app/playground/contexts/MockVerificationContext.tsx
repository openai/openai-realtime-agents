"use client";

import React, { useState } from "react";
import { VerificationState } from "../../simple/types";
import { VerificationContext } from "../../simple/contexts/VerificationContext";

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
    <VerificationContext.Provider
      value={{ state, startVerification, cancelVerification, processPendingMessages }}
    >
      {children}
    </VerificationContext.Provider>
  );
};
