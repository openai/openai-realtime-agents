// src/app/simple/page.tsx
"use client";

import React, { useEffect } from "react";
import "@/app/styles/simple-page-styles.css";
import { ConnectionProvider } from "./contexts/ConnectionContext";
import { CameraProvider } from "./contexts/CameraContext";
import { VerificationProvider } from "./contexts/VerificationContext";
import { UIProvider } from "./contexts/UIContext";
import PhoneMockup from "./components/PhoneMockup";

export default function SimplePage() {
  useEffect(() => {
    // Debug logging
    console.log("SimplePage mounted");
    console.log("API Key format check:", process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 
      `Key starts with: ${process.env.NEXT_PUBLIC_OPENAI_API_KEY.substring(0, 3)}...` : 
      "No API key found");
    
    // Intercept Audio playback events
    const originalPlay = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function() {
      console.log("Audio play attempted", this);
      return originalPlay.apply(this);
    };
    
    return () => {
      // Restore original function
      HTMLAudioElement.prototype.play = originalPlay;
    };
  }, []);

  return (
    <ConnectionProvider>
      <CameraProvider>
        <VerificationProvider>
          <UIProvider>
            <div className="stage">
              <div className="blur-backdrop"></div>
              <PhoneMockup />
            </div>
          </UIProvider>
        </VerificationProvider>
      </CameraProvider>
    </ConnectionProvider>
  );
}