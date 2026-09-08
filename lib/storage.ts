import { useEffect, useState } from 'react';
import { SavedTemplate } from '../types';

const PREFIX = 'printconfig:v1:';

export const storageKey = (name: string) => `${PREFIX}${name}`;

export function readStorage<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey(name));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(name: string, value: T) {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage write failed', e);
  }
}

export function usePersistedState<T>(name: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStorage(name, initial));
  useEffect(() => {
    writeStorage(name, value);
  }, [name, value]);
  return [value, setValue] as const;
}

export const generateId = () => Math.random().toString(36).substr(2, 9);

// Repository over localStorage; swap the body for Supabase later without touching components.
export const templatesRepo = {
  list(): SavedTemplate[] {
    return readStorage<SavedTemplate[]>('templates', []);
  },
  save(template: Omit<SavedTemplate, 'id' | 'created_at'> & { id?: string }): SavedTemplate {
    const all = templatesRepo.list();
    const now = new Date().toISOString();
    const existing = template.id ? all.find(t => t.id === template.id) : undefined;
    const saved: SavedTemplate = existing
      ? { ...existing, ...template, id: existing.id, updated_at: now }
      : { ...template, id: generateId(), created_at: now, updated_at: now };
    const next = existing ? all.map(t => (t.id === saved.id ? saved : t)) : [...all, saved];
    writeStorage('templates', next);
    return saved;
  },
  remove(id: string): SavedTemplate[] {
    const next = templatesRepo.list().filter(t => t.id !== id);
    writeStorage('templates', next);
    return next;
  }
};
