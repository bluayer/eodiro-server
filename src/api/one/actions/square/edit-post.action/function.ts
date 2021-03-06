import { PostAttrs, initPost } from '@/database/models/post'
import { QueryTypes, query } from '@/database/query'

import { Action } from './interface'
import Auth from '@/modules/auth'
import { OneApiError } from '@/api/one/types'
import { PostFileType } from '@/database/models/post_file'
import SqlB from '@/modules/sqlb'
import { TableNames } from '@/database/table-names'
import Time from '@/modules/time'

export default async function (
  data: Action['data']
): Promise<Action['payload']> {
  const authPayload = await Auth.isSignedUser(data.accessToken)

  if (!authPayload) {
    return {
      err: OneApiError.UNAUTHORIZED,
    }
  }

  const Post = await initPost()
  const yourPost = await Post.isOwnedBy(data.postId, authPayload.userId)

  if (!yourPost) {
    return {
      err: OneApiError.FORBIDDEN,
    }
  }

  const title = data.title.trim()
  if (title.length === 0) {
    return {
      err: 'No Title',
    }
  }

  const body = data.body.trim()
  if (body.length === 0) {
    return {
      err: 'No Body',
    }
  }

  await query(
    SqlB<PostAttrs>()
      .update('post', {
        title,
        body,
        edited_at: Time.getCurrTime(),
      })
      .where()
      .equal('id', data.postId),
    {
      type: QueryTypes.UPDATE,
      plain: true,
    }
  )

  if (data.fileIds) {
    // Delete all connected entries in post_file
    // and insert again
    await query(
      SqlB<PostFileType>()
        .delete()
        .from(TableNames.post_file)
        .where()
        .equal('post_id', data.postId)
    )

    if (data.fileIds.length > 0) {
      await query(
        SqlB<PostFileType>().bulkInsert(
          TableNames.post_file,
          data.fileIds.map((fileId) => {
            return {
              post_id: data.postId,
              file_id: fileId,
            }
          })
        )
      )
    }
  }

  return {
    err: null,
  }
}
