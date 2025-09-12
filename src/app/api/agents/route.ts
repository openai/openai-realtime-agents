import { NextRequest, NextResponse } from "next/server";
import { DynamicAgent } from "@/app/types";
import { allAgentSets } from "@/app/agentConfigs";

// In-memory storage for development - in production, use a database
const agents: DynamicAgent[] = [];

// Initialize with default agents if empty
function initializeDefaultAgents() {
  if (agents.length === 0) {
    // Use imported allAgentSets

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

export async function GET(request: NextRequest) {
  try {
    initializeDefaultAgents();

    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get('scenarioId');

    if (scenarioId) {
      // Filter agents by scenario
      const scenarioAgents = agents.filter(agent =>
        agent.id.startsWith(`${scenarioId}-agent-`)
      );
      return NextResponse.json(scenarioAgents);
    }

    return NextResponse.json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, voice, instructions, tools, handoffAgentIds, handoffDescription, scenarioId } = body;

    if (!name || !scenarioId) {
      return NextResponse.json({ error: "Agent name and scenario ID are required" }, { status: 400 });
    }

    const newAgent: DynamicAgent = {
      id: `${scenarioId}-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      voice: voice || 'sage',
      instructions: instructions || '',
      tools: tools || [],
      handoffAgentIds: handoffAgentIds || [],
      handoffDescription: handoffDescription || '',
    };

    agents.push(newAgent);
    return NextResponse.json(newAgent, { status: 201 });
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Agent ID required" }, { status: 400 });
    }

    const agentIndex = agents.findIndex(a => a.id === id);
    if (agentIndex === -1) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    agents[agentIndex] = {
      ...agents[agentIndex],
      ...updates,
    };

    return NextResponse.json(agents[agentIndex]);
  } catch (error) {
    console.error("Error updating agent:", error);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Agent ID required" }, { status: 400 });
    }

    const agentIndex = agents.findIndex(a => a.id === id);
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