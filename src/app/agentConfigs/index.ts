import { AllAgentConfigsType } from "@/app/types";
import { startupInterviewerTemplate } from "./supportFeedback";

export const allAgentSets: AllAgentConfigsType = {
  startupInterviewer: [startupInterviewerTemplate],
};

export const defaultAgentSetKey = "startupInterviewer";
