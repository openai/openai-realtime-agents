import { AllAgentConfigsType } from "@/app/types";
import customerServiceRetail from "./customerServiceRetail";
import chatSupervisor from "./chatSupervisor";
import simpleHandoff from "./simpleHandoff";

export const allAgentSets: AllAgentConfigsType = {
  customerServiceRetail,
  chatSupervisor,
  simpleHandoff,
};

export const defaultAgentSetKey = "chatSupervisor";
