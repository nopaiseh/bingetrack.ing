const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingVariables.length > 0) {
  console.error(
    `Missing required environment variables: ${missingVariables.join(", ")}`,
  );
  process.exit(1);
}

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SITE_URL"]) {
  if (!process.env[name]) continue;
  try {
    new URL(process.env[name]);
  } catch {
    console.error(`${name} must be a valid absolute URL.`);
    process.exit(1);
  }
}

console.log("Required application environment variables are present.");
