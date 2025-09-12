"use client";
import React, { useState, useEffect } from "react";
import { useScenarios } from "@/app/contexts/ScenarioContext";
import { DynamicScenario } from "@/app/types";
import ScenarioForm from "./ScenarioForm";
import AgentManager from "./AgentManager";

interface ScenariosManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ScenariosManager: React.FC<ScenariosManagerProps> = ({ isOpen, onClose }) => {
  const { scenarios, deleteScenario, loadScenarios } = useScenarios();
  const [selectedScenario, setSelectedScenario] = useState<DynamicScenario | null>(null);
  const [showScenarioForm, setShowScenarioForm] = useState(false);
  const [showAgentManager, setShowAgentManager] = useState(false);
  const [editingScenario, setEditingScenario] = useState<DynamicScenario | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadScenarios();
    }
  }, [isOpen, loadScenarios]);

  if (!isOpen) return null;

  const handleCreateScenario = () => {
    setEditingScenario(null);
    setShowScenarioForm(true);
  };

  const handleEditScenario = (scenario: DynamicScenario) => {
    setEditingScenario(scenario);
    setShowScenarioForm(true);
  };

  const handleManageAgents = (scenario: DynamicScenario) => {
    setSelectedScenario(scenario);
    setShowAgentManager(true);
  };

  const handleDeleteScenarioClick = async (scenario: DynamicScenario) => {
    if (confirm(`آیا مطمئن هستید که می‌خواهید سناریو "${scenario.name}" را حذف کنید؟`)) {
      try {
        await deleteScenario(scenario.id);
      } catch (error) {
        console.error('Error deleting scenario:', error);
        alert('خطا در حذف سناریو');
      }
    }
  };

  const handleScenarioFormClose = () => {
    setShowScenarioForm(false);
    setEditingScenario(null);
  };

  const handleAgentManagerClose = () => {
    setShowAgentManager(false);
    setSelectedScenario(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">مدیریت سناریوهای داینامیک</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
          </div>

          <div className="mb-6">
            <button
              onClick={handleCreateScenario}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              ایجاد سناریوی جدید
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenarios.map((scenario) => (
              <div key={scenario.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{scenario.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{scenario.description}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleEditScenario(scenario)}
                      className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
                    >
                      ویرایش
                    </button>
                    <button
                      onClick={() => handleManageAgents(scenario)}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                    >
                      عامل‌ها
                    </button>
                    <button
                      onClick={() => handleDeleteScenarioClick(scenario)}
                      className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                    >
                      حذف
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>عامل‌ها:</span>
                    <span className="font-medium">{scenario.agents.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>شرکت:</span>
                    <span className="font-medium">{scenario.companyName || 'نامشخص'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ایجاد:</span>
                    <span className="font-medium">
                      {new Date(scenario.createdAt).toLocaleDateString('fa-IR')}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">عامل‌ها:</h4>
                  <div className="space-y-1">
                    {scenario.agents.slice(0, 3).map((agent, index) => (
                      <div key={agent.id} className="text-xs text-gray-600 flex justify-between">
                        <span>{agent.name}</span>
                        <span>{agent.voice}</span>
                      </div>
                    ))}
                    {scenario.agents.length > 3 && (
                      <div className="text-xs text-gray-500">
                        و {scenario.agents.length - 3} عامل دیگر...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {scenarios.length === 0 && (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">هیچ سناریویی وجود ندارد</h3>
                <p className="text-gray-500 mb-6">اولین سناریوی خود را ایجاد کنید</p>
                <button
                  onClick={handleCreateScenario}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                >
                  ایجاد سناریوی جدید
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showScenarioForm && (
        <ScenarioForm
          scenario={editingScenario || undefined}
          onClose={handleScenarioFormClose}
        />
      )}

      {showAgentManager && selectedScenario && (
        <AgentManager
          scenario={selectedScenario}
          onClose={handleAgentManagerClose}
        />
      )}
    </>
  );
};

export default ScenariosManager;