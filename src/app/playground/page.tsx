"use client";

import React, { useEffect } from "react";
import "@/app/styles/simple-page-styles.css";
import { MockConnectionProvider } from "./contexts/MockConnectionContext";
import { SimulationProvider } from "../simple/contexts/SimulationContext";
import { CameraProvider } from "../simple/contexts/CameraContext";
import { MockVerificationProvider } from "./contexts/MockVerificationContext";
import { UIProvider, useUI } from "../simple/contexts/UIContext";
import PhoneMockup from "../simple/components/PhoneMockup";
import dynamic from 'next/dynamic';
// load SimulationToggle and SimulationPanel only on client
const SimulationToggle = dynamic(
  () => import('../simple/components/SimulationToggle'),
  { ssr: false }
);
const SimulationPanel = dynamic(
  () => import('../simple/components/SimulationPanel'),
  { ssr: false }
);
import { useRouter } from "next/navigation";

// Handler for loan animation events within Playground
const LoanAnimationHandler: React.FC = () => {
  const { loanState, showLoanAnimation } = useUI();
  useEffect(() => {
    const handleLoanAnimationTrigger = () => {
      if (loanState.requestedAmount) showLoanAnimation();
    };
    document.addEventListener('loan-animation-trigger', handleLoanAnimationTrigger);
    return () => {
      document.removeEventListener('loan-animation-trigger', handleLoanAnimationTrigger);
    };
  }, [loanState.requestedAmount, showLoanAnimation]);
  return null;
};

const PlaygroundPage: React.FC = () => {
  const router = useRouter();
  useEffect(() => {
    console.log("PlaygroundPage mounted (using mock contexts)");
  }, []);
  return (
    <MockConnectionProvider>
      <SimulationProvider>
        <CameraProvider>
          <MockVerificationProvider>
            <UIProvider>
              <LoanAnimationHandler />
              <div className="stage">
                <div className="blur-backdrop"></div>
                <PhoneMockup />
                <SimulationToggle position="bottom-right" />
                <SimulationPanel />
              </div>
              {/* Button to navigate to /three to view the 3D coin */}
              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <button
                  onClick={() => router.push("/three")}
                  style={{
                    padding: "10px 20px",
                    fontSize: "16px",
                    borderRadius: "5px",
                    backgroundColor: "#28a745",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Ver Moeda 3D
                </button>
              </div>
            </UIProvider>
          </MockVerificationProvider>
        </CameraProvider>
      </SimulationProvider>
    </MockConnectionProvider>
  );
};

export default PlaygroundPage;