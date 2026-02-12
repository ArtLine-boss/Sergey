import React, { useState } from 'react';
import { TemplateConstructor } from './components/TemplateConstructor';
import { DataManager } from './components/DataManager';
import { DataItem, FieldSchema } from './types';
import { Layers, Database, Wrench, Package } from 'lucide-react';

// Initial Schemas
const initialMaterialSchema: FieldSchema[] = [
  { key: 'name', label: 'Название', type: 'text', required: true, isSystem: true },
  { key: 'sku', label: 'Артикул', type: 'text', required: true },
  { key: 'group', label: 'Группа', type: 'text' },
  { key: 'price', label: 'Цена', type: 'number', required: true, isSystem: true },
  { key: 'unit', label: 'Ед. изм.', type: 'text', defaultValue: 'лист' },
  { key: 'density', label: 'Плотность', type: 'text' },
  { key: 'dimensions', label: 'Формат', type: 'text' },
  { key: 'image_url', label: 'Фото (URL)', type: 'image' }
];

const initialOperationSchema: FieldSchema[] = [
  { key: 'name', label: 'Название', type: 'text', required: true, isSystem: true },
  { key: 'variant', label: 'Вариант', type: 'text' },
  { key: 'description', label: 'Описание', type: 'text' },
  { key: 'price', label: 'Базовая цена', type: 'number', isSystem: true }
];

// Mock Data
const mockMaterials: DataItem[] = [
  {
    id: 'mat-1',
    sku: 'P-150-C',
    name: 'Мелованная бумага 150г',
    density: '150г',
    dimensions: 'A1',
    unit: 'лист',
    group: 'Бумага',
    image_url: 'https://picsum.photos/100/100',
    price: 5.5
  },
  {
    id: 'mat-2',
    sku: 'P-300-C',
    name: 'Мелованная бумага 300г',
    density: '300г',
    dimensions: 'A1',
    unit: 'лист',
    group: 'Бумага',
    image_url: 'https://picsum.photos/101/101',
    price: 12.0
  },
  {
    id: 'mat-3',
    sku: 'P-80-O',
    name: 'Офсетная бумага 80г',
    density: '80г',
    dimensions: 'A1',
    unit: 'лист',
    group: 'Бумага',
    image_url: 'https://picsum.photos/102/102',
    price: 2.0
  }
];

const mockOperations: DataItem[] = [
  {
    id: 'op-1',
    name: 'Ламинация',
    variant: 'Глянцевая 30мкм',
    description: 'Защитный слой',
    price: 10
  },
  {
    id: 'op-2',
    name: 'Ламинация',
    variant: 'Матовая 30мкм',
    description: 'Приятная на ощупь',
    price: 15
  },
  {
    id: 'op-3',
    name: 'Биговка',
    variant: '1 биг',
    description: 'Линия сгиба',
    price: 1
  }
];

// Mock Supabase
const mockSupabase = {
  from: (table: string) => ({
    insert: (data: any[]) => {
      console.log(`[Mock Supabase] Inserting into ${table}:`, data);
      return {
        select: () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: data.map(d => ({ ...d, id: Math.random().toString(36).substr(2, 9), created_at: new Date().toISOString() })),
              error: null
            });
          }, 800);
        })
      };
    }
  })
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'constructor' | 'materials' | 'operations'>('constructor');
  
  // State for data
  const [materials, setMaterials] = useState<DataItem[]>(mockMaterials);
  const [operations, setOperations] = useState<DataItem[]>(mockOperations);

  // State for schemas
  const [materialSchema, setMaterialSchema] = useState<FieldSchema[]>(initialMaterialSchema);
  const [operationSchema, setOperationSchema] = useState<FieldSchema[]>(initialOperationSchema);

  // Constructor state
  const [loadedTemplateId, setLoadedTemplateId] = useState<string>('');
  const [originalConfig, setOriginalConfig] = useState<any>(null);

  const handleLoadData = () => {
    console.log('Data reload requested');
  };

  return (
    <div className="h-screen w-screen bg-gray-100 flex flex-col font-sans text-slate-800 overflow-hidden">
      
      {/* Top Navigation Bar */}
      <div className="bg-slate-800 text-white flex-none">
        <div className="flex items-center px-4">
          <div className="flex items-center gap-2 py-4 mr-8 border-r border-slate-700 pr-6">
            <Package className="text-blue-400" />
            <h1 className="font-bold tracking-tight">PrintConfig</h1>
          </div>
          
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab('constructor')}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'constructor' 
                  ? 'border-blue-400 text-white bg-slate-700/50' 
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              <Layers size={16} /> Конструктор
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'materials' 
                  ? 'border-blue-400 text-white bg-slate-700/50' 
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              <Database size={16} /> Материалы
            </button>
            <button
              onClick={() => setActiveTab('operations')}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'operations' 
                  ? 'border-blue-400 text-white bg-slate-700/50' 
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              <Wrench size={16} /> Операции
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'constructor' && (
          <TemplateConstructor
            materials={materials}
            operations={operations}
            supabase={mockSupabase}
            loadedTemplateId={loadedTemplateId}
            setLoadedTemplateId={setLoadedTemplateId}
            originalConfig={originalConfig}
            setOriginalConfig={setOriginalConfig}
            loadData={handleLoadData}
          />
        )}
        
        {activeTab === 'materials' && (
          <DataManager
            title="Склад материалов"
            data={materials}
            schema={materialSchema}
            onUpdateData={setMaterials}
            onUpdateSchema={setMaterialSchema}
          />
        )}

        {activeTab === 'operations' && (
          <DataManager
            title="Справочник операций"
            data={operations}
            schema={operationSchema}
            onUpdateData={setOperations}
            onUpdateSchema={setOperationSchema}
          />
        )}
      </div>
    </div>
  );
};

export default App;
