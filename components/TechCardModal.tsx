import React from 'react';
import { X, Printer, Download, AlertTriangle, ClipboardList } from 'lucide-react';
import { STAGE_LABELS, TechCard, UNIT_LABELS } from '../types';
import { formatMinutes, formatMoney } from '../lib/techCard';
import { downloadJson } from '../lib/export';

interface TechCardModalProps {
  techCard: TechCard;
  clientPrice: number;
  onClose: () => void;
}

const Stat: React.FC<{ label: string; value: React.ReactNode; accent?: boolean }> = ({ label, value, accent }) => (
  <div>
    <div className="text-[10px] uppercase font-bold text-gray-400">{label}</div>
    <div className={`text-sm ${accent ? 'font-bold text-slate-800' : 'text-gray-700'}`}>{value}</div>
  </div>
);

const Warnings: React.FC<{ items: string[] }> = ({ items }) =>
  items.length === 0 ? null : (
    <ul className="mt-2 space-y-1">
      {items.map((w, i) => (
        <li key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-start gap-1.5">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {w}
        </li>
      ))}
    </ul>
  );

export const TechCardModal: React.FC<TechCardModalProps> = ({ techCard, clientPrice, onClose }) => {
  const { product, parts, rows, totals } = techCard;
  const margin = clientPrice > 0 ? ((clientPrice - totals.totalCost) / clientPrice) * 100 : 0;
  const date = new Date(techCard.generatedAt).toLocaleString('ru-RU');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static print:block">
      <div
        id="techcard-print-root"
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:rounded-none print:w-full print:max-w-none"
      >
        <div className="p-5 border-b border-gray-200 flex justify-between items-start print:border-b-2 print:border-black">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-600 print:hidden" /> Технологическая карта
            </h3>
            <div className="text-sm text-gray-600 mt-1">
              <span className="font-semibold">{product.name || 'Без названия'}</span>
              {' · '}{product.size}{' · '}{product.quantity} шт.
              {product.pageCount > 0 && parts.some(p => p.pages > 1) && ` · ${product.pageCount} стр.`}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Сформирована {date}</div>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={() => downloadJson(`техкарта_${product.name || 'изделие'}`, techCard)}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-gray-700"
            >
              <Download size={14} /> JSON
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              <Printer size={14} /> Печать
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 print:overflow-visible">
          <Warnings items={techCard.warnings} />

          {/* Parts */}
          <section>
            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Раскладка и материалы</h4>
            <div className={`grid gap-3 ${parts.length > 1 ? 'md:grid-cols-2' : ''} print:grid-cols-2`}>
              {parts.map(part => (
                <div key={part.partId} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 print:break-inside-avoid">
                  <div className="flex justify-between items-baseline mb-3">
                    <div className="font-bold text-slate-800">{part.partName}</div>
                    <div className="text-xs text-gray-500">
                      {part.size} · {part.pages > 1 ? `${part.pages} стр.` : '1 лицо'} · {part.sides === 2 ? '2 стороны' : '1 сторона'}
                    </div>
                  </div>
                  {part.imposition ? (
                    <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                      <Stat label="Оборудование" value={part.imposition.equipmentName} />
                      <Stat label="Лист" value={`${part.imposition.sheetW} × ${part.imposition.sheetH} мм`} />
                      <Stat label="Печатная область" value={`${part.imposition.printableW} × ${part.imposition.printableH} мм`} />
                      <Stat
                        label="На листе"
                        value={
                          <>
                            <b>{part.imposition.itemsPerSheet}</b> шт.
                            {part.imposition.source === 'override'
                              ? ' (вручную)'
                              : ` (${part.imposition.cols}×${part.imposition.rows}${part.imposition.rotated ? ', с поворотом' : ''})`}
                          </>
                        }
                      />
                      <Stat label="Ячейка с вылетами" value={`${part.imposition.cellW} × ${part.imposition.cellH} мм`} />
                      <Stat label="Лиц всего" value={part.faces} />
                      <Stat label="Печатных листов" value={<><b>{part.printSheets}</b> + {part.wasteSheets} приладка = {part.totalSheets}</>} accent />
                      <Stat label="Раскрой" value={`${part.cutFactor} печ. из 1 закуп.`} />
                      <Stat label="Закупочных листов" value={<b>{part.purchaseSheets}</b>} accent />
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">Раскладка не рассчитана</div>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {part.material ? (
                      <div className="flex justify-between text-sm">
                        <div>
                          <span className="font-medium text-gray-800">{part.material.name}</span>
                          <span className="text-gray-500"> · {part.material.format}</span>
                        </div>
                        <div className="font-mono text-gray-700">
                          {part.material.qty} {part.material.unit} × {formatMoney(part.material.price)} = <b>{formatMoney(part.material.cost)} ₽</b>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">Материал не выбран</div>
                    )}
                  </div>
                  <Warnings items={part.warnings} />
                </div>
              ))}
            </div>
          </section>

          {/* Operations */}
          <section>
            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Последовательность операций</h4>
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="p-2 text-left">№</th>
                    <th className="p-2 text-left">Часть</th>
                    <th className="p-2 text-left">Стадия</th>
                    <th className="p-2 text-left">Операция</th>
                    <th className="p-2 text-left">Оборудование</th>
                    <th className="p-2 text-right">Кол-во</th>
                    <th className="p-2 text-right">Ставка</th>
                    <th className="p-2 text-right">Приладка</th>
                    <th className="p-2 text-right">Работа</th>
                    <th className="p-2 text-right">Всего</th>
                    <th className="p-2 text-right">Станок ₽</th>
                    <th className="p-2 text-left">Расходник</th>
                    <th className="p-2 text-right">Итого ₽</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={13} className="p-4 text-center text-gray-400">Операции не выбраны</td></tr>
                  )}
                  {rows.map(r => (
                    <tr key={`${r.partId}-${r.operationId}-${r.order}`} className="border-t border-gray-100 align-top print:break-inside-avoid">
                      <td className="p-2 font-bold text-gray-500">{r.order}</td>
                      <td className="p-2 text-gray-600">{r.partName}</td>
                      <td className="p-2 text-gray-600">{STAGE_LABELS[r.stage]}</td>
                      <td className="p-2 font-medium text-gray-800">
                        {r.operationName}
                        {r.warnings.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {r.warnings.map((w, i) => (
                              <div key={i} className="text-amber-700 flex items-center gap-1"><AlertTriangle size={10} /> {w}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-gray-700">{r.equipmentName}</td>
                      <td className="p-2 text-right font-mono whitespace-nowrap">{r.count} <span className="text-gray-400">{UNIT_LABELS[r.unit]}</span></td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {r.rateUsed ? <>{r.rateUsed.perHour}/ч <span className="text-gray-400">({r.rateUsed.condition})</span></> : '—'}
                      </td>
                      <td className="p-2 text-right font-mono">{Math.round(r.setupMin)} мин</td>
                      <td className="p-2 text-right font-mono">{r.runMin.toFixed(1)} мин</td>
                      <td className="p-2 text-right font-mono font-bold">{formatMinutes(r.totalMin)}</td>
                      <td className="p-2 text-right font-mono">{formatMoney(r.machineCost)}</td>
                      <td className="p-2 text-gray-600 whitespace-nowrap">
                        {r.consumable ? <>{r.consumable.materialName}: {r.consumable.qty.toFixed(2)} {r.consumable.unit} = {formatMoney(r.consumable.cost)} ₽</> : '—'}
                      </td>
                      <td className="p-2 text-right font-mono font-bold">{formatMoney(r.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Totals */}
          <section className="grid grid-cols-2 md:grid-cols-6 gap-3 print:grid-cols-6">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-gray-400">Время</div>
              <div className="text-lg font-bold text-slate-800">{formatMinutes(totals.timeMin)}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-gray-400">Материалы</div>
              <div className="text-lg font-bold text-slate-800">{formatMoney(totals.materialsCost)} ₽</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-gray-400">Операции</div>
              <div className="text-lg font-bold text-slate-800">{formatMoney(totals.operationsCost)} ₽</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-[10px] uppercase font-bold text-blue-500">Себестоимость</div>
              <div className="text-lg font-bold text-blue-900">{formatMoney(totals.totalCost)} ₽</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-[10px] uppercase font-bold text-blue-500">На 1 шт.</div>
              <div className="text-lg font-bold text-blue-900">{formatMoney(totals.costPerItem)} ₽</div>
            </div>
            <div className={`p-3 rounded-lg border ${margin >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-[10px] uppercase font-bold text-gray-500">Цена клиента / маржа</div>
              <div className={`text-lg font-bold ${margin >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                {formatMoney(clientPrice)} ₽ <span className="text-sm font-medium">({margin.toFixed(0)}%)</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TechCardModal;
