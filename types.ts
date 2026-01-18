
export interface WordEntry {
  id: string;
  english: string;
  russian: string;
  timestamp: number;
  masteryCount?: number; // How many times it was correctly answered in spelling
}

export interface WordList {
  id: string;
  name: string;
  words: WordEntry[];
}

export interface UserProgress {
  streak: number;
  lastDate: string;
  totalCorrect: number;
}

export interface TranslationResult {
  english: string;
  russian: string;
}
