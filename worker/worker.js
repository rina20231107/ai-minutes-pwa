const ALLOWED_ORIGIN = 'https://rina20231107.github.io';
const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin'
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    if (origin !== ALLOWED_ORIGIN) return Response.json({ error: 'Origin not allowed' }, { status: 403, headers: corsHeaders(origin) });
    if (!env.OPENAI_API_KEY) return Response.json({ error: 'Server is not configured' }, { status: 500, headers: corsHeaders(origin) });
    try {
      const incoming = await request.formData();const file = incoming.get('file');
      if (!(file instanceof File)) return Response.json({ error: '音声ファイルがありません' }, { status: 400, headers: corsHeaders(origin) });
      if (file.size > 25 * 1024 * 1024) return Response.json({ error: '音声ファイルは25MB以下にしてください' }, { status: 413, headers: corsHeaders(origin) });
      const body = new FormData();body.append('file', file, file.name || 'recording.m4a');body.append('model', 'gpt-4o-mini-transcribe');body.append('language', incoming.get('language') || 'ja');body.append('prompt', '日本語の会議、研修、打ち合わせの文字起こしです。固有名詞、数字、専門用語をできるだけ正確に記録してください。');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body });
      const result = await response.json();
      if (!response.ok) return Response.json({ error: result?.error?.message || 'OpenAI APIでエラーが発生しました' }, { status: response.status, headers: corsHeaders(origin) });
      return Response.json({ text: result.text || '' }, { headers: { ...corsHeaders(origin), 'Cache-Control': 'no-store' } });
    } catch { return Response.json({ error: '文字起こし処理に失敗しました' }, { status: 500, headers: corsHeaders(origin) }); }
  }
};
