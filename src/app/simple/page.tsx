// src/app/simple/page.tsx
"use client";

import React from "react";
import "@/app/styles/simple-page-styles.css";
import { ConnectionProvider } from "./contexts/ConnectionContext";
import { CameraProvider } from "./contexts/CameraContext";
import { VerificationProvider } from "./contexts/VerificationContext";
import { UIProvider } from "./contexts/UIProvider";
import PhoneMockup from "./components/PhoneMockup";

export default function SimplePage() {
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