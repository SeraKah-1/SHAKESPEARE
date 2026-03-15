import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string, chapterNumber: string }> }) {
  try {
    const { id, chapterNumber } = await params;
    const { content } = await request.json();

    const { data, error } = await supabase
      .from('chapters')
      .update({ content })
      .eq('story_id', id)
      .eq('chapter_number', parseInt(chapterNumber))
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ chapter: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string, chapterNumber: string }> }) {
  try {
    const { id, chapterNumber } = await params;
    
    // Delete the chapter
    const { error: deleteError } = await supabase
      .from('chapters')
      .delete()
      .eq('story_id', id)
      .eq('chapter_number', parseInt(chapterNumber));

    if (deleteError) throw deleteError;

    // Update chapter_number for remaining chapters
    const { data: chaptersToUpdate, error: fetchToUpdateError } = await supabase
      .from('chapters')
      .select('id, chapter_number')
      .eq('story_id', id)
      .gt('chapter_number', parseInt(chapterNumber))
      .order('chapter_number', { ascending: true });

    if (!fetchToUpdateError && chaptersToUpdate) {
      for (const chapter of chaptersToUpdate) {
        await supabase
          .from('chapters')
          .update({ chapter_number: chapter.chapter_number - 1 })
          .eq('id', chapter.id);
      }
    }

    // Fetch remaining chapters to rebuild ai_memory_state
    const { data: remainingChapters, error: fetchError } = await supabase
      .from('chapters')
      .select('ai_summary')
      .eq('story_id', id)
      .order('chapter_number', { ascending: true });

    if (fetchError) throw fetchError;

    // Rebuild memory
    const newMemory: any = {
      story_context: "",
      characters: [],
      events: []
    };

    // Fetch story to get base context
    const { data: storyData } = await supabase.from('stories').select('ai_memory_state').eq('id', id).single();
    if (storyData?.ai_memory_state?.story_context) {
      newMemory.story_context = storyData.ai_memory_state.story_context;
    }

    if (remainingChapters) {
      for (const chapter of remainingChapters) {
        if (chapter.ai_summary) {
          try {
            const summary = typeof chapter.ai_summary === 'string' ? JSON.parse(chapter.ai_summary) : chapter.ai_summary;
            if (summary.new_characters) newMemory.characters.push(...summary.new_characters);
            if (summary.new_events) newMemory.events.push(...summary.new_events);
          } catch (e) {
            console.error('Error parsing chapter summary', e);
          }
        }
      }
    }

    // Update story with new memory
    await supabase.from('stories').update({
      ai_memory_state: newMemory,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    return NextResponse.json({ success: true, newMemory });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
