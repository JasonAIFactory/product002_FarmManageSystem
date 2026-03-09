import { createClient } from "@supabase/supabase-js";

// CORE_CANDIDATE — reusable file upload to Supabase Storage

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET = "photos";

export async function uploadImage(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const path = `${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
