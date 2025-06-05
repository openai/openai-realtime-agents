"use client";

import { useRef } from "react";
import {
  SessionStatus,
} from "@/app/types";
import { useEvent } from "@/app/contexts/EventContext";

export interface UseHandleSessionEventParams {
  setSessionStatus: (status: SessionStatus) => void;
  sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void;
}

export function useHandleServerEvent({}: UseHandleSessionEventParams) {
  const { logServerEvent } = useEvent();

  // Handler functions for each event
  function handleError(...args: any[]) {
    console.log("[session error]", ...args);
    logServerEvent({
      type: "error",
      message: args[0],
    });
  }
  function handleAudioInterrupted(...args: any[]) {
    logServerEvent({
      type: "audio_interrupted",
      message: args[0],
    });
  } 
  function handleAudioStart(...args: any[]) {
    logServerEvent({
      type: "audio_start",
      message: args[0],
    });
  }
  function handleAudioStopped(...args: any[]) {
    logServerEvent({
      type: "audio_stopped",
      message: args[0],
    });
  }

  // Return a ref to all handler functions
  const handlersRef = useRef({
    handleError,
    handleAudioInterrupted,
    handleAudioStart,
    handleAudioStopped,
  });

  return handlersRef;
}
