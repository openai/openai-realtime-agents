import { NextRequest, NextResponse } from "next/server";
import { DynamicScenario } from "@/app/types";
import { allAgentSets } from "@/app/agentConfigs";

// In-memory storage for development - in production, use a database
const scenarios: DynamicScenario[] = [];

// Initialize with default scenarios if empty
function initializeDefaultScenarios() {
  if (scenarios.length === 0) {
    // Use imported allAgentSets

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

export async function GET() {
  try {
    initializeDefaultScenarios();
    return NextResponse.json(scenarios);
  } catch (error) {
    console.error("Error fetching scenarios:", error);
    return NextResponse.json({ error: "Failed to fetch scenarios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, agents, companyName } = body;

    if (!name || !agents || !Array.isArray(agents)) {
      return NextResponse.json({ error: "Invalid scenario data" }, { status: 400 });
    }

    const newScenario: DynamicScenario = {
      id: `scenario-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description: description || '',
      agents,
      companyName: companyName || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    scenarios.push(newScenario);
    return NextResponse.json(newScenario, { status: 201 });
  } catch (error) {
    console.error("Error creating scenario:", error);
    return NextResponse.json({ error: "Failed to create scenario" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Scenario ID required" }, { status: 400 });
    }

    const scenarioIndex = scenarios.findIndex(s => s.id === id);
    if (scenarioIndex === -1) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    scenarios[scenarioIndex] = {
      ...scenarios[scenarioIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(scenarios[scenarioIndex]);
  } catch (error) {
    console.error("Error updating scenario:", error);
    return NextResponse.json({ error: "Failed to update scenario" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Scenario ID required" }, { status: 400 });
    }

    const scenarioIndex = scenarios.findIndex(s => s.id === id);
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