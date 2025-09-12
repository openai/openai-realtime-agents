"use client";
import React, { useState, useEffect } from 'react';
import { DynamicScenario, DynamicAgent } from '@/app/types';
import { useScenarios } from '@/app/contexts/ScenarioContext';

interface ScenarioFormProps {
  scenario?: DynamicScenario;
  onClose: () => void;
  onSave?: (scenario: DynamicScenario) => void;
}

const ScenarioForm: React.FC<ScenarioFormProps> = ({ scenario, onClose, onSave }) => {
  const { saveScenario } = useScenarios();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    companyName: '',
  });
  const [agents, setAgents] = useState<DynamicAgent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (scenario) {
      setFormData({
        name: scenario.name,
        description: scenario.description || '',
        companyName: scenario.companyName || '',
      });
      setAgents(scenario.agents);
    }
  }, [scenario]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
  };

  const handleRemoveAgent = (index: number) => {
    setAgents(prev => prev.filter((_, i) => i !== index));
  };

  const handleAgentChange = (index: number, field: keyof DynamicAgent, value: any) => {
    setAgents(prev => prev.map((agent, i) =>
      i === index ? { ...agent, [field]: value } : agent
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const scenarioData: DynamicScenario = {
        id: scenario?.id || '',
        name: formData.name,
        description: formData.description,
        companyName: formData.companyName,
        agents: agents.map(agent => ({
          ...agent,
          id: agent.id.startsWith('temp-') ? `${formData.name.toLowerCase().replace(/\s+/g, '-')}-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : agent.id,
        })),
        createdAt: scenario?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const savedScenario = await saveScenario(scenarioData);

      if (onSave) {
        onSave(savedScenario);
      }

      onClose();
    } catch (error) {
      console.error('Error saving scenario:', error);
      alert('خطا در ذخیره سناریو');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {scenario ? 'ویرایش سناریو' : 'ایجاد سناریوی جدید'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Scenario Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">نام سناریو *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="مثال: پشتیبانی مشتریان"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">نام شرکت</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="مثال: فروشگاه آنلاین"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">توضیحات</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="توضیحات سناریو..."
            />
          </div>

          {/* Agents Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">عامل‌ها</h3>
              <button
                type="button"
                onClick={handleAddAgent}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                افزودن عامل
              </button>
            </div>

            <div className="space-y-4">
              {agents.map((agent, index) => (
                <div key={agent.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">عامل {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => handleRemoveAgent(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      حذف
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">نام عامل *</label>
                      <input
                        type="text"
                        value={agent.name}
                        onChange={(e) => handleAgentChange(index, 'name', e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="مثال: پشتیبان فروش"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">صدا</label>
                      <select
                        value={agent.voice}
                        onChange={(e) => handleAgentChange(index, 'voice', e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">دستورالعمل‌ها *</label>
                    <textarea
                      value={agent.instructions}
                      onChange={(e) => handleAgentChange(index, 'instructions', e.target.value)}
                      required
                      rows={4}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="دستورالعمل‌های عامل را وارد کنید..."
                    />
                  </div>
                </div>
              ))}

              {agents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  هنوز عاملی اضافه نشده است. روی "افزودن عامل" کلیک کنید.
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              لغو
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name.trim() || agents.length === 0}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'در حال ذخیره...' : (scenario ? 'بروزرسانی' : 'ایجاد')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScenarioForm;