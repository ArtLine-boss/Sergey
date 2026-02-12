import React, { useState, useMemo, useEffect } from 'react';
import {
  Settings, Plus, Trash2, ChevronRight, ChevronDown, Package, Ruler,
  ArrowUp, ArrowDown, GitBranch, X, Eye, EyeOff, Info, BookOpen,
  Layers, AlertCircle, Calculator, Save, Loader2, Search, Check,
  Monitor, MonitorOff, ChevronRightSquare
} from 'lucide-react';

import {
  VisibilityRule,
  BlockType,
  ConfigItem,
  Block,
  Material,
  Operation
} from '../types';

// =============================================================================
// 3. НАЧАЛЬНЫЕ ДАННЫЕ
// =============================================================================

const initialSizePresets: string[] = [
  '210 x 297 (A4)',
  '148 x 210 (A5)',
  '297 x 420 (A3)',
  '100 x 100',
  '90 x 50'
];

const initialBlocks: Block[] = [
  {
    id: 'paper',
    name: 'Бумага (Материал)',
    type: 'standard',
    visibilityRules: [],
    items: [
      {
        id: 'p1',
        name: 'Меловка 150',
        price: 10,
        unit: 'лист',
        children: [],
        isOpen: true,
        isPaused: false,
        isHidden: false,
        description: 'Стандартная мелованная бумага средней плотности.'
      },
      {
        id: 'p2',
        name: 'Меловка 300',
        price: 25,
        unit: 'лист',
        children: [],
        isOpen: true
      }
    ]
  },
  {
    id: 'binding',
    name: 'Вид переплета',
    type: 'binding',
    visibilityRules: [],
    minPages: 8,
    maxPages: 400,
    pageMultiplicity: 4,
    defaultPages: 24,
    items: [
      {
        id: 'b1',
        name: 'На скобу',
        price: 20,
        unit: 'шт',
        children: [],
        isOpen: true,
        description: 'Брошюровка металлической скобой.',
        minPages: 8,
        maxPages: 48,
        pageMultiplicity: 4
      },
      {
        id: 'b2',
        name: 'КБС (Клей)',
        price: 50,
        unit: 'шт',
        children: [],
        isOpen: true,
        description: 'Термоклеевое скрепление.',
        minPages: 40,
        maxPages: 400,
        pageMultiplicity: 2
      }
    ]
  }
];

// =============================================================================
// 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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

// =============================================================================
// 5. ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
// =============================================================================

/**
 * Компонент Tooltip - показывает подсказку при наведении
 */
