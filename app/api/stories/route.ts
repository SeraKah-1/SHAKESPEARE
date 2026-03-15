import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('stories')
      .select('*, collections(name)')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ stories: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, tags, collection_id } = await request.json();
    
    // Initial memory state for a new story
    const initialMemoryState = {
      story_context: "",
      genre: "Sci-Fi",
      tone: "Dark",
      theme: "Survival",
      characters: [],
      events: [],
      chapters: []
    };

    const { data, error } = await supabase
      .from('stories')
      .insert([{ 
        title: title || 'Untitled Story', 
        tags: tags || [], 
        collection_id: collection_id || null,
        ai_memory_state: initialMemoryState
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ story: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
