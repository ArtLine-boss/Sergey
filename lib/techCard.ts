import {
  Block, ConfigItem, DataItem, Imposition, MaterialLine, OperationStage, OperationUnit,
  ProductPart, ProductivityRate, STAGE_ORDER, TechCard, TechCardPart, TechCardRow, VisibilityRule
} from '../types';

export const PRODUCT_PART_ID = '__product__';
export const PRODUCT_PART_NAME = 'Изделие';

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

export type Size = { w: number; h: number };

const NAMED_FORMATS: Record<string, Size> = {
  A0: { w: 841, h: 1189 }, A1: { w: 594, h: 841 }, A2: { w: 420, h: 594 }, A3: { w: 297, h: 420 },
  A4: { w: 210, h: 297 }, A5: { w: 148, h: 210 }, A6: { w: 105, h: 148 }, A7: { w: 74, h: 105 },
  SRA3: { w: 320, h: 450 }, SRA4: { w: 225, h: 320 }, SRA2: { w: 450, h: 640 }, SRA1: { w: 640, h: 900 },
  B0: { w: 1000, h: 1414 }, B1: { w: 707, h: 1000 }, B2: { w: 500, h: 707 }, B3: { w: 353, h: 500 },
  B4: { w: 250, h: 353 }, B5: { w: 176, h: 250 }
};

export const parseSize = (raw?: string | null): Size | null => {
  if (!raw) return null;
  const m = raw.match(/(\d+(?:[.,]\d+)?)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)/i);
  if (m) {
    const w = parseFloat(m[1].replace(',', '.'));
    const h = parseFloat(m[2].replace(',', '.'));
    if (w > 0 && h > 0) return { w, h };
  }
  const named = raw.toUpperCase().replace(/\s+/g, '').match(/(SRA\d|[AB]\d)/);
  if (named && NAMED_FORMATS[named[1]]) return NAMED_FORMATS[named[1]];
  return null;
};

export const formatSize = (s: Size | null) => (s ? `${s.w} × ${s.h} мм` : '—');

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

const materialSize = (m: DataItem | undefined): Size | null => {
  if (!m) return null;
  const w = num(m.width_mm), h = num(m.height_mm);
  if (w > 0 && h > 0) return { w, h };
  return parseSize(m.dimensions);
};

// ---------------------------------------------------------------------------
// Imposition
// ---------------------------------------------------------------------------

const fit = (area: Size, cell: Size) => {
  const cols = cell.w > 0 ? Math.floor(area.w / cell.w) : 0;
  const rows = cell.h > 0 ? Math.floor(area.h / cell.h) : 0;
  return { cols, rows, n: cols * rows };
};

export const calcImposition = (
  product: Size,
  sheet: Size,
  margin: number,
  bleed: number,
  meta: { equipmentId?: string; equipmentName: string; source: Imposition['source'] }
): Imposition => {
  const printable = { w: sheet.w - 2 * margin, h: sheet.h - 2 * margin };
  const cell = { w: product.w + 2 * bleed, h: product.h + 2 * bleed };
  const straight = fit(printable, cell);
  const turned = fit(printable, { w: cell.h, h: cell.w });
  const rotated = turned.n > straight.n;
  const best = rotated ? turned : straight;
  return {
    equipmentId: meta.equipmentId,
    equipmentName: meta.equipmentName,
    sheetW: sheet.w,
    sheetH: sheet.h,
    printableW: printable.w,
    printableH: printable.h,
    cellW: cell.w,
    cellH: cell.h,
    cols: best.cols,
    rows: best.rows,
    itemsPerSheet: best.n,
    rotated,
    source: meta.source
  };
};

// How many print sheets can be cut from one purchase sheet (both orientations, never below 1).
export const calcCutFactor = (purchase: Size | null, print: Size | null): number => {
  if (!purchase || !print) return 1;
  const a = fit(purchase, print).n;
  const b = fit(purchase, { w: print.h, h: print.w }).n;
  return Math.max(1, a, b);
};

// ---------------------------------------------------------------------------
// Selection helpers (shared with the constructor)
// ---------------------------------------------------------------------------

export const isEntityVisible = (
  entityId: string,
  rules: VisibilityRule[],
  selections: Record<string, string>
) => {
  const applicable = rules.filter(r => r.targetItemId === entityId);
  if (applicable.length === 0) return true;
  const selectedIds = Object.values(selections);
  if (applicable.some(r => r.logicType === 'HIDE' && selectedIds.includes(r.triggerItemId))) return false;
  const show = applicable.filter(r => r.logicType === 'SHOW');
  if (show.length > 0 && !show.some(r => selectedIds.includes(r.triggerItemId))) return false;
  return true;
};

