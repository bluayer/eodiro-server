import { EodiroQueryType, eodiroQuery } from '@/database/eodiro-query'
import { OneApiError, OneApiPayloadData } from '../../types'
import { Post, PostAttrs, initPost } from '@/database/models/post'
import { PostLike, PostLikeAttrs } from '@/database/models/post_like'
import SqlB, { Q } from '@/modules/sqlb'

import Auth from '@/modules/auth'
import { FileType } from '@/database/models/file'
import { GetPostById } from './get-post-by-id'
import { PostFileType } from '@/database/models/post_file'
import dayjs from 'dayjs'

export async function getPostById(
  data: GetPostById['data']
): Promise<GetPostById['payload']> {
  const authPayload = await Auth.isSignedUser(data.accessToken)

  if (!authPayload) {
    return {
      err: OneApiError.UNAUTHORIZED,
      data: null,
    }
  }

  const { postId } = data

  if (typeof postId !== 'number') {
    return {
      err: OneApiError.BAD_REQUEST,
      data: null,
    }
  }

  const q = Q<PostAttrs & PostLikeAttrs>()
    .select(
      '*',
      Q()
        .select('count(*)')
        .from(PostLike.tableName)
        .where()
        .equal(PostLike.attrs.post_id, postId)
        .as('likes')
    )
    .from(Post.tableName)
    .where()
    .equal(Post.attrs.id, postId)
  const result = await eodiroQuery<
    PostAttrs & PostLikeAttrs & { likes: number }
  >(q)

  if (result.length === 0) {
    return {
      err: OneApiError.NO_CONTENT,
      data: null,
    }
  }

  const postItem = result[0] as OneApiPayloadData<GetPostById>

  // Check authority when request with edit mode
  if (data.edit === true) {
    const Post = await initPost()
    const isYourPost = await Post.isOwnedBy(data.postId, authPayload.userId)
    if (!isYourPost) {
      return {
        err: OneApiError.FORBIDDEN,
        data: null,
      }
    }
  }

  // Join file and post_file
  const postFiles = await eodiroQuery<PostFileType & FileType>(
    SqlB()
      .select('*')
      .from(SqlB().join('file', 'post_file').on('file.id = post_file.file_id'))
      .where(SqlB().equal('post_id', data.postId)),
    EodiroQueryType.SELECT
  )

  if (postFiles.length > 0) {
    postItem.files = postFiles.map((postFile) => {
      return {
        fileId: postFile.file_id,
        path: `/public-user-content/${dayjs(postFile.uploaded_at).format(
          'YYYYMMDD'
        )}/${postFile.uuid}/${encodeURIComponent(postFile.file_name)}`,
        mimeType: postFile.mime,
        name: postFile.file_name,
      }
    })
  }

  return {
    err: null,
    data: postItem,
  }
}
