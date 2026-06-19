import type { Context } from 'hono'
import type { Env } from './index'
import type { Comment } from './html'

export async function getComments(c: Context<{ Bindings: Env }>, postId: number) {
  const { results } = await c.env.DB.prepare('SELECT * FROM comments WHERE post_id=? ORDER BY created_at ASC').bind(postId).all<Comment>()
  return results
}

export async function addComment(c: Context<{ Bindings: Env }>, postId: number, author: string, body: string, userId: number) {
  await c.env.DB.prepare('INSERT INTO comments (post_id,author,body,user_id) VALUES (?,?,?,?)').bind(postId, author, body, userId).run()
}

export async function deleteComment(c: Context<{ Bindings: Env }>, id: number) {
  await c.env.DB.prepare('DELETE FROM comments WHERE id=?').bind(id).run()
}
