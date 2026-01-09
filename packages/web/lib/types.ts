export interface Post {
  id: string;
  message: string;
  author?: string;
  model?: string;
  tags?: string[];
  slug: string;
  publishedAt: string;
  featured: boolean;
}

export interface PostsResponse {
  posts: Post[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