interface TooltipProps {
  text?: string;
  error?: string;
  imageUrl?: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({
  text,
  error,
  imageUrl,
  children
}) => {
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

/**
 * Компонент AdminItem - элемент конфигурации в админ-панели
 */
const AdminItem: React.FC<{
  item: ConfigItem;
  level: number;
  blockType: BlockType;
  onUpdate: (id: string, field: keyof ConfigItem, value: any) => void;
  onAdd: (parentId: string | null, blockId: string) => void;
  onDelete: (itemId: string) => void;
  onToggle: (itemId: string) => void;
  onTogglePause: (itemId: string) => void;
  onToggleHidden: (itemId: string) => void
}> = ({
  item,
  level,
  blockType,
  onUpdate,
  onAdd,
  onDelete,
  onToggle,
  onTogglePause,
  onToggleHidden
}) => {
  const hasChildren = item.children.length > 0;
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
          <button
            onClick={() => onToggle(item.id)}
            className="text-gray-500 hover:text-blue-600"
          >
            {item.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        {!hasChildren && <div className="w-4" />}

        <div className="flex-1 grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5">
            <input
              value={item.name}
              placeholder="Название"
              onChange={(e) => onUpdate(item.id, 'name', e.target.value)}
              className={`w-full text-sm font-medium border-b outline-none pb-1 bg-transparent ${
                item.isPaused
                  ? 'text-gray-500 border-orange-200'
                  : item.isHidden
                  ? 'text-purple-700 border-purple-300'
                  : 'border-gray-200 focus:border-blue-500 text-gray-700'
              }`}
            />
            {item.isPaused && (
              <span className="text-[10px] text-orange-600 font-bold uppercase ml-1">
                Приостановлено
              </span>
            )}
            {item.isHidden && !item.isPaused && (
              <span className="text-[10px] text-purple-600 font-bold uppercase ml-1">
                Скрыто от клиента
              </span>
            )}
          </div>

          <div className="col-span-3">
            <input
              type="number"
              value={item.price}
              placeholder="Цена"
              onChange={(e) => onUpdate(item.id, 'price', parseFloat(e.target.value))}
              disabled={hasChildren}
              className={`w-full text-sm font-mono text-right border-b outline-none pb-1 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
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
                isDetailsOpen || item.description
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
                item.isHidden
                  ? 'text-purple-600 bg-purple-100 hover:bg-purple-200'
                  : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
              }`}
              title={item.isHidden ? "Показать клиенту" : "Скрыть от клиента"}
            >
              {item.isHidden ? <MonitorOff size={14} /> : <Monitor size={14} />}
            </button>

            <button
              onClick={() => onTogglePause(item.id)}
              className={`p-1.5 rounded transition-colors ${
                item.isPaused
                  ? 'text-orange-500 bg-orange-100 hover:bg-orange-200'
                  : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'
              }`}
              title={item.isPaused ? "Возобновить" : "Приостановить"}
            >
              {item.isPaused ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>

            <button
              onClick={() => onAdd(item.id, '')}
              className="p-1.5 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded"
            >
              <Plus size={14} />
            </button>

            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {isDetailsOpen && (
        <div className="ml-10 p-3 bg-gray-50 border border-gray-200 rounded-b-md -mt-1 mb-2">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">
                Текстовое описание
              </label>
              <textarea
                value={item.description || ''}
                onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-1.5 outline-none focus:border-blue-400 min-h-[40px] bg-white text-gray-700"
                placeholder="Введите описание..."
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">
                Фото (URL)
              </label>
              <input
                value={item.imageUrl || ''}
                onChange={(e) => onUpdate(item.id, 'imageUrl', e.target.value)}
                className="w-full text-xs border border-gray-300 rounded p-1.5 outline-none focus:border-blue-400 bg-white text-gray-700"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      )}

      {item.isOpen && item.children.length > 0 && (
        <div className="mt-1 relative">
          <div
            className="absolute left-0 top-0 bottom-0 border-l-2 border-gray-100"
            style={{ left: `${level * 20 + 10}px` }}
          ></div>
          {item.children.map(child => (
            <AdminItem
              key={child.id}
              item={child}
              level={level + 1}
              blockType={blockType}
              onUpdate={onUpdate}
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

/**
 * Компонент ClientOptionGroup - группа опций для выбора клиентом
 */
const ClientOptionGroup: React.FC<{
  items: ConfigItem[];
  parentContextId: string;
  selections: Record<string, string>;
  onSelect: (updates: Record<string, string>) => void;
  checkVisibility: (itemId: string) => boolean;
  pageCount: number;
  isBindingBlock: boolean
}> = ({
  items,
  parentContextId,
  selections,
  onSelect,
  checkVisibility,
  pageCount,
  isBindingBlock
}) => {
  const selectedId = selections[parentContextId];
  const selectedItem = items.find(i => i.id === selectedId);
  const visibleItems = items.filter(item =>
    checkVisibility(item.id) && !item.isPaused && !item.isHidden
  );

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
            <Tooltip
              key={item.id}
              text={tooltipDesc}
              imageUrl={tooltipImg}
              error={errorMsg}
            >
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
                  <span className={`text-xs mt-1 ${
                    isSelected ? 'text-blue-200' : 'text-gray-400'
                  }`}>
                    +{displayPrice} ₽
                  </span>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {selectedItem && selectedItem.children.length > 0 &&
        checkVisibility(selectedItem.id) && !selectedItem.isPaused && (
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
// 6. ОСНОВНОЙ КОМПОНЕНТ TEMPLATECONSTRUCTOR
// =============================================================================

interface TemplateConstructorProps {
  materials: Material[];
  operations: Operation[];
  supabase: any;
  loadedTemplateId?: string;
  setLoadedTemplateId: (id: string) => void;
  originalConfig?: any;
  setOriginalConfig: (config: any) => void;
  loadData: () => void;
}

export const TemplateConstructor: React.FC<TemplateConstructorProps> = ({
  materials = [],
  operations = [],
  supabase,
  loadedTemplateId,
  setLoadedTemplateId,
  originalConfig,
  setOriginalConfig,
  loadData
}) => {

  // ===========================================================================
  // 7. СОСТОЯНИЯ
  // ===========================================================================

  const [sizeLabel, setSizeLabel] = useState<string>('Размер изделия');
  const [sizePresets, setSizePresets] = useState<string[]>(initialSizePresets);
  const [newSizePresetVal, setNewSizePresetVal] = useState<string>('');
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
  const [selections, setSelections] = useState<Record<string, string>>({});

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [addContext, setAddContext] = useState<{ parentId: string | null, blockId: string } | null>(null);
  const [addItemTab, setAddItemTab] = useState<'empty' | 'material' | 'operation'>('empty');
  const [selectedSourceItems, setSelectedSourceItems] = useState<string[]>([]);
  const [withSides, setWithSides] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ===========================================================================
  // ВЫЧИСЛЯЕМЫЕ ЗНАЧЕНИЯ
  // ===========================================================================

  const allItemsGlobal = useMemo(() => getAllItemsGlobal(blocks), [blocks]);

  const filteredAddMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(addItemSearch.toLowerCase()) ||
    m.sku.toLowerCase().includes(addItemSearch.toLowerCase())
  );

  const filteredAddOperations = operations.filter(o =>
    o.name.toLowerCase().includes(addItemSearch.toLowerCase()) ||
    (o.variant && o.variant.toLowerCase().includes(addItemSearch.toLowerCase()))
  );

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

  const confirmAddItem = () => {
    if (!addContext) return;
    const { parentId, blockId } = addContext;
    const newItems: ConfigItem[] = [];

    if (addItemTab === 'empty') {
      newItems.push({
        id: generateId(),
        name: 'Новая опция',
        price: 0,
        unit: 'шт',
        children: [],
        isOpen: true,
        isPaused: false
      });
    } else if (addItemTab === 'material') {
      selectedSourceItems.forEach(id => {
        const mat = materials.find(m => m.id === id);
        if (mat) {
          newItems.push({
            id: generateId(),
            name: mat.name,
            price: mat.price,
            unit: mat.unit,
            children: [],
            isOpen: true,
            isPaused: false,
            description: `${mat.group} ${mat.density ? `(${mat.density})` : ''}`,
            imageUrl: mat.image_url
          });
        }
      });
    } else if (addItemTab === 'operation') {
      if (withSides) {
        const oneSidedParent: ConfigItem = {
          id: generateId(),
          name: 'Односторонняя',
          price: 0,
          unit: 'шт',
          children: [],
          isOpen: true,
          isPaused: false
        };
        const twoSidedParent: ConfigItem = {
          id: generateId(),
          name: 'Двусторонняя',
          price: 0,
          unit: 'шт',
          children: [],
          isOpen: true,
          isPaused: false
        };

        selectedSourceItems.forEach(id => {
          const op = operations.find(o => o.id === id);
          if (op) {
            const opName = op.variant || op.name;
            const parts = [];
            if (op.variant) parts.push(op.variant);
            if (op.description) parts.push(op.description);
            const opDesc = parts.join('. ');

            oneSidedParent.children.push({
              id: generateId(),
              name: opName,
              price: 0,
              unit: 'шт',
              children: [],
              isOpen: true,
              isPaused: false,
              description: opDesc
            });
            twoSidedParent.children.push({
              id: generateId(),
              name: opName,
              price: 0,
              unit: 'шт',
              children: [],
              isOpen: true,
              isPaused: false,
              description: opDesc
            });
          }
        });

        if (selectedSourceItems.length > 0) {
          newItems.push(oneSidedParent);
          newItems.push(twoSidedParent);
        }
      } else {
        selectedSourceItems.forEach(id => {
          const op = operations.find(o => o.id === id);
          if (op) {
            const opName = op.variant || op.name;
            const parts = [];
            if (op.variant) parts.push(op.variant);
            if (op.description) parts.push(op.description);
            const opDesc = parts.join('. ');

            newItems.push({
              id: generateId(),
              name: opName,
              price: 0,
              unit: 'шт',
              children: [],
              isOpen: true,
              isPaused: false,
              description: opDesc
            });
          }
        });
      }
    }

    if (newItems.length > 0) {
      if (!parentId) {
        setBlocks(prev => prev.map(b =>
          b.id === blockId ? { ...b, items: [...b.items, ...newItems] } : b
        ));
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

  const addBlock = () => {
    setBlocks(prev => [...prev, {
      id: `block-${generateId()}`,
      name: 'Новый блок',
      type: 'standard',
      items: [],
      visibilityRules: []
    }]);
  };

  const toggleBlockType = (blockId: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, type: b.type === 'standard' ? 'binding' : 'standard' } : b
    ));
  };

  const updateBlockName = (blockId: string, newName: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, name: newName } : b
    ));
  };

  const updateBlockParam = (
    blockId: string,
    field: 'minPages' | 'maxPages' | 'pageMultiplicity' | 'defaultPages',
    value: number
  ) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, [field]: value } : b
    ));

    if (field === 'defaultPages') {
      setPageCount(isNaN(value) ? 0 : value);
    }
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

  const deleteItem = (itemId: string) => {
    const deleteRecursive = (items: ConfigItem[]): ConfigItem[] =>
      items.filter(item => item.id !== itemId)
        .map(item => ({ ...item, children: deleteRecursive(item.children) }));
    setBlocks(prev => prev.map(b => ({ ...b, items: deleteRecursive(b.items) })));
  };

  const toggleOpen = (itemId: string) => {
    const toggleRecursive = (items: ConfigItem[]): ConfigItem[] =>
      items.map(item =>
        item.id === itemId
          ? { ...item, isOpen: !item.isOpen }
          : { ...item, children: toggleRecursive(item.children) }
      );
    setBlocks(prev => prev.map(b => ({ ...b, items: toggleRecursive(b.items) })));
  };

  const togglePause = (itemId: string) => {
    const toggleRecursive = (items: ConfigItem[]): ConfigItem[] =>
      items.map(item =>
        item.id === itemId
          ? { ...item, isPaused: !item.isPaused }
          : { ...item, children: toggleRecursive(item.children) }
      );
    setBlocks(prev => prev.map(b => ({ ...b, items: toggleRecursive(b.items) })));
  };

  const toggleHidden = (itemId: string) => {
    const toggleRecursive = (items: ConfigItem[]): ConfigItem[] =>
      items.map(item =>
        item.id === itemId
          ? { ...item, isHidden: !item.isHidden }
          : { ...item, children: toggleRecursive(item.children) }
      );
    setBlocks(prev => prev.map(b => ({ ...b, items: toggleRecursive(b.items) })));
  };

  const toggleLogicPanel = (blockId: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, isLogicOpen: !b.isLogicOpen } : b
    ));
  };

  const addRule = (
    blockId: string,
    targetItemId: string,
    triggerItemId: string,
    logicType: 'HIDE' | 'SHOW'
  ) => {
    if (!triggerItemId || !targetItemId) return;
    setBlocks(prev => prev.map(b =>
      b.id !== blockId ? b : {
        ...b,
        visibilityRules: [...b.visibilityRules, {
          id: generateId(),
          targetItemId,
          triggerItemId,
          logicType
        }]
      }
    ));
  };

  const removeRule = (blockId: string, ruleId: string) => {
    setBlocks(prev => prev.map(b =>
      b.id !== blockId ? b : {
        ...b,
        visibilityRules: b.visibilityRules.filter(r => r.id !== ruleId)
      }
    ));
  };

  const isEntityVisible = (
    entityId: string,
    rules: VisibilityRule[],
    currentSelections: Record<string, string>
  ) => {
    const applicableRules = rules.filter(r => r.targetItemId === entityId);
    if (applicableRules.length === 0) return true;

    const selectedItemIds = Object.values(currentSelections);
    const hideRules = applicableRules.filter(r => r.logicType === 'HIDE');
    if (hideRules.some(rule => selectedItemIds.includes(rule.triggerItemId))) return false;

    const showRules = applicableRules.filter(r => r.logicType === 'SHOW');
    if (showRules.length > 0) {
      if (!showRules.some(rule => selectedItemIds.includes(rule.triggerItemId))) return false;
    }
    return true;
  };

  const handleSelect = (updates: Record<string, string>) => {
    setSelections(prev => ({ ...prev, ...updates }));
  };

  const calculateTotal = () => {
    let totalUnitCost = 0;

    const calcRecursive = (
      items: ConfigItem[],
      parentIdContext: string,
      blockRules: VisibilityRule[]
    ) => {
      const selectedId = selections[parentIdContext];
      if (!selectedId) return;

      const selectedItem = items.find(i => i.id === selectedId);
      const isVisible = selectedItem ? isEntityVisible(selectedItem.id, blockRules, selections) : false;

      if (selectedItem && isVisible && !selectedItem.isPaused) {
        totalUnitCost += Number(selectedItem.price);
        if (selectedItem.children.length > 0) {
          calcRecursive(selectedItem.children, selectedItem.id, blockRules);
        }
      }
    };

    blocks.forEach(block => {
      if (isEntityVisible('BLOCK', block.visibilityRules, selections)) {
        calcRecursive(block.items, block.id, block.visibilityRules);
      }
    });

    return totalUnitCost * quantity;
  };

  const totalCost = calculateTotal();

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setQuantity(0);
      return;
    }
    const num = parseInt(val);
    if (!isNaN(num)) setQuantity(num);
  };

  const handleQuantityBlur = () => {
    let finalVal = quantity;
    if (finalVal < minQuantity) finalVal = minQuantity;
    if (maxQuantity && finalVal > maxQuantity) finalVal = maxQuantity;
    setQuantity(finalVal);
  };

  const handlePageCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setPageCount(0);
      return;
    }
    const num = parseInt(val);
    if (!isNaN(num)) setPageCount(num);
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

