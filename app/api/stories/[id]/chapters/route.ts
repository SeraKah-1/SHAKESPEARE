import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('story_id', id)
      .order('chapter_number', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ chapters: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { content, chapter_number, ai_summary } = await request.json();

    const { data, error } = await supabase
      .from('chapters')
      .insert([{ 
        story_id: id, 
        content, 
        chapter_number, 
        ai_summary 
      }])
      .select()
      .single();

    if (error) throw error;
    
    // Update story updated_at
    await supabase.from('stories').update({ updated_at: new Date().toISOString() }).eq('id', id);

    return NextResponse.json({ chapter: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
