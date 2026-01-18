
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { translateWord } from './services/geminiService';
import { WordEntry, WordList, UserProgress } from './types';
import WordCard from './components/WordCard';

type Mode = 'list' | 'train' | 'challenge' | 'lists_mgmt' | 'bulk_import';
type ChallengeStep = 'choice' | 'spelling';

interface ChallengeItem {
  word: WordEntry;
  direction: 'en-ru' | 'ru-en';
  options: string[];
}

const App: React.FC = () => {
  const [allLists, setAllLists] = useState<WordList[]>(() => {
    const saved = localStorage.getItem('magic_dict_all_lists');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load lists", e);
      }
    }
    return [{ id: 'default', name: 'My First Words', words: [] }];
  });

  const [activeListId, setActiveListId] = useState<string>(() => {
    const savedId = localStorage.getItem('magic_dict_active_list_id');
    return savedId || 'default';
  });

  const [progress, setProgress] = useState<UserProgress>(() => {
    const saved = localStorage.getItem('magic_dict_progress');
    if (saved) return JSON.parse(saved);
    return { streak: 0, lastDate: '', totalCorrect: 0 };
  });
  
  const [inputValue, setInputValue] = useState('');
  const [bulkInputValue, setBulkInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('list');
  
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [challengeStep, setChallengeStep] = useState<ChallengeStep>('choice');
  
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [spellingInput, setSpellingInput] = useState('');
  
  const [questItems, setQuestItems] = useState<ChallengeItem[]>([]);

  useEffect(() => {
    localStorage.setItem('magic_dict_all_lists', JSON.stringify(allLists));
  }, [allLists]);

  useEffect(() => {
    localStorage.setItem('magic_dict_active_list_id', activeListId);
  }, [activeListId]);

  useEffect(() => {
    localStorage.setItem('magic_dict_progress', JSON.stringify(progress));
  }, [progress]);

  const activeList = useMemo(() => 
    allLists.find(l => l.id === activeListId) || allLists[0], 
  [allLists, activeListId]);

  const words = activeList?.words || [];

  const startQuest = useCallback(() => {
    if (words.length < 1) {
      alert("Add words first!");
      return;
    }
    
    const items = words.map(w => {
      const direction = Math.random() > 0.5 ? 'en-ru' : 'ru-en';
      const correctAnswer = direction === 'en-ru' ? w.russian : w.english;
      const otherWords = words.filter(ow => ow.id !== w.id);
      const distractors = otherWords
        .map(ow => direction === 'en-ru' ? ow.russian : ow.english)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      const options = Array.from(new Set([correctAnswer, ...distractors])).sort(() => 0.5 - Math.random());
      return { word: w, direction, options } as ChallengeItem;
    }).sort(() => Math.random() - 0.5);

    setQuestItems(items);
    setCurrentIdx(0);
    setChallengeStep('choice');
    setIsCorrect(null);
    setSelectedOption(null);
    setSpellingInput('');
    setMode('challenge');
  }, [words]);

  const updateProgress = useCallback((isCorrectAnswer: boolean) => {
    if (!isCorrectAnswer) return;

    const today = new Date().toDateString();
    setProgress(prev => {
      let newStreak = prev.streak;
      if (prev.lastDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        newStreak = prev.lastDate === yesterday.toDateString() ? prev.streak + 1 : 1;
      }
      return {
        streak: newStreak,
        lastDate: today,
        totalCorrect: prev.totalCorrect + 1
      };
    });
  }, []);

  const handleTranslate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const word = inputValue.trim().toLowerCase();
    if (!word) return;

    if (words.some(w => w.english.toLowerCase() === word)) {
      alert(`"${word}" is already in your list!`);
      setInputValue('');
      return;
    }

    setLoading(true);
    const result = await translateWord(word);
    
    const newEntry: WordEntry = {
      id: Date.now().toString(),
      english: result.english.toLowerCase(),
      russian: result.russian.toLowerCase(),
      timestamp: Date.now(),
      masteryCount: 0
    };

    setAllLists(prev => prev.map(list => 
      list.id === activeListId ? { ...list, words: [newEntry, ...list.words] } : list
    ));
    setInputValue('');
    setLoading(false);
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInputValue.trim()) return;

    setLoading(true);
    const inputWords = Array.from(new Set(
      bulkInputValue.split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0)
    ));
    
    const wordsToImport = inputWords.filter(word => 
      !words.some(existing => existing.english.toLowerCase() === word)
    );

    if (wordsToImport.length === 0) {
      alert("All these words are already in your list!");
      setLoading(false);
      setMode('list');
      return;
    }
    
    const newEntries: WordEntry[] = [];
    for (const word of wordsToImport) {
      try {
        const result = await translateWord(word);
        newEntries.push({
          id: (Date.now() + Math.random()).toString(),
          english: result.english.toLowerCase(),
          russian: result.russian.toLowerCase(),
          timestamp: Date.now(),
          masteryCount: 0
        });
      } catch (err: unknown) { 
        // Fix for Error in file App.tsx on line 171: ensure error message is converted to string for alert or log
        console.error(String(err)); 
      }
    }

    setAllLists(prev => prev.map(list => 
      list.id === activeListId ? { ...list, words: [...newEntries, ...list.words] } : list
    ));
    setBulkInputValue('');
    setMode('list');
    setLoading(false);
  };

  const deleteWord = useCallback((id: string) => {
    setAllLists(prev => prev.map(list => 
      list.id === activeListId ? { ...list, words: list.words.filter(w => w.id !== id) } : list
    ));
  }, [activeListId]);

  const createNewList = () => {
    const nameInput = window.prompt("Enter new list name:");
    if (nameInput && nameInput.trim()) {
      const newListId = Date.now().toString();
      const newList: WordList = { id: newListId, name: nameInput.trim(), words: [] };
      setAllLists(prev => [...prev, newList]);
      setActiveListId(newListId);
      setMode('list');
    }
  };

  const deleteList = (id: string) => {
    if (allLists.length <= 1) return;
    if (confirm("Delete this entire list?")) {
      const newLists = allLists.filter(l => l.id !== id);
      setAllLists(newLists);
      if (activeListId === id) setActiveListId(newLists[0].id);
    }
  };

  const nextItem = () => {
    setShowAnswer(false);
    setIsCorrect(null);
    setSelectedOption(null);
    setSpellingInput('');
    if (challengeStep === 'spelling' || mode === 'train') {
      setChallengeStep('choice');
      setCurrentIdx((prev) => (prev + 1) % questItems.length);
    } else {
      setChallengeStep('spelling');
    }
  };

  const handleOptionClick = (option: string) => {
    if (isCorrect !== null) return;
    setSelectedOption(option);
    const current = questItems[currentIdx];
    const answer = current.direction === 'en-ru' ? current.word.russian : current.word.english;
    
    if (option.toLowerCase() === answer.toLowerCase()) {
      setIsCorrect(true);
      setTimeout(() => {
        setIsCorrect(null);
        setChallengeStep('spelling');
      }, 800);
    } else {
      setIsCorrect(false);
      setTimeout(() => setIsCorrect(null), 800);
    }
  };

  const handleSpellingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const current = questItems[currentIdx];
    const answer = current.direction === 'en-ru' ? current.word.russian : current.word.english;
    
    if (spellingInput.trim().toLowerCase() === answer.toLowerCase()) {
      setIsCorrect(true);
      updateProgress(true);
      setAllLists(prev => prev.map(l => ({
        ...l,
        words: l.words.map(w => w.id === current.word.id ? { ...w, masteryCount: (w.masteryCount || 0) + 1 } : w)
      })));
      setTimeout(nextItem, 1000);
    } else {
      setIsCorrect(false);
      setTimeout(() => setIsCorrect(null), 1000);
    }
  };

  const masteredCount = useMemo(() => words.filter(w => (w.masteryCount || 0) >= 3).length, [words]);

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col px-4 pb-8">
      <header className="py-6 text-center">
        <div className="flex justify-between items-center mb-4 px-2">
           <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm">
             <span className="text-xl">🔥</span>
             <span className="font-bold text-orange-500">{progress.streak}</span>
           </div>
           <h1 className="text-3xl font-bold text-blue-500">Magic ABC 🪄</h1>
           <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm">
             <span className="text-xl">🏆</span>
             <span className="font-bold text-yellow-500">{progress.totalCorrect}</span>
           </div>
        </div>
        
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="relative flex-1">
            <select 
              value={activeListId} 
              onChange={(e) => { setActiveListId(e.target.value); setMode('list'); }}
              className="w-full bg-white border-2 border-blue-100 rounded-xl px-3 py-2 text-blue-600 font-bold outline-none appearance-none shadow-sm"
            >
              {allLists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.words.length})</option>)}
            </select>
          </div>
          <button onClick={() => setMode('lists_mgmt')} className={`p-2 rounded-xl border-2 ${mode === 'lists_mgmt' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-400 border-blue-100'}`}>
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
        </div>

        <div className="flex justify-center flex-wrap gap-2">
          <button onClick={() => setMode('list')} className={`px-4 py-2 rounded-full font-bold transition-all text-sm ${mode === 'list' ? 'bg-blue-500 text-white shadow-md' : 'bg-white text-blue-400'}`}>My Words</button>
          <button onClick={() => { if(words.length) { setQuestItems(words.map(w => ({ word: w, direction: 'en-ru', options: [] }))); setMode('train'); setCurrentIdx(0); } else alert("Add words first!"); }} className={`px-4 py-2 rounded-full font-bold transition-all text-sm ${mode === 'train' ? 'bg-blue-500 text-white shadow-md' : 'bg-white text-blue-400'}`}>Cards 🃏</button>
          <button onClick={startQuest} className={`px-4 py-2 rounded-full font-bold transition-all text-sm ${mode === 'challenge' ? 'bg-purple-500 text-white shadow-md' : 'bg-white text-purple-400'}`}>Quest 🎯</button>
        </div>
      </header>

      {mode === 'lists_mgmt' && (
        <main className="flex-1 space-y-4">
           <button onClick={createNewList} className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl shadow-lg">+ New Collection</button>
           <div className="space-y-3">
             {allLists.map(list => (
               <div key={list.id} className={`bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border-2 ${activeListId === list.id ? 'border-blue-300' : 'border-transparent'}`}>
                 <div className="flex flex-col flex-1 cursor-pointer" onClick={() => { setActiveListId(list.id); setMode('list'); }}>
                    <span className="font-bold text-blue-600">{list.name}</span>
                    <span className="text-xs text-blue-300">{list.words.length} words</span>
                 </div>
                 <button onClick={() => deleteList(list.id)} className="text-red-300 p-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
               </div>
             ))}
           </div>
           <button onClick={() => setMode('list')} className="w-full text-blue-400 font-bold py-4 underline">Back</button>
        </main>
      )}

      {mode === 'bulk_import' && (
        <main className="flex-1 space-y-4 animate-in zoom-in duration-300">
          <div className="bg-white p-6 rounded-[32px] shadow-xl border-b-4 border-blue-100">
            <h3 className="text-xl font-bold text-blue-500 mb-2">Bulk Add Words</h3>
            <p className="text-xs text-blue-300 mb-4">Paste multiple words. Duplicates will be skipped automatically.</p>
            <form onSubmit={handleBulkImport}>
              <textarea
                value={bulkInputValue}
                onChange={(e) => setBulkInputValue(e.target.value)}
                placeholder="apple, banana, orange..."
                className="w-full h-40 px-4 py-3 rounded-2xl border-2 border-blue-50 focus:border-blue-400 outline-none text-blue-600 font-medium resize-none mb-4"
                disabled={loading}
              />
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setMode('list')} 
                  className="flex-1 py-3 text-blue-400 font-bold"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] bg-blue-500 text-white py-3 rounded-2xl font-bold shadow-md active:scale-95 disabled:opacity-50"
                  disabled={loading || !bulkInputValue.trim()}
                >
                  {loading ? 'Processing...' : 'Import Words'}
                </button>
              </div>
            </form>
          </div>
        </main>
      )}

      {mode === 'list' && (
        <>
          <div className="mb-4 bg-white p-4 rounded-2xl shadow-sm border-b-4 border-blue-50 flex items-center justify-between">
             <div className="text-blue-500 font-bold">Progress</div>
             <div className="text-blue-400 font-bold">{masteredCount} / {words.length} ⭐</div>
          </div>
          
          <section className="sticky top-4 z-10 bg-blue-500 p-4 rounded-3xl shadow-xl border-2 border-blue-400 mb-6">
            <form onSubmit={handleTranslate} className="flex gap-2">
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Type a word..." className="flex-1 px-5 py-4 rounded-2xl border-none outline-none text-lg text-white bg-blue-600 placeholder-blue-300 font-medium" disabled={loading} />
              <button type="submit" disabled={loading || !inputValue.trim()} className="bg-yellow-400 text-white font-bold p-4 rounded-2xl">
                {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'GO'}
              </button>
            </form>
          </section>

          <button 
            onClick={() => setMode('bulk_import')}
            className="w-full mb-6 bg-white border-2 border-dashed border-blue-200 text-blue-400 py-3 rounded-2xl font-bold hover:bg-blue-50 transition-colors"
          >
            + Add Many Words at Once
          </button>

          <main className="flex-1 space-y-4">
            {words.length === 0 ? <p className="text-center py-20 text-blue-300 font-bold">List is empty! 🚀</p> : words.map(w => <WordCard key={w.id} entry={w} onDelete={deleteWord} />)}
          </main>
        </>
      )}

      {mode === 'train' && (
        <main className="flex-1 flex flex-col items-center justify-center">
            <div onClick={() => setShowAnswer(!showAnswer)} className="w-full aspect-square max-w-[280px] bg-white rounded-[40px] shadow-2xl flex flex-col items-center justify-center cursor-pointer p-8 text-center border-b-8 border-blue-100">
                <span className="text-blue-300 font-bold uppercase text-xs mb-4">{showAnswer ? "Russian" : "English"}</span>
                <h2 className="text-4xl font-bold text-blue-600 capitalize">{showAnswer ? questItems[currentIdx]?.word.russian : questItems[currentIdx]?.word.english}</h2>
                {!showAnswer && <p className="text-blue-200 mt-6 animate-pulse text-sm">Tap to flip</p>}
            </div>
            <div className="mt-12 flex flex-col items-center gap-4 w-full px-8">
                <button onClick={nextItem} className="w-full bg-yellow-400 text-white py-5 rounded-3xl text-2xl font-bold">Next ➔</button>
                <p className="text-blue-300 font-bold">{currentIdx + 1} / {questItems.length}</p>
            </div>
        </main>
      )}

      {mode === 'challenge' && (
        <main className="flex-1 flex flex-col items-center justify-center py-6">
            <div className="w-full max-w-[320px] bg-white rounded-[40px] shadow-xl p-8 text-center mb-6 border-b-8 border-purple-100">
                <h2 className="text-4xl font-bold text-purple-600 capitalize mb-8">
                    {questItems[currentIdx]?.direction === 'en-ru' ? questItems[currentIdx]?.word.english : questItems[currentIdx]?.word.russian}
                </h2>
                {challengeStep === 'choice' ? (
                    <div className="grid grid-cols-1 gap-3">
                        {questItems[currentIdx]?.options.map((option, i) => (
                            <button key={i} onClick={() => handleOptionClick(option)} className={`w-full py-4 px-4 rounded-2xl text-lg font-bold border-4 transition-all ${selectedOption === option ? (isCorrect ? 'border-green-400 bg-green-50 text-green-600' : 'border-red-400 bg-red-50 text-red-600 animate-shake') : 'border-purple-50 bg-purple-50 text-purple-600'}`}>{option}</button>
                        ))}
                    </div>
                ) : (
                    <form onSubmit={handleSpellingSubmit} className="space-y-4">
                        <input type="text" value={spellingInput} onChange={(e) => { setSpellingInput(e.target.value); setIsCorrect(null); }} className={`w-full px-4 py-5 rounded-2xl text-center text-2xl font-bold border-4 outline-none transition-all ${isCorrect === true ? 'border-green-400 bg-green-50 text-green-600' : isCorrect === false ? 'border-red-400 bg-red-50 text-red-600 animate-shake' : 'border-purple-100 bg-purple-50 text-purple-600'}`} placeholder="Type it..." autoFocus />
                        <button type="submit" className="w-full bg-purple-500 text-white py-4 rounded-2xl text-xl font-bold">Submit!</button>
                    </form>
                )}
            </div>
            <button onClick={() => setMode('list')} className="text-purple-300 font-bold underline">Stop Quest</button>
            <p className="mt-4 text-purple-200 font-bold">{currentIdx + 1} / {questItems.length}</p>
            <style>{`.animate-shake { animation: shake 0.2s ease-in-out 0s 2; } @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }`}</style>
        </main>
      )}
    </div>
  );
};

export default App;
