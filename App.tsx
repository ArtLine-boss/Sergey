import React, { useState } from 'react';
import { TemplateConstructor } from './components/TemplateConstructor';
import { DataManager } from './components/DataManager';
import { TemplatesList } from './components/TemplatesList';
import { DataItem, FieldSchema, SavedTemplate, STAGE_LABELS, TemplateConfig, UNIT_LABELS } from './types';
import { templatesRepo, usePersistedState } from './lib/storage';
import { Layers, Database, Wrench, Package, Cpu, FileJson } from 'lucide-react';

// Initial Schemas
const initialMaterialSchema: FieldSchema[] = [
  { key: 'name', label: 'Название', type: 'text', required: true, isSystem: true },
  { key: 'sku', label: 'Артикул', type: 'text', required: true },
  { key: 'group', label: 'Группа', type: 'text', hint: 'Сопоставляется с условием в ставках оборудования (напр. «Картон»)' },
  { key: 'price', label: 'Цена', type: 'number', required: true, isSystem: true },
  { key: 'unit', label: 'Ед. изм.', type: 'text', defaultValue: 'лист' },
  { key: 'density', label: 'Плотность', type: 'text' },
  { key: 'dimensions', label: 'Формат', type: 'text', hint: 'Подпись, напр. SRA1' },
  { key: 'width_mm', label: 'Ширина, мм', type: 'number', hint: 'Закупочный лист' },
  { key: 'height_mm', label: 'Высота, мм', type: 'number' },
  { key: 'image_url', label: 'Фото (URL)', type: 'image' }
];

const initialOperationSchema: FieldSchema[] = [
  { key: 'name', label: 'Название', type: 'text', required: true, isSystem: true },
  { key: 'variant', label: 'Вариант', type: 'text' },
  { key: 'description', label: 'Описание', type: 'text' },
  { key: 'price', label: 'Базовая цена', type: 'number', isSystem: true },
  { key: 'stage', label: 'Стадия', type: 'select', options: ['prepress', 'print', 'postpress', 'assembly'], optionLabels: STAGE_LABELS, defaultValue: 'postpress', required: true },
  { key: 'equipment_id', label: 'Оборудование', type: 'select', optionsFrom: 'equipment' },
  { key: 'unit', label: 'Единица расчёта', type: 'select', options: ['sheet', 'item', 'run'], optionLabels: UNIT_LABELS, defaultValue: 'item', required: true },
  { key: 'complexity', label: 'Сложность', type: 'text', hint: 'Сопоставляется с условием в ставках оборудования' },
  { key: 'setup_time_min', label: 'Приладка, мин', type: 'number', hint: 'Переопределяет приладку оборудования' },
  { key: 'waste_percent', label: 'Отходы, %', type: 'number' },
  { key: 'material_id', label: 'Расходный материал', type: 'select', optionsFrom: 'materials' },
  { key: 'material_per_unit', label: 'Расход на единицу', type: 'number', hint: 'В ед. изм. расходника (напр. м² плёнки на лист)' }
];

const initialEquipmentSchema: FieldSchema[] = [
  { key: 'name', label: 'Название', type: 'text', required: true, isSystem: true },
  { key: 'type', label: 'Тип', type: 'select', options: ['Печать', 'Ламинация', 'Резка', 'Биговка', 'Фальцовка', 'Сборка', 'Прочее'], defaultValue: 'Прочее' },
  { key: 'sheet_width_mm', label: 'Печатный лист, ширина мм', type: 'number', hint: 'Для печатного оборудования' },
  { key: 'sheet_height_mm', label: 'Печатный лист, высота мм', type: 'number' },
  { key: 'margin_mm', label: 'Непечатные поля, мм', type: 'number' },
  { key: 'bleed_mm', label: 'Вылеты на подрезку, мм', type: 'number' },
  { key: 'max_width_mm', label: 'Макс. формат, ширина мм', type: 'number', hint: 'Для послепечатного оборудования' },
  { key: 'max_height_mm', label: 'Макс. формат, высота мм', type: 'number' },
  { key: 'hourly_rate', label: '₽ / машино-час', type: 'number', required: true, isSystem: true },
  { key: 'setup_time_min', label: 'Приладка, мин', type: 'number' },
  { key: 'waste_sheets', label: 'Листы на приладку', type: 'number' },
  { key: 'rates', label: 'Производительность', type: 'rates', isSystem: true, hint: 'Ед/час по условию (группа материала или сложность); пустое условие — по умолчанию' }
];

