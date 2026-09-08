import React, { useState } from 'react';
import { FolderOpen, Download, Copy, Trash2, Check, FileJson } from 'lucide-react';
import { SavedTemplate } from '../types';
import { copyToClipboard, downloadJson, toPublicTemplate } from '../lib/export';

interface TemplatesListProps {
  templates: SavedTemplate[];
  activeId: string;
  onOpen: (t: SavedTemplate) => void;
  onDelete: (id: string) => void;
}

export const TemplatesList: React.FC<TemplatesListProps> = ({ templates, activeId, onOpen, onDelete }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (t: SavedTemplate) => {
    const ok = await copyToClipboard(toPublicTemplate(t));
    if (ok) {
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const handleDelete = (t: SavedTemplate) => {
    if (window.confirm(`Удалить шаблон «${t.name}»?`)) onDelete(t.id);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-6 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Сохранённые шаблоны</h2>
          <p className="text-xs text-gray-500 mt-1">
            Экспорт даёт публичный JSON для раздела «Продукция» на сайте — без себестоимости и внутренних ссылок.
          </p>
        </div>
        {templates.length > 0 && (
          <button
            onClick={() => downloadJson('шаблоны_все', templates.map(toPublicTemplate))}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm font-medium"
          >
            <Download size={16} /> Экспортировать все
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {templates.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed border-gray-300 rounded-lg text-gray-400">
            <FileJson size={40} className="mx-auto mb-3 opacity-50" />
            Шаблонов пока нет. Соберите изделие в конструкторе и нажмите «Сохранить как шаблон».
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                <tr>
                  <th className="p-4 border-b border-gray-200">Название</th>
                  <th className="p-4 border-b border-gray-200">Части</th>
                  <th className="p-4 border-b border-gray-200">Блоков</th>
                  <th className="p-4 border-b border-gray-200">Обновлён</th>
                  <th className="p-4 border-b border-gray-200 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {templates.map(t => (
                  <tr key={t.id} className={`border-b border-gray-100 last:border-0 hover:bg-blue-50/50 ${t.id === activeId ? 'bg-blue-50' : ''}`}>
                    <td className="p-4">
                      <div className="font-medium text-gray-800">{t.name}</div>
                      {t.id === activeId && <div className="text-[10px] text-blue-600 font-bold uppercase">Открыт в конструкторе</div>}
                    </td>
                    <td className="p-4 text-gray-600">
                      {(t.config.parts || []).length > 0 ? t.config.parts.map(p => p.name).join(', ') : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="p-4 text-gray-600">{t.config.blocks.length}</td>
                    <td className="p-4 text-gray-500 text-xs">{new Date(t.updated_at || t.created_at).toLocaleString('ru-RU')}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => onOpen(t)} className="px-2.5 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded flex items-center gap-1" title="Открыть в конструкторе">
                          <FolderOpen size={14} /> Открыть
                        </button>
                        <button onClick={() => downloadJson(`шаблон_${t.name}`, toPublicTemplate(t))} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Скачать JSON для сайта">
                          <Download size={16} />
                        </button>
                        <button onClick={() => handleCopy(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Копировать JSON">
                          {copiedId === t.id ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                        </button>
                        <button onClick={() => handleDelete(t)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Удалить">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatesList;
