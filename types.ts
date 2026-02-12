
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
};

export type SavedTemplate = {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  created_at: string;
  config: {
    sizeLabel: string;
    sizePresets: string[];
    blocks: Block[];
    quantityLabel: string;
    minQuantity: number;
    maxQuantity: number;
    quantityStep: number;
    quantityPresets: number[];
  };
};

// Generic types for Data Manager

export type FieldType = 'text' | 'number' | 'image' | 'select' | 'color';

export type FieldSchema = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  isSystem?: boolean; // Cannot be deleted
  defaultValue?: any;
  options?: string[]; // For select type
};

export type DataItem = {
  id: string;
  [key: string]: any;
};

// Legacy types support (mapped to DataItem)
export type Material = DataItem;
export type Operation = DataItem;
