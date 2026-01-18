
import React from 'react';
import { WordEntry } from '../types';

interface WordCardProps {
  entry: WordEntry;
  onDelete: (id: string) => void;
}

const WordCard: React.FC<WordCardProps> = ({ entry, onDelete }) => {
  const mastery = entry.masteryCount || 0;
  
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border-b-4 border-blue-100 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex-1">
        <h3 className="text-xl font-bold text-blue-600 capitalize">{entry.english}</h3>
        <p className="text-gray-500 text-lg">{entry.russian}</p>
        <div className="flex gap-1 mt-2">
           {[1, 2, 3].map(i => (
             <span key={i} className={`text-xs ${mastery >= i ? 'grayscale-0 opacity-100' : 'grayscale opacity-30'}`}>
               ⭐
             </span>
           ))}
        </div>
      </div>
      <button 
        onClick={() => onDelete(entry.id)}
        className="text-red-200 hover:text-red-500 transition-colors p-2"
        aria-label="Remove word"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
};

export default WordCard;
