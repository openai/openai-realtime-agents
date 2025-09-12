import { NextRequest, NextResponse } from "next/server";
import { DynamicAgent } from "@/app/types";

// In-memory storage for development - in production, use a database
let agents: DynamicAgent[] = [];

// Initialize with default agents if empty
function initializeDefaultAgents() {
  if (agents.length === 0) {
    // Import default scenarios from agentConfigs
    const { allAgentSets } = require("@/app/agentConfigs");

    Object.entries(allAgentSets).forEach(([scenarioKey, scenarioAgents]: [string, any]) => {
      (scenarioAgents as any[]).forEach((agent: any, index: number) => {
        const dynamicAgent: DynamicAgent = {
          id: `${scenarioKey}-agent-${index}`,
          name: agent.name,
          voice: agent.voice || 'sage',
          instructions: typeof agent.instructions === 'string' ? agent.instructions : 'Default instructions',
          tools: agent.tools || [],
          handoffAgentIds: agent.handoffs?.map((h: any) => h.name) || [],
          handoffDescription: agent.handoffDescription || '',
        };
        agents.push(dynamicAgent);
      });
    });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initializeDefaultAgents();
    const agent = agents.find(a => a.id === params.id);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error("Error fetching agent:", error);
    return NextResponse.json({ error: "Failed to fetch agent" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const agentIndex = agents.findIndex(a => a.id === params.id);

    if (agentIndex === -1) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    agents[agentIndex] = {
      ...agents[agentIndex],
      ...body,
    };

    return NextResponse.json(agents[agentIndex]);
  } catch (error) {
    console.error("Error updating agent:", error);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agentIndex = agents.findIndex(a => a.id === params.id);

    if (agentIndex === -1) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    agents.splice(agentIndex, 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}