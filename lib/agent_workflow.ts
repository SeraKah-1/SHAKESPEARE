import { DynamicRouter } from './llm_router';
import fs from 'fs/promises';
import path from 'path';
import { supabase } from './supabase';

const memoryPath = path.join(process.cwd(), 'memory.json');

export async function* runChapterLoopGenerator(userChoice: string, storyId?: string, providedMemory?: any) {
  const router = new DynamicRouter();
  
  // Use provided memory or fallback
  let contextData: any = providedMemory || { 
    story_context: "", 
    genre: "Sci-Fi", 
    tone: "Dark", 
    theme: "Survival",
    characters: [], 
    events: [], 
    chapters: [] 
  };
  
  const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  
  if (!providedMemory) {
    if (storyId && hasSupabase) {
      // Fetch from Supabase
      const { data, error } = await supabase.from('stories').select('ai_memory_state').eq('id', storyId).single();
      if (!error && data?.ai_memory_state) {
        contextData = { ...contextData, ...data.ai_memory_state };
      }
      // Fetch chapters
      const { data: chaptersData } = await supabase.from('chapters').select('content').eq('story_id', storyId).order('chapter_number', { ascending: true });
      if (chaptersData) {
        contextData.chapters = chaptersData.map((c: any) => c.content);
      }
    } else {
      // Fallback to memory.json
      try {
        const memoryData = await fs.readFile(memoryPath, 'utf-8');
        contextData = JSON.parse(memoryData);
      } catch (e) {
        // Ignore if file doesn't exist
      }
    }
  }

  const configData = await router.getConfig();

  const nextChapterNumber = (contextData.chapters?.length || 0) + 1;

  yield { type: 'log', message: `Memulai proses generasi Bab ${nextChapterNumber}...` };
  yield { type: 'status', agent: 'architect', status: 'planning' };
  yield { type: 'log', message: 'Architect sedang menyusun outline plot...' };

  const architectPrompt = (configData.architect.prompt || '')
    .replace(/{{NEXT_CHAPTER}}/g, nextChapterNumber.toString())
    .replace(/{{GENRE}}/g, contextData.genre || 'Fiksi')
    .replace(/{{THEME}}/g, contextData.theme || 'Universal')
    .replace(/{{LORE_CONTEXT}}/g, contextData.story_context || '')
    .replace('{{CHARACTERS}}', JSON.stringify(contextData.characters || []))
    .replace('{{EVENTS}}', JSON.stringify(contextData.events || []))
    .replace('{{USER_CHOICE}}', userChoice);

  const outline = await router.generate('architect', architectPrompt);
  yield { type: 'log', message: 'Architect selesai menyusun outline.' };

  yield { type: 'status', agent: 'wordsmith', status: 'drafting' };
  yield { type: 'log', message: 'Wordsmith sedang menulis draf bab...' };
  
  const wordsmithPrompt = (configData.wordsmith.prompt || '')
    .replace(/{{NEXT_CHAPTER}}/g, nextChapterNumber.toString())
    .replace(/{{GENRE}}/g, contextData.genre || 'Fiksi')
    .replace(/{{TONE}}/g, contextData.tone || 'Imersif')
    .replace(/{{LORE_CONTEXT}}/g, contextData.story_context || '')
    .replace('{{OUTLINE}}', outline)
    .replace('{{CHARACTERS}}', JSON.stringify(contextData.characters || []))
    .replace('{{EVENTS}}', JSON.stringify(contextData.events || []));

  let draft = await router.generate('wordsmith', wordsmithPrompt);
  yield { type: 'log', message: 'Wordsmith selesai menulis draf awal.' };

  yield { type: 'status', agent: 'critic', status: 'reviewing' };
  yield { type: 'log', message: 'Critic sedang mengevaluasi draf...' };
  
  const criticPrompt = (configData.critic.prompt || '')
    .replace(/{{GENRE}}/g, contextData.genre || 'Fiksi')
    .replace(/{{LORE_CONTEXT}}/g, contextData.story_context || '')
    .replace('{{OUTLINE}}', outline)
    .replace('{{DRAFT}}', draft);

  const critique = await router.generate('critic', criticPrompt);
  
  const scoreMatch = critique.match(/NILAI:\s*(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 10;
  const statusMatch = critique.match(/STATUS:\s*(APPROVE|REJECT)/i);
  const isRejected = statusMatch ? statusMatch[1].toUpperCase() === 'REJECT' : score < 8;

  yield { type: 'status', agent: 'critic', status: `reviewed`, score };
  yield { type: 'log', message: `Critic memberikan nilai: ${score}/10. Status: ${isRejected ? 'REJECT' : 'APPROVE'}` };

  if (isRejected) {
    yield { type: 'status', agent: 'wordsmith', status: 'revising' };
    yield { type: 'log', message: 'Draf ditolak. Wordsmith sedang merevisi draf berdasarkan kritik...' };
    
    const revisionPrompt = (configData.wordsmith.revision_prompt || '')
      .replace(/{{GENRE}}/g, contextData.genre || 'Fiksi')
      .replace(/{{TONE}}/g, contextData.tone || 'Imersif')
      .replace('{{CRITIQUE}}', critique)
      .replace('{{DRAFT}}', draft);

    draft = await router.generate('wordsmith', revisionPrompt);
    yield { type: 'log', message: 'Wordsmith selesai merevisi draf.' };
  }

  yield { type: 'status', agent: 'lorekeeper', status: 'archiving' };
  yield { type: 'log', message: 'Lorekeeper sedang mengekstrak fakta dan pilihan...' };
  
  const lorekeeperPrompt = (configData.lorekeeper.prompt || '')
    .replace('{{DRAFT}}', draft);

  const loreDataStr = await router.generate('lorekeeper', lorekeeperPrompt);
  
  let loreData;
  try {
    const cleanedStr = loreDataStr.replace(/```json/g, '').replace(/```/g, '').trim();
    loreData = JSON.parse(cleanedStr);
  } catch (e) {
    console.error('Failed to parse Lorekeeper JSON:', e);
    loreData = {
      new_characters: [],
      new_events: ["Bab baru selesai ditulis."],
      next_choices: ["Lanjutkan perjalanan", "Istirahat sejenak", "Selidiki area sekitar"]
    };
  }

  // Update memory
  if (loreData.new_characters && Array.isArray(loreData.new_characters)) {
    contextData.characters.push(...loreData.new_characters);
  }
  if (loreData.new_events && Array.isArray(loreData.new_events)) {
    contextData.events.push(...loreData.new_events);
  }
  if (loreData.state_changes && Array.isArray(loreData.state_changes)) {
    loreData.state_changes.forEach((s: any) => {
      if (s.entity && s.current_state) {
        contextData.events.push(`Perubahan Status [${s.entity}]: ${s.current_state}`);
      }
    });
  }
  if (loreData.unresolved_mysteries && Array.isArray(loreData.unresolved_mysteries)) {
    loreData.unresolved_mysteries.forEach((m: string) => {
      contextData.events.push(`Misteri Baru: ${m}`);
    });
  }
  
  if (storyId && hasSupabase) {
    // Save to Supabase
    const chapterNumber = contextData.chapters.length + 1;
    await supabase.from('chapters').insert([{
      story_id: storyId,
      content: draft,
      chapter_number: chapterNumber,
      ai_summary: JSON.stringify(loreData)
    }]);
    
    // Remove chapters array before saving to ai_memory_state to avoid duplication
    const memoryStateToSave = { ...contextData };
    delete memoryStateToSave.chapters;
    
    await supabase.from('stories').update({
      ai_memory_state: memoryStateToSave,
      updated_at: new Date().toISOString()
    }).eq('id', storyId);
  } else {
    // Save to memory.json
    contextData.chapters.push(draft);
    await fs.writeFile(memoryPath, JSON.stringify(contextData, null, 2), 'utf-8');
  }

  yield { type: 'log', message: 'Lorekeeper selesai menyimpan ke memori.' };

  yield {
    type: 'done',
    draft,
    choices: loreData.next_choices || ["Lanjutkan perjalanan", "Istirahat sejenak", "Selidiki area sekitar"]
  };
}
