"use client";
import React, { useState } from 'react';
import { DynamicAgent, DynamicScenario } from '@/app/types';
import { useScenarios } from '@/app/contexts/ScenarioContext';

interface AgentManagerProps {
  scenario: DynamicScenario;
  onClose: () => void;
}

const AgentManager: React.FC<AgentManagerProps> = ({ scenario, onClose }) => {
  const { updateScenario } = useScenarios();
  const [agents, setAgents] = useState<DynamicAgent[]>(scenario.agents);
  const [editingAgent, setEditingAgent] = useState<DynamicAgent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddAgent = () => {
    const newAgent: DynamicAgent = {
      id: `temp-agent-${Date.now()}`,
      name: '',
      voice: 'sage',
      instructions: '',
      tools: [],
      handoffAgentIds: [],
    };
    setAgents(prev => [...prev, newAgent]);
    setEditingAgent(newAgent);
  };

  const handleEditAgent = (agent: DynamicAgent) => {
    setEditingAgent(agent);
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('آیا مطمئن هستید که می‌خواهید این عامل را حذف کنید؟')) {
      return;
    }

    try {
      const updatedAgents = agents.filter(agent => agent.id !== agentId);
      setAgents(updatedAgents);

      await updateScenario(scenario.id, {
        ...scenario,
        agents: updatedAgents,
      });
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('خطا در حذف عامل');
    }
  };

  const handleSaveAgent = async (updatedAgent: DynamicAgent) => {
    try {
      setIsSubmitting(true);

      const updatedAgents = agents.map(agent =>
        agent.id === updatedAgent.id ? updatedAgent : agent
      );

      // If it's a new agent, assign a proper ID
      if (updatedAgent.id.startsWith('temp-')) {
        const finalAgent = {
          ...updatedAgent,
          id: `${scenario.name.toLowerCase().replace(/\s+/g, '-')}-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        updatedAgents[updatedAgents.length - 1] = finalAgent;
      }

      setAgents(updatedAgents);
      setEditingAgent(null);

      await updateScenario(scenario.id, {
        ...scenario,
        agents: updatedAgents,
      });
    } catch (error) {
      console.error('Error saving agent:', error);
      alert('خطا در ذخیره عامل');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingAgent(null);
    // Reset agents to original state
    setAgents(scenario.agents);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">مدیریت عامل‌های سناریو: {scenario.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div className="mb-6">
          <button
            onClick={handleAddAgent}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            افزودن عامل جدید
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-lg">{agent.name}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditAgent(agent)}
                    className="text-blue-500 hover:text-blue-700 text-sm"
                  >
                    ویرایش
                  </button>
                  <button
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    حذف
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>صدا:</strong> {agent.voice}</p>
                <p><strong>ابزارها:</strong> {agent.tools.length}</p>
                <p><strong>هاندوف‌ها:</strong> {agent.handoffAgentIds.length}</p>
              </div>

              <div className="mt-3">
                <p className="text-sm text-gray-700">
                  <strong>دستورالعمل‌ها:</strong>
                </p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-3">
                  {agent.instructions.length > 100
                    ? `${agent.instructions.substring(0, 100)}...`
                    : agent.instructions
                  }
                </p>
              </div>
            </div>
          ))}

          {agents.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <p className="text-lg mb-4">هیچ عاملی در این سناریو وجود ندارد</p>
              <button
                onClick={handleAddAgent}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                اولین عامل را اضافه کنید
              </button>
            </div>
          )}
        </div>

        {editingAgent && (
          <AgentForm
            agent={editingAgent}
            allAgents={agents}
            onSave={handleSaveAgent}
            onCancel={handleCancelEdit}
            isSubmitting={isSubmitting}
          />
        )}

        <div className="flex justify-end mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};

// Inline AgentForm component for editing agents
interface AgentFormProps {
  agent: DynamicAgent;
  allAgents: DynamicAgent[];
  onSave: (agent: DynamicAgent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const AgentForm: React.FC<AgentFormProps> = ({
  agent,
  allAgents,
  onSave,
  onCancel,
  isSubmitting
}) => {
  const [formData, setFormData] = useState({
    name: agent.name,
    voice: agent.voice,
    instructions: agent.instructions,
    handoffAgentIds: agent.handoffAgentIds,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleHandoffChange = (agentId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      handoffAgentIds: checked
        ? [...prev.handoffAgentIds, agentId]
        : prev.handoffAgentIds.filter(id => id !== agentId)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedAgent: DynamicAgent = {
      ...agent,
      ...formData,
    };

    onSave(updatedAgent);
  };

  const availableHandoffAgents = allAgents.filter(a => a.id !== agent.id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">
            {agent.id.startsWith('temp-') ? 'ایجاد عامل جدید' : 'ویرایش عامل'}
          </h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">نام عامل *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">صدا</label>
              <select
                name="voice"
                value={formData.voice}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sage">Sage</option>
                <option value="alloy">Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">دستورالعمل‌ها *</label>
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleInputChange}
              required
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {availableHandoffAgents.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">عامل‌های هاندوف</label>
              <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded p-3">
                {availableHandoffAgents.map((handoffAgent) => (
                  <label key={handoffAgent.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.handoffAgentIds.includes(handoffAgent.id)}
                      onChange={(e) => handleHandoffChange(handoffAgent.id, e.target.checked)}
                      className="ml-2"
                    />
                    {handoffAgent.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              لغو
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {isSubmitting ? 'در حال ذخیره...' : 'ذخیره'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentManager;