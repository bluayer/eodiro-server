import { OneApiFunction, OneApiPayloadData } from '@/api/one/types'
import { Post, postAttrs } from '@/database/models/post'

import { Action } from './interface'
import { ArrayUtil } from '@/modules/utils/array-util'
import { Comment } from '@/database/models/comment'
import { GetRecentPostsOfBoard } from '../..'
import { PostLike } from '@/database/models/post_like'
import { Q } from '@/modules/sqlb'
import _ from 'lodash'
import { eodiroQuery } from '@/database/eodiro-query'

const func: OneApiFunction<Action> = async (data) => {
  const { boardId, mostRecentPostId, noBody } = data

  // Fetch all columns if no columns specified
  const columns = data.columns || postAttrs

  if (noBody) {
    _.pullAllWith(columns, ['body'], _.isEqual)
  } else {
    ArrayUtil.replace(columns, 'body', 'substring(body, 1, 100) as body')
  }

  const q = Q()
    .select(
      ...columns,
      Q()
        .select('count(*)')
        .from(Comment.tableName)
        .where(
          `${Comment.tableName}.${Comment.attrs.post_id} = ${Post.tableName}.${Post.attrs.id}`
        )
        .as('comment_count')
    )
    .from(
      Q()
        .join(
          Post.tableName,
          Q()
            .select(PostLike.attrs.post_id, 'count(*) as likes')
            .from(PostLike.tableName)
            .group(PostLike.attrs.post_id)
            .bind('t')
            .build(),
          'left'
        )
        .on(`${Post.tableName}.${Post.attrs.id} = t.${PostLike.attrs.post_id}`)
    )
    .where()
    .equal(Post.attrs.board_id, boardId)
    .andMore(Post.attrs.id, mostRecentPostId)
    .order(Post.attrs.id, 'DESC')

  const result = await eodiroQuery(q)

  return {
    err: null,
    data: result as OneApiPayloadData<GetRecentPostsOfBoard>,
  }
}

export default func
