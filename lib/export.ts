import { Block, ConfigItem, SavedTemplate } from '../types';

const stripItems = (items: ConfigItem[]): any[] =>
  items
    .filter(i => !i.isPaused)
    .map(({ sourceId, sourceType, isOpen, isPaused, children, ...rest }) => ({
      ...rest,
      children: stripItems(children)
    }));

const stripBlocks = (blocks: Block[]) =>
  blocks.map(({ isLogicOpen, items, ...rest }) => ({ ...rest, items: stripItems(items) }));

// Public shape for the printing house website ("Продукция" section). No cost data, no internal links.
export const toPublicTemplate = (t: SavedTemplate) => ({
  id: t.id,
  name: t.name,
  description: t.description || '',
  image_url: t.image_url || '',
  updated_at: t.updated_at || t.created_at,
  config: {
    sizeLabel: t.config.sizeLabel,
    sizePresets: t.config.sizePresets,
    parts: (t.config.parts || []).map(({ itemsPerSheetOverride, ...p }) => p),
    blocks: stripBlocks(t.config.blocks),
    quantityLabel: t.config.quantityLabel,
    minQuantity: t.config.minQuantity,
    maxQuantity: t.config.maxQuantity,
    quantityStep: t.config.quantityStep,
    quantityPresets: t.config.quantityPresets
  }
});

const safeFileName = (name: string) =>
  name.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'export';

export const downloadJson = (name: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(name)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const copyToClipboard = async (data: unknown) => {
  const text = JSON.stringify(data, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Скопируйте JSON вручную:', text);
    return false;
  }
};
