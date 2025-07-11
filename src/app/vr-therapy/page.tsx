import React, { Suspense } from "react";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import VRTherapyApp from "./VRTherapyApp";

export default function VRTherapyPage() {
    return (
        <Suspense fallback={<div>Loading VR Therapy...</div>}>
            <TranscriptProvider>
                <EventProvider>
                    <VRTherapyApp />
                </EventProvider>
            </TranscriptProvider>
        </Suspense>
    );
} 