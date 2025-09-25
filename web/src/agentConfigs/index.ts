import { simpleHandoffScenario } from './simpleHandoff';
import {
  customerServiceRetailScenario,
  customerServiceRetailCompanyName,
} from './customerServiceRetail';
import {
  chatSupervisorScenario,
  chatSupervisorCompanyName,
} from './chatSupervisor';
import type { RealtimeAgent } from '@openai/agents/realtime';

export const allAgentSets: Record<string, RealtimeAgent[]> = {
  simpleHandoff: simpleHandoffScenario,
  customerServiceRetail: customerServiceRetailScenario,
  chatSupervisor: chatSupervisorScenario,
};

export const defaultAgentSetKey = 'chatSupervisor';

export { customerServiceRetailCompanyName, chatSupervisorCompanyName };
