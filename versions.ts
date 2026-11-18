import type {
  VersionResolver,
  VersionResolverContext,
} from "@kubekpanel/blueprint-sdk";

const apiHost = ["api", "github", "com"].join(".");
const dlHost = ["github", "com"].join(".");
const owner = "HarpyWar";
const repo = "nfsuserver";

const API_URL = `https://${apiHost}/repos/${owner}/${repo}/releases`;
const FALLBACK_URL = `https://${dlHost}/${owner}/${repo}/releases/download/1.0.5/nfsuserver.1.0.5.linux.static.tar.gz`;

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: GithubAsset[];
}

async function fetchReleases(
  ctx: VersionResolverContext,
): Promise<GithubRelease[]> {
  const res = await ctx.fetch(API_URL, {
    headers: {
      "User-Agent": "Kubek",
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return (data as GithubRelease[]).filter(
    (r) =>
      !r.draft &&
      !r.prerelease &&
      r.assets.some((a) => a.name.toLowerCase().includes("linux")),
  );
}

const resolver: VersionResolver = {
  async listVersions(ctx: VersionResolverContext) {
    try {
      const releases = await fetchReleases(ctx);
      if (releases.length > 0) {
        return releases.map((r) => ({
          id: r.tag_name,
          label: `NFSU Server ${r.tag_name}`,
        }));
      }
    } catch {
      // Fallback при сетевой ошибке
    }

    return [{ id: "1.0.5", label: "NFSU Server 1.0.5" }];
  },

  async resolveDownload(version: string, ctx: VersionResolverContext) {
    try {
      const releases = await fetchReleases(ctx);
      const target =
        !version || version === "latest"
          ? releases[0]
          : releases.find((r) => r.tag_name === version) ?? releases[0];

      const asset =
        target?.assets.find(
          (a) =>
            a.name.toLowerCase().includes("linux") &&
            a.name.toLowerCase().includes("static"),
        ) ??
        target?.assets.find((a) => a.name.toLowerCase().includes("linux"));

      if (asset) {
        return {
          url: asset.browser_download_url,
          unpack: true,
        };
      }
    } catch {
      // Fallback к прямой ссылке на 1.0.5
    }

    return {
      url: FALLBACK_URL,
      unpack: true,
    };
  },
};

export default resolver;
