// The only Node global the build config reads; avoids pulling in all of @types/node.
declare const process: { env: Record<string, string | undefined> };
