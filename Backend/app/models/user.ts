import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import ApiKey from './api_key.js'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export type UserPlan = 'free' | 'pro' | 'enterprise'

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare isActive: boolean

  // ============================================
  // Champs de plan et facturation
  // ============================================

  @column()
  declare plan: UserPlan

  @column()
  declare invoicesUsedThisMonth: number

  @column()
  declare creditBalance: number // en centimes

  @column.dateTime()
  declare subscriptionEndsAt: DateTime | null

  @column.dateTime()
  declare usageResetAt: DateTime | null

  @column()
  declare stripeCustomerId: string | null

  @column()
  declare paypalCustomerId: string | null

  // ============================================
  // Champs Stripe Subscription
  // ============================================

  @column()
  declare stripeSubscriptionId: string | null

  @column()
  declare stripePriceId: string | null

  @column()
  declare subscriptionStatus: string | null

  @column.dateTime()
  declare currentPeriodStart: DateTime | null

  @column.dateTime()
  declare currentPeriodEnd: DateTime | null

  @column()
  declare cancelAtPeriodEnd: boolean

  // ============================================
  // Timestamps
  // ============================================

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // ============================================
  // Relations
  // ============================================

  @hasMany(() => ApiKey)
  declare apiKeys: HasMany<typeof ApiKey>

  // Provider pour les access tokens
  static accessTokens = DbAccessTokensProvider.forModel(User)

  // ============================================
  // Méthodes utilitaires
  // ============================================

  /**
   * Vérifie si l'abonnement Pro/Enterprise est actif
   */
  hasActiveSubscription(): boolean {
    if (this.plan === 'free') return false
    if (!this.subscriptionEndsAt) return false
    return this.subscriptionEndsAt > DateTime.now()
  }

  /**
   * Vérifie si l'utilisateur peut générer des factures
   * Free: 1 facture max
   * Pro/Enterprise: illimité pendant l'abonnement
   * Sans abonnement: utilisation du crédit
   */
  canGenerateInvoices(count: number = 1): { allowed: boolean; reason?: string } {
    // Plan Free: max 1 facture
    if (this.plan === 'free') {
      if (this.invoicesUsedThisMonth >= 1) {
        return { allowed: false, reason: 'Limite gratuite atteinte (1 facture). Passez au plan Pro.' }
      }
      if (count > 1) {
        return { allowed: false, reason: 'Le plan gratuit ne permet qu\'une seule facture.' }
      }
      return { allowed: true }
    }

    // Plan Pro/Enterprise avec abonnement actif
    if (this.hasActiveSubscription()) {
      return { allowed: true }
    }

    // Sans abonnement: facturation au crédit
    const costCents = count * 10 // 10 centimes par facture
    if (this.creditBalance >= costCents) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: `Crédit insuffisant. Requis: ${costCents / 100}€, Disponible: ${this.creditBalance / 100}€`,
    }
  }

  /**
   * Déduit le coût des factures du crédit ou incrémente le compteur
   */
  async chargeForInvoices(count: number): Promise<void> {
    if (this.plan === 'free' || this.hasActiveSubscription()) {
      // Juste incrémenter le compteur
      this.invoicesUsedThisMonth += count
    } else {
      // Déduire du crédit
      const costCents = count * 10
      this.creditBalance -= costCents
      this.invoicesUsedThisMonth += count
    }
    await this.save()
  }

  /**
   * Reset mensuel du compteur (à appeler via cron job)
   */
  async resetMonthlyUsage(): Promise<void> {
    this.invoicesUsedThisMonth = 0
    this.usageResetAt = DateTime.now()
    await this.save()
  }
}
