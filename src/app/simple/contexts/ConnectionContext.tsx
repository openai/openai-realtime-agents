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

export const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, connect, disconnect, sendMessage, addMessageListener } = useWebRTCConnection();

  useEffect(() => {
    console.log('[ConnectionProvider] initiating connection');
    connect();
    return () => {
      console.log('[ConnectionProvider] disconnecting');
      disconnect();
    };
  }, [connect, disconnect]);

  // Log when connection state updates
  useEffect(() => {
    console.log('[ConnectionProvider] state change', {
      status: state.status,
      sessionId: state.sessionId,
      error: state.error?.message,
    });
    if (state.error) {
      console.error('[ConnectionProvider] connection error', state.error);
    }
  }, [state.status, state.sessionId, state.error]);

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
