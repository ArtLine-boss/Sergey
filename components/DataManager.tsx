import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, Copy, Save, X, Settings, 
  MoreVertical, Search, AlertCircle, Image as ImageIcon
} from 'lucide-react';
import { DataItem, FieldSchema, FieldType } from '../types';

interface DataManagerProps {
  title: string;
  data: DataItem[];
  schema: FieldSchema[];
  onUpdateData: (newData: DataItem[]) => void;
  onUpdateSchema: (newSchema: FieldSchema[]) => void;
}

export const DataManager: React.FC<DataManagerProps> = ({
  title,
  data,
  schema,
  onUpdateData,
  onUpdateSchema
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<DataItem | null>(null);

  // --- CRUD Operations ---

  const handleDelete = (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот элемент?')) {
      onUpdateData(data.filter(item => item.id !== id));
    }
  };

  const handleCopy = (item: DataItem) => {
    const newItem = { 
      ...item, 
      id: Math.random().toString(36).substr(2, 9),
      name: `${item.name} (Копия)`
    };
    onUpdateData([...data, newItem]);
  };

  const handleEdit = (item: DataItem) => {
    setCurrentItem({ ...item });
    setIsEditModalOpen(true);
  };

  const handleAddNew = () => {
    const newItem: DataItem = { id: Math.random().toString(36).substr(2, 9) };
    schema.forEach(field => {
      newItem[field.key] = field.defaultValue || '';
      if (field.type === 'number') newItem[field.key] = 0;
    });
    setCurrentItem(newItem);
    setIsEditModalOpen(true);
  };

  const handleSaveItem = () => {
    if (!currentItem) return;
    
    // Simple validation
    const missingFields = schema
      .filter(f => f.required && !currentItem[f.key] && currentItem[f.key] !== 0)
      .map(f => f.label);

    if (missingFields.length > 0) {
      alert(`Пожалуйста, заполните обязательные поля: ${missingFields.join(', ')}`);
      return;
    }

    const index = data.findIndex(i => i.id === currentItem.id);
    if (index >= 0) {
      const newData = [...data];
      newData[index] = currentItem;
      onUpdateData(newData);
    } else {
      onUpdateData([...data, currentItem]);
    }
    setIsEditModalOpen(false);
  };

  // --- Schema Operations ---

  const [tempSchema, setTempSchema] = useState<FieldSchema[]>([]);

  const openSchemaEditor = () => {
    setTempSchema(JSON.parse(JSON.stringify(schema)));
    setIsSchemaModalOpen(true);
  };

  const addSchemaField = () => {
    setTempSchema([
      ...tempSchema, 
      { 
        key: `field_${Math.random().toString(36).substr(2, 5)}`, 
        label: 'Новое поле', 
        type: 'text', 
        required: false 
      }
    ]);
  };

  const removeSchemaField = (index: number) => {
    const field = tempSchema[index];
    if (field.isSystem) {
      alert('Системные поля нельзя удалять');
      return;
    }
    const newSchema = [...tempSchema];
    newSchema.splice(index, 1);
    setTempSchema(newSchema);
  };

  const updateSchemaField = (index: number, key: keyof FieldSchema, value: any) => {
    const newSchema = [...tempSchema];
    newSchema[index] = { ...newSchema[index], [key]: value };
    setTempSchema(newSchema);
  };

  const saveSchema = () => {
    onUpdateSchema(tempSchema);
    setIsSchemaModalOpen(false);
  };

  // --- Rendering ---

  const filteredData = data.filter(item => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-6 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        <div className="flex gap-2">
           <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400"/>
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск..."
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 outline-none bg-white text-gray-700 w-64"
            />
          </div>
          <button 
            onClick={openSchemaEditor}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm font-medium"
          >
            <Settings size={16} /> Настроить поля
          </button>
          <button 
            onClick={handleAddNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            <Plus size={16} /> Добавить
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
              <tr>
                {schema.map(field => (
                  <th key={field.key} className="p-4 border-b border-gray-200">{field.label}</th>
                ))}
                <th className="p-4 border-b border-gray-200 w-24 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={schema.length + 1} className="p-8 text-center text-gray-400">
                    Элементы не найдены
                  </td>
                </tr>
              ) : (
                filteredData.map(item => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition-colors border-b border-gray-100 last:border-0">
                    {schema.map(field => (
                      <td key={field.key} className="p-4 text-gray-700">
                        {field.type === 'image' ? (
                          item[field.key] ? (
                            <img src={item[field.key]} alt="" className="w-10 h-10 object-cover rounded border border-gray-200" />
                          ) : <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-300"><ImageIcon size={16}/></div>
                        ) : field.key === 'price' ? (
                           <span className="font-mono font-medium text-green-700">{item[field.key]} ₽</span>
                        ) : (
                          <div className="max-w-[200px] truncate" title={String(item[field.key])}>
                            {item[field.key]}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleCopy(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Копировать">
                          <Copy size={16} />
                        </button>
                        <button onClick={() => handleEdit(item)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded" title="Редактировать">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Удалить">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Item Modal */}
      {isEditModalOpen && currentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">
                {currentItem.id && data.some(i => i.id === currentItem.id) ? 'Редактирование' : 'Создание'}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {schema.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === 'text' || field.type === 'image' || field.type === 'color' ? (
                     <input
                      type={field.type === 'color' ? 'color' : 'text'}
                      value={currentItem[field.key] || ''}
                      onChange={(e) => setCurrentItem({ ...currentItem, [field.key]: e.target.value })}
                      className={`w-full border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all bg-white text-gray-700 ${field.type === 'color' ? 'h-10 cursor-pointer' : 'border-gray-300'}`}
                      placeholder={field.type === 'image' ? 'https://...' : ''}
                    />
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      value={currentItem[field.key] || 0}
                      onChange={(e) => setCurrentItem({ ...currentItem, [field.key]: parseFloat(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all bg-white text-gray-700"
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium">
                Отмена
              </button>
              <button onClick={handleSaveItem} className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium shadow-sm">
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema Editor Modal */}
      {isSchemaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Settings size={18} /> Настройка полей таблицы
              </h3>
              <button onClick={() => setIsSchemaModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-3">
                {tempSchema.map((field, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Название поля</label>
                      <input
                        value={field.label}
                        onChange={(e) => updateSchemaField(index, 'label', e.target.value)}
                        className="w-full border border-gray-300 rounded p-1.5 text-sm bg-white text-gray-700"
                      />
                    </div>
                    <div className="w-1/4">
                       <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Тип</label>
                       <select
                        value={field.type}
                        onChange={(e) => updateSchemaField(index, 'type', e.target.value)}
                        disabled={field.isSystem}
                        className="w-full border border-gray-300 rounded p-1.5 text-sm bg-white text-gray-700"
                       >
                         <option value="text">Текст</option>
                         <option value="number">Число</option>
                         <option value="image">Картинка</option>
                         <option value="color">Цвет</option>
                       </select>
                    </div>
                     <div className="w-1/4">
                       <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Ключ (ID)</label>
                        <input
                        value={field.key}
                        disabled={true}
                        className="w-full border border-gray-200 bg-gray-100 text-gray-400 rounded p-1.5 text-sm font-mono"
                      />
                    </div>
                    <button 
                      onClick={() => removeSchemaField(index)}
                      disabled={field.isSystem}
                      className={`mt-6 p-2 rounded ${field.isSystem ? 'text-gray-300 cursor-not-allowed' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={addSchemaField}
                className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Plus size={16} /> Добавить новое поле
              </button>
            </div>

             <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setIsSchemaModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium">
                Отмена
              </button>
              <button onClick={saveSchema} className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium shadow-sm">
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
