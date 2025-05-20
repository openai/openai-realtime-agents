"use client";

import React from "react";
import { ConnectionState } from "../../simple/types";
import { ConnectionContext } from "../../simple/contexts/ConnectionContext";


const fixedState: ConnectionState = {
  status: "disconnected",
  sessionId: null,
  error: null,
};

export const MockConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const connect = async () => {};
  const disconnect = () => {};
  const sendMessage = () => false;
  const onAgentMessage = () => {
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
