"use client";

import React, { createContext, useContext } from "react";
import { ConnectionState } from "../../simple/types";

interface ConnectionContextType {
  state: ConnectionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: any) => boolean;
  onAgentMessage: (listener: (message: any) => void) => () => void;
}

const MockConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

const fixedState: ConnectionState = {
  status: "disconnected",
  sessionId: null,
  error: null,
};

export const MockConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const connect = async () => {};
  const disconnect = () => {};
  const sendMessage = (_msg: any) => false;
  const onAgentMessage = (_listener: (message: any) => void) => {
    return () => {};
  };

  return (
    <MockConnectionContext.Provider
      value={{ state: fixedState, connect, disconnect, sendMessage, onAgentMessage }}
    >
      {children}
    </MockConnectionContext.Provider>
  );
};

export const useConnection = () => {
  const context = useContext(MockConnectionContext);
  if (!context) {
    throw new Error("useConnection must be used within a MockConnectionProvider");
  }
  return context;
};
