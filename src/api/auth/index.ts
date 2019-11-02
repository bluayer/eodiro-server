import express from 'express'
import Auth from '@/modules/auth'
import { SignUpInfo } from '@/modules/auth'

const router = express.Router()

// Sign up
router.post('/signup', async (req, res) => {
  const signUpInfo: SignUpInfo = req.body
  const { portalId, nickname, password } = signUpInfo
  const validations = {
    portalId:
      (await Auth.isValidPortalId(portalId)) &&
      Auth.isValidPortalIdFormat(portalId),
    nickname: await Auth.isValidNickname(nickname),
    password: Auth.isValidPassword(password)
  }

  if (validations.portalId && validations.password && validations.nickname) {
    const signUpResult = await Auth.signUp(signUpInfo)

    if (signUpResult) {
      res.sendStatus(201)
    } else {
      res.sendStatus(500)
    }
  } else {
    res.status(409).json(validations)
  }
})

// Verify pending user
router.get('/verify', async (req, res) => {
  const requestData = req.body
  const result = await Auth.verifyPendingUser(requestData.token)
  res.json(result)
})

// Sign in
router.get('/signin', async (req, res) => {
  const isSucceeded = await Auth.signIn(req.session, req.body)
  if (isSucceeded) {
    res.sendStatus(200)
  } else {
    res.sendStatus(401)
  }
})

// Sign out
router.get('/signout', (req, res) => {
  Auth.signOut(req.session)
})

export default router