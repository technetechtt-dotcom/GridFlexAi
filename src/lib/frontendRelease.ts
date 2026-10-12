/**
 * Frontend build release identity (Vite-injected at build time).
 * Set on Render static site: VITE_RELEASE_GIT_SHA (and optional digest/build id).
 */
export type FrontendReleaseIdentity = {
  gitSha: string | null;
  imageDigest: string | null;
  buildId: string | null;
  publicOrigin: string | null;
};

export function getFrontendReleaseIdentity(): FrontendReleaseIdentity {
  const sha = (import.meta.env.VITE_RELEASE_GIT_SHA as string | undefined)?.trim() || null;
  const digest = (import.meta.env.VITE_RELEASE_IMAGE_DIGEST as string | undefined)?.trim() || null;
  const buildId = (import.meta.env.VITE_RELEASE_BUILD_ID as string | undefined)?.trim() || null;
  const publicOrigin = (import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined)?.trim() || null;
  return { gitSha: sha, imageDigest: digest, buildId, publicOrigin };
}

export function shortSha(sha: string | null): string {
  if (!sha) return 'unpinned';
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}
