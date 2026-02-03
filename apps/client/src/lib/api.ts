import { treaty } from '@elysiajs/eden'
import type { App } from '../../../server/src/index'

export const api = treaty<App>('localhost:3001');