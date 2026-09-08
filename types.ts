
export type VisibilityRule = {
  id: string;
  targetItemId: string;
  triggerItemId: string;
  logicType: 'HIDE' | 'SHOW';
};

export type BlockType = 'standard' | 'binding';

export type ConfigItem = {
  id: string;
  name: string;
  price: number;
  unit: string;
  children: ConfigItem[];
  isOpen?: boolean;
  isPaused?: boolean;
  isHidden?: boolean;
  description?: string;
  imageUrl?: string;
  minPages?: number;
  maxPages?: number;
  pageMultiplicity?: number;
  sourceType?: 'material' | 'operation';
  sourceId?: string;
  sides?: 1 | 2;
};

export type Block = {
  id: string;
  name: string;
  type: BlockType;
  items: ConfigItem[];
  visibilityRules: VisibilityRule[];
  isLogicOpen?: boolean;
  minPages?: number;
  maxPages?: number;
  pageMultiplicity?: number;
  defaultPages?: number;
  partId?: string;
};

export type PagesMode = 'fixed' | 'client' | 'none';

export type ProductPart = {
  id: string;
  name: string;
  pagesMode: PagesMode;
  pages?: number;
  customSize?: string;
  itemsPerSheetOverride?: number;
};

export type TemplateConfig = {
  sizeLabel: string;
  sizePresets: string[];
  parts: ProductPart[];
  blocks: Block[];
  quantityLabel: string;
  minQuantity: number;
  maxQuantity: number;
  quantityStep: number;
  quantityPresets: number[];
};

export type SavedTemplate = {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  created_at: string;
  updated_at?: string;
  config: TemplateConfig;
};

// Generic types for Data Manager

export type FieldType = 'text' | 'number' | 'image' | 'select' | 'color' | 'rates';

export type LookupSource = 'equipment' | 'materials';

export type FieldSchema = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  isSystem?: boolean; // Cannot be deleted
  defaultValue?: any;
  options?: string[]; // For select type (static)
  optionLabels?: Record<string, string>; // Display labels for static options
  optionsFrom?: LookupSource; // For select type (dynamic, by entity id)
  hint?: string;
};

export type DataItem = {
  id: string;
  [key: string]: any;
};

export type Material = DataItem;
export type Operation = DataItem;
export type Equipment = DataItem;

export type ProductivityRate = { condition: string; perHour: number };

export type OperationStage = 'prepress' | 'print' | 'postpress' | 'assembly';
export type OperationUnit = 'sheet' | 'item' | 'run';

export const STAGE_ORDER: OperationStage[] = ['prepress', 'print', 'postpress', 'assembly'];
export const STAGE_LABELS: Record<OperationStage, string> = {
  prepress: 'Допечатная',
  print: 'Печать',
  postpress: 'Постпечать',
  assembly: 'Сборка'
};
export const UNIT_LABELS: Record<OperationUnit, string> = {
  sheet: 'лист',
  item: 'изделие',
  run: 'тираж'
};

// Tech card

export type MaterialLine = {
  materialId: string;
  name: string;
  format: string;
  unit: string;
  qty: number;
  price: number;
  cost: number;
};

export type Imposition = {
  equipmentId?: string;
  equipmentName: string;
  sheetW: number;
  sheetH: number;
  printableW: number;
  printableH: number;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  itemsPerSheet: number;
  rotated: boolean;
  source: 'auto' | 'override' | 'material';
};

export type TechCardPart = {
  partId: string;
  partName: string;
  size: string;
  pages: number;
  sides: 1 | 2;
  faces: number;
  material: MaterialLine | null;
  imposition: Imposition | null;
  printSheets: number;
  wasteSheets: number;
  totalSheets: number;
  cutFactor: number;
  purchaseSheets: number;
  warnings: string[];
};

export type TechCardRow = {
  order: number;
  partId: string;
  partName: string;
  stage: OperationStage;
  operationId: string;
  operationName: string;
  equipmentId?: string;
  equipmentName: string;
  unit: OperationUnit;
  count: number;
  rateUsed: { perHour: number; condition: string } | null;
  setupMin: number;
  runMin: number;
  totalMin: number;
  machineCost: number;
  consumable: { materialId: string; materialName: string; qty: number; unit: string; cost: number } | null;
  totalCost: number;
  warnings: string[];
};

export type TechCard = {
  generatedAt: string;
  product: { name: string; size: string; quantity: number; pageCount: number };
  parts: TechCardPart[];
  rows: TechCardRow[];
  totals: {
    timeMin: number;
    materialsCost: number;
    operationsCost: number;
    totalCost: number;
    costPerItem: number;
  };
  warnings: string[];
};
