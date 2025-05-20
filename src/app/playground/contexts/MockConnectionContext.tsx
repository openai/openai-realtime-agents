"use client";

import React from "react";
import { ConnectionState } from "../../simple/types";
import { ConnectionContext } from "../../simple/contexts/ConnectionContext";

interface ConnectionContextType {
  state: ConnectionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: any) => boolean;
  onAgentMessage: (listener: (message: any) => void) => () => void;
}

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
    <ConnectionContext.Provider
      value={{ state: fixedState, connect, disconnect, sendMessage, onAgentMessage }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};
