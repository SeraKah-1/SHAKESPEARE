'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, ChevronLeft, ChevronRight, Settings, Book, Database, Activity, CheckCircle2, CircleDashed, AlertCircle, Save, Edit2, X, Check, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Types
type Model = { provider: string; model_id: string };
type ConfigRole = { primary: Model; fallback: Model; prompt: string; revision_prompt?: string };
type Config = {
  architect: ConfigRole;
  wordsmith: ConfigRole;
  critic: ConfigRole;
  lorekeeper: ConfigRole;
};
type Memory = {
  story_context: string;
  characters: {name: string, description: string}[];
  events: string[];
  chapters: string[];
};

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isLocal = id === 'local';
  const router = useRouter();

  // Layout State
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);

  // Story Metadata
  const [storyTitle, setStoryTitle] = useState('Local Memory');
  const [isSavingStory, setIsSavingStory] = useState(false);

  // Reader & Memory State
  const [memory, setMemory] = useState<Memory>({ story_context: '', characters: [], events: [], chapters: [] });
  const [choices, setChoices] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const endOfStoryRef = useRef<HTMLDivElement>(null);

  // Editing States
  const [editingChapter, setEditingChapter] = useState<number | null>(null);
  const [chapterEditContent, setChapterEditContent] = useState('');
  
  const [editingLore, setEditingLore] = useState<'context' | 'characters' | 'events' | null>(null);
  const [loreEditContent, setLoreEditContent] = useState('');

  // Settings State
  const [models, setModels] = useState<Model[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  // Telemetry State
  const [logs, setLogs] = useState<{time: string, message: string, type: string}[]>([]);
  const [agentStatus, setAgentStatus] = useState<Record<string, {status: string, score?: number}>>({
    architect: { status: 'idle' },
    wordsmith: { status: 'idle' },
    critic: { status: 'idle' },
    lorekeeper: { status: 'idle' }
  });
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Initial Load
  useEffect(() => {
    if (isLocal) {
      fetch('/api/memory')
        .then(res => res.json())
        .then(data => {
          setMemory(data);
        })
        .catch(err => console.error('Failed to load memory', err));
    } else {
      // Fetch from Supabase endpoints
      Promise.all([
        fetch(`/api/stories/${id}`).then(res => res.json()),
        fetch(`/api/stories/${id}/chapters`).then(res => res.json())
      ]).then(([storyData, chaptersData]) => {
        if (storyData.story) {
          setStoryTitle(storyData.story.title || 'Untitled Story');
          if (storyData.story.ai_memory_state) {
            const mem = storyData.story.ai_memory_state;
            if (chaptersData.chapters) {
              mem.chapters = chaptersData.chapters.map((c: any) => c.content);
            } else {
              mem.chapters = [];
            }
            setMemory(mem);
          }
        }
      }).catch(err => console.error('Failed to load story from Supabase', err));
    }

    Promise.all([
      fetch('/api/models').then(res => res.json()),
      fetch('/api/config').then(res => res.json())
    ]).then(([modelsData, configData]) => {
      setModels(modelsData.models || []);
      setConfig(configData);
    }).catch(err => console.error('Failed to load settings', err));
  }, [id, isLocal]);

  // Auto-scroll
  useEffect(() => {
    if (endOfStoryRef.current && !editingChapter) endOfStoryRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [memory.chapters, isGenerating, editingChapter]);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message: string, type: string = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message, type }]);
  };

  const saveMemory = async (newMemory: Memory) => {
    setIsSavingStory(true);
    try {
      if (isLocal) {
        await fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMemory),
        });
      } else {
        // Save to Supabase
        const memoryStateToSave = { ...newMemory };
        delete (memoryStateToSave as any).chapters; // Chapters are saved separately
        
        await fetch(`/api/stories/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ai_memory_state: memoryStateToSave }),
        });
        
        // Note: Editing chapters directly in Supabase would require a separate endpoint
        // For now, we only update the memory state (context, characters, events)
      }
      setMemory(newMemory);
    } catch (err) {
      console.error('Failed to save memory', err);
    } finally {
      setIsSavingStory(false);
    }
  };

  const handleDeleteChapter = async (chapterIndex: number) => {
    if (!confirm(`Are you sure you want to delete Chapter ${chapterIndex + 1}? This action cannot be undone.`)) return;
    
    try {
      if (isLocal) {
        const newMemory = { ...memory };
        newMemory.chapters.splice(chapterIndex, 1);
        await saveMemory(newMemory);
      } else {
        const res = await fetch(`/api/stories/${id}/chapters/${chapterIndex + 1}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success && data.newMemory) {
          // Update local memory state
          const newMemory = { ...memory, ...data.newMemory };
          newMemory.chapters.splice(chapterIndex, 1);
          setMemory(newMemory);
        } else {
          alert(`Error deleting chapter: ${data.error || 'Unknown error'}`);
        }
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveChapter = async (idx: number) => {
    const newChapters = [...memory.chapters];
    newChapters[idx] = chapterEditContent;
    
    if (!isLocal) {
      try {
        await fetch(`/api/stories/${id}/chapters/${idx + 1}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: chapterEditContent }),
        });
      } catch (err) {
        console.error('Failed to update chapter in Supabase', err);
      }
    }
    
    saveMemory({ ...memory, chapters: newChapters });
    setEditingChapter(null);
  };

  const handleSaveLore = () => {
    if (!editingLore) return;
    let newMemory = { ...memory };
    try {
      if (editingLore === 'context') {
        newMemory.story_context = loreEditContent;
      } else if (editingLore === 'characters') {
        newMemory.characters = JSON.parse(loreEditContent);
      } else if (editingLore === 'events') {
        newMemory.events = JSON.parse(loreEditContent);
      }
      saveMemory(newMemory);
      setEditingLore(null);
    } catch (e) {
      alert('Format JSON tidak valid! Pastikan format array object benar.');
    }
  };

  const handleChoice = async (choice: string) => {
    if (!choice.trim() || isGenerating) return;
    
    setIsGenerating(true);
    setCustomInput('');
    setChoices([]);
    setAgentStatus({
      architect: { status: 'idle' },
      wordsmith: { status: 'idle' },
      critic: { status: 'idle' },
      lorekeeper: { status: 'idle' }
    });
    setLogs([]); // Clear logs for new generation

    try {
      const payload = {
        userChoice: choice,
        storyId: isLocal ? undefined : id,
        memory: {
          story_context: memory.story_context,
          characters: memory.characters,
          events: memory.events,
          chapters: memory.chapters
        }
      };

      const res = await fetch('/api/generate_chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalDraft = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'log') {
                  addLog(data.message);
                } else if (data.type === 'status') {
                  setAgentStatus(prev => ({
                    ...prev,
                    [data.agent]: { status: data.status, score: data.score }
                  }));
                } else if (data.type === 'done') {
                  finalDraft = data.draft;
                  setChoices(data.choices || []);
                  setAgentStatus({
                    architect: { status: 'done' },
                    wordsmith: { status: 'done' },
                    critic: { status: 'done' },
                    lorekeeper: { status: 'done' }
                  });
                  addLog('Proses selesai.', 'success');
                } else if (data.type === 'error') {
                  addLog(`Error: ${data.message}`, 'error');
                }
              } catch (e) {
                console.error('Error parsing SSE:', e);
              }
            }
          }
        }
      }

      if (finalDraft) {
        // Refresh memory to get the latest state including new lore
        const memRes = await fetch('/api/memory');
        const memData = await memRes.json();
        setMemory(memData);
      }
    } catch (err: any) {
      console.error('Error:', err);
      addLog(`System Error: ${err.message}`, 'error');
    }
    
    setIsGenerating(false);
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setSaveMessage('Config saved');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage('Failed to save');
      }
    } catch (err) {
      setSaveMessage('Error saving');
    }
    setIsSaving(false);
  };

  const updateConfigModel = (role: keyof Config, type: 'primary' | 'fallback', provider: string, model_id: string) => {
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [role]: {
          ...prev[role],
          [type]: { provider, model_id }
        }
      };
    });
  };

  const updateConfigPrompt = (role: keyof Config, promptType: 'prompt' | 'revision_prompt', value: string) => {
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [role]: {
          ...prev[role],
          [promptType]: value
        }
      };
    });
  };

  const renderAgentStatusIcon = (status: string) => {
    if (status === 'idle') return <CircleDashed size={16} className="text-zinc-600" />;
    if (status === 'done' || status === 'reviewed') return <CheckCircle2 size={16} className="text-emerald-400" />;
    if (status === 'revising') return <AlertCircle size={16} className="text-rose-500 animate-pulse" />;
    return <Loader2 size={16} className="text-indigo-400 animate-spin" />;
  };

  const providers = Array.from(new Set(models.map(m => m.provider)));

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-zinc-950">
      
      {/* TOP BAR */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="text-zinc-400 hover:text-white flex items-center gap-1 text-sm transition-colors">
            <ChevronLeft size={16} /> Back to Library
          </button>
          <div className="h-4 w-px bg-zinc-700"></div>
          <h1 className="text-zinc-200 font-medium">{storyTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => saveMemory(memory)} 
            disabled={isSavingStory}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSavingStory ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isSavingStory ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANE: The Lore Explorer */}
        <div className={`flex flex-col bg-zinc-900 border-r border-zinc-800 transition-all duration-300 ease-in-out ${isLeftOpen ? 'w-1/4 min-w-[300px]' : 'w-0 overflow-hidden opacity-0'}`}>
        <div className="p-4 border-b border-zinc-800 flex items-center space-x-2 text-zinc-300 font-medium">
          <Book size={18} className="text-emerald-500" />
          <span>The Lore Explorer</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {/* Story Context */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center space-x-2">
                <Database size={14} />
                <span>Story Context</span>
              </h3>
              <button onClick={() => { setEditingLore('context'); setLoreEditContent(memory.story_context); }} className="text-zinc-500 hover:text-emerald-400"><Edit2 size={12} /></button>
            </div>
            {editingLore === 'context' ? (
              <div className="space-y-2">
                <textarea value={loreEditContent} onChange={e => setLoreEditContent(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-300 h-24 custom-scrollbar focus:outline-none focus:border-indigo-500" />
                <div className="flex justify-end space-x-2">
                  <button onClick={() => setEditingLore(null)} className="text-zinc-500 hover:text-rose-400"><X size={14}/></button>
                  <button onClick={handleSaveLore} className="text-zinc-500 hover:text-emerald-400"><Check size={14}/></button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400">
                {memory.story_context || 'Belum ada konteks.'}
              </div>
            )}
          </div>

          {/* Characters */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center space-x-2">
                <Database size={14} />
                <span>Characters</span>
              </h3>
              <button onClick={() => { setEditingLore('characters'); setLoreEditContent(JSON.stringify(memory.characters, null, 2)); }} className="text-zinc-500 hover:text-emerald-400"><Edit2 size={12} /></button>
            </div>
            {editingLore === 'characters' ? (
              <div className="space-y-2">
                <textarea value={loreEditContent} onChange={e => setLoreEditContent(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-300 h-32 custom-scrollbar font-mono focus:outline-none focus:border-indigo-500" />
                <div className="flex justify-end space-x-2">
                  <button onClick={() => setEditingLore(null)} className="text-zinc-500 hover:text-rose-400"><X size={14}/></button>
                  <button onClick={handleSaveLore} className="text-zinc-500 hover:text-emerald-400"><Check size={14}/></button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 space-y-2">
                {memory.characters.length === 0 ? 'Belum ada karakter.' : memory.characters.map((c, i) => (
                  <div key={i}><span className="font-semibold text-zinc-300">{c.name}:</span> {c.description}</div>
                ))}
              </div>
            )}
          </div>

          {/* Events */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center space-x-2">
                <Database size={14} />
                <span>Past Events</span>
              </h3>
              <button onClick={() => { setEditingLore('events'); setLoreEditContent(JSON.stringify(memory.events, null, 2)); }} className="text-zinc-500 hover:text-emerald-400"><Edit2 size={12} /></button>
            </div>
            {editingLore === 'events' ? (
              <div className="space-y-2">
                <textarea value={loreEditContent} onChange={e => setLoreEditContent(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-300 h-32 custom-scrollbar font-mono focus:outline-none focus:border-indigo-500" />
                <div className="flex justify-end space-x-2">
                  <button onClick={() => setEditingLore(null)} className="text-zinc-500 hover:text-rose-400"><X size={14}/></button>
                  <button onClick={handleSaveLore} className="text-zinc-500 hover:text-emerald-400"><Check size={14}/></button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400">
                <ul className="list-disc pl-4 space-y-1">
                  {memory.events.length === 0 ? 'Belum ada kejadian.' : memory.events.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Chapters</h3>
            <div className="space-y-1">
              {memory.chapters.map((_, idx) => (
                <div key={idx} className="flex items-center justify-between w-full px-3 py-2 rounded-md hover:bg-zinc-800 transition-colors group">
                  <button className="text-sm text-zinc-400 group-hover:text-zinc-100 transition-colors text-left flex-1">
                    Bab {idx + 1}
                  </button>
                  <button 
                    onClick={() => handleDeleteChapter(idx)}
                    className="text-zinc-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-500/10"
                    title="Delete Chapter"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {memory.chapters.length === 0 && <div className="text-sm text-zinc-600 italic px-3">Belum ada bab.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER PANE: The Zen Reader */}
      <div className="flex-1 flex flex-col bg-[#121212] relative">
        {/* Top Bar for Toggles */}
        <div className="absolute top-4 left-4 z-10">
          <button onClick={() => setIsLeftOpen(!isLeftOpen)} className="p-2 rounded-md bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors backdrop-blur-sm">
            {isLeftOpen ? <ChevronLeft size={18} /> : <Book size={18} />}
          </button>
        </div>
        <div className="absolute top-4 right-4 z-10">
          <button onClick={() => setIsRightOpen(!isRightOpen)} className="p-2 rounded-md bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors backdrop-blur-sm flex items-center space-x-2">
            <Settings size={18} />
            {!isRightOpen && <span className="text-xs font-medium pr-1">God Mode</span>}
          </button>
        </div>

        {/* Reader Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-12 md:py-20">
          <div className="max-w-[720px] mx-auto w-full">
            {memory.chapters.length === 0 ? (
              <div className="text-center text-zinc-600 italic mt-32 font-serif text-lg">
                Kertas digital ini masih kosong. Silakan mulai ceritamu di bawah.
              </div>
            ) : (
              memory.chapters.map((chapter, idx) => (
                <div key={idx} className="mb-16 animate-in fade-in duration-1000 relative group">
                  <div className="absolute -left-12 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingChapter(idx); setChapterEditContent(chapter); }} className="p-2 text-zinc-500 hover:text-emerald-400 bg-zinc-900 rounded-full border border-zinc-800">
                      <Edit2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-center mb-10 opacity-30">
                    <div className="h-px bg-zinc-700 flex-1"></div>
                    <span className="px-6 text-zinc-400 text-xs font-sans uppercase tracking-[0.2em]">Bab {idx + 1}</span>
                    <div className="h-px bg-zinc-700 flex-1"></div>
                  </div>
                  
                  {editingChapter === idx ? (
                    <div className="space-y-4">
                      <textarea 
                        value={chapterEditContent} 
                        onChange={e => setChapterEditContent(e.target.value)} 
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-zinc-300 font-serif text-[16px] leading-[1.8] min-h-[400px] custom-scrollbar focus:outline-none focus:border-indigo-500/50" 
                      />
                      <div className="flex justify-end space-x-3">
                        <button onClick={() => setEditingChapter(null)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800">Cancel</button>
                        <button onClick={() => handleSaveChapter(idx)} className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white">Save Changes</button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-invert prose-zinc max-w-none font-serif text-[18px] leading-[1.8] text-[#EAEAEA]">
                      <ReactMarkdown>{chapter}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isGenerating && (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-600 animate-pulse">
                <Loader2 className="animate-spin mb-4 text-indigo-500/50" size={24} />
                <p className="font-sans text-xs tracking-widest uppercase">The AI is weaving the next thread...</p>
              </div>
            )}
            <div ref={endOfStoryRef} />

            {/* The Intersection */}
            {!isGenerating && memory.chapters.length > 0 && (
              <div className="mt-16 pt-12 border-t border-zinc-800/50">
                <h4 className="text-xs font-sans text-zinc-500 uppercase tracking-widest mb-6 text-center">Architect&apos;s Propositions</h4>
                <div className="grid grid-cols-1 gap-4 mb-8">
                  {choices.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChoice(choice)}
                      className="text-left px-6 py-4 bg-zinc-900/30 border border-zinc-800/50 hover:border-indigo-500/50 hover:bg-zinc-900/80 rounded-xl transition-all duration-300 text-zinc-300 font-sans text-sm group"
                    >
                      <span className="text-indigo-400/50 group-hover:text-indigo-400 mr-3 font-mono text-xs">{(idx + 1).toString().padStart(2, '0')}</span>
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className={`mt-8 ${memory.chapters.length === 0 ? 'mt-32' : ''}`}>
              <div className="relative group">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChoice(customInput)}
                  placeholder={memory.chapters.length === 0 ? "Mulai cerita dengan..." : "Or command your own fate..."}
                  disabled={isGenerating}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-6 pr-14 py-4 text-zinc-200 font-sans text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-zinc-900 transition-all disabled:opacity-50 placeholder:text-zinc-600"
                />
                <button
                  onClick={() => handleChoice(customInput)}
                  disabled={isGenerating || !customInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-indigo-400 disabled:opacity-50 transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: The AI Control Room */}
      <div className={`flex flex-col bg-zinc-900 border-l border-zinc-800 transition-all duration-300 ease-in-out ${isRightOpen ? 'w-[30%] min-w-[350px]' : 'w-0 overflow-hidden opacity-0'}`}>
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between text-zinc-300 font-medium">
          <div className="flex items-center space-x-2">
            <Activity size={18} className="text-indigo-400" />
            <span>AI Telemetry</span>
          </div>
          <button onClick={() => setIsRightOpen(false)} className="text-zinc-500 hover:text-zinc-300">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {/* Agent Status Pipeline */}
          <div className="p-5 border-b border-zinc-800/50 bg-zinc-950/20">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-4">Pipeline Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  {renderAgentStatusIcon(agentStatus.architect.status)}
                  <span className={agentStatus.architect.status !== 'idle' ? 'text-zinc-200' : 'text-zinc-500'}>Architect Planning</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  {renderAgentStatusIcon(agentStatus.wordsmith.status)}
                  <span className={agentStatus.wordsmith.status !== 'idle' ? 'text-zinc-200' : 'text-zinc-500'}>Wordsmith Drafting</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  {renderAgentStatusIcon(agentStatus.critic.status)}
                  <span className={agentStatus.critic.status !== 'idle' ? 'text-zinc-200' : 'text-zinc-500'}>
                    Critic Reviewing
                    {agentStatus.critic.score && <span className="ml-2 text-emerald-400/80">({agentStatus.critic.score}/10)</span>}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  {renderAgentStatusIcon(agentStatus.lorekeeper.status)}
                  <span className={agentStatus.lorekeeper.status !== 'idle' ? 'text-zinc-200' : 'text-zinc-500'}>Lorekeeper Archiving</span>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Accordion */}
          <div className="p-5 border-b border-zinc-800/50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Model Configuration</h3>
              <button 
                onClick={handleSaveConfig} 
                disabled={isSaving || !config}
                className="text-xs flex items-center space-x-1 text-emerald-500 hover:text-emerald-400 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                <span>{saveMessage || 'Save'}</span>
              </button>
            </div>
            
            {config ? (
              <div className="space-y-2">
                {(['architect', 'wordsmith', 'critic', 'lorekeeper'] as const).map((role) => (
                  <div key={role} className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50">
                    <button 
                      onClick={() => setOpenAccordion(openAccordion === role ? null : role)}
                      className="w-full px-4 py-3 flex justify-between items-center text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
                    >
                      <span className="capitalize font-medium">{role}</span>
                      <span className="text-xs text-zinc-500 font-mono">{config[role].primary.provider}</span>
                    </button>
                    
                    {openAccordion === role && (
                      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 space-y-4">
                        {/* Primary Model */}
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Primary Model</label>
                          <div className="flex space-x-2">
                            <select 
                              value={providers.includes(config[role].primary.provider) ? config[role].primary.provider : ''}
                              onChange={(e) => {
                                const newProv = e.target.value;
                                const firstModel = models.find(m => m.provider === newProv)?.model_id || '';
                                updateConfigModel(role, 'primary', newProv, firstModel);
                              }}
                              disabled={models.length === 0}
                              className="w-1/3 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            >
                              {models.length === 0 ? <option value="">Loading...</option> : (
                                <>
                                  {!providers.includes(config[role].primary.provider) && <option value="">Select...</option>}
                                  {providers.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                                </>
                              )}
                            </select>
                            <select
                              value={models.some(m => m.model_id === config[role].primary.model_id) ? config[role].primary.model_id : ''}
                              onChange={(e) => updateConfigModel(role, 'primary', config[role].primary.provider, e.target.value)}
                              disabled={models.length === 0 || !providers.includes(config[role].primary.provider)}
                              className="w-2/3 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            >
                              {models.length === 0 ? <option value="">Loading...</option> : (
                                <>
                                  {!models.some(m => m.model_id === config[role].primary.model_id) && <option value="">Select Model...</option>}
                                  {models.filter(m => m.provider === config[role].primary.provider).map(m => (
                                    <option key={m.model_id} value={m.model_id}>{m.model_id}</option>
                                  ))}
                                </>
                              )}
                            </select>
                          </div>
                        </div>

                        {/* Fallback Model */}
                        <div>
                          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Fallback Model</label>
                          <div className="flex space-x-2">
                            <select 
                              value={providers.includes(config[role].fallback.provider) ? config[role].fallback.provider : ''}
                              onChange={(e) => {
                                const newProv = e.target.value;
                                const firstModel = models.find(m => m.provider === newProv)?.model_id || '';
                                updateConfigModel(role, 'fallback', newProv, firstModel);
                              }}
                              disabled={models.length === 0}
                              className="w-1/3 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            >
                              {models.length === 0 ? <option value="">Loading...</option> : (
                                <>
                                  {!providers.includes(config[role].fallback.provider) && <option value="">Select...</option>}
                                  {providers.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                                </>
                              )}
                            </select>
                            <select
                              value={models.some(m => m.model_id === config[role].fallback.model_id) ? config[role].fallback.model_id : ''}
                              onChange={(e) => updateConfigModel(role, 'fallback', config[role].fallback.provider, e.target.value)}
                              disabled={models.length === 0 || !providers.includes(config[role].fallback.provider)}
                              className="w-2/3 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            >
                              {models.length === 0 ? <option value="">Loading...</option> : (
                                <>
                                  {!models.some(m => m.model_id === config[role].fallback.model_id) && <option value="">Select Model...</option>}
                                  {models.filter(m => m.provider === config[role].fallback.provider).map(m => (
                                    <option key={m.model_id} value={m.model_id}>{m.model_id}</option>
                                  ))}
                                </>
                              )}
                            </select>
                          </div>
                        </div>

                        {/* Custom Prompts */}
                        <div className="pt-2 border-t border-zinc-800">
                          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">System Prompt</label>
                          <textarea
                            value={config[role].prompt || ''}
                            onChange={(e) => updateConfigPrompt(role, 'prompt', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-300 h-32 custom-scrollbar focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        {role === 'wordsmith' && (
                          <div>
                            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Revision Prompt</label>
                            <textarea
                              value={config[role].revision_prompt || ''}
                              onChange={(e) => updateConfigPrompt(role, 'revision_prompt', e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-300 h-24 custom-scrollbar focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-zinc-500 text-center py-4">Loading config...</div>
            )}
          </div>

          {/* System Logs */}
          <div className="flex-1 flex flex-col p-5 min-h-[200px]">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">System Logs</h3>
            <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-y-auto custom-scrollbar font-mono text-[10px] leading-relaxed">
              {logs.length === 0 ? (
                <span className="text-zinc-700">Waiting for activity...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`mb-1.5 ${log.type === 'error' ? 'text-rose-500' : log.type === 'success' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    <span className="text-zinc-600 mr-2">[{log.time}]</span>
                    {log.message}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}