// Mock Data
const mockMaterials: DataItem[] = [
  { id: 'mat-1', sku: 'P-150-C', name: 'Мелованная бумага 150г', density: '150г', dimensions: 'SRA1', width_mm: 640, height_mm: 900, unit: 'лист', group: 'Бумага', image_url: 'https://picsum.photos/100/100', price: 5.5 },
  { id: 'mat-2', sku: 'P-300-C', name: 'Мелованная бумага 300г', density: '300г', dimensions: 'SRA1', width_mm: 640, height_mm: 900, unit: 'лист', group: 'Картон', image_url: 'https://picsum.photos/101/101', price: 12.0 },
  { id: 'mat-3', sku: 'P-80-O', name: 'Офсетная бумага 80г', density: '80г', dimensions: 'SRA1', width_mm: 640, height_mm: 900, unit: 'лист', group: 'Бумага', image_url: 'https://picsum.photos/102/102', price: 2.0 },
  { id: 'mat-4', sku: 'F-GL-30', name: 'Плёнка глянцевая 30мкм', density: '30мкм', dimensions: 'рулон 330мм', unit: 'м²', group: 'Плёнка', price: 45 },
  { id: 'mat-5', sku: 'F-MT-30', name: 'Плёнка матовая 30мкм', density: '30мкм', dimensions: 'рулон 330мм', unit: 'м²', group: 'Плёнка', price: 55 }
];

const mockEquipment: DataItem[] = [
  { id: 'eq-1', name: 'Konica Minolta C3070', type: 'Печать', sheet_width_mm: 330, sheet_height_mm: 487, margin_mm: 5, bleed_mm: 2, hourly_rate: 2500, setup_time_min: 10, waste_sheets: 5, rates: [{ condition: '', perHour: 3000 }, { condition: 'Картон', perHour: 1800 }] },
  { id: 'eq-2', name: 'Ламинатор GMP Excelam 355', type: 'Ламинация', max_width_mm: 355, max_height_mm: 0, hourly_rate: 900, setup_time_min: 15, rates: [{ condition: '', perHour: 600 }] },
  { id: 'eq-3', name: 'Резак Ideal 4315', type: 'Резка', max_width_mm: 430, max_height_mm: 0, hourly_rate: 600, setup_time_min: 5, rates: [{ condition: '', perHour: 3000 }] },
  { id: 'eq-4', name: 'Биговщик Cyklos GPM 450', type: 'Биговка', max_width_mm: 450, max_height_mm: 0, hourly_rate: 500, setup_time_min: 5, rates: [{ condition: '', perHour: 1500 }] },
  { id: 'eq-5', name: 'Брошюровщик Duplo', type: 'Сборка', hourly_rate: 800, setup_time_min: 15, rates: [{ condition: '', perHour: 400 }] },
  { id: 'eq-6', name: 'Термоклеевая машина (КБС)', type: 'Сборка', hourly_rate: 1200, setup_time_min: 30, rates: [{ condition: '', perHour: 150 }] }
];

const mockOperations: DataItem[] = [
  { id: 'op-print', name: 'Печать цифровая', variant: 'CMYK', description: 'Цифровая печать', price: 0, stage: 'print', equipment_id: 'eq-1', unit: 'sheet', waste_percent: 2 },
  { id: 'op-1', name: 'Ламинация', variant: 'Глянцевая 30мкм', description: 'Защитный слой', price: 10, stage: 'postpress', equipment_id: 'eq-2', unit: 'sheet', material_id: 'mat-4', material_per_unit: 0.16 },
  { id: 'op-2', name: 'Ламинация', variant: 'Матовая 30мкм', description: 'Приятная на ощупь', price: 15, stage: 'postpress', equipment_id: 'eq-2', unit: 'sheet', material_id: 'mat-5', material_per_unit: 0.16 },
  { id: 'op-3', name: 'Биговка', variant: '1 биг', description: 'Линия сгиба', price: 1, stage: 'postpress', equipment_id: 'eq-4', unit: 'item' },
  { id: 'op-4', name: 'Резка', variant: 'Подрезка в формат', description: '', price: 0.5, stage: 'postpress', equipment_id: 'eq-3', unit: 'item' },
  { id: 'op-5', name: 'Брошюровка', variant: 'На скобу', description: 'Брошюровка металлической скобой', price: 20, stage: 'assembly', equipment_id: 'eq-5', unit: 'item' },
  { id: 'op-6', name: 'КБС', variant: 'Термоклей', description: 'Термоклеевое скрепление', price: 50, stage: 'assembly', equipment_id: 'eq-6', unit: 'item' }
];

