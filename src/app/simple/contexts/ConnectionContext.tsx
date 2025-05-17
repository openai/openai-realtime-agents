"use client";

import React, { createContext, useContext, useEffect } from 'react';
import { useWebRTCConnection } from '../hooks/useWebRTCConnection';
import { ConnectionState } from '../types';

interface ConnectionContextType {
  state: ConnectionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: any) => boolean;
  onAgentMessage: (listener: (message: any) => void) => () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, connect, disconnect, sendMessage, addMessageListener } = useWebRTCConnection();

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const onAgentMessage = (listener: (message: any) => void) => {
    return addMessageListener(listener);
  };

  return (
    <ConnectionContext.Provider value={{ state, connect, disconnect, sendMessage, onAgentMessage }}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
};
