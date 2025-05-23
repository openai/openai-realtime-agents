import { AllAgentConfigsType } from "@/app/types";
import frontDeskAuthentication from "./frontDeskAuthentication";
import customerServiceRetail from "./customerServiceRetail";
import chatSupervisorDemo from "./chatSupervisorDemo";
import simpleExample from "./simpleExample";

export const allAgentSets: AllAgentConfigsType = {
  frontDeskAuthentication,
  customerServiceRetail,
  chatSupervisorDemo,
  simpleExample,
};

export const defaultAgentSetKey = "chatSupervisorDemo";
