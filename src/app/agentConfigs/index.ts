import { AllAgentConfigsType } from "@/app/types";
import frontDeskAuthentication from "./frontDeskAuthentication";
import customerServiceRetail from "./customerServiceRetail";
import simpleExample from "./simpleExample";
import { startupInterviewerTemplate } from "./supportFeedback";

export const allAgentSets: AllAgentConfigsType = {
  frontDeskAuthentication,
  customerServiceRetail,
  simpleExample,
  startupInterviewer: [startupInterviewerTemplate],
};

export const defaultAgentSetKey = "simpleExample";