  const removePreset = (val: number) => {
    setQuantityPresets(quantityPresets.filter(p => p !== val));
  };

  const addSizePreset = () => {
    const val = newSizePresetVal.trim();
    if (val && !sizePresets.includes(val)) {
      setSizePresets([...sizePresets, val]);
      setNewSizePresetVal('');
    }
  };

  const removeSizePreset = (val: string) => {
    setSizePresets(sizePresets.filter(p => p !== val));
  };

  const updateItem = (id: string, field: keyof ConfigItem, value: any) => {
    const updateRecursive = (items: ConfigItem[]): ConfigItem[] =>
      items.map(item =>
        item.id === id
          ? { ...item, [field]: value }
          : item.children.length > 0
          ? { ...item, children: updateRecursive(item.children) }
          : item
      );
    setBlocks(prev => prev.map(b => ({ ...b, items: updateRecursive(b.items) })));
  };

  const handleSaveNewTemplate = async () => {
    if (!templateName.trim()) return;
    setIsSaving(true);

    try {
      const config = {
        sizeLabel,
        sizePresets,
        blocks,
        quantityLabel,
        minQuantity,
        maxQuantity,
        quantityStep,
        quantityPresets
      };
      const { data, error } = await supabase
        .from('templates')
        .insert([{ name: templateName, config }])
        .select();

      if (!error && data && data[0]) {
        setLoadedTemplateId(data[0].id);
        setOriginalConfig(JSON.parse(JSON.stringify(config)));
      }

      setTemplateName('');
      setIsSaveModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSourceSelection = (id: string) => {
    setSelectedSourceItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // ===========================================================================
  // 8. JSX РАЗМЕТКА
  // ===========================================================================

  return (
    <div className="flex w-full h-full">
      {/* Левая панель - Конструктор */}
      <div className="w-7/12 flex flex-col border-r border-gray-300 bg-gray-50 overflow-hidden">
        <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Settings size={18} />
            Конструктор шаблона
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setIsSaveModalOpen(true)}
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
              <label className="text-[10px] text-blue-600 font-bold mb-2 block">
                КНОПКИ РАЗМЕРОВ ДЛЯ КЛИЕНТА
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {sizePresets.map(preset => (
                  <div
                    key={preset}
                    className="flex items-center bg-white border border-blue-200 rounded-md px-2 py-1 text-xs text-blue-800"
                  >
                    {preset}
                    <button
                      onClick={() => removeSizePreset(preset)}
                      className="ml-1 text-blue-400 hover:text-red-500"
                    >
                      <X size={10} />
                    </button>
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
                <button
                  onClick={addSizePreset}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                >
                  Добавить
                </button>
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
              <div>
                <label className="text-[10px] text-green-600 font-bold mb-1 block">
                  МИН. ТИРАЖ
                </label>
                <input
                  type="number"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(parseInt(e.target.value) || 1)}
                  className="w-full border border-green-200 rounded px-2 py-1 text-sm bg-white text-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-green-600 font-bold mb-1 block">
                  МАКС. ТИРАЖ
                </label>
                <input
                  type="number"
                  value={maxQuantity}
                  onChange={(e) => setMaxQuantity(parseInt(e.target.value) || 10000)}
                  className="w-full border border-green-200 rounded px-2 py-1 text-sm bg-white text-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-green-600 font-bold mb-1 block">
                  ШАГ (+/-)
                </label>
                <input
                  type="number"
                  value={quantityStep}
                  onChange={(e) => setQuantityStep(parseInt(e.target.value) || 1)}
                  className="w-full border border-green-200 rounded px-2 py-1 text-sm bg-white text-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-green-600 font-bold mb-1 block">
                КНОПКИ БЫСТРОГО ВВОДА
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {quantityPresets.map(preset => (
                  <div
                    key={preset}
                    className="flex items-center bg-white border border-green-200 rounded-md px-2 py-1 text-xs text-green-800"
                  >
                    {preset}
                    <button
                      onClick={() => removePreset(preset)}
                      className="ml-1 text-green-400 hover:text-red-500"
                    >
                      <X size={10} />
                    </button>
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
                <button
                  onClick={addPreset}
                  className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                >
                  Добавить
                </button>
              </div>
            </div>
          </div>

          {/* Блоки */}
          {blocks.map((block, index) => (
            <div
              key={block.id}
              className="mb-8 p-4 bg-white rounded-lg border border-gray-200 shadow-sm relative group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 mr-4 flex items-center gap-2">
                  <input
                    value={block.name}
                    onChange={(e) => updateBlockName(block.id, e.target.value)}
                    className="text-sm font-bold uppercase tracking-wide text-gray-600 border-b border-transparent focus:border-blue-500 outline-none bg-transparent hover:border-gray-200 w-full"
                  />
                  <div
                    onClick={() => toggleBlockType(block.id)}
                    className={`cursor-pointer px-2 py-1 rounded text-[10px] font-bold border transition-all flex items-center gap-1 shrink-0 ${
                      block.type === 'binding'
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                    }`}
                    title="Нажмите для смены типа блока"
                  >
                    {block.type === 'binding' ? <BookOpen size={12}/> : <Layers size={12}/>}
                    {block.type === 'binding' ? 'ПЕРЕПЛЕТ' : 'ОБЫЧНЫЙ'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveBlock(block.id, 'up')}
                    disabled={index === 0}
                    className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                      index === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600'
                    }`}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => moveBlock(block.id, 'down')}
                    disabled={index === blocks.length - 1}
                    className={`p-1 hover:bg-gray-100 rounded transition-colors ${
                      index === blocks.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-blue-600'
                    }`}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <div className="w-px h-4 bg-gray-200 mx-2"></div>
                  <button
                    onClick={() => toggleLogicPanel(block.id)}
                    className={`p-1 rounded transition-colors mr-1 ${
                      block.isLogicOpen
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                    }`}
                  >
                    <GitBranch size={16} />
                  </button>
                  <button
                    onClick={() => handleOpenAddModal(null, block.id)}
                    className="text-xs flex items-center gap-1 text-blue-600 hover:underline mr-2"
                  >
                    <Plus size={12}/> Опция
                  </button>
                  <button
                    onClick={() => deleteBlock(block.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Параметры переплета */}
              {block.type === 'binding' && (
                <div className="mb-4 p-3 bg-indigo-50 rounded border border-indigo-200">
                  <div className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1">
                    <BookOpen size={12} /> ПАРАМЕТРЫ ПЕРЕПЛЕТА
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[9px] text-indigo-600 block mb-1">
                        Мин. кол-во страниц в блоке
                      </label>
                      <input
                        type="number"
                        value={block.minPages || ''}
                        onChange={(e) => updateBlockParam(block.id, 'minPages', parseFloat(e.target.value))}
                        className="w-full text-xs border border-indigo-200 rounded p-1.5 text-center outline-none focus:border-indigo-400 bg-white text-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="-"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-indigo-600 block mb-1">
                        Макс. кол-во страниц в блоке
                      </label>
                      <input
                        type="number"
                        value={block.maxPages || ''}
                        onChange={(e) => updateBlockParam(block.id, 'maxPages', parseFloat(e.target.value))}
                        className="w-full text-xs border border-indigo-200 rounded p-1.5 text-center outline-none focus:border-indigo-400 bg-white text-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="-"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-indigo-600 block mb-1">
                        Кратность страниц в блоке
                      </label>
                      <input
                        type="number"
                        value={block.pageMultiplicity || ''}
                        onChange={(e) => updateBlockParam(block.id, 'pageMultiplicity', parseFloat(e.target.value))}
                        className="w-full text-xs border border-indigo-200 rounded p-1.5 text-center outline-none focus:border-indigo-400 bg-white text-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="-"
                        title="Например: 4 для скобы"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-indigo-600 block mb-1">
                        Значение по умолчанию
                      </label>
                      <input
                        type="number"
                        value={block.defaultPages || ''}
                        onChange={(e) => updateBlockParam(block.id, 'defaultPages', parseFloat(e.target.value))}
                        className="w-full text-xs border border-indigo-200 rounded p-1.5 text-center outline-none focus:border-indigo-400 bg-white text-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="-"
                        title="Количество страниц при загрузке калькулятора"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Панель условий видимости */}
              {block.isLogicOpen && (
                <div className="mb-4 p-3 bg-purple-50 rounded border border-purple-100 text-sm">
                  <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                    <GitBranch size={14} /> Условия видимости
                  </h4>

                  {block.visibilityRules.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                      {block.visibilityRules.map((rule) => {
                        const triggerItem = allItemsGlobal.find(i => i.id === rule.triggerItemId);
                        const targetItemName = rule.targetItemId === 'BLOCK'
                          ? 'Весь этот блок'
                          : getItemsFlat(block.items).find(i => i.id === rule.targetItemId)?.name || 'Неизвестно';
                        const isShowRule = rule.logicType === 'SHOW';

                        return (
                          <div
                            key={rule.id}
                            className={`border px-3 py-2 rounded flex items-center justify-between shadow-sm text-xs ${
                              isShowRule
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isShowRule ? <Eye size={12}/> : <EyeOff size={12}/>}
                              <span className="font-bold uppercase">
                                {isShowRule ? 'Показать' : 'Скрыть'}:
                              </span>
                              <span className="font-medium underline">{targetItemName}</span>
                              <span className="opacity-50">&larr;</span>
                              <span className="opacity-70">если выбрано:</span>
                              <span>
                                {triggerItem?.name || 'Unknown'}
                                <i className="opacity-60"> ({triggerItem?.blockName})</i>
                              </span>
                            </div>
                            <button
                              onClick={() => removeRule(block.id, rule.id)}
                              className="opacity-50 hover:opacity-100 hover:text-red-600"
                            >
                              <X size={14}/>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 bg-white/50 p-3 rounded border border-purple-100">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-purple-400 font-bold mb-1 block">
                          ЧТО МЕНЯЕМ
                        </label>
                        <select
                          id={`target-select-${block.id}`}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-purple-400 bg-white text-gray-700"
                        >
                          <option value="BLOCK">Весь блок целиком</option>
                          {getItemsFlat(block.items).map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-purple-400 font-bold mb-1 block">
                          ДЕЙСТВИЕ
                        </label>
                        <select
                          id={`type-select-${block.id}`}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-purple-400 bg-white text-gray-700"
                        >
                          <option value="HIDE">Скрыть (по умолчанию видно)</option>
                          <option value="SHOW">Показать (по умолчанию скрыто)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-[10px] text-purple-400 font-bold mb-1 block">
                          ЕСЛИ ВЫБРАНО
                        </label>
                        <select
                          id={`trigger-select-${block.id}`}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-purple-400 bg-white text-gray-700"
                        >
                          <option value="">Выберите условие...</option>
                          {allItemsGlobal.filter(i => i.blockName !== block.name).map(item => (
                            <option key={item.id} value={item.id}>
                              {item.blockName}: {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          const targetSelect = document.getElementById(`target-select-${block.id}`) as HTMLSelectElement;
                          const triggerSelect = document.getElementById(`trigger-select-${block.id}`) as HTMLSelectElement;
                          const typeSelect = document.getElementById(`type-select-${block.id}`) as HTMLSelectElement;
                          addRule(block.id, targetSelect.value, triggerSelect.value, typeSelect.value as 'HIDE' | 'SHOW');
                          triggerSelect.value = "";
                        }}
                        className="bg-purple-600 text-white px-4 py-1.5 h-[26px] flex items-center rounded text-xs hover:bg-purple-700 transition font-medium"
                      >
                        <Plus size={14} className="mr-1"/> Добавить
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Список опций */}
              {block.items.length === 0 ? (
                <div className="text-center p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 text-sm">
                  Список пуст.
                </div>
              ) : (
                block.items.map(item => (
                  <AdminItem
                    key={item.id}
                    item={item}
                    level={0}
                    blockType={block.type}
                    onUpdate={updateItem}
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

          {/* Кнопка добавления нового блока */}
          <div
            onClick={addBlock}
            className="mt-8 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition text-gray-400 hover:text-blue-500"
          >
            <span className="font-medium flex items-center justify-center gap-2">
              <Plus size={20} /> Добавить новый блок
            </span>
          </div>
        </div>
      </div>

      {/* Правая панель - Предпросмотр */}
      <div className="w-5/12 bg-white flex flex-col shadow-xl z-10">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Package size={18} /> Предпросмотр (Клиент)
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white/90">
              <div className="text-center">
                <Package size={48} className="mx-auto mb-2 opacity-80" />
                <span className="font-medium text-lg">Полиграфия</span>
              </div>
            </div>

            <div className="p-6">
              {/* Селектор размеров */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  {sizeLabel}
                </label>
                <div className="flex flex-wrap gap-2">
                  {sizePresets.map(preset => (
                    <button
                      key={preset}
                      onClick={() => setSelectedSize(preset)}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedSize === preset
                          ? 'bg-blue-100 text-blue-800 border-blue-200 ring-2 ring-blue-100'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 my-4"></div>

              {/* Блоки с опциями */}
              {blocks.map(block => {
                if (!isEntityVisible('BLOCK', block.visibilityRules, selections)) return null;

                return (
                  <React.Fragment key={block.id}>
                    {block.type === 'binding' && (
                      <div className="mb-6 p-4 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                        <label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                          <BookOpen size={16} className="text-indigo-600"/> Количество страниц
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                                const step = block.pageMultiplicity || 1;
                                const min = block.minPages || 1;
                                setPageCount(p => Math.max(min, p - step));
                            }}
                            className="w-10 h-10 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shadow-sm transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={pageCount === 0 ? '' : pageCount}
                            onChange={handlePageCountChange}
                            onBlur={handlePageCountBlur}
                            className="w-24 text-center border border-indigo-200 rounded-lg py-2 font-bold text-lg text-indigo-900 bg-white shadow-sm focus:border-indigo-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => {
                                const step = block.pageMultiplicity || 1;
                                const max = block.maxPages || 10000;
                                setPageCount(p => Math.min(max, p + step));
                            }}
                            className="w-10 h-10 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 shadow-sm transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}

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
              })}

              <div className="border-t border-gray-100 my-4"></div>

              {/* Секция количества (тиража) */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  {quantityLabel}
                </label>
                {quantityPresets.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {quantityPresets.map(preset => (
                      <button
                        key={preset}
                        onClick={() => setQuantity(preset)}
                        className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                          quantity === preset
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {preset} шт.
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(q => Math.max(minQuantity, q - quantityStep))}
                    className="w-8 h-8 rounded bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors font-medium text-blue-600 border border-blue-200"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity === 0 ? '' : quantity}
                    onChange={handleQuantityChange}
                    onBlur={handleQuantityBlur}
                    className="w-24 text-center border rounded py-1 font-semibold text-gray-800 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setQuantity(q => Math.min(maxQuantity, q + quantityStep))}
                    className="w-8 h-8 rounded bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors font-medium text-blue-600 border border-blue-200"
                  >
                    +
                  </button>
                  <div className="text-xs text-gray-400 ml-auto">
                    Мин: {minQuantity} / Макс: {maxQuantity}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Футер с итоговой стоимостью */}
        <div className="p-6 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-gray-500 text-sm">Итоговая стоимость</span>
              <div className="text-xs text-gray-400 mt-1">
                {quantity} шт. × {(totalCost / quantity || 0).toFixed(2)} ₽/шт.
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-800 flex items-baseline gap-1">
              {totalCost.toLocaleString('ru-RU')}
              <span className="text-lg font-normal text-gray-500">₽</span>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 9. МОДАЛЬНЫЕ ОКНА */}
      {/* =================================================================== */}

      {/* Модальное окно добавления опции */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-[600px] flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Plus size={20} className="text-blue-600"/> Добавить опцию
              </h3>
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20}/>
              </button>
            </div>

            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setAddItemTab('empty')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  addItemTab === 'empty'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Пустая
              </button>
              <button
                onClick={() => setAddItemTab('material')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  addItemTab === 'material'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Из Склада
              </button>
              <button
                onClick={() => setAddItemTab('operation')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  addItemTab === 'operation'
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Из Операций
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {addItemTab === 'empty' && (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <ChevronRightSquare size={32} />
                  </div>
                  <p>Будет добавлен один пустой элемент.</p>
                </div>
              )}

              {addItemTab === 'material' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                    <input
                      value={addItemSearch}
                      onChange={(e) => setAddItemSearch(e.target.value)}
                      placeholder="Поиск..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 outline-none bg-white text-gray-700"
                      autoFocus
                    />
                  </div>
                  <div className="border rounded-lg max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                    {filteredAddMaterials.map(m => (
                      <div
                        key={m.id}
                        onClick={() => toggleSourceSelection(m.id)}
                        className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                          selectedSourceItems.includes(m.id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center ${
                            selectedSourceItems.includes(m.id)
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {selectedSourceItems.includes(m.id) && <Check size={12} />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-800">{m.name}</div>
                          <div className="text-xs text-gray-500">{m.group} • {m.price} ₽</div>
                        </div>
                      </div>
                    ))}
                    {filteredAddMaterials.length === 0 && (
                      <div className="p-4 text-center text-xs text-gray-400">
                        Ничего не найдено
                      </div>
                    )}
                  </div>
                </div>
              )}

              {addItemTab === 'operation' && (
                <div className="space-y-4">
                  <div className="flex gap-4 items-center">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                      <input
                        value={addItemSearch}
                        onChange={(e) => setAddItemSearch(e.target.value)}
                        placeholder="Поиск..."
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 outline-none bg-white text-gray-700"
                        autoFocus
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={withSides}
                        onChange={(e) => setWithSides(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      Разбить на 1/2 стороны
                    </label>
                  </div>
                  <div className="border rounded-lg max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                    {filteredAddOperations.map(op => (
                      <div
                        key={op.id}
                        onClick={() => toggleSourceSelection(op.id)}
                        className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                          selectedSourceItems.includes(op.id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center ${
                            selectedSourceItems.includes(op.id)
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {selectedSourceItems.includes(op.id) && <Check size={12} />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-800">
                            {op.name} {op.variant && (
                              <span className="text-gray-500 font-normal">({op.variant})</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">0 ₽</div>
                        </div>
                      </div>
                    ))}
                    {filteredAddOperations.length === 0 && (
                      <div className="p-4 text-center text-xs text-gray-400">
                        Ничего не найдено
                      </div>
                    )}
                  </div>
                  {withSides && (
                    <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
                      <Info size={12} className="inline mr-1 -mt-0.5"/>
                      Будут созданы две родительские категории: "Односторонняя" и "Двусторонняя".
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition text-sm"
              >
                Отмена
              </button>
              <button
                onClick={confirmAddItem}
                disabled={addItemTab !== 'empty' && selectedSourceItems.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addItemTab === 'empty'
                  ? 'Добавить'
                  : `Добавить выбранные (${selectedSourceItems.length})`
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateConstructor;