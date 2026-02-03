// Cloudflare Pages Function - GET /api/streams
export async function onRequest(context: any) {
  const { env } = context;

  try {
    // D1 데이터베이스에서 라이브 스트림 목록 조회
    const result = await env.DB.prepare(`
      SELECT 
        id,
        title,
        description,
        youtube_video_id,
        seller_name,
        seller_profile_image,
        viewer_count
      FROM streams
      WHERE is_active = 1
      ORDER BY created_at DESC
    `).all();

    return new Response(
      JSON.stringify({
        success: true,
        data: result.results || []
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
