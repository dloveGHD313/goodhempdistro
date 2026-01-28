export type MascotPostResult = {
  title: string;
  subtitle?: string | null;
  href: string;
  meta?: string | null;
};

export async function searchFeedPosts(): Promise<MascotPostResult[]> {
  return [];
}
