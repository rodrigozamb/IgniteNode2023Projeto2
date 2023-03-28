import { FastifyInstance } from 'fastify'
import { knex } from '../database'
import { string, z } from 'zod'
import { randomUUID } from 'node:crypto'
import { checkSessionIdExists } from '../middlewares/check-session-id-exists'

export async function transactionsRoutes(app: FastifyInstance) {
  app.get(
    '/',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request) => {
      const { sessionId } = request.cookies

      const transactions = await knex('transactions')
        .where('session_id', sessionId)
        .select()

      return { transactions }
    },
  )

  app.get('/:id', { preHandler: [checkSessionIdExists] }, async (req) => {
    const getParamsSchema = z.object({
      id: string().uuid(),
    })

    const { id } = getParamsSchema.parse(req.params)
    const { sessionId } = req.cookies

    const transaction = await knex('transactions')
      .where({ id, session_id: sessionId })
      .first()
    return { transaction }
  })

  app.get('/summary', { preHandler: [checkSessionIdExists] }, async (req) => {
    const { sessionId } = req.cookies
    const summary = await knex('transactions')
      .where('session_id', sessionId)
      .sum('amount', { as: 'amount' })
      .first()
    return { summary }
  })

  app.post('/', async (req, reply) => {
    const createTransactionSchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(['credit', 'debit']),
    })

    const { amount, title, type } = createTransactionSchema.parse(req.body)

    let sessionId = req.cookies.sessionId
    if (!sessionId) {
      sessionId = randomUUID()
      reply.cookie('sessionId', sessionId, {
        path: '/',
        maxAge: 100 * 60 * 60 * 27, // days
      })
    }

    await knex('transactions').insert({
      id: randomUUID(),
      title,
      amount: type === 'credit' ? amount : amount * -1,
      session_id: sessionId,
    })

    return reply.status(201).send()
  })
}
