import React, { useState, useMemo, useEffect } from 'react';
import {
  Settings, Plus, Trash2, ChevronRight, ChevronDown, Package, Ruler,
  ArrowUp, ArrowDown, GitBranch, X, Eye, EyeOff, Info, BookOpen,
  Layers, AlertCircle, Calculator, Save, Search, Check,
  Monitor, MonitorOff, ChevronRightSquare, Puzzle, ClipboardList, Download, Link2, Cpu
} from 'lucide-react';

import {
  VisibilityRule, BlockType, ConfigItem, Block, DataItem, ProductPart, TemplateConfig, SavedTemplate,
  STAGE_LABELS, UNIT_LABELS
} from '../types';
import { isEntityVisible, collectSelectedItems, buildTechCard, formatMoney } from '../lib/techCard';
import { downloadJson, toPublicTemplate } from '../lib/export';
import { TechCardModal } from './TechCardModal';

// =============================================================================
// НАЧАЛЬНЫЕ ДАННЫЕ (демо-брошюра, привязана к mock-справочникам из App.tsx)
// =============================================================================

const initialSizePresets: string[] = [
  '210 x 297 (A4)',
  '148 x 210 (A5)',
  '297 x 420 (A3)',
  '100 x 100',
  '90 x 50'
];

const initialParts: ProductPart[] = [
  { id: 'part-cover', name: 'Обложка', pagesMode: 'fixed', pages: 4 },
  { id: 'part-block', name: 'Блок', pagesMode: 'client' }
];

const printSidesItems = (prefix: string, price1: number, price2: number): ConfigItem[] => [
  {
    id: `${prefix}-1s`, name: 'Односторонняя', price: 0, unit: 'шт', sides: 1, isOpen: true, children: [
      { id: `${prefix}-1s-op`, name: 'Цифровая CMYK', price: price1, unit: 'лист', children: [], sourceType: 'operation', sourceId: 'op-print' }
    ]
  },
  {
    id: `${prefix}-2s`, name: 'Двусторонняя', price: 0, unit: 'шт', sides: 2, isOpen: true, children: [
      { id: `${prefix}-2s-op`, name: 'Цифровая CMYK', price: price2, unit: 'лист', children: [], sourceType: 'operation', sourceId: 'op-print' }
    ]
  }
];

const initialBlocks: Block[] = [
  {
    id: 'paper-cover', name: 'Бумага обложки', type: 'standard', partId: 'part-cover', visibilityRules: [],
    items: [
      { id: 'pc1', name: 'Меловка 300', price: 25, unit: 'лист', children: [], isOpen: true, sourceType: 'material', sourceId: 'mat-2', description: 'Плотная мелованная бумага для обложки.' },
      { id: 'pc2', name: 'Меловка 150', price: 10, unit: 'лист', children: [], isOpen: true, sourceType: 'material', sourceId: 'mat-1' }
    ]
  },
  { id: 'print-cover', name: 'Печать обложки', type: 'standard', partId: 'part-cover', visibilityRules: [], items: printSidesItems('prc', 6, 10) },
  {
    id: 'lam-cover', name: 'Ламинация обложки', type: 'standard', partId: 'part-cover', visibilityRules: [],
    items: [
      { id: 'lc0', name: 'Без ламинации', price: 0, unit: 'шт', children: [], isOpen: true },
      { id: 'lc1', name: 'Глянцевая 30мкм', price: 10, unit: 'лист', children: [], isOpen: true, sourceType: 'operation', sourceId: 'op-1', description: 'Защитный слой' },
      { id: 'lc2', name: 'Матовая 30мкм', price: 15, unit: 'лист', children: [], isOpen: true, sourceType: 'operation', sourceId: 'op-2', description: 'Приятная на ощупь' }
    ]
  },
  {
    id: 'paper-block', name: 'Бумага блока', type: 'standard', partId: 'part-block', visibilityRules: [],
    items: [
      { id: 'pb1', name: 'Меловка 150', price: 10, unit: 'лист', children: [], isOpen: true, sourceType: 'material', sourceId: 'mat-1', description: 'Стандартная мелованная бумага средней плотности.' },
      { id: 'pb2', name: 'Офсетная 80', price: 4, unit: 'лист', children: [], isOpen: true, sourceType: 'material', sourceId: 'mat-3' }
    ]
  },
  { id: 'print-block', name: 'Печать блока', type: 'standard', partId: 'part-block', visibilityRules: [], items: printSidesItems('prb', 3, 5) },
  {
    id: 'binding', name: 'Вид переплета', type: 'binding', visibilityRules: [],
    minPages: 8, maxPages: 400, pageMultiplicity: 4, defaultPages: 24,
    items: [
      { id: 'b1', name: 'На скобу', price: 20, unit: 'шт', children: [], isOpen: true, sourceType: 'operation', sourceId: 'op-5', description: 'Брошюровка металлической скобой.', minPages: 8, maxPages: 48, pageMultiplicity: 4 },
      { id: 'b2', name: 'КБС (Клей)', price: 50, unit: 'шт', children: [], isOpen: true, sourceType: 'operation', sourceId: 'op-6', description: 'Термоклеевое скрепление.', minPages: 40, maxPages: 400, pageMultiplicity: 2 }
    ]
  }
];

// =============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =============================================================================

const generateId = () => Math.random().toString(36).substr(2, 9);

const getRecursiveDefaults = (item: ConfigItem): Record<string, string> => {
  const defaults: Record<string, string> = {};
  let current = item;
  while (current.children && current.children.length > 0) {
    const validChild = current.children.find(c => !c.isPaused);
    if (validChild) {
      defaults[current.id] = validChild.id;
      current = validChild;
    } else {
      break;
    }
  }
  return defaults;
};

const buildDefaultSelections = (blocks: Block[]): Record<string, string> => {
  const sel: Record<string, string> = {};
  blocks.forEach(block => {
    const first = block.items.find(i => !i.isPaused && !i.isHidden) || block.items.find(i => !i.isPaused);
    if (first) {
      sel[block.id] = first.id;
      Object.assign(sel, getRecursiveDefaults(first));
    }
  });
  return sel;
};

const getItemsFlat = (items: ConfigItem[], blockName: string = ''): { id: string, name: string, blockName: string }[] => {
  const flat: { id: string, name: string, blockName: string }[] = [];
  const traverse = (itemList: ConfigItem[]) => {
    itemList.forEach(item => {
      flat.push({ id: item.id, name: item.name, blockName });
      if (item.children.length > 0) traverse(item.children);
    });
  };
  traverse(items);
  return flat;
};

const getAllItemsGlobal = (blocks: Block[]) => blocks.flatMap(b => getItemsFlat(b.items, b.name));

const numberInputClass = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

// =============================================================================
// ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
// =============================================================================

interface TooltipProps {
  text?: string;
  error?: string;
  imageUrl?: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ text, error, imageUrl, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  if (!text && !imageUrl && !error) return <>{children}</>;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white rounded-lg shadow-xl p-3 text-xs pointer-events-none">
          {error && (
            <div className="mb-2 pb-2 border-b border-white/20 text-red-300 font-bold flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {imageUrl && (
            <div className="mb-2 rounded overflow-hidden bg-white/10 aspect-video">
              <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
            </div>
          )}
          {text && <p className="leading-relaxed">{text}</p>}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};

type Sources = { materials: DataItem[]; operations: DataItem[]; equipment: DataItem[] };

