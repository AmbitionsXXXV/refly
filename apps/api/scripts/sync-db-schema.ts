import { execSync } from 'child_process';

console.log(process.env.DATABASE_URL);
execSync(
  `npx prisma migrate diff --from-url '${process.env.DATABASE_URL}' --to-schema-datamodel prisma/schema.prisma --script | npx prisma db execute --stdin`,
  { stdio: 'inherit' },
);
