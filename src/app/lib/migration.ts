import { DynamicScenario, DynamicAgent } from '@/app/types';
import { allAgentSets } from '@/app/agentConfigs';
import { ScenarioStorage } from './scenarioStorage';

/**
 * Migration script to convert existing static scenarios to dynamic format
 */
export class MigrationService {
  static async migrateExistingScenarios(): Promise<void> {
    try {
      console.log('Starting migration of existing scenarios...');

      // Check if scenarios already exist
      const existingScenarios = await ScenarioStorage.getAllScenarios();
      if (existingScenarios.length > 0) {
        console.log('Scenarios already exist, skipping migration');
        return;
      }

      // Convert static scenarios to dynamic format
      const dynamicScenarios: DynamicScenario[] = [];

      for (const [scenarioKey, agents] of Object.entries(allAgentSets)) {
        console.log(`Migrating scenario: ${scenarioKey}`);

        const dynamicAgents: DynamicAgent[] = (agents as any[]).map((agent: any, index: number) => ({
          id: `${scenarioKey}-agent-${index}`,
          name: agent.name,
          voice: agent.voice || 'sage',
          instructions: typeof agent.instructions === 'string' ? agent.instructions : 'Default instructions',
          tools: agent.tools || [],
          handoffAgentIds: agent.handoffs?.map((h: any) => h.name) || [],
          handoffDescription: agent.handoffDescription || '',
        }));

        const dynamicScenario: DynamicScenario = {
          id: scenarioKey,
          name: scenarioKey,
          description: `Migrated ${scenarioKey} scenario`,
          agents: dynamicAgents,
          companyName: scenarioKey === 'customerServiceRetail' ? 'Snowy Peak Boards' : 'NewTelco',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        dynamicScenarios.push(dynamicScenario);
      }

      // Save migrated scenarios
      for (const scenario of dynamicScenarios) {
        await ScenarioStorage.createScenario(scenario);
      }

      console.log(`Migration completed successfully. Migrated ${dynamicScenarios.length} scenarios.`);
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  static async validateMigration(): Promise<boolean> {
    try {
      const scenarios = await ScenarioStorage.getAllScenarios();

      if (scenarios.length === 0) {
        console.error('No scenarios found after migration');
        return false;
      }

      // Validate each scenario
      for (const scenario of scenarios) {
        if (!scenario.id || !scenario.name || !scenario.agents) {
          console.error(`Invalid scenario: ${scenario.id}`);
          return false;
        }

        // Validate agents
        for (const agent of scenario.agents) {
          if (!agent.id || !agent.name || !agent.instructions) {
            console.error(`Invalid agent in scenario ${scenario.id}: ${agent.id}`);
            return false;
          }
        }
      }

      console.log(`Migration validation passed. ${scenarios.length} scenarios validated.`);
      return true;
    } catch (error) {
      console.error('Migration validation failed:', error);
      return false;
    }
  }

  static async clearAllData(): Promise<void> {
    try {
      // This would need to be implemented in ScenarioStorage
      console.log('Clearing all dynamic scenario data...');
      // For now, we'll use localStorage directly
      if (typeof window !== 'undefined') {
        localStorage.removeItem('dynamicScenarios');
        localStorage.removeItem('dynamicAgents');
      }
      console.log('All data cleared.');
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw error;
    }
  }
}

/**
 * Utility function to run migration from browser console
 */
export const runMigration = async () => {
  try {
    await MigrationService.migrateExistingScenarios();
    const isValid = await MigrationService.validateMigration();

    if (isValid) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.error('❌ Migration validation failed!');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
};

/**
 * Utility function to clear all data from browser console
 */
export const clearAllData = async () => {
  try {
    await MigrationService.clearAllData();
    console.log('✅ All data cleared successfully!');
  } catch (error) {
    console.error('❌ Failed to clear data:', error);
  }
};