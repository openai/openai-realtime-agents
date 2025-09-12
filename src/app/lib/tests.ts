import { ScenarioStorage } from './scenarioStorage';
import { AgentStorage } from './agentStorage';
import { MigrationService } from './migration';

/**
 * Test suite for dynamic scenarios system
 */
export class TestSuite {
  static async runAllTests(): Promise<void> {
    console.log('🧪 Running Dynamic Scenarios Test Suite...\n');

    try {
      await this.testScenarioStorage();
      await this.testAgentStorage();
      await this.testMigration();
      await this.testIntegration();

      console.log('✅ All tests passed!');
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    }
  }

  static async testScenarioStorage(): Promise<void> {
    console.log('Testing Scenario Storage...');

    // Clear existing data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dynamicScenarios');
    }

    // Test creating a scenario
    const testScenario = {
      name: 'Test Scenario',
      description: 'A test scenario',
      agents: [{
        id: 'test-agent-1',
        name: 'Test Agent',
        voice: 'sage' as any,
        instructions: 'Test instructions',
        tools: [],
        handoffAgentIds: [],
      }],
      companyName: 'Test Company',
    };

    const created = await ScenarioStorage.createScenario(testScenario);
    console.log('✅ Created scenario:', created.id);

    // Test retrieving scenarios
    const scenarios = await ScenarioStorage.getAllScenarios();
    if (scenarios.length === 0) {
      throw new Error('No scenarios found after creation');
    }
    console.log('✅ Retrieved scenarios:', scenarios.length);

    // Test updating scenario
    const updated = await ScenarioStorage.updateScenario(created.id, {
      description: 'Updated description'
    });
    if (!updated || updated.description !== 'Updated description') {
      throw new Error('Scenario update failed');
    }
    console.log('✅ Updated scenario');

    // Test deleting scenario
    const deleted = await ScenarioStorage.deleteScenario(created.id);
    if (!deleted) {
      throw new Error('Scenario deletion failed');
    }
    console.log('✅ Deleted scenario');

    console.log('✅ Scenario Storage tests passed\n');
  }

  static async testAgentStorage(): Promise<void> {
    console.log('Testing Agent Storage...');

    // Clear existing data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dynamicAgents');
    }

    // Test creating an agent
    const testAgent = {
      name: 'Test Agent',
      voice: 'sage' as any,
      instructions: 'Test instructions',
      tools: [],
      handoffAgentIds: [],
    };

    const created = await AgentStorage.createAgent(testAgent);
    console.log('✅ Created agent:', created.id);

    // Test retrieving agents
    const agents = await AgentStorage.getAllAgents();
    if (agents.length === 0) {
      throw new Error('No agents found after creation');
    }
    console.log('✅ Retrieved agents:', agents.length);

    // Test updating agent
    const updated = await AgentStorage.updateAgent(created.id, {
      instructions: 'Updated instructions'
    });
    if (!updated || updated.instructions !== 'Updated instructions') {
      throw new Error('Agent update failed');
    }
    console.log('✅ Updated agent');

    // Test deleting agent
    const deleted = await AgentStorage.deleteAgent(created.id);
    if (!deleted) {
      throw new Error('Agent deletion failed');
    }
    console.log('✅ Deleted agent');

    console.log('✅ Agent Storage tests passed\n');
  }

  static async testMigration(): Promise<void> {
    console.log('Testing Migration...');

    // Clear existing data
    await MigrationService.clearAllData();

    // Run migration
    await MigrationService.migrateExistingScenarios();
    console.log('✅ Migration completed');

    // Validate migration
    const isValid = await MigrationService.validateMigration();
    if (!isValid) {
      throw new Error('Migration validation failed');
    }
    console.log('✅ Migration validated');

    console.log('✅ Migration tests passed\n');
  }

  static async testIntegration(): Promise<void> {
    console.log('Testing Integration...');

    // Test that scenarios and agents work together
    const scenarios = await ScenarioStorage.getAllScenarios();
    if (scenarios.length === 0) {
      throw new Error('No scenarios available for integration test');
    }

    const testScenario = scenarios[0];
    console.log('✅ Found scenario for integration test:', testScenario.name);

    // Test agent retrieval for scenario
    const scenarioAgents = await AgentStorage.getAgentsByScenario(testScenario.id);
    console.log('✅ Found agents for scenario:', scenarioAgents.length);

    // Test that agent IDs match
    const agentIds = scenarioAgents.map(a => a.id);
    const scenarioAgentIds = testScenario.agents.map(a => a.id);

    const allMatch = scenarioAgentIds.every(id => agentIds.includes(id));
    if (!allMatch) {
      throw new Error('Agent IDs do not match between scenario and storage');
    }
    console.log('✅ Agent IDs match correctly');

    console.log('✅ Integration tests passed\n');
  }
}

/**
 * Utility function to run tests from browser console
 */
export const runTests = async () => {
  try {
    await TestSuite.runAllTests();
    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('💥 Test suite failed:', error);
  }
};

/**
 * Quick test for UI components
 */
export const testUI = () => {
  console.log('🖥️  UI Test Instructions:');
  console.log('1. Open the scenarios manager from the main UI');
  console.log('2. Try creating a new scenario');
  console.log('3. Add agents to the scenario');
  console.log('4. Test editing and deleting scenarios');
  console.log('5. Verify that changes persist after page refresh');
  console.log('6. Test that OpenAI connection still works with dynamic scenarios');
};