export type SelectedItem = { item: ConfigItem; block: Block; blockIndex: number; sides: 1 | 2 | undefined; order: number };

export const collectSelectedItems = (blocks: Block[], selections: Record<string, string>): SelectedItem[] => {
  const out: SelectedItem[] = [];
  let order = 0;
  const walk = (items: ConfigItem[], ctx: string, block: Block, blockIndex: number, sides: 1 | 2 | undefined) => {
    const selectedId = selections[ctx];
    if (!selectedId) return;
    const item = items.find(i => i.id === selectedId);
    if (!item || item.isPaused || !isEntityVisible(item.id, block.visibilityRules, selections)) return;
    const nextSides = item.sides ?? sides;
    out.push({ item, block, blockIndex, sides: nextSides, order: order++ });
    if (item.children.length > 0) walk(item.children, item.id, block, blockIndex, nextSides);
  };
  blocks.forEach((block, idx) => {
    if (!isEntityVisible('BLOCK', block.visibilityRules, selections)) return;
    walk(block.items, block.id, block, idx, undefined);
  });
  return out;
};

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

const normalize = (s: unknown) => String(s ?? '').trim().toLowerCase();

export const pickRate = (
  rates: ProductivityRate[] | undefined,
  candidates: (string | undefined)[]
): ProductivityRate | null => {
  if (!Array.isArray(rates) || rates.length === 0) return null;
  for (const c of candidates) {
    const key = normalize(c);
    if (!key) continue;
    const hit = rates.find(r => normalize(r.condition) === key && num(r.perHour) > 0);
    if (hit) return hit;
  }
  const def = rates.find(r => !normalize(r.condition) && num(r.perHour) > 0);
  return def || null;
};

// ---------------------------------------------------------------------------
// Tech card
// ---------------------------------------------------------------------------

export type BuildTechCardInput = {
  productName: string;
  parts: ProductPart[];
  blocks: Block[];
  selections: Record<string, string>;
  selectedSize: string;
  quantity: number;
  pageCount: number;
  materials: DataItem[];
  operations: DataItem[];
  equipment: DataItem[];
};

type PartComputation = TechCardPart & { materialGroup?: string; sheetSize: Size | null };

