import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://yyzedjuqejcckyibwtvo.supabase.co";

const supabaseKey =
  "sb_publishable_tJjnCdC8aeWyBpjNvHl73g_6w7y0TW4";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);