const SourceBadge: React.FC<{ item: ConfigItem; sources: Sources }> = ({ item, sources }) => {
  if (!item.sourceType || !item.sourceId) return null;
  if (item.sourceType === 'material') {
    const m = sources.materials.find(x => x.id === item.sourceId);
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${m ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`} title="Связь со складом">
        <Link2 size={10} /> {m ? `${m.name}${m.group ? ` · ${m.group}` : ''}` : 'материал не найден'}
      </span>
    );
  }
  const op = sources.operations.find(x => x.id === item.sourceId);
  const eq = op ? sources.equipment.find(x => x.id === op.equipment_id) : undefined;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${op ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-red-50 text-red-600 border-red-200'}`} title="Связь с операцией">
      <Cpu size={10} />
      {op
        ? `${op.name}${op.variant ? ` (${op.variant})` : ''} → ${eq ? eq.name : 'без оборудования'} · ${STAGE_LABELS[op.stage as keyof typeof STAGE_LABELS] || '?'} · ${UNIT_LABELS[op.unit as keyof typeof UNIT_LABELS] || '?'}`
        : 'операция не найдена'}
    </span>
  );
};

const AdminItem: React.FC<{
  item: ConfigItem;
  level: number;
  blockType: BlockType;
  sources: Sources;
  onPatch: (id: string, patch: Partial<ConfigItem>) => void;
  onAdd: (parentId: string | null, blockId: string) => void;
  onDelete: (itemId: string) => void;
  onToggle: (itemId: string) => void;
  onTogglePause: (itemId: string) => void;
  onToggleHidden: (itemId: string) => void
}> = ({ item, level, blockType, sources, onPatch, onAdd, onDelete, onToggle, onTogglePause, onToggleHidden }) => {
  const hasChildren = item.children.length > 0;
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const isLinked = !!(item.sourceType && item.sourceId);
  const linkValue = isLinked ? `${item.sourceType}:${item.sourceId}` : '';

  return (
    <div className="mb-2">
      <div
        className={`flex items-center gap-2 p-2 border rounded shadow-sm transition-colors ${
          item.isPaused
            ? 'bg-orange-50 border-orange-200'
            : item.isHidden
            ? 'bg-purple-50 border-purple-200'
            : 'bg-white hover:border-blue-300'
        }`}
        style={{ marginLeft: `${level * 20}px` }}
      >
        {hasChildren && (
          <button onClick={() => onToggle(item.id)} className="text-gray-500 hover:text-blue-600">
            {item.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        {!hasChildren && <div className="w-4" />}

        <div className="flex-1 grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5">
            <input
              value={item.name}
              placeholder="Название"
              onChange={(e) => onPatch(item.id, { name: e.target.value })}
              className={`w-full text-sm font-medium border-b outline-none pb-1 bg-transparent ${
                item.isPaused
                  ? 'text-gray-500 border-orange-200'
                  : item.isHidden
                  ? 'text-purple-700 border-purple-300'
                  : 'border-gray-200 focus:border-blue-500 text-gray-700'
              }`}
            />
            <div className="flex flex-wrap gap-1 mt-0.5">
              {item.isPaused && <span className="text-[10px] text-orange-600 font-bold uppercase">Приостановлено</span>}
              {item.isHidden && !item.isPaused && <span className="text-[10px] text-purple-600 font-bold uppercase">Скрыто от клиента</span>}
              {item.sides && <span className="text-[10px] text-indigo-600 font-bold uppercase">{item.sides === 2 ? '2 стороны' : '1 сторона'}</span>}
              {isLinked && (
                <span className={`text-[10px] font-bold uppercase flex items-center gap-0.5 ${item.sourceType === 'material' ? 'text-emerald-600' : 'text-sky-600'}`}>
                  <Link2 size={9} /> {item.sourceType === 'material' ? 'склад' : 'операция'}
                </span>
              )}
            </div>
          </div>

          <div className="col-span-3">
            <input
              type="number"
              value={item.price}
              placeholder="Цена"
              onChange={(e) => onPatch(item.id, { price: parseFloat(e.target.value) })}
              disabled={hasChildren}
              className={`w-full text-sm font-mono text-right border-b outline-none pb-1 bg-transparent ${numberInputClass} ${
                hasChildren
                  ? 'text-gray-300 border-gray-100 cursor-not-allowed'
                  : item.isPaused
                  ? 'text-gray-400 border-orange-200'
                  : item.isHidden
                  ? 'text-purple-700 border-purple-300'
                  : 'border-gray-200 focus:border-blue-500 text-green-700'
              }`}
            />
          </div>

          <div className="col-span-4 flex items-end justify-end gap-1">
            <button
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className={`p-1.5 rounded transition-colors ${
                isDetailsOpen || item.description || isLinked
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'
              }`}
              title="Настройки"
            >
              <Info size={14} />
            </button>
            <button
              onClick={() => onToggleHidden(item.id)}
              className={`p-1.5 rounded transition-colors ${
                item.isHidden ? 'text-purple-600 bg-purple-100 hover:bg-purple-200' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
              }`}
              title={item.isHidden ? 'Показать клиенту' : 'Скрыть от клиента'}
            >
              {item.isHidden ? <MonitorOff size={14} /> : <Monitor size={14} />}
            </button>
            <button
              onClick={() => onTogglePause(item.id)}
              className={`p-1.5 rounded transition-colors ${
                item.isPaused ? 'text-orange-500 bg-orange-100 hover:bg-orange-200' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'
              }`}
              title={item.isPaused ? 'Возобновить' : 'Приостановить'}
            >
              {item.isPaused ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={() => onAdd(item.id, '')} className="p-1.5 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded">
              <Plus size={14} />
            </button>
            <button onClick={() => onDelete(item.id)} className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {isDetailsOpen && (
        <div className="ml-10 p-3 bg-gray-50 border border-gray-200 rounded-b-md -mt-1 mb-2">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Связь для техкарты</label>
              <select
                value={linkValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) onPatch(item.id, { sourceType: undefined, sourceId: undefined });
                  else {
                    const [type, id] = v.split(':');
                    onPatch(item.id, { sourceType: type as ConfigItem['sourceType'], sourceId: id });
                  }
                }}
                className="w-full text-xs border border-gray-300 rounded p-1.5 outline-none focus:border-blue-400 bg-white text-gray-700"
              >
                <option value="">— не участвует в техкарте —</option>
                <optgroup label="Материалы (склад)">
                  {sources.materials.map(m => (
                    <option key={m.id} value={`material:${m.id}`}>{m.name}{m.group ? ` · ${m.group}` : ''}</option>
                  ))}
                </optgroup>
                <optgroup label="Операции">
                  {sources.operations.map(o => (
                    <option key={o.id} value={`operation:${o.id}`}>{o.name}{o.variant ? ` (${o.variant})` : ''}</option>
                  ))}
                </optgroup>
              </select>
              <div className="mt-1.5"><SourceBadge item={item} sources={sources} /></div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Стороны печати (для вложенных опций)</label>
              <select
                value={item.sides ?? ''}
                onChange={(e) => onPatch(item.id, { sides: e.target.value ? (parseInt(e.target.value) as 1 | 2) : undefined })}
                className="w-full text-xs border border-gray-300 rounded p-1.5 outline-none focus:border-blue-400 bg-white text-gray-700"
              >
                <option value="">— не задано —</option>
                <option value="1">Односторонняя (1)</option>
                <option value="2">Двусторонняя (2)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Текстовое описание</label>
              <textarea
                value={item.description || ''}
                onChange={(e) => onPatch(item.id, { description: e.target.value })}
                className="w-full text-xs border border-gray-300 rounded p-1.5 outline-none focus:border-blue-400 min-h-[40px] bg-white text-gray-700"
                placeholder="Введите описание..."
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Фото (URL)</label>
              <input
                value={item.imageUrl || ''}
                onChange={(e) => onPatch(item.id, { imageUrl: e.target.value })}
                className="w-full text-xs border border-gray-300 rounded p-1.5 outline-none focus:border-blue-400 bg-white text-gray-700"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      )}

      {item.isOpen && item.children.length > 0 && (
        <div className="mt-1 relative">
          <div className="absolute left-0 top-0 bottom-0 border-l-2 border-gray-100" style={{ left: `${level * 20 + 10}px` }}></div>
          {item.children.map(child => (
            <AdminItem
              key={child.id}
              item={child}
              level={level + 1}
              blockType={blockType}
              sources={sources}
              onPatch={onPatch}
              onAdd={onAdd}
              onDelete={onDelete}
              onToggle={onToggle}
              onTogglePause={onTogglePause}
              onToggleHidden={onToggleHidden}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ClientOptionGroup: React.FC<{
  items: ConfigItem[];
  parentContextId: string;
  selections: Record<string, string>;
  onSelect: (updates: Record<string, string>) => void;
  checkVisibility: (itemId: string) => boolean;
  pageCount: number;
  isBindingBlock: boolean
}> = ({ items, parentContextId, selections, onSelect, checkVisibility, pageCount, isBindingBlock }) => {
  const selectedId = selections[parentContextId];
  const selectedItem = items.find(i => i.id === selectedId);
  const visibleItems = items.filter(item => checkVisibility(item.id) && !item.isPaused && !item.isHidden);

  if (visibleItems.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {visibleItems.map(item => {
          const isSelected = selectedId === item.id;
          let isValid = true;
          let errorMsg = '';

          if (isBindingBlock) {
            if (item.minPages && pageCount < item.minPages) {
              isValid = false;
              errorMsg = `Мин. ${item.minPages} стр. (сейчас ${pageCount})`;
            }
            if (item.maxPages && pageCount > item.maxPages) {
              isValid = false;
              errorMsg = `Макс. ${item.maxPages} стр. (сейчас ${pageCount})`;
            }
            if (item.pageMultiplicity && pageCount % item.pageMultiplicity !== 0) {
              isValid = false;
              errorMsg = `Кратность ${item.pageMultiplicity} (сейчас ${pageCount})`;
            }
          }

          const validChildren = item.children.filter(c => !c.isPaused);
          const hasSingleChild = validChildren.length === 1;
          const singleChild = hasSingleChild ? validChildren[0] : null;
          const displayName = hasSingleChild ? `${item.name} ${singleChild!.name}` : item.name;
          const displayPrice = hasSingleChild ? item.price + (singleChild?.price || 0) : item.price;
          const tooltipDesc = (hasSingleChild && singleChild!.description) || item.description;
          const tooltipImg = (hasSingleChild && singleChild!.imageUrl) || item.imageUrl;

          const handleClick = () => {
            if (!isValid) return;
            const updates: Record<string, string> = { [parentContextId]: item.id };
            const defaults = getRecursiveDefaults(item);
            onSelect({ ...updates, ...defaults });
          };

          return (
            <Tooltip key={item.id} text={tooltipDesc} imageUrl={tooltipImg} error={errorMsg}>
              <button
                onClick={handleClick}
                disabled={!isValid}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all shadow-sm flex flex-col items-center min-w-[100px] relative ${
                  !isValid
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60 grayscale'
                    : isSelected
                    ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-200'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-1">
                  {displayName}
                  {!isValid && <AlertCircle size={12} className="text-red-400" />}
                </div>
                {displayPrice > 0 && (
                  <span className={`text-xs mt-1 ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>+{displayPrice} ₽</span>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {selectedItem && (selectedItem.children.length > 1 || selectedItem.children.some(c => c.children.length > 0)) && checkVisibility(selectedItem.id) && !selectedItem.isPaused && (
        <div className="mt-4 pl-6 border-l-2 border-blue-100 ml-4">
          <ClientOptionGroup
            items={selectedItem.children}
            parentContextId={selectedItem.id}
            selections={selections}
            onSelect={onSelect}
            checkVisibility={checkVisibility}
            pageCount={pageCount}
            isBindingBlock={false}
          />
        </div>
      )}
    </div>
  );
};

// =============================================================================
// ОСНОВНОЙ КОМПОНЕНТ TEMPLATECONSTRUCTOR
// =============================================================================

interface TemplateConstructorProps {
  materials: DataItem[];
  operations: DataItem[];
  equipment: DataItem[];
  templates: SavedTemplate[];
  loadedTemplateId: string;
  loadRequest: { template: SavedTemplate; nonce: number } | null;
  onSaveTemplate: (name: string, config: TemplateConfig, id?: string) => SavedTemplate;
}

export const TemplateConstructor: React.FC<TemplateConstructorProps> = ({
  materials = [],
  operations = [],
  equipment = [],
  templates,
  loadedTemplateId,
  loadRequest,
  onSaveTemplate
}) => {

  // ===========================================================================
  // СОСТОЯНИЯ
  // ===========================================================================

  const [templateName, setTemplateName] = useState('Брошюра A4');
  const [sizeLabel, setSizeLabel] = useState<string>('Размер изделия');
  const [sizePresets, setSizePresets] = useState<string[]>(initialSizePresets);
  const [newSizePresetVal, setNewSizePresetVal] = useState<string>('');
  const [parts, setParts] = useState<ProductPart[]>(initialParts);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [quantityLabel, setQuantityLabel] = useState<string>('Тираж (шт)');
  const [minQuantity, setMinQuantity] = useState<number>(1);
  const [maxQuantity, setMaxQuantity] = useState<number>(10000);
  const [quantityStep, setQuantityStep] = useState<number>(50);
  const [quantityPresets, setQuantityPresets] = useState<number[]>([50, 100, 200, 500, 1000]);
  const [newPresetVal, setNewPresetVal] = useState<string>('');

  const [selectedSize, setSelectedSize] = useState<string>(initialSizePresets[0] || '');
  const [quantity, setQuantity] = useState<number>(100);
  const [pageCount, setPageCount] = useState<number>(() => {
    const bindingBlock = initialBlocks.find(b => b.type === 'binding');
    return bindingBlock?.defaultPages || 16;
  });
  const [selections, setSelections] = useState<Record<string, string>>(() => buildDefaultSelections(initialBlocks));

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isTechCardOpen, setIsTechCardOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [addContext, setAddContext] = useState<{ parentId: string | null, blockId: string } | null>(null);
  const [addItemTab, setAddItemTab] = useState<'empty' | 'material' | 'operation'>('empty');
  const [selectedSourceItems, setSelectedSourceItems] = useState<string[]>([]);
  const [withSides, setWithSides] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');

  const sources: Sources = useMemo(() => ({ materials, operations, equipment }), [materials, operations, equipment]);

  // Загрузка сохранённого шаблона в конструктор
  useEffect(() => {
    if (!loadRequest) return;
    const { template } = loadRequest;
    const cfg = template.config;
    setTemplateName(template.name);
    setSizeLabel(cfg.sizeLabel);
    setSizePresets(cfg.sizePresets);
    setParts(cfg.parts || []);
    setBlocks(cfg.blocks);
    setQuantityLabel(cfg.quantityLabel);
    setMinQuantity(cfg.minQuantity);
    setMaxQuantity(cfg.maxQuantity);
    setQuantityStep(cfg.quantityStep);
    setQuantityPresets(cfg.quantityPresets);
    setSelectedSize(cfg.sizePresets[0] || '');
    setSelections(buildDefaultSelections(cfg.blocks));
    const binding = cfg.blocks.find(b => b.type === 'binding');
    setPageCount(binding?.defaultPages || 16);
    setQuantity(cfg.quantityPresets[1] || cfg.quantityPresets[0] || cfg.minQuantity);
  }, [loadRequest?.nonce]);

  // ===========================================================================
  // ВЫЧИСЛЯЕМЫЕ ЗНАЧЕНИЯ
  // ===========================================================================

  const allItemsGlobal = useMemo(() => getAllItemsGlobal(blocks), [blocks]);

  const currentConfig: TemplateConfig = useMemo(() => ({
    sizeLabel, sizePresets, parts, blocks, quantityLabel, minQuantity, maxQuantity, quantityStep, quantityPresets
  }), [sizeLabel, sizePresets, parts, blocks, quantityLabel, minQuantity, maxQuantity, quantityStep, quantityPresets]);

  const selectedItems = useMemo(() => collectSelectedItems(blocks, selections), [blocks, selections]);
  const totalCost = selectedItems.reduce((acc, s) => acc + Number(s.item.price || 0), 0) * quantity;

  const techCard = useMemo(() => buildTechCard({
    productName: templateName,
    parts, blocks, selections, selectedSize, quantity, pageCount, materials, operations, equipment
  }), [templateName, parts, blocks, selections, selectedSize, quantity, pageCount, materials, operations, equipment]);

  const hasBindingBlock = blocks.some(b => b.type === 'binding');
  const needsPageCounter = hasBindingBlock || parts.some(p => p.pagesMode === 'client');

  const filteredAddMaterials = materials.filter(m =>
    String(m.name || '').toLowerCase().includes(addItemSearch.toLowerCase()) ||
    String(m.sku || '').toLowerCase().includes(addItemSearch.toLowerCase())
  );

  const filteredAddOperations = operations.filter(o =>
    String(o.name || '').toLowerCase().includes(addItemSearch.toLowerCase()) ||
    (o.variant && String(o.variant).toLowerCase().includes(addItemSearch.toLowerCase()))
  );

  const loadedTemplate = templates.find(t => t.id === loadedTemplateId);

  // ===========================================================================
  // ФУНКЦИИ-ОБРАБОТЧИКИ
  // ===========================================================================

  const handleOpenAddModal = (parentId: string | null, blockId: string) => {
    setAddContext({ parentId, blockId });
    setAddItemTab('empty');
    setSelectedSourceItems([]);
    setWithSides(false);
    setAddItemSearch('');
    setIsAddItemModalOpen(true);
  };

  const operationToItem = (op: DataItem): ConfigItem => {
    const parts = [];
    if (op.variant) parts.push(op.variant);
    if (op.description) parts.push(op.description);
    return {
      id: generateId(),
      name: op.variant || op.name,
      price: Number(op.price) || 0,
      unit: op.unit === 'sheet' ? 'лист' : 'шт',
      children: [],
      isOpen: true,
      isPaused: false,
      description: parts.join('. '),
      sourceType: 'operation',
      sourceId: op.id
    };
  };

  const confirmAddItem = () => {
    if (!addContext) return;
    const { parentId, blockId } = addContext;
    const newItems: ConfigItem[] = [];

    if (addItemTab === 'empty') {
      newItems.push({ id: generateId(), name: 'Новая опция', price: 0, unit: 'шт', children: [], isOpen: true, isPaused: false });
    } else if (addItemTab === 'material') {
      selectedSourceItems.forEach(id => {
        const mat = materials.find(m => m.id === id);
        if (mat) {
          newItems.push({
            id: generateId(),
            name: mat.name,
            price: Number(mat.price) || 0,
            unit: mat.unit || 'лист',
            children: [],
            isOpen: true,
            isPaused: false,
            description: `${mat.group || ''} ${mat.density ? `(${mat.density})` : ''}`.trim(),
            imageUrl: mat.image_url,
            sourceType: 'material',
            sourceId: mat.id
          });
        }
      });
    } else if (addItemTab === 'operation') {
      const ops = selectedSourceItems.map(id => operations.find(o => o.id === id)).filter(Boolean) as DataItem[];
      if (withSides) {
        if (ops.length > 0) {
          newItems.push({ id: generateId(), name: 'Односторонняя', price: 0, unit: 'шт', sides: 1, children: ops.map(operationToItem), isOpen: true, isPaused: false });
          newItems.push({ id: generateId(), name: 'Двусторонняя', price: 0, unit: 'шт', sides: 2, children: ops.map(operationToItem), isOpen: true, isPaused: false });
        }
      } else {
        ops.forEach(op => newItems.push(operationToItem(op)));
      }
    }

    if (newItems.length > 0) {
      if (!parentId) {
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, items: [...b.items, ...newItems] } : b));
      } else {
        const addRecursive = (items: ConfigItem[]): ConfigItem[] =>
          items.map(item =>
            item.id === parentId
              ? { ...item, children: [...item.children, ...newItems], isOpen: true }
              : { ...item, children: addRecursive(item.children) }
          );
        setBlocks(prev => prev.map(b => ({ ...b, items: addRecursive(b.items) })));
      }
    }
    setIsAddItemModalOpen(false);
  };

  // --- части изделия ---
  const addPart = () => {
    setParts(prev => [...prev, { id: `part-${generateId()}`, name: 'Новая часть', pagesMode: 'none' }]);
  };

  const updatePart = (id: string, patch: Partial<ProductPart>) => {
    setParts(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  };

  const deletePart = (id: string) => {
    setParts(prev => prev.filter(p => p.id !== id));
    setBlocks(prev => prev.map(b => (b.partId === id ? { ...b, partId: undefined } : b)));
  };

  const movePart = (id: string, direction: 'up' | 'down') => {
    setParts(prev => {
      const index = prev.findIndex(p => p.id === id);
      const target = direction === 'up' ? index - 1 : index + 1;
      if (index === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // --- блоки ---
  const addBlock = () => {
    setBlocks(prev => [...prev, { id: `block-${generateId()}`, name: 'Новый блок', type: 'standard', items: [], visibilityRules: [] }]);
  };

  const updateBlock = (blockId: string, patch: Partial<Block>) => {
    setBlocks(prev => prev.map(b => (b.id === blockId ? { ...b, ...patch } : b)));
  };

  const toggleBlockType = (blockId: string) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, type: b.type === 'standard' ? 'binding' : 'standard' } : b));
  };

  const updateBlockParam = (blockId: string, field: 'minPages' | 'maxPages' | 'pageMultiplicity' | 'defaultPages', value: number) => {
    updateBlock(blockId, { [field]: value });
    if (field === 'defaultPages') setPageCount(isNaN(value) ? 0 : value);
  };

  const deleteBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex(b => b.id === blockId);
    if (index === -1) return;
    const newBlocks = [...blocks];
    if (direction === 'up' && index > 0) {
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
      setBlocks(newBlocks);
    } else if (direction === 'down' && index < blocks.length - 1) {
      [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
      setBlocks(newBlocks);
    }
  };

  const mapItemsRecursive = (fn: (item: ConfigItem) => ConfigItem) => {
    const walk = (items: ConfigItem[]): ConfigItem[] => items.map(item => fn({ ...item, children: walk(item.children) }));
    setBlocks(prev => prev.map(b => ({ ...b, items: walk(b.items) })));
  };

  const deleteItem = (itemId: string) => {
    const deleteRecursive = (items: ConfigItem[]): ConfigItem[] =>
      items.filter(item => item.id !== itemId).map(item => ({ ...item, children: deleteRecursive(item.children) }));
    setBlocks(prev => prev.map(b => ({ ...b, items: deleteRecursive(b.items) })));
  };

  const patchItem = (id: string, patch: Partial<ConfigItem>) =>
    mapItemsRecursive(item => (item.id === id ? { ...item, ...patch } : item));

  const toggleOpen = (itemId: string) => mapItemsRecursive(item => (item.id === itemId ? { ...item, isOpen: !item.isOpen } : item));
  const togglePause = (itemId: string) => mapItemsRecursive(item => (item.id === itemId ? { ...item, isPaused: !item.isPaused } : item));
  const toggleHidden = (itemId: string) => mapItemsRecursive(item => (item.id === itemId ? { ...item, isHidden: !item.isHidden } : item));

  const toggleLogicPanel = (blockId: string) => updateBlock(blockId, { isLogicOpen: !blocks.find(b => b.id === blockId)?.isLogicOpen });

  const addRule = (blockId: string, targetItemId: string, triggerItemId: string, logicType: 'HIDE' | 'SHOW') => {
    if (!triggerItemId || !targetItemId) return;
    setBlocks(prev => prev.map(b =>
      b.id !== blockId ? b : { ...b, visibilityRules: [...b.visibilityRules, { id: generateId(), targetItemId, triggerItemId, logicType }] }
    ));
  };

  const removeRule = (blockId: string, ruleId: string) => {
    setBlocks(prev => prev.map(b => b.id !== blockId ? b : { ...b, visibilityRules: b.visibilityRules.filter(r => r.id !== ruleId) }));
  };

  const handleSelect = (updates: Record<string, string>) => {
    setSelections(prev => ({ ...prev, ...updates }));
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') { setQuantity(0); return; }
    const n = parseInt(val);
    if (!isNaN(n)) setQuantity(n);
  };

  const handleQuantityBlur = () => {
    let finalVal = quantity;
    if (finalVal < minQuantity) finalVal = minQuantity;
    if (maxQuantity && finalVal > maxQuantity) finalVal = maxQuantity;
    setQuantity(finalVal);
  };

  const handlePageCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') { setPageCount(0); return; }
    const n = parseInt(val);
    if (!isNaN(n)) setPageCount(n);
  };

  const handlePageCountBlur = () => {
    const bindingBlock = blocks.find(b => b.type === 'binding');
    const min = bindingBlock?.minPages || 1;
    const max = bindingBlock?.maxPages || 10000;
    let val = pageCount;
    if (val < min) val = min;
    if (val > max) val = max;
    setPageCount(val);
  };

  const addPreset = () => {
    const val = parseInt(newPresetVal);
    if (val && !quantityPresets.includes(val)) {
      setQuantityPresets([...quantityPresets, val].sort((a, b) => a - b));
      setNewPresetVal('');
    }
  };

  const removePreset = (val: number) => setQuantityPresets(quantityPresets.filter(p => p !== val));

  const addSizePreset = () => {
    const val = newSizePresetVal.trim();
    if (val && !sizePresets.includes(val)) {
      setSizePresets([...sizePresets, val]);
      setNewSizePresetVal('');
    }
  };

  const removeSizePreset = (val: string) => setSizePresets(sizePresets.filter(p => p !== val));

  const openSaveModal = () => {
    setSaveName(templateName || '');
    setIsSaveModalOpen(true);
  };

  const handleSave = (asNew: boolean) => {
    const name = saveName.trim();
    if (!name) return;
    onSaveTemplate(name, currentConfig, asNew ? undefined : loadedTemplateId || undefined);
    setTemplateName(name);
    setIsSaveModalOpen(false);
  };

  const handleExportJson = () => {
    const now = new Date().toISOString();
    downloadJson(`шаблон_${templateName || 'изделие'}`, toPublicTemplate({
      id: loadedTemplateId || 'draft',
      name: templateName || 'Без названия',
      created_at: loadedTemplate?.created_at || now,
      updated_at: now,
      config: currentConfig
    }));
  };

  const toggleSourceSelection = (id: string) => {
    setSelectedSourceItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Группировка блоков по частям для превью
  const previewGroups = useMemo(() => {
    const partIds = new Set(parts.map(p => p.id));
    const groups = parts.map(part => ({ part, blocks: blocks.filter(b => b.partId === part.id) }));
    const rest = blocks.filter(b => !b.partId || !partIds.has(b.partId));
    return [...groups.filter(g => g.blocks.length > 0), ...(rest.length ? [{ part: null as ProductPart | null, blocks: rest }] : [])];
  }, [parts, blocks]);

  const renderPageCounter = (block?: Block) => {
    const step = block?.pageMultiplicity || 1;
    const min = block?.minPages || 1;
    const max = block?.maxPages || 10000;
    return (
      <div className="mb-6 p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg">
        <label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-600" /> Количество страниц
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPageCount(p => Math.max(min, p - step))}
            className="w-10 h-10 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shadow-sm transition-colors"
          >-</button>
          <input
            type="number"
            value={pageCount === 0 ? '' : pageCount}
            onChange={handlePageCountChange}
            onBlur={handlePageCountBlur}
            className={`w-24 text-center border border-indigo-200 rounded-lg py-2 font-bold text-lg text-indigo-900 bg-white shadow-sm focus:border-indigo-400 outline-none ${numberInputClass}`}
          />
          <button
            onClick={() => setPageCount(p => Math.min(max, p + step))}
            className="w-10 h-10 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shadow-sm transition-colors"
          >+</button>
        </div>
      </div>
    );
  };

  const renderPreviewBlock = (block: Block) => {
    if (!isEntityVisible('BLOCK', block.visibilityRules, selections)) return null;
    return (
      <React.Fragment key={block.id}>
        {block.type === 'binding' && renderPageCounter(block)}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-900 mb-3">{block.name}</h4>
          {block.items.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Нет доступных опций</p>
          ) : (
            <ClientOptionGroup
              items={block.items}
              parentContextId={block.id}
              selections={selections}
              onSelect={handleSelect}
              checkVisibility={(itemId) => isEntityVisible(itemId, block.visibilityRules, selections)}
              pageCount={pageCount}
              isBindingBlock={block.type === 'binding'}
            />
          )}
        </div>
      </React.Fragment>
    );
  };

  const clientPageCounterPlaced = hasBindingBlock;

  // ===========================================================================
  // JSX РАЗМЕТКА
  // ===========================================================================

  return (
    <div className="flex w-full h-full">
      {/* Левая панель - Конструктор */}
      <div className="w-7/12 flex flex-col border-r border-gray-300 bg-gray-50 overflow-hidden print:hidden">
        <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Settings size={18} className="text-gray-600 shrink-0" />
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Название шаблона"
              className="font-semibold text-gray-700 bg-transparent border-b border-transparent focus:border-blue-500 outline-none w-full min-w-0"
            />
            {loadedTemplate && <span className="text-[10px] text-gray-400 uppercase font-bold shrink-0">сохранён</span>}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleExportJson}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition flex items-center gap-2"
              title="Публичный JSON для сайта"
            >
              <Download size={14} /> JSON
            </button>
            <button
              onClick={openSaveModal}
              className="px-4 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
            >
              <Save size={14} /> Сохранить как шаблон
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Секция размеров */}
          <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100 shadow-sm relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-1">
                <Ruler size={16} className="text-blue-800" />
                <input
                  value={sizeLabel}
                  onChange={(e) => setSizeLabel(e.target.value)}
                  className="text-sm font-bold uppercase tracking-wide text-blue-800 bg-transparent border-b border-transparent focus:border-blue-500 outline-none w-full transition-all"
                  placeholder="Заголовок для клиента"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-blue-600 font-bold mb-2 block">КНОПКИ РАЗМЕРОВ ДЛЯ КЛИЕНТА</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {sizePresets.map(preset => (
                  <div key={preset} className="flex items-center bg-white border border-blue-200 rounded-md px-2 py-1 text-xs text-blue-800">
                    {preset}
                    <button onClick={() => removeSizePreset(preset)} className="ml-1 text-blue-400 hover:text-red-500"><X size={10} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSizePresetVal}
                  onChange={(e) => setNewSizePresetVal(e.target.value)}
                  placeholder="Например: 100 x 150"
                  className="flex-1 border border-blue-200 rounded px-2 py-1 text-xs bg-white focus:border-blue-400 outline-none text-gray-700"
                  onKeyDown={(e) => e.key === 'Enter' && addSizePreset()}
                />
                <button onClick={addSizePreset} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">Добавить</button>
              </div>
            </div>
          </div>

          {/* Секция количества (тиража) */}
          <div className="mb-8 p-4 bg-green-50 rounded-lg border border-green-100 shadow-sm relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-1">
                <Calculator size={16} className="text-green-800" />
                <input
                  value={quantityLabel}
                  onChange={(e) => setQuantityLabel(e.target.value)}
                  className="text-sm font-bold uppercase tracking-wide text-green-800 bg-transparent border-b border-transparent focus:border-green-500 outline-none w-full transition-all"
                  placeholder="Заголовок тиража"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {([['МИН. ТИРАЖ', minQuantity, (v: number) => setMinQuantity(v || 1)], ['МАКС. ТИРАЖ', maxQuantity, (v: number) => setMaxQuantity(v || 10000)], ['ШАГ (+/-)', quantityStep, (v: number) => setQuantityStep(v || 1)]] as const).map(([label, value, set]) => (
                <div key={label}>
                  <label className="text-[10px] text-green-600 font-bold mb-1 block">{label}</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => set(parseInt(e.target.value))}
                    className={`w-full border border-green-200 rounded px-2 py-1 text-sm bg-white text-gray-700 ${numberInputClass}`}
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="text-[10px] text-green-600 font-bold mb-1 block">КНОПКИ БЫСТРОГО ВВОДА</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {quantityPresets.map(preset => (
                  <div key={preset} className="flex items-center bg-white border border-green-200 rounded-md px-2 py-1 text-xs text-green-800">
                    {preset}
                    <button onClick={() => removePreset(preset)} className="ml-1 text-green-400 hover:text-red-500"><X size={10} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newPresetVal}
                  onChange={(e) => setNewPresetVal(e.target.value)}
                  placeholder="Новое число..."
                  className="flex-1 border border-green-200 rounded px-2 py-1 text-xs bg-white focus:border-green-400 outline-none text-gray-700"
                  onKeyDown={(e) => e.key === 'Enter' && addPreset()}
                />
                <button onClick={addPreset} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">Добавить</button>
              </div>
            </div>
          </div>

          {/* Секция частей изделия */}
          <div className="mb-8 p-4 bg-amber-50 rounded-lg border border-amber-100 shadow-sm relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-800">
                <Puzzle size={16} /> Части изделия
              </div>
              <button onClick={addPart} className="text-xs flex items-center gap-1 text-amber-700 hover:underline">
                <Plus size={12} /> Часть
              </button>
            </div>
            {parts.length === 0 ? (
              <p className="text-xs text-amber-700/70">
                Частей нет — всё изделие считается одной частью (листовка, визитка). Для брошюры добавьте «Обложка» и «Блок» и привяжите к ним блоки опций.
              </p>
            ) : (
              <div className="space-y-2">
                {parts.map((part, index) => (
                  <div key={part.id} className="bg-white border border-amber-200 rounded-md p-2 grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <label className="text-[9px] text-amber-600 block mb-0.5">Название</label>
                      <input
                        value={part.name}
                        onChange={(e) => updatePart(part.id, { name: e.target.value })}
                        className="w-full text-xs font-semibold border border-amber-200 rounded p-1.5 bg-white text-gray-700 outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[9px] text-amber-600 block mb-0.5">Страницы</label>
                      <div className="flex gap-1">
                        <select
                          value={part.pagesMode}
                          onChange={(e) => updatePart(part.id, { pagesMode: e.target.value as ProductPart['pagesMode'] })}
                          className="flex-1 text-xs border border-amber-200 rounded p-1.5 bg-white text-gray-700 outline-none min-w-0"
                        >
                          <option value="none">1 лицо</option>
                          <option value="fixed">Фикс.</option>
                          <option value="client">От клиента</option>
                        </select>
                        {part.pagesMode === 'fixed' && (
                          <input
                            type="number"
                            value={part.pages ?? ''}
                            onChange={(e) => updatePart(part.id, { pages: parseInt(e.target.value) || undefined })}
                            className={`w-12 text-xs border border-amber-200 rounded p-1.5 text-center bg-white text-gray-700 ${numberInputClass}`}
                            placeholder="4"
                          />
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] text-amber-600 block mb-0.5">Свой размер</label>
                      <input
                        value={part.customSize || ''}
                        onChange={(e) => updatePart(part.id, { customSize: e.target.value || undefined })}
                        placeholder="как изделие"
                        className="w-full text-xs border border-amber-200 rounded p-1.5 bg-white text-gray-700 outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] text-amber-600 block mb-0.5">На листе</label>
                      <input
                        type="number"
                        value={part.itemsPerSheetOverride ?? ''}
                        onChange={(e) => updatePart(part.id, { itemsPerSheetOverride: parseInt(e.target.value) || undefined })}
                        placeholder="авто"
                        className={`w-full text-xs border border-amber-200 rounded p-1.5 text-center bg-white text-gray-700 ${numberInputClass}`}
                      />
                    </div>
                    <div className="col-span-2 flex justify-end gap-0.5">
                      <button onClick={() => movePart(part.id, 'up')} disabled={index === 0} className={`p-1 rounded ${index === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-amber-700 hover:bg-amber-100'}`}><ArrowUp size={14} /></button>
                      <button onClick={() => movePart(part.id, 'down')} disabled={index === parts.length - 1} className={`p-1 rounded ${index === parts.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-amber-700 hover:bg-amber-100'}`}><ArrowDown size={14} /></button>
                      <button onClick={() => deletePart(part.id)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Блоки */}
          {blocks.map((block, index) => (
            <div key={block.id} className="mb-8 p-4 bg-white rounded-lg border border-gray-200 shadow-sm relative group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 mr-4 flex items-center gap-2">
                  <input
                    value={block.name}
                    onChange={(e) => updateBlock(block.id, { name: e.target.value })}
                    className="text-sm font-bold uppercase tracking-wide text-gray-600 border-b border-transparent focus:border-blue-500 outline-none bg-transparent hover:border-gray-200 w-full"
                  />
                  <select
                    value={block.partId && parts.some(p => p.id === block.partId) ? block.partId : ''}
                    onChange={(e) => updateBlock(block.id, { partId: e.target.value || undefined })}
                    className={`text-[10px] font-bold rounded px-1.5 py-1 border shrink-0 outline-none cursor-pointer ${
                      block.partId ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}
                    title="К какой части изделия относится блок"
                  >
                    <option value="">ВСЁ ИЗДЕЛИЕ</option>
                    {parts.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                  </select>
                  <div
                    onClick={() => toggleBlockType(block.id)}
                    className={`cursor-pointer px-2 py-1 rounded text-[10px] font-bold border transition-all flex items-center gap-1 shrink-0 ${
                      block.type === 'binding'
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                    }`}
                    title="Нажмите для смены типа блока"
                  >
                    {block.type === 'binding' ? <BookOpen size={12} /> : <Layers size={12} />}
                    {block.type === 'binding' ? 'ПЕРЕПЛЕТ' : 'ОБЫЧНЫЙ'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveBlock(block.id, 'up')} disabled={index === 0} className={`p-1 hover:bg-gray-100 rounded transition-colors ${index === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600'}`}><ArrowUp size={16} /></button>
                  <button onClick={() => moveBlock(block.id, 'down')} disabled={index === blocks.length - 1} className={`p-1 hover:bg-gray-100 rounded transition-colors ${index === blocks.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600'}`}><ArrowDown size={16} /></button>
                  <div className="w-px h-4 bg-gray-200 mx-2"></div>
                  <button
                    onClick={() => toggleLogicPanel(block.id)}
                    className={`p-1 rounded transition-colors mr-1 ${block.isLogicOpen ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'}`}
                  >
                    <GitBranch size={16} />
                  </button>
                  <button onClick={() => handleOpenAddModal(null, block.id)} className="text-xs flex items-center gap-1 text-blue-600 hover:underline mr-2">
                    <Plus size={12} /> Опция
                  </button>
                  <button onClick={() => deleteBlock(block.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
                </div>
              </div>

              {block.type === 'binding' && (
                <div className="mb-4 p-3 bg-indigo-50 rounded border border-indigo-200">
                  <div className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1"><BookOpen size={12} /> ПАРАМЕТРЫ ПЕРЕПЛЕТА</div>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      ['Мин. кол-во страниц в блоке', 'minPages', ''],
                      ['Макс. кол-во страниц в блоке', 'maxPages', ''],
                      ['Кратность страниц в блоке', 'pageMultiplicity', 'Например: 4 для скобы'],
                      ['Значение по умолчанию', 'defaultPages', 'Количество страниц при загрузке калькулятора']
                    ] as const).map(([label, field, title]) => (
                      <div key={field}>
                        <label className="text-[9px] text-indigo-600 block mb-1">{label}</label>
                        <input
                          type="number"
                          value={block[field] || ''}
                          onChange={(e) => updateBlockParam(block.id, field, parseFloat(e.target.value))}
                          className={`w-full text-xs border border-indigo-200 rounded p-1.5 text-center outline-none focus:border-indigo-400 bg-white text-gray-700 ${numberInputClass}`}
                          placeholder="-"
                          title={title}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {block.isLogicOpen && (
                <div className="mb-4 p-3 bg-purple-50 rounded border border-purple-100 text-sm">
                  <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2"><GitBranch size={14} /> Условия видимости</h4>
                  {block.visibilityRules.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                      {block.visibilityRules.map((rule) => {
                        const triggerItem = allItemsGlobal.find(i => i.id === rule.triggerItemId);
                        const targetItemName = rule.targetItemId === 'BLOCK'
                          ? 'Весь этот блок'
                          : getItemsFlat(block.items).find(i => i.id === rule.targetItemId)?.name || 'Неизвестно';
                        const isShowRule = rule.logicType === 'SHOW';
                        return (
                          <div key={rule.id} className={`border px-3 py-2 rounded flex items-center justify-between shadow-sm text-xs ${isShowRule ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                            <div className="flex items-center gap-2">
                              {isShowRule ? <Eye size={12} /> : <EyeOff size={12} />}
                              <span className="font-bold uppercase">{isShowRule ? 'Показать' : 'Скрыть'}:</span>
                              <span className="font-medium underline">{targetItemName}</span>
                              <span className="opacity-50">&larr;</span>
                              <span className="opacity-70">если выбрано:</span>
                              <span>{triggerItem?.name || 'Unknown'}<i className="opacity-60"> ({triggerItem?.blockName})</i></span>
                            </div>
                            <button onClick={() => removeRule(block.id, rule.id)} className="opacity-50 hover:opacity-100 hover:text-red-600"><X size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 bg-white/50 p-3 rounded border border-purple-100">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-purple-400 font-bold mb-1 block">ЧТО МЕНЯЕМ</label>
                        <select id={`target-select-${block.id}`} className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-purple-400 bg-white text-gray-700">
                          <option value="BLOCK">Весь блок целиком</option>
                          {getItemsFlat(block.items).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-purple-400 font-bold mb-1 block">ДЕЙСТВИЕ</label>
                        <select id={`type-select-${block.id}`} className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-purple-400 bg-white text-gray-700">
                          <option value="HIDE">Скрыть (по умолчанию видно)</option>
                          <option value="SHOW">Показать (по умолчанию скрыто)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-[10px] text-purple-400 font-bold mb-1 block">ЕСЛИ ВЫБРАНО</label>
                        <select id={`trigger-select-${block.id}`} className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-purple-400 bg-white text-gray-700">
                          <option value="">Выберите условие...</option>
                          {allItemsGlobal.filter(i => i.blockName !== block.name).map(item => (
                            <option key={item.id} value={item.id}>{item.blockName}: {item.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          const targetSelect = document.getElementById(`target-select-${block.id}`) as HTMLSelectElement;
                          const triggerSelect = document.getElementById(`trigger-select-${block.id}`) as HTMLSelectElement;
                          const typeSelect = document.getElementById(`type-select-${block.id}`) as HTMLSelectElement;
                          addRule(block.id, targetSelect.value, triggerSelect.value, typeSelect.value as 'HIDE' | 'SHOW');
                          triggerSelect.value = '';
                        }}
                        className="bg-purple-600 text-white px-4 py-1.5 h-[26px] flex items-center rounded text-xs hover:bg-purple-700 transition font-medium"
                      >
                        <Plus size={14} className="mr-1" /> Добавить
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {block.items.length === 0 ? (
                <div className="text-center p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 text-sm">Список пуст.</div>
              ) : (
                block.items.map(item => (
                  <AdminItem
                    key={item.id}
                    item={item}
                    level={0}
                    blockType={block.type}
                    sources={sources}
                    onPatch={patchItem}
                    onAdd={handleOpenAddModal}
                    onDelete={deleteItem}
                    onToggle={toggleOpen}
                    onTogglePause={togglePause}
                    onToggleHidden={toggleHidden}
                  />
                ))
              )}
            </div>
          ))}

          <div
            onClick={addBlock}
            className="mt-8 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition text-gray-400 hover:text-blue-500"
          >
            <span className="font-medium flex items-center justify-center gap-2"><Plus size={20} /> Добавить новый блок</span>
          </div>
        </div>
      </div>

      {/* Правая панель - Предпросмотр */}
      <div className="w-5/12 bg-white flex flex-col shadow-xl z-10 print:hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2"><Package size={18} /> Предпросмотр (Клиент)</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white/90">
              <div className="text-center">
                <Package size={48} className="mx-auto mb-2 opacity-80" />
                <span className="font-medium text-lg">{templateName || 'Полиграфия'}</span>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">{sizeLabel}</label>
                <div className="flex flex-wrap gap-2">
                  {sizePresets.map(preset => (
                    <button
                      key={preset}
                      onClick={() => setSelectedSize(preset)}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedSize === preset ? 'bg-blue-100 text-blue-800 border-blue-200 ring-2 ring-blue-100' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 my-4"></div>

              {needsPageCounter && !clientPageCounterPlaced && renderPageCounter()}

              {previewGroups.map(group => (
                <div key={group.part?.id || '__product__'} className="mb-4">
                  {group.part && (
                    <div className="flex items-center gap-2 mb-3 pb-1 border-b border-amber-200">
                      <Puzzle size={14} className="text-amber-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-800">{group.part.name}</span>
                      <span className="text-[10px] text-amber-600/70">
                        {group.part.pagesMode === 'fixed' ? `${group.part.pages || 1} стр.` : group.part.pagesMode === 'client' ? 'страницы от клиента' : ''}
                      </span>
                    </div>
                  )}
                  {group.blocks.map(renderPreviewBlock)}
                </div>
              ))}

              <div className="border-t border-gray-100 my-4"></div>

              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">{quantityLabel}</label>
                {quantityPresets.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {quantityPresets.map(preset => (
                      <button
                        key={preset}
                        onClick={() => setQuantity(preset)}
                        className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                          quantity === preset ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {preset} шт.
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => setQuantity(q => Math.max(minQuantity, q - quantityStep))} className="w-8 h-8 rounded bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors font-medium text-blue-600 border border-blue-200">-</button>
                  <input
                    type="number"
                    value={quantity === 0 ? '' : quantity}
                    onChange={handleQuantityChange}
                    onBlur={handleQuantityBlur}
                    className={`w-24 text-center border rounded py-1 font-semibold text-gray-800 bg-white ${numberInputClass}`}
                  />
                  <button onClick={() => setQuantity(q => Math.min(maxQuantity, q + quantityStep))} className="w-8 h-8 rounded bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors font-medium text-blue-600 border border-blue-200">+</button>
                  <div className="text-xs text-gray-400 ml-auto">Мин: {minQuantity} / Макс: {maxQuantity}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Футер с итоговой стоимостью */}
        <div className="p-5 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-gray-500 text-sm">Итоговая стоимость</span>
              <div className="text-xs text-gray-400 mt-1">{quantity} шт. × {(totalCost / quantity || 0).toFixed(2)} ₽/шт.</div>
              <div className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-2">
                <span>Себестоимость: <b className="text-slate-700">{formatMoney(techCard.totals.totalCost)} ₽</b></span>
                {totalCost > 0 && (
                  <span className={`px-1.5 py-0.5 rounded font-bold ${totalCost >= techCard.totals.totalCost ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    маржа {(((totalCost - techCard.totals.totalCost) / totalCost) * 100).toFixed(0)}%
                  </span>
                )}
                {techCard.warnings.length + techCard.parts.reduce((a, p) => a + p.warnings.length, 0) + techCard.rows.reduce((a, r) => a + r.warnings.length, 0) > 0 && (
                  <span className="text-amber-600 flex items-center gap-0.5"><AlertCircle size={11} /> есть замечания</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-slate-800 flex items-baseline gap-1 justify-end">
                {totalCost.toLocaleString('ru-RU')}
                <span className="text-lg font-normal text-gray-500">₽</span>
              </div>
              <button
                onClick={() => setIsTechCardOpen(true)}
                className="mt-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded hover:bg-slate-700 transition flex items-center gap-1.5 ml-auto"
              >
                <ClipboardList size={14} /> Техкарта
              </button>
            </div>
          </div>
        </div>
      </div>

      {isTechCardOpen && (
        <TechCardModal techCard={techCard} clientPrice={totalCost} onClose={() => setIsTechCardOpen(false)} />
      )}

      {/* Модальное окно сохранения шаблона */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-[460px] flex flex-col">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Save size={18} className="text-blue-600" /> Сохранить шаблон</h3>
              <button onClick={() => setIsSaveModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Название</label>
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSave(!loadedTemplate)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white text-gray-700"
                placeholder="Например: Брошюра A4 на скобе"
              />
              <p className="text-xs text-gray-400 mt-2">
                Шаблон сохраняется в браузере. Публичный JSON для сайта можно скачать на вкладке «Шаблоны».
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
              <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm">Отмена</button>
              {loadedTemplate && (
                <button onClick={() => handleSave(false)} disabled={!saveName.trim()} className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 text-sm font-medium disabled:opacity-50">
                  Обновить «{loadedTemplate.name}»
                </button>
              )}
              <button onClick={() => handleSave(true)} disabled={!saveName.trim()} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                {loadedTemplate ? 'Сохранить как новый' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно добавления опции */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-[600px] flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Plus size={20} className="text-blue-600" /> Добавить опцию</h3>
              <button onClick={() => setIsAddItemModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="flex border-b border-gray-200 bg-gray-50">
              {([['empty', 'Пустая'], ['material', 'Из Склада'], ['operation', 'Из Операций']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setAddItemTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${addItemTab === tab ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {addItemTab === 'empty' && (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><ChevronRightSquare size={32} /></div>
                  <p>Будет добавлен один пустой элемент.</p>
                  <p className="text-xs text-gray-400 mt-1">Связать его со складом или операцией можно позже через настройки опции.</p>
                </div>
              )}

              {addItemTab === 'material' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input value={addItemSearch} onChange={(e) => setAddItemSearch(e.target.value)} placeholder="Поиск..." className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 outline-none bg-white text-gray-700" autoFocus />
                  </div>
                  <div className="border rounded-lg max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                    {filteredAddMaterials.map(m => (
                      <div key={m.id} onClick={() => toggleSourceSelection(m.id)} className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-blue-50 transition-colors ${selectedSourceItems.includes(m.id) ? 'bg-blue-50' : ''}`}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedSourceItems.includes(m.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
                          {selectedSourceItems.includes(m.id) && <Check size={12} />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-800">{m.name}</div>
                          <div className="text-xs text-gray-500">{m.group} • {m.price} ₽{m.width_mm && m.height_mm ? ` • ${m.width_mm}×${m.height_mm} мм` : ''}</div>
                        </div>
                      </div>
                    ))}
                    {filteredAddMaterials.length === 0 && <div className="p-4 text-center text-xs text-gray-400">Ничего не найдено</div>}
                  </div>
                </div>
              )}

              {addItemTab === 'operation' && (
                <div className="space-y-4">
                  <div className="flex gap-4 items-center">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                      <input value={addItemSearch} onChange={(e) => setAddItemSearch(e.target.value)} placeholder="Поиск..." className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 outline-none bg-white text-gray-700" autoFocus />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input type="checkbox" checked={withSides} onChange={(e) => setWithSides(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                      Разбить на 1/2 стороны
                    </label>
                  </div>
                  <div className="border rounded-lg max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                    {filteredAddOperations.map(op => {
                      const eq = equipment.find(e => e.id === op.equipment_id);
                      return (
                        <div key={op.id} onClick={() => toggleSourceSelection(op.id)} className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-blue-50 transition-colors ${selectedSourceItems.includes(op.id) ? 'bg-blue-50' : ''}`}>
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedSourceItems.includes(op.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
                            {selectedSourceItems.includes(op.id) && <Check size={12} />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm text-gray-800">
                              {op.name} {op.variant && <span className="text-gray-500 font-normal">({op.variant})</span>}
                            </div>
                            <div className="text-xs text-gray-500">
                              {STAGE_LABELS[op.stage as keyof typeof STAGE_LABELS] || '—'} • {eq ? eq.name : 'без оборудования'} • {op.price || 0} ₽
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {filteredAddOperations.length === 0 && <div className="p-4 text-center text-xs text-gray-400">Ничего не найдено</div>}
                  </div>
                  {withSides && (
                    <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
                      <Info size={12} className="inline mr-1 -mt-0.5" />
                      Будут созданы две родительские категории: «Односторонняя» и «Двусторонняя» — техкарта учтёт число сторон.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
              <button onClick={() => setIsAddItemModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition text-sm">Отмена</button>
              <button
                onClick={confirmAddItem}
                disabled={addItemTab !== 'empty' && selectedSourceItems.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addItemTab === 'empty' ? 'Добавить' : `Добавить выбранные (${selectedSourceItems.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateConstructor;