export const buildTechCard = (input: BuildTechCardInput): TechCard => {
  const { parts, blocks, selections, selectedSize, quantity, materials, operations, equipment } = input;
  const pageCount = Math.max(0, num(input.pageCount));
  const qty = Math.max(0, num(quantity));
  const selected = collectSelectedItems(blocks, selections);
  const hasBinding = blocks.some(b => b.type === 'binding');

  const effectiveParts: ProductPart[] = parts.length > 0
    ? parts
    : [{ id: PRODUCT_PART_ID, name: PRODUCT_PART_NAME, pagesMode: hasBinding ? 'client' : 'none' }];
  const partIds = new Set(effectiveParts.map(p => p.id));

  const partOf = (block: Block): string =>
    parts.length === 0 ? PRODUCT_PART_ID : (block.partId && partIds.has(block.partId) ? block.partId : PRODUCT_PART_ID);

  const byId = <T extends DataItem>(list: T[], id?: string) => (id ? list.find(x => x.id === id) : undefined);

  // --- parts ---------------------------------------------------------------
  const computedParts: PartComputation[] = effectiveParts.map(part => {
    const warnings: string[] = [];
    const own = selected.filter(s => partOf(s.block) === part.id);

    const pages = part.pagesMode === 'fixed' ? Math.max(1, num(part.pages, 1))
      : part.pagesMode === 'client' ? Math.max(1, pageCount || 1)
      : 1;
    const sides = own.reduce<1 | 2>((acc, s) => (s.sides === 2 ? 2 : acc), 1);

    const materialItem = own.find(s => s.item.sourceType === 'material');
    const material = byId(materials, materialItem?.item.sourceId);
    if (materialItem && !material) warnings.push(`Материал «${materialItem.item.name}» не найден на складе`);
    if (!materialItem) warnings.push('Не выбран материал');

    const printOpItem = own.find(s => {
      if (s.item.sourceType !== 'operation') return false;
      const op = byId(operations, s.item.sourceId);
      return op?.stage === 'print';
    });
    const printOp = byId(operations, printOpItem?.item.sourceId);
    const printEquipment = byId(equipment, printOp?.equipment_id);
    if (printOpItem && !printEquipment) warnings.push(`У операции «${printOp?.name || printOpItem.item.name}» не назначено оборудование`);
    if (!printOpItem) warnings.push('Нет операции печати — раскладка по формату материала');

    const sizeStr = part.customSize?.trim() || selectedSize;
    const productSize = parseSize(sizeStr);
    if (!productSize) warnings.push(`Не удалось разобрать размер «${sizeStr}»`);

    let imposition: Imposition | null = null;
    let sheetSize: Size | null = null;
    const eqSheet = printEquipment ? { w: num(printEquipment.sheet_width_mm), h: num(printEquipment.sheet_height_mm) } : null;
    if (productSize) {
      if (eqSheet && eqSheet.w > 0 && eqSheet.h > 0) {
        sheetSize = eqSheet;
        imposition = calcImposition(productSize, eqSheet, num(printEquipment!.margin_mm), num(printEquipment!.bleed_mm), {
          equipmentId: printEquipment!.id, equipmentName: printEquipment!.name, source: 'auto'
        });
      } else {
        const ms = materialSize(material);
        if (ms) {
          sheetSize = ms;
          imposition = calcImposition(productSize, ms, 0, 0, { equipmentName: material!.name, source: 'material' });
        }
      }
      if (part.itemsPerSheetOverride && part.itemsPerSheetOverride > 0) {
        const base = imposition || calcImposition(productSize, productSize, 0, 0, { equipmentName: '—', source: 'override' });
        imposition = { ...base, itemsPerSheet: part.itemsPerSheetOverride, cols: 0, rows: 0, source: 'override' };
      }
    }

    const ips = imposition?.itemsPerSheet ?? 0;
    if (imposition && ips === 0) warnings.push('Изделие не помещается на печатный лист');
    if (!imposition && productSize) warnings.push('Нет данных о формате листа — листы не рассчитаны');

    const faces = qty * pages;
    const printSheets = ips > 0 ? Math.ceil(faces / (ips * sides)) : 0;

    const wastePercent = own.reduce((acc, s) => {
      const op = s.item.sourceType === 'operation' ? byId(operations, s.item.sourceId) : undefined;
      return acc + (op && (op.unit || 'item') === 'sheet' ? num(op.waste_percent) : 0);
    }, 0);
    const wasteSheets = printSheets > 0
      ? num(printEquipment?.waste_sheets) + Math.ceil(printSheets * wastePercent / 100)
      : 0;
    const totalSheets = printSheets + wasteSheets;

    const cutFactor = calcCutFactor(materialSize(material), sheetSize);
    const purchaseSheets = Math.ceil(totalSheets / cutFactor);

    const materialLine: MaterialLine | null = material ? {
      materialId: material.id,
      name: material.name,
      format: material.dimensions || formatSize(materialSize(material)),
      unit: material.unit || 'лист',
      qty: purchaseSheets,
      price: num(material.price),
      cost: purchaseSheets * num(material.price)
    } : null;

    return {
      partId: part.id,
      partName: part.name,
      size: productSize ? formatSize(productSize) : sizeStr,
      pages,
      sides,
      faces,
      material: materialLine,
      imposition,
      printSheets,
      wasteSheets,
      totalSheets,
      cutFactor,
      purchaseSheets,
      warnings,
      materialGroup: material?.group,
      sheetSize
    };
  });

  const partIndex = new Map(effectiveParts.map((p, i) => [p.id, i]));
  const partByIdMap = new Map(computedParts.map(p => [p.partId, p]));
  const allPrintSheets = computedParts.reduce((a, p) => a + p.printSheets, 0);
  const allTotalSheets = computedParts.reduce((a, p) => a + p.totalSheets, 0);

  // --- operations ----------------------------------------------------------
  const rows: TechCardRow[] = [];
  selected.forEach(s => {
    if (s.item.sourceType !== 'operation') return;
    const op = byId(operations, s.item.sourceId);
    const warnings: string[] = [];
    const pid = partOf(s.block);
    const part = partByIdMap.get(pid);
    const partName = part?.partName ?? PRODUCT_PART_NAME;
    if (!op) {
      rows.push({
        order: 0, partId: pid, partName, stage: 'postpress', operationId: s.item.sourceId || '', operationName: s.item.name,
        equipmentName: '—', unit: 'item', count: 0, rateUsed: null, setupMin: 0, runMin: 0, totalMin: 0,
        machineCost: 0, consumable: null, totalCost: 0, warnings: ['Операция не найдена в справочнике']
      });
      return;
    }
    const stage: OperationStage = STAGE_ORDER.includes(op.stage) ? op.stage : 'postpress';
    const unit: OperationUnit = ['sheet', 'item', 'run'].includes(op.unit) ? op.unit : 'item';
    const sides = part?.sides ?? 1;

    let count = 0;
    if (unit === 'sheet') {
      const sheets = part
        ? (stage === 'print' ? part.totalSheets : part.printSheets)
        : (stage === 'print' ? allTotalSheets : allPrintSheets);
      count = stage === 'print' ? sheets * sides : sheets;
    } else if (unit === 'item') {
      count = qty;
    } else {
      count = 1;
    }

    const eq = byId(equipment, op.equipment_id);
    if (!eq) warnings.push('Не назначено оборудование');

    const rate = eq ? pickRate(eq.rates, [part?.materialGroup, op.complexity]) : null;
    if (eq && !rate) warnings.push('Нет подходящей ставки производительности');

    const setupMin = num(op.setup_time_min) > 0 ? num(op.setup_time_min) : num(eq?.setup_time_min);
    const runMin = rate ? (count / num(rate.perHour)) * 60 : 0;
    const totalMin = setupMin + runMin;
    const machineCost = eq ? (totalMin / 60) * num(eq.hourly_rate) : 0;

    if (eq && part?.sheetSize && (num(eq.max_width_mm) > 0 || num(eq.max_height_mm) > 0)) {
      const mw = num(eq.max_width_mm) || Infinity, mh = num(eq.max_height_mm) || Infinity;
      const { w, h } = part.sheetSize;
      const fits = (w <= mw && h <= mh) || (h <= mw && w <= mh);
      if (!fits) warnings.push(`Лист ${w}×${h} больше макс. формата оборудования`);
    }

    let consumable: TechCardRow['consumable'] = null;
    if (op.material_id) {
      const cm = byId(materials, op.material_id);
      if (cm) {
        const perUnit = num(op.material_per_unit);
        const cqty = perUnit * count;
        consumable = { materialId: cm.id, materialName: cm.name, qty: cqty, unit: cm.unit || 'ед', cost: cqty * num(cm.price) };
      } else {
        warnings.push('Расходный материал не найден на складе');
      }
    }

    rows.push({
      order: 0,
      partId: pid,
      partName,
      stage,
      operationId: op.id,
      operationName: op.variant ? `${op.name} (${op.variant})` : op.name,
      equipmentId: eq?.id,
      equipmentName: eq?.name || '—',
      unit,
      count,
      rateUsed: rate ? { perHour: num(rate.perHour), condition: rate.condition || 'по умолчанию' } : null,
      setupMin,
      runMin,
      totalMin,
      machineCost,
      consumable,
      totalCost: machineCost + (consumable?.cost || 0),
      warnings
    });
  });

  const stageIdx = (s: OperationStage) => STAGE_ORDER.indexOf(s);
  const pIdx = (id: string) => partIndex.get(id) ?? Number.MAX_SAFE_INTEGER;
  const orderOf = (r: TechCardRow) => selected.find(s => s.item.sourceId === r.operationId && partOf(s.block) === r.partId)?.order ?? 0;
  rows.sort((a, b) =>
    stageIdx(a.stage) - stageIdx(b.stage) || pIdx(a.partId) - pIdx(b.partId) || orderOf(a) - orderOf(b)
  );
  rows.forEach((r, i) => { r.order = i + 1; });

  const materialsCost = computedParts.reduce((a, p) => a + (p.material?.cost || 0), 0);
  const operationsCost = rows.reduce((a, r) => a + r.totalCost, 0);
  const timeMin = rows.reduce((a, r) => a + r.totalMin, 0);
  const totalCost = materialsCost + operationsCost;

  const warnings: string[] = [];
  if (selected.length === 0) warnings.push('В превью ничего не выбрано');
  if (rows.length === 0) warnings.push('Нет выбранных операций');

  return {
    generatedAt: new Date().toISOString(),
    product: { name: input.productName, size: selectedSize, quantity: qty, pageCount },
    parts: computedParts.map(({ materialGroup, sheetSize, ...p }) => p),
    rows,
    totals: { timeMin, materialsCost, operationsCost, totalCost, costPerItem: qty > 0 ? totalCost / qty : 0 },
    warnings
  };
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const formatMinutes = (min: number) => {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${String(m).padStart(2, '0')} мин`;
};

export const formatMoney = (n: number) =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
