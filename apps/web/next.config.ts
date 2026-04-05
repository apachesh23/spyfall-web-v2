import path from "node:path";
import type { NextConfig } from "next";

/** Корень монорепо (где лежит общий `node_modules`). */
const repoRoot = path.join(__dirname, "../..");
/** Абсолютный путь для webpack; Turbopack — только относительный путь от `root`. */
const colyseusSchemaAbs = path.join(repoRoot, "node_modules", "@colyseus", "schema");

const nextConfig: NextConfig = {
  transpilePackages: ["@spyfall/shared"],
  turbopack: {
    root: repoRoot,
    /**
     * Одна копия @colyseus/schema в бандле. Только относительный путь — иначе Turbopack на Windows:
     * «windows imports are not implemented yet» на абсолютном `E:\...`.
     */
    resolveAlias: {
      "@colyseus/schema": "./node_modules/@colyseus/schema",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@colyseus/schema": colyseusSchemaAbs,
    };
    return config;
  },
};

export default nextConfig;
