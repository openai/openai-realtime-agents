// src/app/simple/page.tsx modificado
"use client";

import React, { useEffect } from "react";
import "@/app/styles/simple-page-styles.css";
import { ConnectionProvider } from "./contexts/ConnectionContext";
import { CameraProvider } from "./contexts/CameraContext";
import { VerificationProvider } from "./contexts/VerificationContext";
import { UIProvider } from "./contexts/UIContext";
import { SimulationProvider } from "./contexts/SimulationContext"; // Nova importação
import PhoneMockup from "./components/PhoneMockup";
import SimulationPanel from "./components/SimulationPanel"; // Nova importação
import SimulationToggle from "./components/SimulationToggle"; // Nova importação

// Componente principal da página
const SimplePage: React.FC = () => {
  useEffect(() => {
    // Debug logging
    console.log("SimplePage mounted");
    // console.log(
    //   "API Key format check:",
    //   process.env.NEXT_PUBLIC_OPENAI_API_KEY
    //     ? `Key starts with: ${process.env.NEXT_PUBLIC_OPENAI_API_KEY.substring(0, 3)}...`
    //     : "No API key found"
    // );
  }, []);

  return (
    <SimulationProvider>
      <ConnectionProvider>
        <CameraProvider>
          <VerificationProvider>
            <UIProvider>
              <div className="stage">
                <div className="blur-backdrop"></div>
                <PhoneMockup />
                <SimulationToggle position="bottom-right" />
                <SimulationPanel />
              </div>
            </UIProvider>
          </VerificationProvider>
        </CameraProvider>
      </ConnectionProvider>
    </SimulationProvider>
  );
};

export default SimplePage;