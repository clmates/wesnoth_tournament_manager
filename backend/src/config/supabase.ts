import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Use service role key for backend operations (full access)
// This is safe because it runs on a private server
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Helper function to upload replay to Supabase Storage
// Expects caller to provide the final filename (including extension) to avoid double extensions
export async function uploadReplayToSupabase(
  storedFilename: string,
  fileBuffer: Buffer
): Promise<{ path: string; url: string }> {
  try {
    console.log('📤 [SUPABASE] Uploading replay to Supabase:', storedFilename);
    console.log('📤 [SUPABASE] File size:', fileBuffer.length, 'bytes');

    const { data, error } = await supabase.storage
      .from('replays')
      .upload(storedFilename, fileBuffer, {
        contentType: 'application/gzip',
        upsert: false, // Don't overwrite if exists
      });

    if (error) {
      console.error('❌ [SUPABASE] Upload failed:', error.message);
      throw error;
    }

    console.log('✅ [SUPABASE] Upload successful:', data.path);

    // Get the public URL if bucket is public, or generate signed URL if private
    const { data: publicData } = supabase.storage
      .from('replays')
      .getPublicUrl(storedFilename);

    return {
      path: data.path,
      url: publicData.publicUrl,
    };
  } catch (error) {
    console.error('❌ [SUPABASE] Error uploading replay:', error);
    throw error;
  }
}

// Helper function to download replay from Supabase Storage
export async function downloadReplayFromSupabase(
  filename: string
): Promise<Buffer> {
  try {
    console.log('📥 [SUPABASE] Downloading replay from Supabase:', filename);

    const { data, error } = await supabase.storage
      .from('replays')
      .download(filename);

    if (error) {
      console.error('❌ [SUPABASE] Download failed:', error.message);
      throw error;
    }

    if (!data) {
      console.error('❌ [SUPABASE] No data returned from download');
      throw new Error('No data returned from Supabase');
    }

    const buffer = await data.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);
    console.log('✅ [SUPABASE] Download successful, size:', fileBuffer.length, 'bytes');

    return fileBuffer;
  } catch (error) {
    console.error('❌ [SUPABASE] Error downloading replay:', error);
    throw error;
  }
}

// Helper function to delete replay from Supabase Storage
export async function deleteReplayFromSupabase(filename: string): Promise<void> {
  try {
    console.log('🗑️ [SUPABASE] Deleting replay from Supabase:', filename);

    const { error } = await supabase.storage.from('replays').remove([filename]);

    if (error) {
      console.error('❌ [SUPABASE] Delete failed:', error.message);
      throw error;
    }

    console.log('✅ [SUPABASE] Delete successful:', filename);
  } catch (error) {
    console.error('❌ [SUPABASE] Error deleting replay:', error);
    throw error;
  }
}