type Tab = 'constructor' | 'templates' | 'materials' | 'operations' | 'equipment';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'constructor', label: 'Конструктор', icon: <Layers size={16} /> },
  { id: 'templates', label: 'Шаблоны', icon: <FileJson size={16} /> },
  { id: 'materials', label: 'Материалы', icon: <Database size={16} /> },
  { id: 'operations', label: 'Операции', icon: <Wrench size={16} /> },
  { id: 'equipment', label: 'Оборудование', icon: <Cpu size={16} /> }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('constructor');

  const [materials, setMaterials] = usePersistedState<DataItem[]>('materials', mockMaterials);
  const [operations, setOperations] = usePersistedState<DataItem[]>('operations', mockOperations);
  const [equipment, setEquipment] = usePersistedState<DataItem[]>('equipment', mockEquipment);

  const [materialSchema, setMaterialSchema] = usePersistedState<FieldSchema[]>('schema:materials', initialMaterialSchema);
  const [operationSchema, setOperationSchema] = usePersistedState<FieldSchema[]>('schema:operations', initialOperationSchema);
  const [equipmentSchema, setEquipmentSchema] = usePersistedState<FieldSchema[]>('schema:equipment', initialEquipmentSchema);

  const [templates, setTemplates] = useState<SavedTemplate[]>(() => templatesRepo.list());
  const [loadRequest, setLoadRequest] = useState<{ template: SavedTemplate; nonce: number } | null>(null);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string>('');

  const lookups = { equipment, materials };

  const handleSaveTemplate = (name: string, config: TemplateConfig, id?: string) => {
    const saved = templatesRepo.save({ id, name, config });
    setTemplates(templatesRepo.list());
    setLoadedTemplateId(saved.id);
    return saved;
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(templatesRepo.remove(id));
    if (loadedTemplateId === id) setLoadedTemplateId('');
  };

  const handleOpenTemplate = (template: SavedTemplate) => {
    setLoadRequest({ template, nonce: Date.now() });
    setLoadedTemplateId(template.id);
    setActiveTab('constructor');
  };

  return (
    <div className="h-screen w-screen bg-gray-100 flex flex-col font-sans text-slate-800 overflow-hidden">
      <div className="bg-slate-800 text-white flex-none print:hidden">
        <div className="flex items-center px-4">
          <div className="flex items-center gap-2 py-4 mr-8 border-r border-slate-700 pr-6">
            <Package className="text-blue-400" />
            <h1 className="font-bold tracking-tight">PrintConfig</h1>
          </div>
          <nav className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-400 text-white bg-slate-700/50'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tabs stay mounted so the constructor keeps its state while editing directories */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`h-full ${activeTab === 'constructor' ? '' : 'hidden'}`}>
          <TemplateConstructor
            materials={materials}
            operations={operations}
            equipment={equipment}
            templates={templates}
            loadedTemplateId={loadedTemplateId}
            loadRequest={loadRequest}
            onSaveTemplate={handleSaveTemplate}
          />
        </div>

        <div className={`h-full ${activeTab === 'templates' ? '' : 'hidden'}`}>
          <TemplatesList
            templates={templates}
            activeId={loadedTemplateId}
            onOpen={handleOpenTemplate}
            onDelete={handleDeleteTemplate}
          />
        </div>

        <div className={`h-full ${activeTab === 'materials' ? '' : 'hidden'}`}>
          <DataManager
            title="Склад материалов"
            data={materials}
            schema={materialSchema}
            lookups={lookups}
            onUpdateData={setMaterials}
            onUpdateSchema={setMaterialSchema}
          />
        </div>

        <div className={`h-full ${activeTab === 'operations' ? '' : 'hidden'}`}>
          <DataManager
            title="Справочник операций"
            data={operations}
            schema={operationSchema}
            lookups={lookups}
            onUpdateData={setOperations}
            onUpdateSchema={setOperationSchema}
          />
        </div>

        <div className={`h-full ${activeTab === 'equipment' ? '' : 'hidden'}`}>
          <DataManager
            title="Оборудование"
            data={equipment}
            schema={equipmentSchema}
            lookups={lookups}
            onUpdateData={setEquipment}
            onUpdateSchema={setEquipmentSchema}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
