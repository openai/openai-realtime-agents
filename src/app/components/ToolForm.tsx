"use client";
import React, { useState } from 'react';
import { DynamicTool, ToolParameters, ToolParameterProperty } from '@/app/types';

interface ToolFormProps {
  tool?: DynamicTool;
  onSave: (tool: DynamicTool) => void;
  onCancel: () => void;
}

const ToolForm: React.FC<ToolFormProps> = ({ tool, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: tool?.name || '',
    description: tool?.description || '',
    parameters: tool?.parameters || {
      type: 'object',
      properties: {},
      required: [],
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddParameter = () => {
    const paramName = `param_${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        properties: {
          ...prev.parameters.properties,
          [paramName]: {
            type: 'string',
            description: '',
          },
        },
      },
    }));
  };

  const handleParameterChange = (paramName: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        properties: {
          ...prev.parameters.properties,
          [paramName]: {
            ...prev.parameters.properties[paramName],
            [field]: value,
          },
        },
      },
    }));
  };

  const handleRemoveParameter = (paramName: string) => {
    setFormData(prev => {
      const { [paramName]: removed, ...remaining } = prev.parameters.properties;
      return {
        ...prev,
        parameters: {
          ...prev.parameters,
          properties: remaining,
          required: prev.parameters.required?.filter(r => r !== paramName) || [],
        },
      };
    });
  };

  const handleRequiredChange = (paramName: string, required: boolean) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        required: required
          ? [...(prev.parameters.required || []), paramName]
          : (prev.parameters.required || []).filter(r => r !== paramName),
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.description.trim()) {
      alert('نام و توضیحات ابزار الزامی هستند');
      return;
    }

    const newTool: DynamicTool = {
      id: tool?.id || `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: formData.name,
      description: formData.description,
      parameters: formData.parameters,
    };

    onSave(newTool);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {tool ? 'ویرایش ابزار' : 'ایجاد ابزار جدید'}
          </h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tool Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">نام ابزار *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="مثال: get_weather"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">توضیحات *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="توضیحات عملکرد ابزار..."
            />
          </div>

          {/* Parameters Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">پارامترها</h3>
              <button
                type="button"
                onClick={handleAddParameter}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
              >
                افزودن پارامتر
              </button>
            </div>

            <div className="space-y-4">
              {Object.entries(formData.parameters.properties).map(([paramName, param]) => (
                <div key={paramName} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">پارامتر: {paramName}</h4>
                    <button
                      type="button"
                      onClick={() => handleRemoveParameter(paramName)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      حذف
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">نوع</label>
                      <select
                        value={param.type}
                        onChange={(e) => handleParameterChange(paramName, 'type', e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="string">رشته (String)</option>
                        <option value="number">عدد (Number)</option>
                        <option value="boolean">بولی (Boolean)</option>
                        <option value="array">آرایه (Array)</option>
                        <option value="object">شیء (Object)</option>
                      </select>
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.parameters.required?.includes(paramName) || false}
                          onChange={(e) => handleRequiredChange(paramName, e.target.checked)}
                          className="ml-2"
                        />
                        الزامی
                      </label>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">توضیحات</label>
                    <textarea
                      value={param.description || ''}
                      onChange={(e) => handleParameterChange(paramName, 'description', e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="توضیحات پارامتر..."
                    />
                  </div>

                  {param.type === 'string' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1">الگو (Regex)</label>
                      <input
                        type="text"
                        value={param.pattern || ''}
                        onChange={(e) => handleParameterChange(paramName, 'pattern', e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="مثال: ^[A-Za-z]+$"
                      />
                    </div>
                  )}

                  {param.type === 'array' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium mb-1">نوع آیتم‌های آرایه</label>
                      <select
                        value={param.items?.type || 'string'}
                        onChange={(e) => handleParameterChange(paramName, 'items', { type: e.target.value })}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="string">رشته</option>
                        <option value="number">عدد</option>
                        <option value="boolean">بولی</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}

              {Object.keys(formData.parameters.properties).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  هیچ پارامتری تعریف نشده است. روی "افزودن پارامتر" کلیک کنید.
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              لغو
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {tool ? 'بروزرسانی' : 'ایجاد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ToolForm;