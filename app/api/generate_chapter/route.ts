import { runChapterLoopGenerator } from '@/lib/agent_workflow';

export async function POST(request: Request) {
  try {
    const { userChoice, storyId, memory } = await request.json();
    
    if (!userChoice) {
      return new Response(JSON.stringify({ error: 'userChoice is required' }), { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of runChapterLoopGenerator(userChoice, storyId, memory)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
        } catch (e: any) {
          console.error('Error in generator:', e);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error generating chapter:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
