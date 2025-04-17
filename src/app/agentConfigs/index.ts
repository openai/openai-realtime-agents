import { AllAgentConfigsType } from "@/app/types";
import frontDeskAuthentication from "./frontDeskAuthentication";
import customerServiceRetail from "./customerServiceRetail";
import simpleExample from "./simpleExample";
import marlene from "./marlene";
export const allAgentSets = { marlene };
export const defaultAgentSetKey = "marlene";

export const allAgentSets: AllAgentConfigsType = {
  frontDeskAuthentication,
  customerServiceRetail,
  simpleExample,
};

export const defaultAgentSetKey = "simpleExample";
