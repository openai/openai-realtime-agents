import { NextRequest, NextResponse } from "next/server";
import { DynamicScenario } from "@/app/types";

// In-memory storage for development - in production, use a database
let scenarios: DynamicScenario[] = [];

// Initialize with default scenarios if empty
function initializeDefaultScenarios() {
  if (scenarios.length === 0) {
    // Import default scenarios from agentConfigs
    const { allAgentSets } = require("@/app/agentConfigs");

    Object.entries(allAgentSets).forEach(([key, agents]: [string, any]) => {
      const dynamicAgents = (agents as any[]).map((agent: any, index: number) => ({
        id: `${key}-agent-${index}`,
        name: agent.name,
        voice: agent.voice || 'sage',
        instructions: typeof agent.instructions === 'string' ? agent.instructions : 'Default instructions',
        tools: agent.tools || [],
        handoffAgentIds: agent.handoffs?.map((h: any) => h.name) || [],
        handoffDescription: agent.handoffDescription || '',
      }));

      const scenario: DynamicScenario = {
        id: key,
        name: key,
        description: `Default ${key} scenario`,
        agents: dynamicAgents,
        companyName: key === 'customerServiceRetail' ? 'Snowy Peak Boards' : 'NewTelco',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      scenarios.push(scenario);
    });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initializeDefaultScenarios();
    const scenario = scenarios.find(s => s.id === params.id);

    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    return NextResponse.json(scenario);
  } catch (error) {
    console.error("Error fetching scenario:", error);
    return NextResponse.json({ error: "Failed to fetch scenario" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const scenarioIndex = scenarios.findIndex(s => s.id === params.id);

    if (scenarioIndex === -1) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    scenarios[scenarioIndex] = {
      ...scenarios[scenarioIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(scenarios[scenarioIndex]);
  } catch (error) {
    console.error("Error updating scenario:", error);
    return NextResponse.json({ error: "Failed to update scenario" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scenarioIndex = scenarios.findIndex(s => s.id === params.id);

    if (scenarioIndex === -1) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    scenarios.splice(scenarioIndex, 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting scenario:", error);
    return NextResponse.json({ error: "Failed to delete scenario" }, { status: 500 });
  }
}