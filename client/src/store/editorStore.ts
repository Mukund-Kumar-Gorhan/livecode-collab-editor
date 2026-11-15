import { SupportedLanguage } from '../types';

export interface EditorStoreState {
  currentLanguage: SupportedLanguage;
  activeRoomId: string | null;
  codeBuffer: string;
}

/**
 * Lightweight state container placeholder.
 * Can be migrated to Zustand / Redux Toolkit as features scale.
 */
export const initialEditorState: EditorStoreState = {
  currentLanguage: 'python',
  activeRoomId: 'demo-room',
  codeBuffer: '',
};

