"use client";

import React, { useCallback, useRef, useState } from "react";
import { ConnectionState } from "../../simple/types";
import { ConnectionContext } from "../../simple/contexts/ConnectionContext";


// Simple mock provider that relies solely on browser APIs. No network requests
// are made and therefore no API tokens are consumed. It emulates a very basic
// conversation loop so that the Playground page can be used completely offline.

export const MockConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConnectionState>({
    status: "disconnected",
    sessionId: null,
    error: null,
  });

  const listenersRef = useRef<Array<(msg: any) => void>>([]);
  const recognitionRef = useRef<any>(null);

  const dispatch = useCallback((message: any) => {
    listenersRef.current.forEach((l) => {
      try { l(message); } catch (err) { console.error(err); }
    });
  }, []);

  const speak = useCallback((text: string) => {
    dispatch({ type: 'conversation.item.created', item: { role: 'assistant', content: text } });
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    utter.onstart = () => dispatch({ type: 'audio_started' });
    utter.onend = () => dispatch({ type: 'audio_ended' });
    window.speechSynthesis.speak(utter);
  }, [dispatch]);

  const startRecognition = useCallback(() => {
    const SpeechRec: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;
    const rec: any = new SpeechRec();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.onstart = () => dispatch({ type: 'input_audio_buffer.started' });
    rec.onerror = () => {
      dispatch({ type: 'input_audio_buffer.stopped' });
      recognitionRef.current = null;
    };
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join(' ');
      dispatch({ type: 'input_audio_buffer.stopped' });
      dispatch({ type: 'conversation.item.created', item: { role: 'user', content: transcript } });
      speak(`Você disse: ${transcript}`);
    };
    rec.onend = () => {
      if (recognitionRef.current) {
        dispatch({ type: 'input_audio_buffer.stopped' });
        recognitionRef.current = null;
      }
    };
    recognitionRef.current = rec;
    rec.start();
  }, [dispatch, speak]);

  const connect = useCallback(async () => {
    if (state.status !== 'disconnected') return;
    setState({ status: 'connected', sessionId: 'mock', error: null });
    startRecognition();
  }, [state.status, startRecognition]);

  const disconnect = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setState((prev) => ({ ...prev, status: 'disconnected' }));
  }, []);

  const sendMessage = useCallback((message: any): boolean => {
    if (message?.type === 'response.create') {
      startRecognition();
      return true;
    }
    if (message?.item?.role === 'user') {
      const content = typeof message.item.content === 'string'
        ? message.item.content
        : Array.isArray(message.item.content)
          ? message.item.content.map((c: any) => c.text || '').join(' ')
          : '';
      dispatch({ type: 'conversation.item.created', item: { role: 'user', content } });
      speak(`Você disse: ${content}`);
      return true;
    }
    dispatch(message);
    return true;
  }, [dispatch, speak, startRecognition]);

  const onAgentMessage = (listener: (message: any) => void) => {
    listenersRef.current.push(listener);
    return () => {
      listenersRef.current = listenersRef.current.filter((l) => l !== listener);
    };
  };

  return (
    <ConnectionContext.Provider value={{ state, connect, disconnect, sendMessage, onAgentMessage }}>
      {children}
    </ConnectionContext.Provider>
  );
};
