"use client";

import React from "react";
import "@/app/styles/simple-page-styles.css";
import { UIProvider } from "../simple/contexts/UIContext";
import { CameraProvider } from "../simple/contexts/CameraContext";
import { SimulationProvider } from "../simple/contexts/SimulationContext";
import { MockConnectionProvider } from "./contexts/MockConnectionContext";
import { MockVerificationProvider } from "./contexts/MockVerificationContext";
import PhoneMockup from "../simple/components/PhoneMockup";
import SimulationToggle from "../simple/components/SimulationToggle";
import SimulationPanel from "../simple/components/SimulationPanel";

const PlaygroundPage: React.FC = () => {
  return (
    <SimulationProvider>
      <MockConnectionProvider>
        <CameraProvider>
          <MockVerificationProvider>
            <UIProvider>
              <div className="stage">
                <div className="blur-backdrop"></div>
                <PhoneMockup />
                <SimulationToggle position="bottom-right" />
                <SimulationPanel />
              </div>
            </UIProvider>
          </MockVerificationProvider>
        </CameraProvider>
      </MockConnectionProvider>
    </SimulationProvider>
  );
};

export default PlaygroundPage;
