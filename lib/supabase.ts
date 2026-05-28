import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jnmahmgcbgishbehrbta.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpubWFobWdjYmdpc2hiZWhyYnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTkxMTMsImV4cCI6MjA5NTQ3NTExM30.7f6h_0D2VgqI9sTBwEwzwTEcnx70BdPgDi1FAtFPEcM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);