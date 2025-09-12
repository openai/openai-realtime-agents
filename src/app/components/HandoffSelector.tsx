"use client";
import React, { useState } from 'react';
import { DynamicAgent } from '@/app/types';

interface HandoffSelectorProps {
  currentAgent: DynamicAgent;
  allAgents: DynamicAgent[];
  selectedHandoffIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onClose: () => void;
}

const HandoffSelector: React.FC<HandoffSelectorProps> = ({
  currentAgent,
  allAgents,
  selectedHandoffIds,
  onSelectionChange,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter out current agent and apply search
  const availableAgents = allAgents
    .filter(agent => agent.id !== currentAgent.id)
    .filter(agent =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.instructions.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const handleAgentToggle = (agentId: string) => {
    const isSelected = selectedHandoffIds.includes(agentId);
    if (isSelected) {
      onSelectionChange(selectedHandoffIds.filter(id => id !== agentId));
    } else {
      onSelectionChange([...selectedHandoffIds, agentId]);
    }
  };

  const handleSelectAll = () => {
    const allIds = availableAgents.map(agent => agent.id);
    onSelectionChange(allIds);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">انتخاب عامل‌های هاندوف</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            انتخاب کنید که عامل <strong>{currentAgent.name}</strong> می‌تواند مکالمه را به کدام عامل‌ها انتقال دهد:
          </p>
        </div>

        {/* Search and Actions */}
        <div className="mb-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="جستجو در عامل‌ها..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
            >
              انتخاب همه
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
            >
              پاک کردن همه
            </button>
          </div>
        </div>

        {/* Agents List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {availableAgents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'هیچ عاملی با این جستجو یافت نشد' : 'هیچ عاملی برای هاندوف وجود ندارد'}
            </div>
          ) : (
            availableAgents.map((agent) => {
              const isSelected = selectedHandoffIds.includes(agent.id);
              return (
                <div
                  key={agent.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleAgentToggle(agent.id)}
                >
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleAgentToggle(agent.id)}
                      className="mt-1 ml-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">{agent.name}</h3>
                        <span className="text-sm text-gray-500">صدا: {agent.voice}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {agent.instructions}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>ابزارها: {agent.tools.length}</span>
                        <span>هاندوف‌ها: {agent.handoffAgentIds.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>
              {selectedHandoffIds.length} عامل انتخاب شده از {availableAgents.length} عامل موجود
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                لغو
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                تایید انتخاب‌ها
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HandoffSelector;