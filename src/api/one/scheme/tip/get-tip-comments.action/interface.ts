import { AuthRequired, OneApiError } from '@/api/one/types'

import { TipCommentsResponse } from '@/database/models/tip_comment'

export interface Action {
  data: AuthRequired<{
    tipId: number
    lastCommentId: number
  }>
  payload: {
    err: OneApiError
    data: {
      tipComments: TipCommentsResponse[]
      totalCount: number
    }
  }
}