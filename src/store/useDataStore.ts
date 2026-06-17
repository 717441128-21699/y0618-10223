import { create } from 'zustand';
import type { DataFile, CompareGroup } from '@/types';

interface DataState {
  files: DataFile[];
  selectedFileId: string | null;
  compareGroups: CompareGroup[];
  activeCompareGroupId: string | null;
  
  addFile: (file: DataFile) => void;
  addFiles: (files: DataFile[]) => void;
  removeFile: (id: string) => void;
  setSelectedFile: (id: string | null) => void;
  getFileById: (id: string) => DataFile | undefined;
  getFilesByType: (type: DataFile['type']) => DataFile[];
  
  addCompareGroup: (group: CompareGroup) => void;
  removeCompareGroup: (id: string) => void;
  setActiveCompareGroup: (id: string | null) => void;
  updateCompareGroup: (id: string, updates: Partial<CompareGroup>) => void;
  updateFileMetadata: (id: string, metadata: Record<string, any>) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  files: [],
  selectedFileId: null,
  compareGroups: [],
  activeCompareGroupId: null,

  addFile: (file) => set((state) => ({
    files: [...state.files, file],
    selectedFileId: state.selectedFileId || file.id,
  })),

  addFiles: (newFiles) => set((state) => ({
    files: [...state.files, ...newFiles],
    selectedFileId: state.selectedFileId || newFiles[0]?.id || null,
  })),

  removeFile: (id) => set((state) => {
    const newFiles = state.files.filter((f) => f.id !== id);
    const newSelectedId = state.selectedFileId === id
      ? (newFiles[0]?.id || null)
      : state.selectedFileId;
    return {
      files: newFiles,
      selectedFileId: newSelectedId,
    };
  }),

  setSelectedFile: (id) => set({ selectedFileId: id }),

  getFileById: (id) => get().files.find((f) => f.id === id),

  getFilesByType: (type) => get().files.filter((f) => f.type === type),

  addCompareGroup: (group) => set((state) => ({
    compareGroups: [...state.compareGroups, group],
    activeCompareGroupId: state.activeCompareGroupId || group.id,
  })),

  removeCompareGroup: (id) => set((state) => {
    const newGroups = state.compareGroups.filter((g) => g.id !== id);
    return {
      compareGroups: newGroups,
      activeCompareGroupId: state.activeCompareGroupId === id
        ? (newGroups[0]?.id || null)
        : state.activeCompareGroupId,
    };
  }),

  setActiveCompareGroup: (id) => set({ activeCompareGroupId: id }),

  updateCompareGroup: (id, updates) => set((state) => ({
    compareGroups: state.compareGroups.map((g) =>
      g.id === id ? { ...g, ...updates } : g
    ),
  })),

  updateFileMetadata: (id, metadata) => set((state) => ({
    files: state.files.map((f) =>
      f.id === id ? { ...f, metadata: { ...f.metadata, ...metadata } } : f
    ),
  })),
}));
